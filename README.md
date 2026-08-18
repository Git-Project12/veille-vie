# Veille V.I.E — Matériaux & Mécanique (ENSICAEN)

Site statique qui regroupe les offres de Volontariat International en Entreprise
et les note selon leur adéquation avec le programme de la filière Matériaux &
Mécanique. Les données sont recollectées chaque jour par GitHub Actions.

Trois axes de recherche sont privilégiés : **R&D matériaux / laboratoire**,
**production / méthodes / industrialisation**, **qualité / contrôle / END**.
Un quatrième axe transverse (calcul, simulation, CAO) est également mesuré,
parce que ces compétences apparaissent dans presque tous les modules du cursus.

## Mise en route sur Mac (le plus simple)

Double-clique **`Lancer.command`** à la racine du dossier. Une fenêtre noire
s'ouvre, installe ce qu'il faut la première fois, récupère les offres du jour et
ouvre le site dans le navigateur. Laisse cette fenêtre ouverte pendant la
consultation ; ferme-la pour arrêter.

Au tout premier lancement, macOS peut refuser d'ouvrir le fichier parce qu'il
vient d'Internet. Dans ce cas : **clic droit** sur `Lancer.command` →
**Ouvrir** → **Ouvrir** dans la boîte de dialogue. Cette autorisation n'est
demandée qu'une fois.

### Si une fenêtre réclame « les outils de ligne de commande »

Elle signifie que Python n'est pas installé : macOS ne fournit qu'un raccourci
vide sous le nom `python3`. **Clique sur « Installer »** — c'est un composant
Apple officiel et gratuit, environ 1 Go, 5 à 15 minutes. Relance ensuite
`Lancer.command`.

Si la fenêtre a été refusée, la même installation se déclenche depuis le
Terminal avec `xcode-select --install`.

Ne pas ouvrir `site/index.html` par double-clic : le navigateur bloque alors la
lecture du fichier de données, et le site paraît vide.

## Mise en route en ligne de commande

```bash
pip install -r collector/requirements.txt
python collector/collect.py
```

Puis ouvrir `site/index.html` dans un navigateur.

Le collecteur écrit `data/offers.json`, seul fichier de données du site.

## Déploiement (mise à jour quotidienne automatique)

1. Créer un dépôt GitHub et y pousser ce dossier.
2. `Settings` → `Pages` → **Source : GitHub Actions**.
3. `Settings` → `Actions` → `General` → `Workflow permissions` :
   cocher **Read and write permissions**.
4. Onglet `Actions` → workflow *Collecte quotidienne des offres V.I.E* →
   **Run workflow**, pour valider le premier passage sans attendre le
   déclenchement de 05h10 UTC.

Le site est ensuite publié sur `https://<utilisateur>.github.io/<dépôt>/`.

## Si la collecte échoue

Le site mon-vie-via.businessfrance.fr est une application JavaScript : ses offres
proviennent d'une API non documentée (`civiweb-api-prd.azurewebsites.net`). Le
collecteur essaie plusieurs formats de requête connus, mais Business France peut
changer ce schéma sans préavis.

```bash
python collector/collect.py --discover
```

Cette commande affiche la réponse brute et l'inventaire des champs disponibles.
Si aucun format ne passe, retrouver le bon en trois gestes :

1. Ouvrir mon-vie-via.businessfrance.fr et lancer une recherche d'offres.
2. Outils développeur → onglet **Réseau** → filtrer sur `search`.
3. Copier le corps de la requête POST, et l'ajouter à `PAYLOAD_VARIANTS`
   dans `collector/collect.py`.

Les noms de champs renvoyés se règlent dans `FIELD_MAP` du même fichier : chaque
champ accepte une liste de clés alternatives, la première trouvée gagne.

## Ajuster le ciblage

Tout se règle dans `collector/profile.py` :

- `KEYWORD_FAMILIES` — les familles de mots-clés, chacune rattachée à un module
  réel du programme. C'est ce rattachement qui permet au site d'afficher
  *pourquoi* une offre ressort (« Métallurgie 1 (280-1) · alliage, acier »).
- `TITLE_PENALTIES` — les intitulés qui écartent une offre (commercial,
  marketing, RH…). À enrichir au fil des faux positifs constatés.
- `DEFAULT_THRESHOLD` — score minimum pour qu'une offre entre dans le fichier.
  Le baisser élargit la collecte, au prix de plus de bruit.

Le calcul lui-même est dans `collector/scoring.py`. Une famille de mots-clés ne
rapporte ses points qu'une fois, même répétée : une annonce concise et bien
ciblée l'emporte sur une annonce bavarde. L'axe dominant pèse 60 % du score, ce
qui favorise les postes vraiment spécialisés.

Après modification, vérifier l'effet sans appeler l'API :

```python
from scoring import score_offer
score_offer({"title": "VIE Ingénieur Qualité Fournisseur",
             "description": "Audits ISO 9001, contrôle non destructif…"})
```

## Lecture des scores

| Score | Lecture |
|-------|---------|
| 70+ | Cœur de cible — le poste mobilise directement plusieurs modules du cursus |
| 50–69 | Bonne adéquation — candidature pertinente, à argumenter |
| 35–49 | À examiner — recoupement partiel, souvent sur un seul axe |
| < 35 | Périphérique — mentionne le vocabulaire sans être un poste matériaux |

Le score compte des mots-clés : il ne remplace pas la lecture de l'annonce. Une
offre bien rédigée mais courte peut être sous-notée ; l'inverse existe aussi.

## Portails entreprises

Le site liste les groupes français qui recrutent le plus sur ce profil, avec un
lien de recherche pour chacun. Ces liens lancent une recherche plutôt que de
pointer une URL de portail carrières figée, parce que ces portails changent
d'adresse régulièrement (migrations Workday, SmartRecruiters, Taleo…). En
pratique, la publication sur Business France est le passage obligé de la
procédure V.I.E : la couverture y est déjà très large.

La liste se modifie dans `COMPANIES`, en haut de `site/assets/app.js`.

## Bonne conduite

Le collecteur s'identifie via un `User-Agent` explicite, espace ses requêtes
d'une seconde et ne tourne qu'une fois par jour. Ne pas réduire ces marges : il
s'agit d'un service public gratuit, et une collecte agressive est le meilleur
moyen de le voir se fermer. Les données récupérées sont des annonces publiques ;
elles ne sont ni revendues ni republiées hors de ce site de veille.
