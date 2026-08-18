#!/bin/bash
# ---------------------------------------------------------------
# Veille V.I.E — lanceur macOS
# Double-clique ce fichier. Il installe ce qu'il faut, récupère les
# offres du jour, puis ouvre le site dans ton navigateur.
# ---------------------------------------------------------------

cd "$(dirname "$0")" || exit 1

PORT=8765

pause_et_quitter() {
  echo ""
  read -n 1 -s -r -p "  Appuie sur une touche pour fermer cette fenêtre."
  echo ""
  exit "${1:-1}"
}

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │  Veille V.I.E — Matériaux & Mécanique     │"
echo "  └──────────────────────────────────────────┘"
echo ""

# --- 1. Trouver un Python qui fonctionne réellement --------------------
# macOS fournit un /usr/bin/python3 factice qui déclenche une fenêtre
# d'installation au lieu de s'exécuter. On teste donc chaque candidat.

PYTHON=""
for candidat in /opt/homebrew/bin/python3 /usr/local/bin/python3 \
                /Library/Frameworks/Python.framework/Versions/Current/bin/python3 \
                "$(command -v python3 2>/dev/null)"; do
  [ -x "$candidat" ] || continue
  if "$candidat" -c "import sys, venv" >/dev/null 2>&1; then
    PYTHON="$candidat"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "  ─────────────────────────────────────────────"
  echo "  Python n'est pas installé sur ce Mac."
  echo ""
  echo "  Une fenêtre a dû s'afficher :"
  echo "    « Des outils de ligne de commande sont"
  echo "      nécessaires pour la commande python3 »"
  echo ""
  echo "  CLIQUE SUR « INSTALLER » dans cette fenêtre."
  echo "  C'est un composant officiel Apple, gratuit."
  echo "  Compte 5 à 15 minutes de téléchargement."
  echo ""
  echo "  Si tu as cliqué « Annuler » ou si rien ne"
  echo "  s'affiche, tape cette commande puis Entrée :"
  echo ""
  echo "      xcode-select --install"
  echo ""
  echo "  Une fois l'installation terminée,"
  echo "  relance ce fichier."
  echo "  ─────────────────────────────────────────────"
  # Déclenche la fenêtre d'installation si elle n'est pas déjà ouverte
  xcode-select --install >/dev/null 2>&1
  pause_et_quitter 1
fi

echo "  [1/4] Python détecté : $("$PYTHON" --version 2>&1)"

# --- 2. Environnement isolé + dépendances ------------------------------
if [ ! -x ".venv/bin/python" ]; then
  echo "  [2/4] Première installation (environ 30 secondes)…"
  rm -rf .venv
  if ! "$PYTHON" -m venv .venv >/dev/null 2>&1; then
    echo ""
    echo "  L'environnement Python n'a pas pu être créé."
    echo "  Transmets cette ligne pour diagnostic :"
    "$PYTHON" -m venv .venv
    pause_et_quitter 1
  fi
  ./.venv/bin/pip install --quiet --upgrade pip >/dev/null 2>&1
  if ! ./.venv/bin/pip install --quiet -r collector/requirements.txt; then
    echo ""
    echo "  L'installation des dépendances a échoué."
    echo "  Vérifie ta connexion internet, puis relance."
    pause_et_quitter 1
  fi
else
  echo "  [2/4] Installation déjà présente."
fi

# --- 3. Collecte des offres --------------------------------------------
echo "  [3/4] Recherche des offres V.I.E en cours…"
echo ""
./.venv/bin/python collector/collect.py
COLLECT_STATUS=$?
echo ""

if [ $COLLECT_STATUS -ne 0 ]; then
  echo "  ─────────────────────────────────────────────"
  echo "  La récupération des offres a échoué."
  echo "  Le site va quand même s'ouvrir, avec les"
  echo "  dernières offres connues s'il y en a."
  echo ""
  echo "  Pour comprendre pourquoi, copie-colle ceci :"
  echo "      ./.venv/bin/python collector/collect.py --discover"
  echo "  et transmets le résultat."
  echo "  ─────────────────────────────────────────────"
  echo ""
fi

# --- 4. Serveur local + ouverture du navigateur ------------------------
# Un serveur est nécessaire : ouvert en double-clic, un navigateur refuse
# de lire le fichier de données pour des raisons de sécurité.

if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  kill "$(lsof -ti tcp:$PORT)" >/dev/null 2>&1
  sleep 1
fi

echo "  [4/4] Démarrage du site…"
./.venv/bin/python collector/serveur.py $PORT >/dev/null 2>&1 &
SERVER_PID=$!

# On attend que le serveur réponde vraiment avant d'ouvrir le navigateur
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep .4
  if curl -s -o /dev/null "http://localhost:$PORT/site/"; then
    PRET=1
    break
  fi
done

if [ -z "$PRET" ]; then
  echo ""
  echo "  Le site n'a pas réussi à démarrer sur le port $PORT."
  echo "  Un autre programme l'utilise peut-être."
  kill $SERVER_PID 2>/dev/null
  pause_et_quitter 1
fi

# Paramètre unique à chaque lancement : impossible pour le navigateur de
# réutiliser une version en cache, y compris celle de la page elle-même.
open "http://localhost:$PORT/site/?r=$(date +%s)"

echo ""
echo "  ─────────────────────────────────────────────"
echo "  Le site est ouvert dans ton navigateur."
echo ""
echo "  GARDE CETTE FENÊTRE OUVERTE pendant"
echo "  que tu consultes les offres."
echo ""
echo "  Pour arrêter : ferme cette fenêtre,"
echo "  ou appuie sur Ctrl + C."
echo "  ─────────────────────────────────────────────"
echo ""

trap 'kill $SERVER_PID 2>/dev/null; exit 0' INT TERM
wait $SERVER_PID
