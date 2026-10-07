#!/bin/bash
# ---------------------------------------------------------------
# Veille V.I.E — diagnostic
# Double-clique ce fichier si aucune offre n'apparaît.
# Il interroge l'API et enregistre le résultat sur ton Bureau
# dans un fichier « diagnostic-vie.txt » à transmettre.
# ---------------------------------------------------------------

cd "$(dirname "$0")" || exit 1

RAPPORT="$HOME/Desktop/diagnostic-vie.txt"

echo ""
echo "  Diagnostic en cours…"
echo ""

{
  echo "===== DIAGNOSTIC VEILLE V.I.E ====="
  echo "Date : $(date)"
  echo "macOS : $(sw_vers -productVersion 2>/dev/null)"
  echo ""

  echo "----- Python -----"
  if [ -x ".venv/bin/python" ]; then
    ./.venv/bin/python --version 2>&1
    ./.venv/bin/pip show requests 2>&1 | head -2
  else
    echo "Environnement .venv absent — le lanceur n'a pas terminé son installation."
  fi
  echo ""

  echo "----- Connexion au serveur de Business France -----"
  curl -s -o /dev/null -w "Code HTTP : %{http_code}  (temps : %{time_total}s)\n" \
    "https://civiweb-api-prd.azurewebsites.net/api/Offers/repository/notepays/68" 2>&1
  echo ""

  echo "----- Réponse de l'API à une recherche d'offres -----"
  if [ -x ".venv/bin/python" ]; then
    ./.venv/bin/python collector/collect.py --discover 2>&1
  else
    echo "Impossible : environnement Python absent."
  fi
  echo ""

  echo "----- Fichier de données actuel -----"
  if [ -f "data/offers.json" ]; then
    echo "Taille : $(wc -c < data/offers.json) octets"
    head -c 600 data/offers.json
  else
    echo "data/offers.json absent."
  fi
  echo ""
  echo "===== FIN ====="
} > "$RAPPORT" 2>&1

echo "  ─────────────────────────────────────────────"
echo "  Terminé."
echo ""
echo "  Un fichier « diagnostic-vie.txt » a été créé"
echo "  sur ton Bureau. Transmets-le tel quel."
echo "  ─────────────────────────────────────────────"
echo ""

open -R "$RAPPORT" 2>/dev/null

read -n 1 -s -r -p "  Appuie sur une touche pour fermer."
echo ""
