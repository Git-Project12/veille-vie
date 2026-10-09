"""
Référentiel de compétences — ENSICAEN, filière Matériaux & Mécanique (apprentissage).

Chaque famille de mots-clés est dérivée d'un module réel du programme (S5 à S10).
Le champ `source` indique le(s) module(s) d'origine : c'est ce qui permet, dans le
site, d'afficher POURQUOI une offre est jugée pertinente.

Pour ajuster le ciblage : modifier les poids (`weight`) ou ajouter des termes.
Tous les termes sont comparés en minuscules, sans accents.
"""

# --- Axes de recherche retenus pour ce profil -------------------------------
# `priority` : tous les domaines ne se valent pas pour ce projet. Les axes
# visés en premier gardent toute leur valeur ; les autres sont minorés, de
# sorte qu'une excellente offre Qualité ne puisse pas devancer une bonne
# offre R&D. Sans cela, l'axe le plus bavard l'emportait mécaniquement.
AXES = {
    "rd": {"label": "R&D matériaux / labo", "color": "#2E5E4E", "priority": 1.0},
    "prod": {"label": "Production / méthodes", "color": "#8A4B1F", "priority": 1.0},
    "qual": {"label": "Qualité / contrôle / END", "color": "#3A4E7A", "priority": 0.72},
    "calc": {"label": "Calcul / simulation / CAO", "color": "#6B4A7A", "priority": 0.72},
}

# Combien de familles solides faut-il pour qu'un axe atteigne 100 ?
#
# Auparavant chaque axe était ramené sur la somme des poids de TOUTES ses
# familles. Comme l'axe R&D en compte 8 et l'axe Qualité 5, deux familles
# déclenchées donnaient 33/100 en R&D mais 56/100 en Qualité : l'axe le plus
# pauvre saturait deux fois plus vite, et comme l'axe dominant pèse 60 % de
# la note, la Qualité gagnait par construction — dominante sur 283 des 463
# offres collectées, alors qu'elle représente 9 % des heures du programme.
#
# Un plafond commun fixe ne marche pas davantage : il condamnerait l'axe
# Qualité, dont le total de poids est petit parce que le programme y
# consacre peu d'heures, à ne jamais pouvoir ressortir.
#
# La référence retenue est donc, pour chaque axe, la somme des poids de ses
# TROIS familles les plus lourdes. Autrement dit : trois signaux forts
# portent n'importe quel axe à 100. L'exigence de preuve est la même
# partout, et chaque axe garde son échelle interne.
AXIS_TOP_FAMILIES = 3

# --- Familles de mots-clés --------------------------------------------------
# weight : points par famille (saturée : une famille ne compte qu'une fois,
# quel que soit le nombre de termes trouvés — évite qu'une offre bavarde gagne).
# Poids : fondés sur les volumes horaires réels du programme (colonnes
# Cours + TD + TP), puis majorés pour les sujets que l'étudiant vise en
# premier — métallurgie et microstructure, mise en forme et procédés,
# dégradation / corrosion / rupture. Les heures disent ce que le diplôme
# atteste ; la majoration dit ce qu'il veut en faire. Le commentaire de
# chaque famille porte les heures d'origine, pour qu'un futur ajustement
# parte des faits et non d'une impression.
#
# Une famille est SATURÉE : elle rapporte ses points une seule fois, quel
# que soit le nombre de termes trouvés — une annonce bavarde ne gagne pas
# contre une annonce concise et juste.
#
# Les termes trop fréquents pour prouver quoi que ce soit (« engineering »
# dans 35 % des offres, « qualité » dans 36 %) sont regroupés dans des
# familles « vocabulaire courant » à poids faible, au lieu de polluer les
# familles de métier. Le seuil retenu est 8 % des offres collectées.
KEYWORD_FAMILIES = [
    # ---------------- Axe R&D matériaux / laboratoire (359 h) ----------------
    {
        "id": "rd1", "axis": "rd", "weight": 12,
        "source": "Métallurgie 1 (280-1, 34 h), Métallurgie 2 (287-1, 45 h)",
        "terms": ["metallurgie", "metallurgy", "metallurgical", "alliage", "alloy",
                  "acier", "steel", "aluminium", "titane", "titanium", "fonte",
                  "microstructure", "phase transformation", "traitement thermique",
                  "heat treatment", "trempe", "quenching", "precipitation",
                  "grain size", "taille de grain"],
    },
    {
        "id": "rd2", "axis": "rd", "weight": 9,
        "source": "Propriétés mécaniques et physique des matériaux (262-1, 30 h), Critères de choix des matériaux (265-1, 15 h)",
        "terms": ["materiaux", "material science", "materials engineer", "materials science",
                  "science des materiaux", "werkstoff", "caracterisation",
                  "characterization", "characterisation", "choix des materiaux",
                  "material selection"],
    },
    {
        "id": "rd3", "axis": "rd", "weight": 12,
        "source": "Dégradation des matériaux (300-2, 55 h), Traitements de surface (306-2, 20 h)",
        "terms": ["corrosion", "degradation", "oxydation", "oxidation", "vieillissement",
                  "traitement de surface", "surface treatment",
                  "revetement", "coating", "galvanisation", "anodisation", "tribologie",
                  "usure", "wear"],
    },
    {
        "id": "rd4", "axis": "rd", "weight": 10,
        "source": "Rupture et fatigue des matériaux (291-1, 47 h)",
        "terms": ["fatigue", "rupture", "fracture", "endommagement", "damage tolerance",
                  "crack", "fissuration", "duree de vie", "lifetime prediction",
                  "essais mecaniques", "mechanical testing", "traction", "tensile test"],
    },
    {
        "id": "rd8", "axis": "rd", "weight": 11,
        "source": "Alternance : investigation & problem solving, analyse microstructurale",
        "terms": ["analyse microstructurale", "microstructural analysis", "metallographie",
                  "metallography", "fractographie", "fractography", "analyse de rupture",
                  "microscopie", "microscopy", "meb", "sem", "tem", "eds", "edx",
                  "diffraction", "drx", "xrd", "spectrometrie", "micrographie",
                  "expertise materiaux", "analyse de defaillance", "failure analysis",
                  "analyse de defaillances", "expertise technique materiaux"],
    },
    {
        "id": "rd6", "axis": "rd", "weight": 8,
        "source": "Comportement mécanique des matériaux non conventionnels (298-2, 30 h), Projet de recherche (261-1, 10 h)",
        "terms": ["innovation materiaux", "new materials", "nouveaux materiaux",
                  "additive manufacturing", "fabrication additive", "impression 3d",
                  "3d printing", "batterie", "battery", "hydrogene", "hydrogen",
                  "materiaux innovants"],
    },
    {
        "id": "rd9", "axis": "rd", "weight": 3,
        "source": "Vocabulaire de laboratoire courant",
        "terms": ["r&d", "recherche et developpement", "research and development",
                  "laboratoire", "laboratory", "problem solving",
                  "resolution de problemes", "investigation"],
    },
    {
        "id": "rd5", "axis": "rd", "weight": 6,
        "source": "Mise en forme des polymères et composites (304-2, 30 h), Céramiques et verre (303-2, 27 h)",
        "terms": ["composite", "polymere", "polymer", "plasturgie", "thermoplastique",
                  "ceramique", "ceramic", "verre", "glass", "fibre de carbone",
                  "carbon fiber", "carbon fibre", "resine", "resin"],
    },
    {
        "id": "rd7", "axis": "rd", "weight": 4,
        "source": "Recyclage des matériaux (8 h), Éco-conception (842-1, 8 h), Enjeux DDRS (838-1, 20 h)",
        "terms": ["recyclage", "recycling", "eco-conception", "ecodesign", "circular economy",
                  "economie circulaire", "acv", "life cycle assessment", "decarbonation",
                  "decarbonization", "sustainab"],
    },

    # ---------------- Axe Production / méthodes (220 h) ----------------
    {
        "id": "prod1", "axis": "prod", "weight": 12,
        "source": "Mise en forme par déformation plastique des métaux (281-1, 45 h), Physique de la mise en forme (290-1, 30 h)",
        "terms": ["mise en forme", "forming", "metal forming", "emboutissage", "stamping",
                  "forgeage", "forging", "laminage", "extrusion", "estampage",
                  "deformation plastique", "sheet metal"],
    },
    {
        "id": "prod4", "axis": "prod", "weight": 10,
        "source": "Outils de production (269-1, 20 h), Tenue mécanique des outillages (284-3 et 292-1, 45 h)",
        "terms": ["outillage", "tooling", "ligne de production", "production line",
                  "atelier", "shop floor", "usine", "plant", "industrialisation",
                  "industrialization", "process engineer", "process engineering",
                  "manufacturing engineer", "methods engineer", "procede"],
    },
    {
        "id": "prod2", "axis": "prod", "weight": 7,
        "source": "Mise en forme par solidification (288-1, 20 h)",
        "terms": ["fonderie", "foundry", "moulage", "solidification",
                  "injection", "die casting", "frittage", "sintering", "coulee"],
    },
    {
        "id": "prod3", "axis": "prod", "weight": 7,
        "source": "Assemblage des matériaux (297-2, 30 h)",
        "terms": ["assemblage", "assembly", "soudage", "welding", "weld", "brasage",
                  "brazing", "collage", "bonding", "rivet"],
    },
    {
        "id": "prod6", "axis": "prod", "weight": 7,
        "source": "Outils et moyens de fabrication (259-1, 30 h)",
        "terms": ["usinage", "machining", "tournage", "fraisage", "milling", "cnc",
                  "decoupe", "cutting", "presse", "press", "rectification"],
    },
    {
        "id": "prod5", "axis": "prod", "weight": 4,
        "source": "Gestion de projet (232-5), Management (233-1, 241-3, 775-2)",
        "terms": ["lean", "kaizen", "5s", "smed", "productivite", "productivity",
                  "optimisation des procedes", "process optimization",
                  "industrial engineer", "ingenierie industrielle"],
    },
    {
        "id": "prod7", "axis": "prod", "weight": 3,
        "source": "Vocabulaire industriel courant (présent dans plus de 8 % des offres)",
        "terms": ["fabrication", "ingenierie", "engineering", "manufacturing",
                  "methodes", "amelioration continue", "continuous improvement",
                  "installations industrielles", "equipements industriels",
                  "equipement industriel", "developpement produit", "product development",
                  "machine speciale", "suivi de fabrication"],
    },

    # ---------------- Axe Qualité / contrôle / END (99 h) ----------------
    {
        "id": "qual1", "axis": "qual", "weight": 8,
        "source": "Contrôles non destructifs (781-1, 30 h)",
        "terms": ["controle non destructif", "controles non destructifs", "cnd",
                  "non destructive testing", "non-destructive", "ndt", "ultrason",
                  "ultrasonic", "radiographie", "radiography", "ressuage",
                  "magnetoscopie", "courants de foucault", "eddy current",
                  "tomographie"],
    },
    {
        "id": "qual3", "axis": "qual", "weight": 7,
        "source": "Plans d'expériences (283-1, 15 h), Outils logiciels mathématiques et statistiques (289-1, 25 h)",
        "terms": ["plan d'experiences", "design of experiments", "doe", "spc",
                  "maitrise statistique", "six sigma", "capabilite", "capability",
                  "amdec", "fmea", "8d", "statistiques", "statistical"],
    },
    {
        "id": "qual2", "axis": "qual", "weight": 4,
        "source": "Qualité et normes (774-1, 14 h, coefficient 0,5)",
        "terms": ["assurance qualite", "quality assurance", "qualite fournisseur",
                  "supplier quality", "quality engineer", "iso 9001", "iatf",
                  "en 9100", "iso 17025"],
    },
    {
        "id": "qual4", "axis": "qual", "weight": 4,
        "source": "Introduction aux techniques expérimentales (267-1, 15 h)",
        "terms": ["metrologie", "metrology", "mesure dimensionnelle", "dimensional",
                  "banc d'essai", "test bench", "tomographie industrielle"],
    },
    {
        "id": "qual5", "axis": "qual", "weight": 2,
        "source": "Vocabulaire qualité courant (présent dans plus de 8 % des offres)",
        "terms": ["qualite", "quality", "standards", "normes", "conformite",
                  "compliance", "validation", "qualification", "essais", "testing",
                  "inspection", "audit", "root cause", "certification"],
    },

    # ---------------- Axe Calcul / simulation / CAO (362 h) ----------------
    {
        "id": "calc1", "axis": "calc", "weight": 12,
        "source": "Éléments finis (256-1, 24 h), TP simulation numérique (272-1, 285-5, 285-4, 63 h), Calculs numériques de mise en forme (277-1, 286-1, 50 h)",
        "terms": ["elements finis", "element finis", "finite element", "fem", "fea",
                  "abaqus", "ansys", "nastran", "simulation numerique",
                  "numerical simulation", "autoform", "pam-stamp", "ls-dyna",
                  "modelisation", "modelling", "modeling", "cfd", "jumeau numerique",
                  "digital twin"],
    },
    {
        "id": "calc3", "axis": "calc", "weight": 11,
        "source": "Résistance des matériaux 1 et 2 (263-1, 270-1, 60 h), Élastoplasticité (279-1, 45 h)",
        "terms": ["resistance des materiaux", "calcul de structure", "structural analysis",
                  "structural calculation", "elastoplasticite", "plasticity",
                  "dimensionnement", "sizing", "stress engineer", "calcul mecanique",
                  "mecanique des milieux continus", "vibration"],
    },
    {
        "id": "calc2", "axis": "calc", "weight": 9,
        "source": "CAO (278-1, 30 h), Conception mécanique (264-1, 43 h)",
        "terms": ["cao", "cad", "catia", "solidworks", "creo", "nx", "conception mecanique",
                  "mechanical design", "design engineer", "bureau d'etudes",
                  "dessin technique", "gd&t", "tolerancement"],
    },
    {
        "id": "calc4", "axis": "calc", "weight": 4,
        "source": "Outils et méthodes de calcul numérique (258-1, 15 h), Excel et macros (266-1, 20 h), Asservissement (840-1, 12 h)",
        "terms": ["python", "matlab", "vba", "macro", "data analysis", "scripting",
                  "automatisation", "automation", "asservissement", "control system"],
    },
]

# --- Secteurs porteurs pour ce profil (bonus léger) -------------------------
SECTOR_BONUS = {
    "weight": 5,
    "terms": ["aeronautique", "aerospace", "aeronautical", "aviation", "spatial", "space",
              "automobile", "automotive", "naval", "shipbuilding", "marine", "defense",
              "defence", "nucleaire", "nuclear", "ferroviaire", "railway", "rail",
              "energie", "energy", "oil and gas", "petrochimie", "siderurgie", "steelmaking",
              "chimie", "chemical", "industriel", "industrial", "mecanique", "mechanical"],
}

# --- Signaux d'exclusion : postes clairement hors formation -----------------
# Ces termes retirent des points s'ils apparaissent dans l'INTITULÉ de l'offre.
TITLE_PENALTIES = {
    "weight": -22,
    "terms": ["business developer", "business development", "sales", "commercial",
              "vente", "marketing", "communication", "digital marketing", "finance",
              "controle de gestion", "controleur de gestion", "comptab", "accounting",
              "audit financier", "ressources humaines", "human resources", "recruit",
              "juridique", "legal", "avocat", "developpeur web", "web developer",
              "front-end", "back-end", "fullstack", "data scientist", "cybersecurit",
              "graphiste", "designer graphique", "tourisme", "evenementiel",
              "trade", "export area manager", "acheteur", "purchasing", "buyer"],
}

# Termes d'intitulé qui confirment un poste technique cœur de cible (bonus fort)
TITLE_BONUSES = {
    "weight": 14,
    "terms": ["materiaux", "materials", "metallurg", "process", "procede", "qualite",
              "quality", "manufacturing", "production", "industrialisation",
              "mecanique", "mechanical", "r&d", "welding", "soudage", "foundry",
              "fonderie", "cnd", "ndt", "methodes", "maintenance", "hse",
              "ingenieur", "engineer", "engineering"],
}

# Bonus si l'offre mentionne un niveau d'études compatible bac+5 ingénieur
LEVEL_TERMS = ["bac+5", "bac +5", "master", "ingenieur", "engineer", "msc", "grande ecole"]

# --- Ancrage industriel ------------------------------------------------
# Une offre qui ne contient AUCUN de ces termes ne parle pas de matière, de
# pièce ou de procédé : quels que soient les mots communs qu'elle partage avec
# le référentiel (qualité, validation, python, amélioration continue), elle
# n'est pas un poste de la filière. Son score est alors plafonné.
#
# Sans ce garde-fou, une offre de support informatique en salle de marché
# atteignait 59/100 en déclenchant sept familles sur du vocabulaire partagé.
INDUSTRIAL_ANCHORS = [
    # Matière
    "materiau", "materiaux", "material", "metal", "metallurg", "alliage",
    "alloy", "acier", "steel", "aluminium", "titane", "titanium", "fonte",
    "polymere", "polymer", "composite", "ceramique", "ceramic", "verre",
    "microstructure", "corrosion",
    # Pièce et conception
    "piece", "part", "mecanique", "mechanical", "conception mecanique",
    "cao", "cad", "catia", "solidworks", "creo", "bureau d'etudes",
    "elements finis", "finite element", "fem", "fea", "abaqus", "ansys",
    "dimensionnement", "resistance des materiaux", "tolerancement",
    # Procédé et atelier
    "usinage", "machining", "fonderie", "foundry", "moulage", "forgeage",
    "forging", "emboutissage", "stamping", "extrusion", "laminage",
    "soudage", "welding", "brasage", "assemblage", "mise en forme",
    "forming", "traitement thermique", "heat treatment", "revetement",
    "coating", "outillage", "tooling", "usine", "atelier", "plant",
    "manufacturing", "production line", "ligne de production",
    "industrialisation", "industrialization", "fabrication",
    # Contrôle
    "controle non destructif", "non destructive", "ndt", "cnd", "ultrason",
    "ultrasonic", "radiographie", "metrologie", "metrology", "essais mecaniques",
    "mechanical testing", "fatigue", "rupture", "fracture",
]

# Score maximum d'une offre dépourvue d'ancrage industriel
ANCHORLESS_CAP = 30

# --- Métiers du numérique appliqués à l'industrie ----------------------
# Cas différent du précédent : l'offre parle bel et bien de matière, de
# procédés et d'usine — l'ancrage industriel est légitime — mais le POSTE
# est un poste de données, d'IA ou d'informatique. L'annonce décrit alors
# l'atelier parce que les données viennent de l'atelier, pas parce qu'on y
# travaille.
#
# Exemple : « Chargé(e) de projets Data, Digital & IA – Ingénierie Avancée
# de Fabrication » (Faurecia, Hanovre) atteignait 89/100 en déclenchant dix
# familles sur emboutissage, soudage, outillage, inspection, statistiques —
# tous présents, tous hors du métier visé, puisque le profil demandé est
# « Science des données / Informatique / Intelligence artificielle ».
#
# On se fie donc à l'INTITULÉ, seul endroit où l'employeur dit quel métier
# il recrute. Si l'intitulé annonce un métier du numérique, le score est
# plafonné : l'offre reste visible et consultable, mais elle ne peut plus
# être présentée comme cœur de cible.
DIGITAL_TITLE_TERMS = [
    # Données
    "data", "donnees", "big data", "dataviz", "business intelligence",
    # Intelligence artificielle
    "ia", "intelligence artificielle", "artificial intelligence",
    "machine learning", "apprentissage automatique", "deep learning",
    "vision par ordinateur", "computer vision",
    # Numérique et systèmes d'information
    "digital", "digitalisation", "transformation numerique",
    "informatique", "it", "systemes d'information", "information systems",
    "erp", "sap", "crm", "cloud", "devops", "cybersecurit",
    # Développement logiciel
    "developpeur", "developer", "developpement logiciel", "software",
    "logiciel", "web", "front-end", "back-end", "fullstack",
    "application support", "support applicatif",
]

# Score maximum d'une offre dont l'intitulé annonce un métier du numérique.
# Fixé juste au niveau « À examiner » : l'offre n'est pas écartée, elle est
# remise à sa place.
DIGITAL_ROLE_CAP = 35

# --- Discipline exigée par l'employeur ---------------------------------
# Le « profil recherché » est le seul endroit où l'employeur nomme lui-même
# la formation qu'il cherche. C'est un signal plus fiable que l'intitulé :
# « Spécialisation en : Science des données / Informatique » (Faurecia) ou
# « Diplôme en Génie électronique, Physique ou équivalent » (ST) disent en
# une ligne ce que trois paragraphes de missions laissaient deviner.
#
# Règle : si le profil nomme au moins une discipline étrangère ET aucune
# discipline acceptée, l'offre est plafonnée. Nommer une discipline
# acceptée suffit à passer — une annonce ouverte à plusieurs cursus ne doit
# pas être écartée parce qu'elle en cite un autre à côté.
FIELD_ACCEPTED = [
    # Le cœur du diplôme
    "materiaux", "materials", "material science", "science des materiaux",
    "genie des materiaux", "materials engineering", "metallurgie", "metallurgy",
    # Équivalences retenues par l'étudiant
    "mecanique", "mechanical", "genie mecanique", "mechanical engineering",
    "genie des procedes", "process engineering", "chemical engineering",
    "physique", "physics", "sciences physiques",
]

FIELD_FOREIGN = [
    "electronique", "electronic engineering", "electrotechnique",
    "informatique", "computer science", "software engineering",
    "science des donnees", "data science", "intelligence artificielle",
    "apprentissage automatique", "machine learning",
    "genie civil", "civil engineering", "telecommunications",
    "genie industriel", "industrial engineering",
    "biologie", "biotechnologie", "pharmacie", "agronomie",
    "commerce", "gestion", "marketing", "droit", "finance",
]

# Score maximum d'une offre dont la discipline exigée est étrangère
FOREIGN_FIELD_CAP = 35

# Seuil sous lequel une offre n'est pas retenue dans le site (0-100)
DEFAULT_THRESHOLD = 25
