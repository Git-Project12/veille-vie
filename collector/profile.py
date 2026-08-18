"""
Référentiel de compétences — ENSICAEN, filière Matériaux & Mécanique (apprentissage).

Chaque famille de mots-clés est dérivée d'un module réel du programme (S5 à S10).
Le champ `source` indique le(s) module(s) d'origine : c'est ce qui permet, dans le
site, d'afficher POURQUOI une offre est jugée pertinente.

Pour ajuster le ciblage : modifier les poids (`weight`) ou ajouter des termes.
Tous les termes sont comparés en minuscules, sans accents.
"""

# --- Axes de recherche retenus pour ce profil -------------------------------
AXES = {
    "rd": {"label": "R&D matériaux / labo", "color": "#2E5E4E"},
    "prod": {"label": "Production / méthodes", "color": "#8A4B1F"},
    "qual": {"label": "Qualité / contrôle / END", "color": "#3A4E7A"},
    "calc": {"label": "Calcul / simulation / CAO", "color": "#6B4A7A"},
}

# --- Familles de mots-clés --------------------------------------------------
# weight : points par famille (saturée : une famille ne compte qu'une fois,
# quel que soit le nombre de termes trouvés — évite qu'une offre bavarde gagne).
KEYWORD_FAMILIES = [
    # ---------------- Axe R&D matériaux / laboratoire ----------------
    {
        "id": "rd1", "axis": "rd", "weight": 10, "source": "Métallurgie 1 & 2 (280-1, 287-1)",
        "terms": ["metallurgie", "metallurgy", "metallurgical", "alliage", "alloy",
                  "acier", "steel", "aluminium", "titane", "titanium", "fonte",
                  "microstructure", "phase transformation", "traitement thermique",
                  "heat treatment", "trempe", "quenching"],
    },
    {
        "id": "rd2", "axis": "rd", "weight": 10, "source": "Propriétés mécaniques et physique des matériaux (262-1)",
        "terms": ["materiaux", "material science", "materials engineer", "materials science",
                  "science des materiaux", "werkstoff", "caracterisation",
                  "characterization", "characterisation"],
    },
    {
        "id": "rd3", "axis": "rd", "weight": 9, "source": "Dégradation des matériaux (300-2), Traitements de surface (306-2)",
        "terms": ["corrosion", "degradation", "oxydation", "oxidation", "vieillissement",
                  "ageing", "aging", "traitement de surface", "surface treatment",
                  "revetement", "coating", "galvanisation", "anodisation", "tribologie",
                  "usure", "wear"],
    },
    {
        "id": "rd4", "axis": "rd", "weight": 9, "source": "Rupture et fatigue des matériaux (291-1)",
        "terms": ["fatigue", "rupture", "fracture", "endommagement", "damage tolerance",
                  "crack", "fissuration", "duree de vie", "lifetime prediction",
                  "essais mecaniques", "mechanical testing", "traction", "tensile test"],
    },
    {
        "id": "rd5", "axis": "rd", "weight": 8, "source": "Mise en forme des polymères et composites (304-2), Céramiques et verre (303-2)",
        "terms": ["composite", "polymere", "polymer", "plasturgie", "thermoplastique",
                  "ceramique", "ceramic", "verre", "glass", "fibre de carbone",
                  "carbon fiber", "carbon fibre", "resine", "resin"],
    },
    {
        "id": "rd6", "axis": "rd", "weight": 8, "source": "Comportement mécanique des matériaux non conventionnels (298-2), Projet de recherche (261-1)",
        "terms": ["r&d", "recherche et developpement", "research and development",
                  "laboratoire", "laboratory", "innovation materiaux", "new materials",
                  "additive manufacturing", "fabrication additive", "impression 3d",
                  "3d printing", "batterie", "battery", "hydrogene", "hydrogen"],
    },
    {
        "id": "rd7", "axis": "rd", "weight": 6, "source": "Recyclage des matériaux, Éco-conception (842-1), Enjeux DDRS (838-1)",
        "terms": ["recyclage", "recycling", "eco-conception", "ecodesign", "circular economy",
                  "economie circulaire", "acv", "life cycle assessment", "decarbonation",
                  "decarbonization", "sustainab"],
    },

    # ---------------- Axe Production / méthodes / industrialisation ----------------
    {
        "id": "prod1", "axis": "prod", "weight": 10,
        "source": "Mise en forme par déformation plastique des métaux (281-1), Physique de la mise en forme (290-1)",
        "terms": ["mise en forme", "forming", "metal forming", "emboutissage", "stamping",
                  "forgeage", "forging", "laminage", "rolling", "extrusion", "estampage",
                  "deformation plastique", "sheet metal"],
    },
    {
        "id": "prod2", "axis": "prod", "weight": 9, "source": "Mise en forme par solidification (288-1), Outils et moyens de fabrication (259-1)",
        "terms": ["fonderie", "foundry", "casting", "moulage", "solidification",
                  "injection", "die casting", "frittage", "sintering"],
    },
    {
        "id": "prod3", "axis": "prod", "weight": 9, "source": "Assemblage des matériaux (297-2)",
        "terms": ["assemblage", "assembly", "soudage", "welding", "weld", "brasage",
                  "brazing", "collage", "bonding", "rivet", "joining"],
    },
    {
        "id": "prod4", "axis": "prod", "weight": 10, "source": "Outils de production (269-1), Tenue mécanique des outillages (284-3, 292-1)",
        "terms": ["procede", "process engineer", "process engineering", "manufacturing engineer",
                  "industrialisation", "industrialization", "methodes", "methods engineer",
                  "outillage", "tooling", "ligne de production", "production line",
                  "atelier", "shop floor", "usine", "plant", "manufacturing"],
    },
    {
        "id": "prod5", "axis": "prod", "weight": 7, "source": "Gestion de projet (232-5), Management (233-1, 241-3, 775-2)",
        "terms": ["lean", "amelioration continue", "continuous improvement", "kaizen",
                  "5s", "smed", "productivite", "productivity", "optimisation des procedes",
                  "process optimization", "industrial engineer", "ingenierie industrielle"],
    },
    {
        "id": "prod6", "axis": "prod", "weight": 6, "source": "Usinage / moyens de fabrication (259-1)",
        "terms": ["usinage", "machining", "tournage", "fraisage", "milling", "cnc",
                  "decoupe", "cutting", "presse", "press"],
    },

    # ---------------- Axe Qualité / contrôle / END ----------------
    {
        "id": "qual1", "axis": "qual", "weight": 11, "source": "Contrôles non destructifs (781-1)",
        "terms": ["controle non destructif", "controles non destructifs", "cnd",
                  "non destructive testing", "non-destructive", "ndt", "ultrason",
                  "ultrasonic", "radiographie", "radiography", "ressuage",
                  "magnetoscopie", "courants de foucault", "eddy current",
                  "tomographie", "inspection"],
    },
    {
        "id": "qual2", "axis": "qual", "weight": 10, "source": "Qualité et normes (774-1)",
        "terms": ["qualite", "quality", "quality engineer", "assurance qualite",
                  "quality assurance", "qualite fournisseur", "supplier quality",
                  "iso 9001", "iatf", "en 9100", "audit", "conformite", "compliance",
                  "normes", "standards", "certification"],
    },
    {
        "id": "qual3", "axis": "qual", "weight": 8, "source": "Plans d'expériences (283-1), Outils logiciels mathématiques et statistiques (289-1)",
        "terms": ["plan d'experiences", "design of experiments", "doe", "spc",
                  "maitrise statistique", "six sigma", "statistiques", "statistical",
                  "capabilite", "capability", "amdec", "fmea", "8d",
                  "root cause", "analyse de defaillance", "failure analysis"],
    },
    {
        "id": "qual4", "axis": "qual", "weight": 7, "source": "Introduction aux techniques expérimentales (267-1)",
        "terms": ["metrologie", "metrology", "mesure dimensionnelle", "dimensional",
                  "banc d'essai", "test bench", "essais", "testing", "validation",
                  "qualification"],
    },

    # ---------------- Axe Calcul / simulation / CAO (transverse) ----------------
    {
        "id": "calc1", "axis": "calc", "weight": 9,
        "source": "Introduction à la méthode des éléments finis (256-1), TP Simulation numérique (272-1, 285-x)",
        "terms": ["elements finis", "element finis", "finite element", "fem", "fea",
                  "abaqus", "ansys", "nastran", "simulation numerique",
                  "numerical simulation", "forge", "autoform", "pam-stamp", "ls-dyna",
                  "modelisation", "modelling", "modeling", "cfd"],
    },
    {
        "id": "calc2", "axis": "calc", "weight": 8, "source": "CAO (278-1), Conception mécanique (264-1), Critères de choix des matériaux (265-1)",
        "terms": ["cao", "cad", "catia", "solidworks", "creo", "nx", "conception mecanique",
                  "mechanical design", "design engineer", "bureau d'etudes",
                  "dessin technique", "gd&t", "tolerancement"],
    },
    {
        "id": "calc3", "axis": "calc", "weight": 8, "source": "Résistance des matériaux 1 & 2 (263-1, 270-1), Élastoplasticité (279-1)",
        "terms": ["resistance des materiaux", "calcul de structure", "structural analysis",
                  "structural calculation", "elastoplasticite", "plasticity",
                  "dimensionnement", "sizing", "stress engineer", "calcul mecanique",
                  "mecanique des milieux continus", "vibration"],
    },
    {
        "id": "calc4", "axis": "calc", "weight": 5,
        "source": "Outils et méthodes de calcul numérique (258-1), Initiation Excel et macros (266-1), Asservissement (840-1)",
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

# Seuil sous lequel une offre n'est pas retenue dans le site (0-100)
DEFAULT_THRESHOLD = 25
