#!/usr/bin/env python3
"""
Collecteur d'offres V.I.E — Business France (mon-vie-via / Civiweb).

Le site mon-vie-via.businessfrance.fr est une application JavaScript : le HTML
ne contient aucune offre. Les données viennent de l'API publique qui l'alimente
(civiweb-api-prd.azurewebsites.net). Ce script interroge cette API, note chaque
offre selon le référentiel ENSICAEN Matériaux & Mécanique, et écrit
data/offers.json consommé par le site.

L'API n'est pas documentée publiquement et son schéma peut changer. Le script
essaie donc plusieurs formats de requête connus et s'arrête au premier qui
répond. En cas d'échec total, `--discover` affiche les réponses brutes pour
identifier le format à ajouter dans PAYLOAD_VARIANTS.

Usage :
    python collect.py                    # collecte + scoring + écriture
    python collect.py --discover         # diagnostic de l'API, aucune écriture
    python collect.py --threshold 35     # ne garder que les offres >= 35/100
    python collect.py --max-pages 40     # limiter la profondeur de collecte
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("Dépendance manquante : pip install requests")

from profile import AXES, DEFAULT_THRESHOLD
from scoring import families_catalog, label_for, score_offer, scoring_constants

API_BASE = "https://civiweb-api-prd.azurewebsites.net/api"
SEARCH_PATHS = ["/Offers/search", "/Offers/Search"]
OFFER_PAGE = "https://mon-vie-via.businessfrance.fr/offres/{id}"

# L'API exige un en-tête X-API-KEY. Ce n'est pas un identifiant personnel :
# c'est une clé fixe intégrée au code JavaScript public de
# mon-vie-via.businessfrance.fr, envoyée à l'identique par le navigateur de
# chaque visiteur, sans connexion. On envoie donc exactement ce que le site
# envoie lui-même pour consulter des annonces publiques.
#
# La clé peut être placée dans un fichier « cle-api.txt » à la racine du
# projet : c'est la méthode recommandée, elle évite toute faute de recopie.
# Sinon, la valeur ci-dessous est utilisée.
API_KEY_FALLBACK = "I+KwpoLPiXIsjxNT/NQ2iOFz8+iuygxAODs9FeAEWYM="

KEY_FILE = os.path.join(os.path.dirname(__file__), "..", "cle-api.txt")


def load_api_key():
    """
    Clé d'API, cherchée dans cet ordre :

    1. variable d'environnement VIE_API_KEY — utilisée par GitHub Actions, qui
       la lit depuis un « secret » du dépôt. C'est la seule méthode acceptable
       en ligne : le dépôt étant public, la clé ne doit jamais y figurer.
    2. fichier cle-api.txt — usage local uniquement. Ce fichier est exclu du
       dépôt par .gitignore et ne doit jamais être publié.
    3. valeur intégrée au script, en dernier recours.
    """
    env_key = os.environ.get("VIE_API_KEY", "").strip()
    if env_key:
        return env_key, "variable d'environnement VIE_API_KEY"
    try:
        with open(KEY_FILE, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line, "cle-api.txt"
    except OSError:
        pass
    return API_KEY_FALLBACK, "valeur intégrée au script"


def key_variants(key, limit=32):
    """
    Variantes de la clé sur les caractères visuellement ambigus.

    Une clé recopiée depuis une capture d'écran confond facilement le I
    majuscule et le l minuscule, qui se ressemblent dans la plupart des
    polices. On teste donc les combinaisons plausibles plutôt que d'échouer
    sur une faute d'un seul caractère.
    """
    positions = [i for i, c in enumerate(key) if c in "Il"]
    if not positions or 2 ** len(positions) > limit:
        return [key]
    variants = []
    for mask in range(2 ** len(positions)):
        chars = list(key)
        for bit, pos in enumerate(positions):
            chars[pos] = "I" if (mask >> bit) & 1 else "l"
        variants.append("".join(chars))
    # La clé telle qu'écrite reste testée en premier
    variants.remove(key)
    return [key] + variants


API_KEY, API_KEY_SOURCE = load_api_key()

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://mon-vie-via.businessfrance.fr",
    "Referer": "https://mon-vie-via.businessfrance.fr/",
    "X-API-KEY": API_KEY,
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    ),
}

PAGE_SIZE = 100
REQUEST_DELAY = 1.2  # secondes entre deux appels — on reste poli avec l'API

# Formats de requête essayés dans l'ordre. Le premier qui renvoie une liste
# d'offres gagne. `{skip}` et `{limit}` sont substitués à l'exécution.
PAYLOAD_VARIANTS = [
    {
        "_name": "civiweb-v1",
        "limit": "{limit}", "skip": "{skip}", "query": "",
        "activitySectorId": [], "missionsTypeIds": [], "missionsDurations": [],
        "gerographicZones": [], "countriesIds": [], "specializationsIds": [],
        "entreprisesIds": [], "studiesLevelIds": [],
    },
    {"_name": "minimal-limit-skip", "limit": "{limit}", "skip": "{skip}"},
    {"_name": "page-size", "pageSize": "{limit}", "pageNumber": "{page}"},
    {"_name": "take-skip", "take": "{limit}", "skip": "{skip}", "query": ""},
]

# Clés possibles pour la liste de résultats dans la réponse
RESULT_KEYS = ["result", "results", "data", "items", "offers", "value", "list"]
TOTAL_KEYS = ["count", "total", "totalCount", "totalItems", "nbResults"]

# Correspondance champ normalisé -> clés possibles renvoyées par l'API
FIELD_MAP = {
    "id": ["id", "offerId", "idOffre", "offreId"],
    "title": ["missionTitle", "title", "titre", "jobTitle", "intitule", "name"],
    "company": ["organizationName", "companyName", "entreprise", "company",
                "organisation", "societe", "raisonSociale"],
    "country": ["countryName", "country", "pays", "paysNom"],
    "city": ["cityName", "city", "ville", "localisation", "town"],
    "description": ["missionDescription", "description", "descriptif",
                    "missionDetail", "content", "jobDescription"],
    "mission": ["missionObjectives", "mission", "objectifs", "missions"],
    "profile": ["candidateProfile", "profil", "profile", "requiredProfile",
                "competences", "skills", "missionProfile", "profilRecherche",
                "candidateDescription", "requirements", "qualifications"],
    "duration": ["missionDuration", "duration", "duree", "durationMonths"],
    "start_date": ["missionStartDate", "startDate", "dateDebut", "beginDate",
                   "missionBeginDate", "dateDebutMission"],
    "end_date": ["missionEndDate", "endDate", "dateFin", "missionFinishDate"],
    "expiry_date": ["expirationDate", "dateExpiration", "dateLimite",
                    "closingDate", "limitDate", "publicationEndDate",
                    "offerEndDate", "dateFinPublication", "applicationDeadline",
                    "deadLine", "deadline"],
    "publish_date": ["creationDate", "publishDate", "datePublication",
                     "publicationDate", "createdAt"],
    "sector": ["activitySector", "sector", "secteur", "sectorName",
               "activitySectorName"],
    "specialization": ["specialization", "specialite", "specializationName",
                       "studyField", "domaine"],
    "contract": ["missionType", "contractType", "typeContrat", "type"],
}


def pick(record, keys):
    """Récupère la première clé présente, insensible à la casse."""
    lowered = {str(k).lower(): v for k, v in record.items()}
    for key in keys:
        val = lowered.get(key.lower())
        if val not in (None, "", [], {}):
            if isinstance(val, dict):
                for sub in ("name", "label", "libelle", "value", "text"):
                    if val.get(sub):
                        return val[sub]
                continue
            if isinstance(val, list):
                parts = [p if isinstance(p, str) else
                         (p.get("name") or p.get("label") or "") if isinstance(p, dict) else ""
                         for p in val]
                parts = [p for p in parts if p]
                if parts:
                    return ", ".join(parts)
                continue
            return val
    return ""


def build_payload(variant, skip, limit, page):
    payload = {}
    for key, value in variant.items():
        if key == "_name":
            continue
        if isinstance(value, str):
            value = (value.replace("{limit}", str(limit))
                          .replace("{skip}", str(skip))
                          .replace("{page}", str(page)))
            if value.isdigit():
                value = int(value)
        payload[key] = value
    return payload


def extract_records(payload):
    """Trouve la liste d'offres dans une réponse de forme inconnue."""
    if isinstance(payload, list):
        return payload, len(payload)
    if not isinstance(payload, dict):
        return [], 0
    total = 0
    for key in TOTAL_KEYS:
        for actual in payload:
            if actual.lower() == key.lower() and isinstance(payload[actual], int):
                total = payload[actual]
                break
        if total:
            break
    for key in RESULT_KEYS:
        for actual in payload:
            if actual.lower() == key.lower() and isinstance(payload[actual], list):
                return payload[actual], total or len(payload[actual])
    # Dernier recours : la première valeur qui est une liste de dicts
    for value in payload.values():
        if isinstance(value, list) and value and isinstance(value[0], dict):
            return value, total or len(value)
    return [], total


def negotiate(session, verbose=True):
    """Trouve (path, variant) qui fonctionne. Retourne None si aucun ne marche."""
    statuses = set()
    for path in SEARCH_PATHS:
        for variant in PAYLOAD_VARIANTS:
            url = API_BASE + path
            payload = build_payload(variant, skip=0, limit=5, page=1)
            try:
                resp = session.post(url, json=payload, timeout=30)
            except requests.RequestException as exc:
                if verbose:
                    print(f"  [x] {path} / {variant['_name']} : {exc}")
                continue
            statuses.add(resp.status_code)
            if resp.status_code != 200:
                if verbose:
                    detail = resp.text[:160].replace("\n", " ")
                    print(f"  [x] {path} / {variant['_name']} : "
                          f"HTTP {resp.status_code} {detail}")
                continue
            try:
                body = resp.json()
            except ValueError:
                if verbose:
                    print(f"  [x] {path} / {variant['_name']} : réponse non-JSON")
                continue
            records, total = extract_records(body)
            if records:
                if verbose:
                    print(f"  [ok] {path} / {variant['_name']} : "
                          f"{len(records)} offres, total annoncé {total}")
                return path, variant, body
            if verbose:
                print(f"  [x] {path} / {variant['_name']} : 200 mais aucune offre trouvée")
            time.sleep(0.5)
    return None, statuses


def fetch_all(session, path, variant, max_pages):
    offers, seen = [], set()
    for page in range(max_pages):
        payload = build_payload(variant, skip=page * PAGE_SIZE,
                                limit=PAGE_SIZE, page=page + 1)
        resp = session.post(API_BASE + path, json=payload, timeout=45)
        resp.raise_for_status()
        records, total = extract_records(resp.json())
        if not records:
            break
        new = 0
        for rec in records:
            key = str(pick(rec, FIELD_MAP["id"]) or rec.get("missionTitle", "") + str(page))
            if key in seen:
                continue
            seen.add(key)
            offers.append(rec)
            new += 1
        print(f"  page {page + 1} : {len(records)} reçues, {new} nouvelles "
              f"(cumul {len(offers)})")
        if new == 0 or len(records) < PAGE_SIZE:
            break
        if total and len(offers) >= total:
            break
        time.sleep(REQUEST_DELAY)
    return offers


BOILERPLATE = [
    r"le\s+v\.?i\.?e\.?\s+est\s+un\s+dispositif",
    r"business\s+france\s+est\s+l['’]agence",
    r"candidature\s+en\s+ligne",
    r"merci\s+de\s+postuler",
    r"toutes\s+nos\s+offres\s+sont",
]


def clean_text(text):
    """Retire le balisage HTML et normalise les espaces d'une annonce."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>|</p>|</li>|</div>", "\n", str(text), flags=re.I)
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (text.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">")
                .replace("&#39;", "'").replace("&quot;", '"'))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def truncate_sentences(text, limit):
    """Coupe à la fin d'une phrase plutôt qu'au milieu d'un mot."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in (". ", ".\n", " • ", "\n"):
        pos = cut.rfind(sep)
        if pos > limit * 0.55:
            return cut[:pos + 1].strip() + " […]"
    return cut.rsplit(" ", 1)[0].strip() + " […]"


def build_summary(description, mission, profile_text, limit=1100):
    """
    Synthèse du poste : description et mission réunies, débarrassées de la
    section « profil recherché » affichée séparément et des mentions
    génériques sur le dispositif V.I.E, puis tronquée proprement.

    Vise une quinzaine de lignes : assez pour juger l'intérêt d'une offre,
    assez court pour ne pas alourdir la page.
    """
    parts = [clean_text(description), clean_text(mission)]
    text = "\n\n".join(p for p in parts if p)
    if not text:
        return ""

    # Ne pas répéter le profil déjà mis en avant
    if profile_text:
        head = profile_text[:80]
        idx = text.find(head)
        if idx > 40:
            for pattern in PROFILE_HEADINGS:
                m = re.search(r"(?:^|\n|\.|:)\s*[-•*\s]*" + pattern,
                              text[:idx], re.IGNORECASE)
                if m:
                    idx = min(idx, m.start())
            text = text[:idx].strip()

    for pattern in BOILERPLATE:
        m = re.search(pattern, text, re.IGNORECASE)
        if m and m.start() > 200:
            text = text[:m.start()].strip()

    return truncate_sentences(text.strip(), limit)



# Intitulés de section utilisés par les entreprises pour décrire le profil
# attendu. Quand l'API ne renvoie pas de champ dédié, on découpe la
# description sur ces intitulés.
PROFILE_HEADINGS = [
    r"profil\s+recherch[ée]", r"votre\s+profil", r"profil\s+du\s+candidat",
    r"profil\s+souhait[ée]", r"le\s+profil", r"comp[ée]tences\s+requises",
    r"comp[ée]tences\s+attendues", r"qualifications?\s+requises?",
    r"candidate\s+profile", r"your\s+profile", r"required\s+profile",
    r"desired\s+profile", r"requirements", r"qualifications",
    r"skills?\s+required", r"who\s+you\s+are", r"what\s+we\s+are\s+looking\s+for",
]

# Sections qui suivent souvent le profil : elles marquent la fin du découpage
NEXT_HEADINGS = [
    r"informations?\s+compl[ée]mentaires", r"conditions", r"r[ée]mun[ée]ration",
    r"pour\s+postuler", r"comment\s+postuler", r"[àa]\s+propos",
    r"pr[ée]sentation\s+de\s+l['’]entreprise", r"additional\s+information",
    r"how\s+to\s+apply", r"about\s+us", r"benefits", r"salary",
]


def extract_profile(text):
    """
    Isole la section « profil recherché » dans le corps d'une annonce.

    Beaucoup d'offres décrivent le profil attendu dans le texte libre, sans
    champ structuré. On repère l'intitulé de section, puis on s'arrête au
    prochain intitulé connu — à défaut, après un bloc de taille raisonnable.
    """
    if not text or len(text) < 60:
        return ""
    start_pattern = re.compile(
        r"(?:^|\n|\.|:)\s*(?:[-•*\s]*)(" + "|".join(PROFILE_HEADINGS) + r")\s*[:\-–]?\s*",
        re.IGNORECASE)
    match = start_pattern.search(text)
    if not match:
        return ""
    chunk = text[match.end():]
    # L'intitulé suivant peut débuter une ligne ou suivre une phrase
    stop = re.compile(r"(?:^|\n|\.\s+)\s*(?:" + "|".join(NEXT_HEADINGS) + r")\s*[:\-–]?",
                      re.IGNORECASE).search(chunk)
    if stop:
        chunk = chunk[:stop.start()]
    # Retirer les mentions génériques sur le dispositif V.I.E, souvent
    # accolées en fin d'annonce
    for pattern in BOILERPLATE:
        m = re.search(pattern, chunk, re.IGNORECASE)
        if m:
            chunk = chunk[:m.start()]
    chunk = chunk.strip(" \n\t•-–:")
    return truncate_sentences(chunk, 900) if len(chunk) > 25 else ""


def collect_raw_dates(record):
    """
    Récupère toute clé dont le nom évoque une date, même inconnue de FIELD_MAP.
    L'API n'étant pas documentée, c'est le filet de sécurité qui garantit de
    ne perdre aucune échéance exploitable par le site.
    """
    dates = {}
    for key, value in record.items():
        if not isinstance(value, (str, int)) or value in ("", None):
            continue
        if "date" in str(key).lower() or str(key).lower().endswith(("debut", "fin")):
            dates[key] = value
    return dates


def normalize_offer(raw):
    offer = {field: pick(raw, keys) for field, keys in FIELD_MAP.items()}
    offer["dates_raw"] = collect_raw_dates(raw)

    # Nettoyer le balisage AVANT toute analyse : les annonces arrivent souvent
    # en HTML, et les motifs de section ne s'y reconnaissent pas.
    for field in ("description", "mission", "profile"):
        offer[field] = clean_text(offer.get(field))

    # Profil recherché : champ dédié s'il existe, sinon extraction depuis le
    # corps de l'annonce.
    if not offer["profile"]:
        for source in ("description", "mission"):
            found = extract_profile(offer[source])
            if found:
                offer["profile"] = found
                offer["profile_extracted"] = True
                break

    offer["summary"] = build_summary(offer["description"], offer["mission"],
                                     offer["profile"])
    offer["id"] = str(offer["id"]) if offer["id"] else ""
    offer["url"] = OFFER_PAGE.format(id=offer["id"]) if offer["id"] else \
        "https://mon-vie-via.businessfrance.fr/offres/recherche"
    for field in ("title", "company", "country", "city"):
        if isinstance(offer[field], str):
            offer[field] = offer[field].strip()
    return offer


def main():
    parser = argparse.ArgumentParser(description="Collecte et note les offres V.I.E")
    parser.add_argument("--discover", action="store_true",
                        help="diagnostic de l'API, n'écrit rien")
    parser.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                        help=f"score minimum conservé (défaut {DEFAULT_THRESHOLD})")
    parser.add_argument("--max-pages", type=int, default=60)
    parser.add_argument("--out", default=os.path.join(
        os.path.dirname(__file__), "..", "data", "offers.json"))
    args = parser.parse_args()

    session = requests.Session()
    session.headers.update(HEADERS)

    print("Négociation avec l'API Business France…")
    print(f"Clé X-API-KEY : {API_KEY[:6]}…{API_KEY[-4:]} ({API_KEY_SOURCE})")
    outcome = negotiate(session)

    # Une clé recopiée à la main peut contenir une confusion I/l. Plutôt que
    # d'abandonner, on teste les variantes visuellement équivalentes.
    if outcome[0] is None and (401 in outcome[1] or 403 in outcome[1]):
        variants = key_variants(API_KEY)[1:]
        if variants:
            print(f"\nClé refusée. Test de {len(variants)} variantes "
                  f"(confusion possible entre I majuscule et l minuscule)…")
            for candidate in variants:
                session.headers["X-API-KEY"] = candidate
                trial = negotiate(session, verbose=False)
                if trial[0] is not None:
                    print(f"  [ok] clé valide trouvée : {candidate}")
                    print(f"  Enregistre-la dans cle-api.txt pour la réutiliser.")
                    outcome = trial
                    break
                time.sleep(0.4)
            else:
                session.headers["X-API-KEY"] = API_KEY
                print("  Aucune variante n'a été acceptée.")

    if outcome[0] is None:
        statuses = outcome[1] if len(outcome) > 1 else set()
        print("\nAucun format de requête n'a fonctionné.")
        if 401 in statuses or 403 in statuses:
            print("\nCause : HTTP 401/403 — la clé X-API-KEY est refusée.")
            print("La méthode la plus sûre pour la récupérer sans faute de frappe :")
            print("  1. Ouvrir mon-vie-via.businessfrance.fr, page des offres")
            print("  2. Inspecteur web → onglet Réseau → filtrer sur 'search'")
            print("  3. CLIC DROIT sur la ligne 'search' → « Copier en tant que cURL »")
            print("  4. Coller dans un éditeur, repérer -H 'X-API-KEY: ...'")
            print("  5. Copier la valeur dans un fichier cle-api.txt")
            print("     placé à côté de Lancer.command")
        elif 400 in statuses or 422 in statuses:
            print("\nCause : HTTP 400 — la clé passe, mais le corps de la requête")
            print("ne convient pas. Récupérer le format exact :")
            print("  1. Inspecteur web → Réseau → 'search' → onglet En-têtes")
            print("  2. Tout en bas, dérouler « Données de la requête »")
            print("  3. Ajouter ce JSON dans PAYLOAD_VARIANTS (collector/collect.py)")
        else:
            print("Relance avec --discover pour voir les réponses brutes.")
        sys.exit(2)

    path, variant, sample = outcome

    if args.discover:
        print("\n--- Réponse brute (extrait) ---")
        print(json.dumps(sample, indent=2, ensure_ascii=False)[:4000])
        records, _ = extract_records(sample)
        if records:
            print("\n--- Champs disponibles sur une offre ---")
            for key, value in records[0].items():
                preview = str(value)[:80].replace("\n", " ")
                print(f"  {key:<32} {preview}")
        return

    print("\nCollecte des offres…")
    raw_offers = fetch_all(session, path, variant, args.max_pages)
    print(f"{len(raw_offers)} offres récupérées.")

    # Historique : conserver la date de première apparition de chaque offre,
    # ce qui permet à la page de signaler les nouveautés.
    previous_seen = {}
    try:
        with open(os.path.abspath(args.out), encoding="utf-8") as fh:
            for old in json.load(fh).get("offers", []):
                if old.get("id"):
                    previous_seen[old["id"]] = old.get("first_seen")
    except (OSError, ValueError):
        pass

    today = datetime.now(timezone.utc).date().isoformat()

    print("Scoring selon le référentiel ENSICAEN Matériaux & Mécanique…")
    scored = []
    for raw in raw_offers:
        offer = normalize_offer(raw)
        if not offer["title"]:
            continue
        score, detail = score_offer(offer)
        if score < args.threshold:
            continue
        offer["score"] = score
        offer["label"] = label_for(score)
        offer["first_seen"] = previous_seen.get(offer["id"]) or today
        offer.update(detail)
        scored.append(offer)

    scored.sort(key=lambda o: (-o["score"], o["company"] or ""))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Business France — mon-vie-via.businessfrance.fr",
        "total_scanned": len(raw_offers),
        "total_kept": len(scored),
        "threshold": args.threshold,
        "axes": AXES,
        "families": families_catalog(),
        "scoring": scoring_constants(),
        "offers": scored,
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    print(f"{len(scored)} offres retenues sur {len(raw_offers)} scannées.")
    print(f"Écrit dans {out_path}")
    if scored:
        print("\nTop 5 :")
        for offer in scored[:5]:
            print(f"  {offer['score']:>3}/100  {offer['title'][:62]} — "
                  f"{offer['company']} ({offer['country']})")


if __name__ == "__main__":
    main()
