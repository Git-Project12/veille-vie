"""
Moteur de scoring : mesure l'adéquation d'une offre V.I.E avec le profil
ENSICAEN Matériaux & Mécanique.

Principe : chaque famille de mots-clés du référentiel est "saturée" — elle
rapporte ses points une seule fois, même si l'offre répète ses termes. Cela
évite qu'une annonce verbeuse écrase une annonce concise mais parfaitement
ciblée.

Le score final est ramené sur 100, avec le détail par axe (R&D, Production,
Qualité, Calcul) pour alimenter la barre de composition affichée sur le site.
"""

import re
import unicodedata

from profile import (
    ANCHORLESS_CAP,
    AXES,
    DIGITAL_ROLE_CAP,
    DIGITAL_TITLE_TERMS,
    INDUSTRIAL_ANCHORS,
    KEYWORD_FAMILIES,
    LEVEL_TERMS,
    SECTOR_BONUS,
    TITLE_BONUSES,
    TITLE_PENALTIES,
)

# Points cumulables au maximum par axe avant normalisation.
# Calculé dynamiquement : somme des poids des familles de l'axe.
AXIS_MAX = {
    axis: sum(f["weight"] for f in KEYWORD_FAMILIES if f["axis"] == axis)
    for axis in AXES
}

# Un profil ne peut pas être excellent partout : on prend les 2 meilleurs axes
# plus une fraction des autres. Un poste "R&D pure" doit pouvoir sortir à 90+.
TOP_AXES_COUNT = 2


def normalize(text):
    """Minuscules, sans accents, ponctuation réduite — pour comparaison robuste."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    text = re.sub(r"[^a-z0-9&+#'\- ]+", " ", text)
    return re.sub(r"\s+", " ", text)


# Cache des expressions compilées : le référentiel est parcouru des centaines
# de fois par collecte.
_PATTERNS = {}


def _contains(haystack, term):
    """
    Cherche un terme en exigeant des frontières de mots.

    Sans cette exigence, « usine » se trouvait dans « business », « aging »
    dans « leveraging », « joining » dans « joining the team » — et une offre
    de trading informatique déclenchait sept familles industrielles.

    Les frontières s'appliquent à tous les termes, y compris les expressions
    de plusieurs mots, où les espaces tolèrent aussi un tiret ou une
    apostrophe (« plan d'experiences », « plan-d-experiences »).
    """
    pattern = _PATTERNS.get(term)
    if pattern is None:
        morceaux = [re.escape(mot) for mot in re.split(r"[\s'\-]+", term) if mot]
        corps = r"[\s\-']+".join(morceaux)
        pattern = re.compile(r"(?<![a-z0-9])" + corps + r"(?![a-z0-9])")
        _PATTERNS[term] = pattern
    return pattern.search(haystack) is not None


def score_offer(offer):
    """
    Attend un dict normalisé avec au moins : title, description, company, mission.
    Retourne (score_0_100, detail) où detail alimente l'affichage du site.
    """
    title_n = normalize(offer.get("title", ""))
    body_n = normalize(
        " ".join(
            str(offer.get(k, "") or "")
            for k in ("title", "description", "mission", "profile", "company",
                      "sector", "specialization")
        )
    )

    axis_points = {axis: 0 for axis in AXES}
    matched = []  # familles déclenchées, pour la justification

    for family in KEYWORD_FAMILIES:
        hits = [t for t in family["terms"] if _contains(body_n, t)]
        if hits:
            axis_points[family["axis"]] += family["weight"]
            matched.append({
                "id": family["id"],
                "axis": family["axis"],
                "source": family["source"],
                "weight": family["weight"],
                "terms": sorted(set(hits))[:4],
            })

    # Normalisation par axe (0-100)
    axis_scores = {
        axis: round(100 * axis_points[axis] / AXIS_MAX[axis]) if AXIS_MAX[axis] else 0
        for axis in AXES
    }

    # Score de base : un poste très spécialisé sur un seul axe (ex. "calcul
    # structure" pur) doit sortir devant un poste vaguement pertinent partout.
    # L'axe dominant pèse donc l'essentiel.
    ordered = sorted(axis_scores.values(), reverse=True)
    rest = ordered[TOP_AXES_COUNT:]
    base = (
        ordered[0] * 0.60
        + ordered[1] * 0.25
        + (sum(rest) / len(rest) if rest else 0) * 0.15
    )

    bonuses = []
    score = base

    # Intitulé de poste cœur de cible
    title_hits = [t for t in TITLE_BONUSES["terms"] if _contains(title_n, t)]
    if title_hits:
        score += TITLE_BONUSES["weight"]
        bonuses.append({"label": "Intitulé technique ciblé",
                        "terms": sorted(set(title_hits))[:3],
                        "points": TITLE_BONUSES["weight"]})

    # Secteur industriel porteur
    sector_hits = [t for t in SECTOR_BONUS["terms"] if _contains(body_n, t)]
    if sector_hits:
        score += SECTOR_BONUS["weight"]
        bonuses.append({"label": "Secteur industriel compatible",
                        "terms": sorted(set(sector_hits))[:3],
                        "points": SECTOR_BONUS["weight"]})

    # Niveau d'études annoncé
    if any(_contains(body_n, t) for t in LEVEL_TERMS):
        score += 4
        bonuses.append({"label": "Niveau bac+5 / ingénieur annoncé",
                        "terms": [], "points": 4})

    # Pénalité : intitulé hors formation
    penalty_hits = [t for t in TITLE_PENALTIES["terms"] if _contains(title_n, t)]
    if penalty_hits:
        score += TITLE_PENALTIES["weight"]
        bonuses.append({"label": "Intitulé hors formation",
                        "terms": sorted(set(penalty_hits))[:3],
                        "points": TITLE_PENALTIES["weight"]})

    score = max(0, min(100, round(score)))

    # Plafonnement en l'absence d'ancrage industriel
    anchors = [t for t in INDUSTRIAL_ANCHORS if _contains(body_n, t)]
    if not anchors and score > ANCHORLESS_CAP:
        bonuses.append({
            "label": "Aucun terme industriel : score plafonné",
            "terms": [], "points": ANCHORLESS_CAP - score,
            "cap": ANCHORLESS_CAP,
        })
        score = ANCHORLESS_CAP

    # Plafonnement des métiers du numérique : l'intitulé dit le métier
    digital_hits = [t for t in DIGITAL_TITLE_TERMS if _contains(title_n, t)]
    if digital_hits and score > DIGITAL_ROLE_CAP:
        bonuses.append({
            "label": "Intitulé de métier du numérique : score plafonné",
            "terms": sorted(set(digital_hits))[:3],
            "points": DIGITAL_ROLE_CAP - score,
            "cap": DIGITAL_ROLE_CAP,
        })
        score = DIGITAL_ROLE_CAP

    # Axe dominant, pour le tri et les filtres du site
    dominant = max(axis_scores, key=lambda a: axis_scores[a])
    if axis_scores[dominant] == 0:
        dominant = None

    return score, {
        "axis_scores": axis_scores,
        "dominant_axis": dominant,
        "matched_families": sorted(matched, key=lambda m: m["axis"]),
        "bonuses": bonuses,
    }


def label_for(score):
    if score >= 70:
        return "Cœur de cible"
    if score >= 50:
        return "Bonne adéquation"
    if score >= 35:
        return "À examiner"
    return "Périphérique"


def families_catalog():
    """
    Catalogue exporté dans le fichier de données : permet à la page de
    recalculer les scores avec des pondérations choisies par l'utilisateur,
    sans relancer le collecteur.
    """
    return [
        {
            "id": f["id"],
            "axis": f["axis"],
            "weight": f["weight"],
            "source": f["source"],
            "terms_preview": f["terms"][:6],
        }
        for f in KEYWORD_FAMILIES
    ]


def scoring_constants():
    """Constantes de la formule, pour que la page reproduise le calcul."""
    return {
        "top_weights": [0.60, 0.25],
        "rest_weight": 0.15,
        "title_bonus": TITLE_BONUSES["weight"],
        "sector_bonus": SECTOR_BONUS["weight"],
        "level_bonus": 4,
        "title_penalty": TITLE_PENALTIES["weight"],
    }
