#!/usr/bin/env python3
"""
Explique le score d'une offre déjà collectée.

Sert à comprendre pourquoi une annonce hors sujet obtient une note élevée,
ou l'inverse — et donc à corriger le référentiel sur des cas réels plutôt
que sur des suppositions.

Usage :
    python collector/expliquer.py "IT APPLICATION SUPPORT"
    python collector/expliquer.py FORTIL
    python collector/expliquer.py --top 10        les 10 mieux notées
    python collector/expliquer.py --texte ENGIE   affiche aussi l'annonce
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from profile import AXES  # noqa: E402

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    "..", "data", "offers.json")


def charger():
    try:
        with open(os.path.abspath(DATA), encoding="utf-8") as fh:
            return json.load(fh)
    except OSError:
        sys.exit("Aucune donnée : lance d'abord une collecte.")
    except ValueError as exc:
        sys.exit(f"Fichier de données illisible : {exc}")


def detailler(offer, montrer_texte=False):
    print("=" * 72)
    print(f"{offer['score']}/100  —  {offer.get('label', '')}")
    print(offer.get("title", ""))
    print(f"{offer.get('company', '')} · {offer.get('country', '')}")
    print("-" * 72)

    axes = offer.get("axis_scores", {})
    print("Score par domaine :")
    for axis, meta in AXES.items():
        barre = "#" * round(axes.get(axis, 0) / 4)
        print(f"  {meta['label']:<28} {axes.get(axis, 0):>3}  {barre}")
    print(f"\nDomaine dominant : {AXES.get(offer.get('dominant_axis'), {}).get('label', '—')}")

    print("\nFamilles de mots-clés déclenchées :")
    familles = offer.get("matched_families", [])
    if not familles:
        print("  aucune")
    for m in familles:
        termes = ", ".join(m.get("terms", []))
        print(f"  [{m['axis']:<4}] {m['source']}")
        print(f"           → termes trouvés : {termes}")

    bonus = offer.get("bonuses", [])
    if bonus:
        print("\nBonus et malus :")
        for b in bonus:
            termes = ", ".join(b.get("terms", []))
            suffixe = f" ({termes})" if termes else ""
            print(f"  {b['points']:>+4}  {b['label']}{suffixe}")

    if montrer_texte:
        print("\nTexte analysé :")
        for champ in ("summary", "profile"):
            valeur = (offer.get(champ) or "").strip()
            if valeur:
                print(f"\n  --- {champ} ---")
                for ligne in valeur.splitlines():
                    print(f"  {ligne}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Explique le score d'une offre")
    parser.add_argument("recherche", nargs="?", default="",
                        help="mot présent dans l'intitulé ou l'entreprise")
    parser.add_argument("--top", type=int, help="afficher les N mieux notées")
    parser.add_argument("--texte", action="store_true",
                        help="afficher aussi le texte de l'annonce")
    parser.add_argument("--max", type=int, default=5,
                        help="nombre maximum d'offres détaillées (défaut 5)")
    args = parser.parse_args()

    data = charger()
    offres = data.get("offers", [])
    print(f"{len(offres)} offres dans le fichier "
          f"(collecte du {data.get('generated_at', '?')})\n")

    if args.top:
        selection = sorted(offres, key=lambda o: -o["score"])[:args.top]
    else:
        aiguille = args.recherche.lower()
        if not aiguille:
            sys.exit("Indique un mot à chercher, ou utilise --top 10.")
        selection = [o for o in offres
                     if aiguille in (o.get("title", "") + " " +
                                     o.get("company", "")).lower()]
        if not selection:
            sys.exit(f"Aucune offre ne correspond à « {args.recherche} ».")
        selection = selection[:args.max]

    for offre in selection:
        detailler(offre, montrer_texte=args.texte)


if __name__ == "__main__":
    main()
