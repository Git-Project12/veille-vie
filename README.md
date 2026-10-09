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
- `DIGITAL_TITLE_TERMS` — les intitulés de métiers du numérique (data, IA,
  informatique, développement). Une offre dont l'intitulé en contient un voit
  son score plafonné à `DIGITAL_ROLE_CAP`.
- `INDUSTRIAL_ANCHORS` — le vocabulaire de la matière, de la pièce et du
  procédé. Une offre qui n'en contient aucun est plafonnée à `ANCHORLESS_CAP`.
- `DEFAULT_THRESHOLD` — score minimum pour qu'une offre entre dans le fichier.
  Le baisser élargit la collecte, au prix de plus de bruit.

### Les deux garde-fous

Le comptage de mots-clés produit deux sortes de faux positifs, traitées
séparément.

**L'offre ne parle pas d'industrie du tout.** Elle partage seulement du
vocabulaire commun — qualité, validation, amélioration continue, Python. Un
poste de support informatique en salle de marché atteignait ainsi 59/100 en
déclenchant sept familles. S'il manque tout ancrage industriel
(`INDUSTRIAL_ANCHORS`), le score est plafonné à 30.

**L'offre parle bien d'industrie, mais le poste est ailleurs.** Cas plus
sournois : l'annonce décrit l'atelier, l'emboutissage, le soudage, l'outillage
— et tout est exact — mais le métier recruté est un métier de données ou
d'IA ; l'atelier n'est là que parce que les données en viennent. Une offre
« Chargé de projets Data, Digital & IA – Ingénierie Avancée de Fabrication »
atteignait 89/100 sur dix familles toutes légitimement déclenchées. Le seul
endroit où l'employeur dit quel métier il recrute est l'intitulé : s'il annonce
un métier du numérique (`DIGITAL_TITLE_TERMS`), le score est plafonné à 35.

Ces deux plafonds n'écartent pas l'offre, ils la remettent à sa place : elle
reste consultable, et le dépliant indique le plafond appliqué. Pour contrôler
l'effet d'une modification sur la collecte en cours, sans rappeler l'API :

```bash
./.venv/bin/python collector/expliquer.py "Data, Digital" --texte
```

Le calcul lui-même est dans `collector/scoring.py`. Une famille de mots-clés ne
rapporte ses points qu'une fois, même répétée : une annonce concise et bien
ciblée l'emporte sur une annonce bavarde. L'axe dominant pèse 60 % du score, ce
qui favorise les postes vraiment spécialisés.

### D'où viennent les poids

Les poids des familles sont calés sur les **volumes horaires réels du
programme** (colonnes Cours + TD + TP), puis majorés pour les sujets visés en
priorité. Chaque famille porte ses heures d'origine dans son champ `source`,
pour qu'un futur ajustement parte des faits.

| Axe | Heures | Part du technique |
|---|---:|---:|
| R&D matériaux / labo | 359 h | 34 % |
| Calcul / simulation / CAO | 362 h | 34 % |
| Production / méthodes | 220 h | 21 % |
| Qualité / contrôle / END | 99 h | 9 % |

Deux constats qui ont motivé la refonte : *Qualité et normes* (774-1) est un
module de 14 h au coefficient 0,5, alors qu'il portait un poids de 10 — le
deuxième du référentiel. Et *Dégradation des matériaux* (300-2), 55 h, le plus
gros module du cursus, en portait 9.

### Référence par axe, et priorités

Chaque axe est ramené sur la somme des poids de ses **trois familles les plus
lourdes** (`AXIS_TOP_FAMILIES`) : trois signaux forts portent n'importe quel axe
à 100, et l'exigence de preuve est la même partout.

Auparavant chaque axe était divisé par la somme de *toutes* ses familles. L'axe
Qualité n'en comptant que quatre contre sept pour la R&D, il saturait deux fois
plus vite : deux familles déclenchées donnaient 33/100 en R&D mais 56/100 en
Qualité. Comme l'axe dominant pèse 60 % de la note, la Qualité gagnait par
construction — elle ressortait dominante sur **283 des 463 offres collectées**,
contre 15 pour la R&D.

S'ajoute un facteur `priority` par axe (dans `AXES`) : les domaines visés en
premier gardent toute leur valeur, les autres sont minorés. Une excellente offre
dans un domaine secondaire ne peut donc pas devancer une bonne offre dans un
domaine prioritaire.

### Vocabulaire courant

Les termes trop fréquents pour prouver quoi que ce soit sont regroupés dans des
familles « vocabulaire courant » à poids faible (`prod7`, `qual5`, `rd9`), au
lieu de gonfler les familles de métier. Le seuil retenu est **8 % des offres
collectées** : « engineering » apparaît dans 35 % d'entre elles, « qualité »
dans 36 %, « standards » et « validation » dans 20 %.

### Le troisième garde-fou : la formation exigée

`FIELD_ACCEPTED` et `FIELD_FOREIGN` lisent le **profil recherché**, seul endroit
où l'employeur nomme lui-même la formation qu'il cherche. Si le profil nomme au
moins une discipline étrangère **et aucune discipline acceptée**, le score est
plafonné à `FOREIGN_FIELD_CAP`. Nommer une discipline acceptée suffit à passer :
une annonce ouverte à plusieurs cursus ne doit pas être écartée parce qu'elle en
cite un autre à côté.

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

## Le dossier `data/`

Il est créé à la première collecte et reçoit :

| Fichier | Contenu |
|---|---|
| `offers.json` | les offres collectées et notées, lues par le site |
| `premieres-detections.json` | la date de première apparition de chaque offre |

**Aucune archive de mise à jour ne contient ce dossier.** Remplacer un dossier
dans le Finder en efface le contenu : une archive qui embarquerait un `data/`
même vide écraserait l'historique, et toutes les offres seraient de nouveau
signalées comme nouvelles. Les archives ne contiennent donc que le code.

L'historique est aussi conservé hors du projet, dans
`~/.veille-vie/premieres-detections.json` : c'est cette copie qui permet de
changer de dossier, ou de passer à une nouvelle version, sans que les offres
déjà connues réapparaissent comme nouvelles.

Les deux fichiers se régénèrent seuls à la prochaine collecte.

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
