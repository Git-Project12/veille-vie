/* Veille V.I.E — Matériaux & Mécanique
   Lit data/offers.json produit par le collecteur.
   Aucune dépendance : le site reste un dossier de fichiers statiques.

   Organisation : plusieurs onglets (toutes, favoris, recommandées, échéances,
   nouveautés, candidatures) partageant la même liste d'offres filtrée. */

const AXIS_LABELS = {
  rd: "R&D matériaux / labo",
  prod: "Production / méthodes",
  qual: "Qualité / contrôle / END",
  calc: "Calcul / simulation / CAO",
};

const AXIS_ORDER = ["rd", "prod", "qual", "calc"];
let PAGE_STEP = 25;          // ajustable depuis le panneau de filtres
const PAGE_SIZES = [25, 50, 75, 100];
const UI_VERSION = "26";   // affiché en pied de page : permet de vérifier
                          // quelle version de l'interface est réellement chargée
const EXPIRY_WINDOW_DAYS = 14;   // seuil de l'onglet « échéances »
const NEW_WINDOW_HOURS = 24;     // durée pendant laquelle une offre reste « nouvelle »

const STATUSES = {
  "": "—",
  todo: "À postuler",
  sent: "Candidature envoyée",
  followup: "Relancée",
  interview: "Entretien",
  rejected: "Refusée",
};

const COMPANIES = [
  { name: "Safran", sector: "Aéronautique" },
  { name: "Airbus", sector: "Aéronautique" },
  { name: "Naval Group", sector: "Naval / défense" },
  { name: "Thales", sector: "Défense / électronique" },
  { name: "Dassault Aviation", sector: "Aéronautique" },
  { name: "Renault Group", sector: "Automobile" },
  { name: "Stellantis", sector: "Automobile" },
  { name: "Valeo", sector: "Équipementier auto" },
  { name: "Forvia", sector: "Équipementier auto" },
  { name: "Michelin", sector: "Polymères / composites" },
  { name: "Alstom", sector: "Ferroviaire" },
  { name: "TotalEnergies", sector: "Énergie" },
  { name: "EDF", sector: "Nucléaire" },
  { name: "Framatome", sector: "Nucléaire" },
  { name: "Orano", sector: "Nucléaire" },
  { name: "ArcelorMittal", sector: "Sidérurgie" },
  { name: "Constellium", sector: "Aluminium" },
  { name: "Aubert & Duval", sector: "Métallurgie" },
  { name: "Saint-Gobain", sector: "Verre / céramiques" },
  { name: "Vallourec", sector: "Tubes / acier" },
  { name: "Nexans", sector: "Câbles / métallurgie" },
  { name: "Air Liquide", sector: "Gaz industriels / soudage" },
  { name: "Schneider Electric", sector: "Équipements électriques" },
  { name: "Bureau Veritas", sector: "Contrôle / certification" },
  { name: "Apave", sector: "Contrôle / END" },
  { name: "Legrand", sector: "Équipements électriques" },
];

let DATA = { offers: [], families: [], scoring: {} };
let PREFS = { weights: {}, favorites: [], tracking: {}, archive: {},
              hidden: [], excludedCountries: [], lastVisit: null };
let filtered = [];
let shown = PAGE_STEP;
let currentTab = "all";
let searchTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ============================ Préférences ============================ */

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem("vie-prefs") || "null");
    if (saved) PREFS = { ...PREFS, ...saved };
  } catch (e) { /* stockage indisponible : on reste sur les valeurs par défaut */ }
  if (!PREFS.favorites) PREFS.favorites = [];
  if (!PREFS.tracking) PREFS.tracking = {};
  if (!PREFS.weights) PREFS.weights = {};
  if (!PREFS.archive) PREFS.archive = {};
  if (!PREFS.hidden) PREFS.hidden = [];
  if (!PREFS.excludedCountries) PREFS.excludedCountries = [];
}

function savePrefs() {
  try { localStorage.setItem("vie-prefs", JSON.stringify(PREFS)); } catch (e) { /* ignoré */ }
}

function weightOf(familyId) {
  const fam = DATA.families.find((f) => f.id === familyId);
  const fallback = fam ? fam.weight : 0;
  const custom = PREFS.weights[familyId];
  return custom === undefined || custom === null ? fallback : Number(custom);
}

function isFavorite(id) { return PREFS.favorites.includes(id); }

/* Offres écartées.

   Sur plusieurs centaines d'annonces, beaucoup se rejettent en trois secondes
   — et réapparaissent chaque jour. Les masquer les range hors de vue sans les
   détruire : un interrupteur dans le panneau de filtres les fait revenir, et
   mettre une offre en favori la démasque, puisque l'étoile dit l'inverse. */
function isHidden(id) { return PREFS.hidden.includes(id); }

function toggleHidden(id) {
  const i = PREFS.hidden.indexOf(id);
  if (i === -1) PREFS.hidden.push(id); else PREFS.hidden.splice(i, 1);
  savePrefs();
}

function afficherMasquees() {
  const bascule = $("#show-hidden");
  return bascule ? bascule.checked : false;
}

/* Retire les offres écartées, sauf quand on demande à les voir. */
function sansMasquees(liste) {
  return afficherMasquees() ? liste : liste.filter((o) => !isHidden(o.id));
}

/* Une offre retirée de Business France disparaît de la collecte suivante.
   On conserve donc une copie locale autonome de chaque favori : entreprise,
   intitulé, lieu, dates, score et profil recherché restent consultables même
   quand l'annonce n'existe plus en ligne. */
function archiveSnapshot(offer) {
  const previous = PREFS.archive[offer.id] || {};
  return {
    id: offer.id,
    title: offer.title,
    company: offer.company,
    country: offer.country,
    city: offer.city,
    duration: offer.duration,
    start_date: offer.start_date,
    expiry_date: offer.expiry_date,
    publish_date: offer.publish_date,
    dates_raw: offer.dates_raw,
    url: offer.url,
    sector: offer.sector,
    summary: offer.summary,
    profile: offer.profile,
    profile_extracted: offer.profile_extracted,
    score: offer.score,
    label: offer.label,
    axis_scores: offer.axis_scores,
    dominant_axis: offer.dominant_axis,
    matched_families: offer.matched_families,
    bonuses: offer.bonuses,
    archived_at: previous.archived_at || new Date().toISOString(),
  };
}

function toggleFavorite(id) {
  const i = PREFS.favorites.indexOf(id);
  if (i === -1) {
    PREFS.favorites.push(id);
    // Étoiler une offre masquée la fait réapparaître : les deux gestes
    // disent le contraire l'un de l'autre.
    const rang = PREFS.hidden.indexOf(id);
    if (rang !== -1) PREFS.hidden.splice(rang, 1);
    const offer = DATA.offers.find((o) => o.id === id);
    if (offer) PREFS.archive[id] = archiveSnapshot(offer);
  } else {
    PREFS.favorites.splice(i, 1);
    // La copie archivée survit au retrait du favori : elle ne disparaît que
    // sur demande explicite, depuis l'onglet Archives.
  }
  savePrefs();
}

/* Une archive est « en ligne » tant que la collecte du jour la contient. */
function isStillOnline(id) {
  return DATA.offers.some((o) => o.id === id);
}

/* Tant qu'une annonce est en ligne, sa copie suit la dernière version connue.
   Une fois retirée, la copie reste figée dans son dernier état. */
function refreshArchive() {
  let changed = false;
  for (const offer of DATA.offers) {
    if (isFavorite(offer.id)) {
      PREFS.archive[offer.id] = archiveSnapshot(offer);
      changed = true;
    }
  }
  if (changed) savePrefs();
}

function removeFromArchive(id) {
  delete PREFS.archive[id];
  savePrefs();
}

/* L'onglet Favoris ne montre que les offres encore collectées ; les copies
   des annonces retirées vivent dans l'onglet Archives. */
function favoritePool() {
  return DATA.offers.filter((o) => isFavorite(o.id));
}

/* Toutes les copies conservées, la plus récemment archivée en tête. */
function archivePool() {
  return Object.values(PREFS.archive)
    .map((snap) => ({ ...snap, _archived: true, _online: isStillOnline(snap.id) }))
    .sort((a, b) => String(b.archived_at || "").localeCompare(String(a.archived_at || "")));
}

/* ============================ Scoring ============================ */

/* Reproduit la formule du collecteur, mais avec les pondérations choisies
   ici. Permet de régler les curseurs et de voir les scores bouger sans
   relancer quoi que ce soit. */
function computeScore(offer) {
  const points = { rd: 0, prod: 0, qual: 0, calc: 0 };

  for (const hit of offer.matched_families || []) {
    points[hit.axis] += weightOf(hit.id);
  }

  const k = DATA.scoring || {};

  /* Référence d'un axe : la somme des poids de ses N familles les plus
     lourdes — trois signaux forts le portent à 100, quel que soit l'axe.
     Auparavant on divisait par la somme de TOUTES les familles de l'axe,
     si bien que l'axe qui en comptait le moins saturait le plus vite.
     Recalculé ici à partir des poids courants : régler un curseur dans
     « Pondérer les critères » déplace la référence avec lui. */
  const nTop = k.axis_top_families || 3;
  const priorite = k.axis_priority || {};
  const max = { rd: 0, prod: 0, qual: 0, calc: 0 };
  for (const axis of AXIS_ORDER) {
    const poids = DATA.families
      .filter((f) => f.axis === axis)
      .map((f) => weightOf(f.id))
      .sort((a, b) => b - a)
      .slice(0, nTop);
    max[axis] = poids.reduce((s, v) => s + v, 0) || 1;
  }

  const axisScores = {};
  for (const axis of AXIS_ORDER) {
    axisScores[axis] = Math.min(100, Math.round(
      100 * points[axis] / max[axis] * (priorite[axis] ?? 1)));
  }
  const topW = k.top_weights || [0.6, 0.25];
  const restW = k.rest_weight ?? 0.15;

  const ordered = AXIS_ORDER.map((a) => axisScores[a]).sort((a, b) => b - a);
  const rest = ordered.slice(topW.length);
  let score = ordered[0] * topW[0] + ordered[1] * topW[1] +
    (rest.length ? rest.reduce((s, v) => s + v, 0) / rest.length : 0) * restW;

  for (const bonus of offer.bonuses || []) score += bonus.points;

  score = Math.max(0, Math.min(100, Math.round(score)));

  /* Certains bonus ne sont pas des points mais des plafonds : offre sans
     ancrage industriel, intitulé de métier du numérique. On les applique
     comme un plafond et non comme un retrait fixe, sinon un relèvement des
     pondérations ici ferait repasser l'offre au-dessus. */
  for (const bonus of offer.bonuses || []) {
    if (typeof bonus.cap === "number") score = Math.min(score, bonus.cap);
  }

  let dominant = null, best = 0;
  for (const axis of AXIS_ORDER) {
    if (axisScores[axis] > best) { best = axisScores[axis]; dominant = axis; }
  }

  return { score, axisScores, dominant };
}

function labelFor(score) {
  if (score >= 70) return "Cœur de cible";
  if (score >= 50) return "Bonne adéquation";
  if (score >= 35) return "À examiner";
  return "Périphérique";
}

function rescoreAll() {
  for (const offer of DATA.offers) {
    const r = computeScore(offer);
    offer.score = r.score;
    offer.axis_scores = r.axisScores;
    offer.dominant_axis = r.dominant;
    offer.label = labelFor(r.score);
  }
}

/* ============================ Dates ============================ */

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function bestExpiry(offer) {
  // La date d'expiration peut porter des noms variés selon l'API : on prend
  // le champ identifié, sinon la première date brute qui évoque une fin.
  let d = parseDate(offer.expiry_date);
  if (d) return d;
  for (const [key, value] of Object.entries(offer.dates_raw || {})) {
    const k = key.toLowerCase();
    if (k.includes("expir") || k.includes("limit") || k.includes("deadline") ||
        k.includes("fin") || k.includes("closing")) {
      d = parseDate(value);
      if (d) return d;
    }
  }
  return null;
}

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((date - new Date()) / 86400000);
}

/* Une offre reste « nouvelle » pendant 24 heures après sa première détection.

   Règle volontairement indépendante des visites : consulter le site ne vide
   plus l'onglet, et une offre repérée le matin reste visible le soir. Le
   critère est le même pour le compteur et pour la liste, ce qui écarte toute
   divergence entre les deux. */
function isNewOffer(offer) {
  const seen = parseDate(offer.first_seen);
  if (!seen) return false;
  return (new Date() - seen) / 3600000 <= NEW_WINDOW_HOURS;
}

/* Ancienneté exprimée en clair : « il y a 3 h » parle davantage qu'une date
   pour une annonce récente, et l'on repasse à la date au-delà d'une semaine. */
function timeAgo(value) {
  const d = parseDate(value);
  if (!d) return "";
  const hours = (new Date() - d) / 3600000;
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `il y a ${days} j`;
  return formatDate(d, { day: "numeric", month: "short", year: "numeric" });
}

/* Date de publication si l'annonce en porte une, sinon date de première
   détection par le collecteur. Les deux sont distinguées explicitement :
   confondre « publiée » et « repérée » induirait en erreur sur l'ancienneté
   réelle d'une offre. */
function publicationLabel(offer) {
  // Au-delà d'une semaine, timeAgo renvoie une date absolue, qui appelle
  // l'article : « publiée le 24 mai » et non « publiée 24 mai ».
  const phrase = (verbe, valeur) => {
    const quand = timeAgo(valeur);
    if (!quand) return "";
    const relatif = quand.startsWith("il y a") || quand === "à l'instant";
    return `${verbe} ${relatif ? "" : "le "}${quand}`;
  };
  if (offer.publish_date) return phrase("publiée", offer.publish_date);
  if (offer.first_seen) return phrase("repérée", offer.first_seen);
  return "";
}

function formatDate(value, opts) {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", opts || { month: "short", year: "numeric" });
}

/* ============================ Recommandations ============================ */

/* Profil de goût : moyenne des offres mises en favori, sur les quatre axes
   et sur les familles de mots-clés. Les offres restantes sont classées par
   proximité — une simple distance, pas une boîte noire. */
function recommendations() {
  const favs = DATA.offers.filter((o) => isFavorite(o.id));
  if (favs.length === 0) return [];

  const profile = { rd: 0, prod: 0, qual: 0, calc: 0 };
  const famCount = {};
  for (const f of favs) {
    for (const axis of AXIS_ORDER) profile[axis] += (f.axis_scores?.[axis] || 0) / favs.length;
    for (const hit of f.matched_families || []) {
      famCount[hit.id] = (famCount[hit.id] || 0) + 1;
    }
  }

  const norm = (v) => Math.sqrt(AXIS_ORDER.reduce((s, a) => s + v[a] * v[a], 0)) || 1;
  const pNorm = norm(profile);

  const scored = DATA.offers
    .filter((o) => !isFavorite(o.id))
    .map((o) => {
      const dot = AXIS_ORDER.reduce((s, a) => s + profile[a] * (o.axis_scores?.[a] || 0), 0);
      const cosine = dot / (pNorm * norm(o.axis_scores || {}));

      const hits = (o.matched_families || []).map((h) => h.id);
      const shared = hits.filter((id) => famCount[id]).length;
      const overlap = hits.length ? shared / hits.length : 0;

      // Le favori le plus proche, pour pouvoir justifier la suggestion
      let closest = null, bestSim = -1;
      for (const f of favs) {
        const d = AXIS_ORDER.reduce((s, a) =>
          s + (f.axis_scores?.[a] || 0) * (o.axis_scores?.[a] || 0), 0);
        const sim = d / (norm(f.axis_scores || {}) * norm(o.axis_scores || {}));
        if (sim > bestSim) { bestSim = sim; closest = f; }
      }

      return {
        offer: o,
        affinity: Math.round(100 * (cosine * 0.6 + overlap * 0.4)),
        parts: {
          shape: Math.round(100 * cosine),
          overlap: Math.round(100 * overlap),
          shared,
          total: hits.length,
        },
        because: closest,
      };
    })
    .filter((r) => r.affinity > 35)
    .sort((a, b) => b.affinity - a.affinity || b.offer.score - a.offer.score);

  return scored.slice(0, 60);
}

/* ============================ Chargement ============================ */

async function load() {
  showSkeleton();
  const paths = ["../data/offers.json", "data/offers.json"];
  let lastError = "fichier introuvable";

  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }
      DATA = await res.json();
      if (!DATA.families) DATA.families = [];
      boot();
      return;
    } catch (err) { lastError = err.message; }
  }
  showSetup(lastError);
}

function showSkeleton() {
  $("#count").textContent = "Chargement des offres…";
  $("#list").innerHTML = Array.from({ length: 4 }, () => `
    <article class="offer skeleton" aria-hidden="true">
      <div class="sk sk-title"></div><div class="sk sk-meta"></div>
      <div class="sk sk-bar"></div><div class="sk sk-tags"></div>
    </article>`).join("");
}

function showSetup(reason) {
  const local = location.protocol === "file:";
  $("#count").textContent = "Aucune donnée chargée";
  $("#list").innerHTML = `
    <div class="empty">
      <h3>${local ? "Le site doit être lancé, pas ouvert" : "La recherche n'a pas encore tourné"}</h3>
      ${local
        ? `<p>Cette page a été ouverte depuis le Finder. Dans ce mode, le
             navigateur refuse de lire le fichier des offres.</p>
           <p><strong>Ferme cet onglet, puis double-clique
             <code>Lancer.command</code></strong>.</p>`
        : `<p>Le site attend <code>data/offers.json</code>. Double-clique
             <code>Lancer.command</code> pour lancer la recherche.</p>`}
      <p class="mono detail">Détail technique : ${escapeHtml(reason)}</p>
    </div>`;
  $("#more-wrap").hidden = true;
  stampVersion();
  renderCompanies();
}

function boot() {
  loadPrefs();
  rescoreAll();
  refreshArchive();
  refreshArchive();
  buildAxisFilters();
  buildWeightPanel();
  fillSelect("#country", uniqueValues("country"));
  fillSelect("#company", uniqueValues("company"));
  renderCorpus();
  renderCompanies();
  renderExcludedCountries();
  restoreFilters();
  bindEvents();
  updateFreshness();
  stampVersion();
  updateTabCounts();
  apply();

  // Un lien de synchronisation ouvert sur cet appareil ?
  appliquerLienSync();

  // Coller le lien alors que le site est DÉJÀ ouvert ne recharge pas la page :
  // le navigateur n'y voit qu'un déplacement dans la même page. Sans cette
  // écoute, l'importation ne se déclencherait pas dans ce cas pourtant courant.
  window.addEventListener("hashchange", appliquerLienSync);

  // Mémoriser la visite pour l'onglet « nouveautés » de la prochaine fois
  // La visite en cours est enregistrée pour la PROCHAINE ouverture. VISIT_REF
  // reste inchangée : l'onglet Nouveautés garde son contenu jusqu'au bout.
  setTimeout(() => {
    PREFS.lastVisit = new Date().toISOString();
    savePrefs();
  }, 4000);
}

function bindEvents() {
  $("#filters").addEventListener("change", refilter);
  $("#q").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refilter, 140);
  });
  $("#minscore").addEventListener("input", (e) => {
    $("#minscore-out").textContent = e.target.value;
  });
  $("#reset").addEventListener("click", resetFilters);
  $("#exclude-country").addEventListener("click", excludeCurrentCountry);
  $("#show-hidden").addEventListener("change", updateTabCounts);

  // Le tri est proposé à deux endroits : en tête des résultats, où il est
  // visible, et dans le panneau de filtres. Les deux restent synchronisés.
  const syncSort = (from, to) => {
    $(to).value = $(from).value;
    refilter();
  };
  $("#sort-top").addEventListener("change", () => syncSort("#sort-top", "#sort"));
  $("#sort").addEventListener("change", () => syncSort("#sort", "#sort-top"));

  // Listes à suggestions pour les pays et les entreprises
  for (const nom of ["country", "company"]) setupCombo(nom);

  // Nombre d'offres affichées par page
  $("#page-size").addEventListener("change", (e) => {
    const value = Number(e.target.value);
    PAGE_STEP = value > 0 ? value : Number.MAX_SAFE_INTEGER;
    PREFS.pageSize = value;
    savePrefs();
    shown = PAGE_STEP;
    render();
  });
  $("#more").addEventListener("click", () => { shown += PAGE_STEP; render(); });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentTab = tab.dataset.tab;
      $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      refilter();
    });
  });

  $("#list").addEventListener("click", onListClick);
  bindInfoButtons(document.body);
  $("#list").addEventListener("change", onListChange);
  $("#list").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest(".fav-btn, .hide-btn, select, textarea, a, .info")) return;
    const card = e.target.closest(".offer");
    if (card) { e.preventDefault(); toggleCard(card); }
  });

  $("#weights-reset").addEventListener("click", () => {
    PREFS.weights = {};
    savePrefs();
    buildWeightPanel();
    rescoreAll();
    updateTabCounts();
    apply();
  });

  $("#export-csv").addEventListener("click", exportCsv);
  $("#export-prefs").addEventListener("click", exportPrefs);
  $("#sync-link").addEventListener("click", partagerSync);
  $("#sync-receive").addEventListener("click", recevoirSync);
  $("#import-prefs").addEventListener("change", importPrefs);
  $("#filter-toggle").addEventListener("click", () => {
    const rail = $("#rail");
    const ouvert = rail.classList.toggle("open");
    $("#filter-toggle").setAttribute("aria-expanded", String(ouvert));
    // Le bouton se colle sous la barre d'onglets quand les filtres sont
    // dépliés : il lui faut la hauteur réelle de cette barre.
    const tabs = document.querySelector(".tabs");
    if (tabs) {
      document.documentElement.style.setProperty("--tabs-h", `${tabs.offsetHeight}px`);
    }
    // En repliant depuis le milieu de la liste, on remonte à son début.
    if (!ouvert) scrollToResults();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== $("#q") &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); $("#q").focus(); $("#q").select();
    }
    if (e.key === "Escape" && document.activeElement === $("#q")) {
      $("#q").value = ""; refilter();
    }
  });
}

/* Sur écran tactile il n'y a pas de survol : le « i » s'ouvre aussi au clic.
   Un seul panneau reste ouvert à la fois. */
function bindInfoButtons(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".info-btn");
    if (btn) {
      e.stopPropagation();
      e.preventDefault();
      const parent = btn.closest(".info");
      const open = parent.classList.contains("open");
      $$(".info.open").forEach((i) => {
        i.classList.remove("open");
        i.querySelector(".info-btn")?.setAttribute("aria-expanded", "false");
      });
      parent.classList.toggle("open", !open);
      btn.setAttribute("aria-expanded", String(!open));
      return;
    }
    if (!e.target.closest(".info-bubble")) {
      $$(".info.open").forEach((i) => {
        i.classList.remove("open");
        i.querySelector(".info-btn")?.setAttribute("aria-expanded", "false");
      });
    }
  });
}

function onListClick(e) {
  if (e.target.closest(".info")) { e.stopPropagation(); return; }

  const masquer = e.target.closest(".hide-btn");
  if (masquer) {
    e.stopPropagation();
    toggleHidden(masquer.dataset.id);
    updateTabCounts();
    apply();
    return;
  }

  const drop = e.target.closest(".drop-archive");
  if (drop) {
    e.stopPropagation();
    const snap = PREFS.archive[drop.dataset.id];
    if (snap && confirm(`Retirer « ${snap.title} » de l'archive ?\n\nCette copie locale sera perdue.`)) {
      removeFromArchive(drop.dataset.id);
      updateTabCounts();
      apply();
    }
    return;
  }
  const fav = e.target.closest(".fav-btn");
  if (fav) {
    e.stopPropagation();
    toggleFavorite(fav.dataset.id);
    updateTabCounts();
    if (currentTab === "fav" || currentTab === "reco" || currentTab === "archive") apply();
    else {
      fav.classList.toggle("on", isFavorite(fav.dataset.id));
      fav.setAttribute("aria-pressed", String(isFavorite(fav.dataset.id)));
    }
    return;
  }
  if (e.target.closest("a, select, textarea, .track, .hide-btn")) return;
  toggleCard(e.target.closest(".offer"));
}

function onListChange(e) {
  const card = e.target.closest(".offer");
  if (!card) return;
  const id = card.dataset.id;
  const entry = PREFS.tracking[id] || {};

  if (e.target.matches(".status-select")) {
    entry.status = e.target.value;
    card.dataset.status = e.target.value;
  }
  if (e.target.matches(".note-field")) entry.note = e.target.value;

  if (entry.status || entry.note) PREFS.tracking[id] = entry;
  else delete PREFS.tracking[id];

  savePrefs();
  updateTabCounts();
}

function toggleCard(card) {
  if (!card || card.classList.contains("skeleton")) return;
  card.setAttribute("aria-expanded", String(card.classList.toggle("open")));
}

/* ============================ Filtres et onglets ============================ */

function uniqueValues(field) {
  const counts = new Map();
  for (const o of DATA.offers) {
    const v = (o[field] || "").trim();
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}

const OPTION_CACHE = {};

/* ============================ Listes à suggestions ============================

   Les champs Pays et Entreprise étaient un champ de recherche posé au-dessus
   d'une liste déroulante : il fallait taper le nom, puis ouvrir la liste. On
   écrivait donc dans le vide, sans rien voir venir.

   Ils sont maintenant de vraies listes à suggestions : les propositions
   s'affichent sous le champ dès la première lettre, se parcourent aux flèches
   et se valident à Entrée. Le <select> reste dans la page, masqué : c'est lui
   qui porte la valeur choisie, lu par les filtres et par « Exclure ce pays ».
   Le champ visible n'est qu'une façade. */

const COMBO_MAX = 10;   // propositions affichées avant « et N autres »

/* Minuscules sans accents : « coree » doit trouver « CORÉE DU SUD », et
   « espagne » « ESPAGNE » écrit en capitales par Business France. */
function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fillSelect(sel, entries) {
  OPTION_CACHE[sel] = entries;
  const el = $(sel);
  const placeholder = el.options[0]?.textContent || "Tous";
  const current = el.value;
  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
    entries.map(([value]) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  el.value = current;
}

/* Classement des propositions : ce qui commence par la saisie d'abord, puis
   ce qui la contient. À rang égal, le pays qui a le plus d'offres passe
   devant — taper « a » propose ALLEMAGNE avant AFRIQUE DU SUD. */
function comboMatches(sel, query) {
  const entries = OPTION_CACHE[sel] || [];
  const needle = fold(query.trim());
  if (!needle) return entries.map(([value, count]) => ({ value, count, at: -1 }));

  const out = [];
  for (const [value, count] of entries) {
    const at = fold(value).indexOf(needle);
    if (at !== -1) out.push({ value, count, at });
  }
  return out.sort((a, b) => (a.at === 0 ? 0 : 1) - (b.at === 0 ? 0 : 1) ||
    b.count - a.count || a.value.localeCompare(b.value, "fr"));
}

/* La portion saisie est soulignée dans la proposition, pour qu'on voie
   pourquoi elle est là. Les positions viennent du texte sans accents, qui a
   la même longueur que l'original : les index restent valables. */
function surligner(value, at, length) {
  if (at < 0 || !length) return escapeHtml(value);
  return escapeHtml(value.slice(0, at)) +
    "<mark>" + escapeHtml(value.slice(at, at + length)) + "</mark>" +
    escapeHtml(value.slice(at + length));
}

function setupCombo(nom) {
  const sel = `#${nom}`;
  const select = $(sel);
  const boite = $(`.combo[data-combo="${nom}"]`);
  if (!select || !boite) return;

  const input = boite.querySelector(".combo-input");
  const liste = boite.querySelector(".combo-list");
  const vider = boite.querySelector(".combo-clear");
  let actif = -1;
  let visibles = [];

  const fermer = () => {
    liste.hidden = true;
    liste.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    actif = -1;
  };

  const marquerActif = () => {
    [...liste.children].forEach((li, i) => {
      const on = i === actif;
      li.classList.toggle("on", on);
      li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        input.setAttribute("aria-activedescendant", li.id);
        // On fait défiler la liste elle-même, pas la page : scrollIntoView
        // remonte au premier parent défilable, et quand la liste tient tout
        // entière c'est la page qui bougeait — le champ se dérobait sous le
        // doigt sur téléphone.
        const haut = li.offsetTop;
        const bas = haut + li.offsetHeight;
        if (haut < liste.scrollTop) liste.scrollTop = haut;
        else if (bas > liste.scrollTop + liste.clientHeight) {
          liste.scrollTop = bas - liste.clientHeight;
        }
      }
    });
    if (actif < 0) input.removeAttribute("aria-activedescendant");
  };

  const ouvrir = (query) => {
    const trouves = comboMatches(sel, query);
    visibles = trouves.slice(0, COMBO_MAX);
    const reste = trouves.length - visibles.length;
    const length = fold(query.trim()).length;

    if (!trouves.length) {
      liste.innerHTML = `<li class="combo-empty" role="presentation">Aucun
        ${nom === "country" ? "pays" : "entreprise"} ne correspond</li>`;
    } else {
      liste.innerHTML = visibles.map((m, i) =>
        `<li id="${nom}-opt-${i}" role="option" aria-selected="false"
             data-value="${escapeHtml(m.value)}">
           <span>${surligner(m.value, m.at, length)}</span>
           <span class="combo-count mono">${m.count}</span>
         </li>`).join("") +
        (reste > 0
          ? `<li class="combo-empty" role="presentation">et ${reste} autre${reste > 1 ? "s" : ""}
               — précise la recherche</li>`
          : "");
    }

    liste.hidden = false;
    input.setAttribute("aria-expanded", "true");
    actif = trouves.length ? 0 : -1;
    marquerActif();
  };

  const choisir = (value) => {
    select.value = value;
    if (value && select.value !== value) {
      // Pays absent du menu (données rechargées depuis) : on l'ajoute.
      select.insertAdjacentHTML("beforeend",
        `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`);
      select.value = value;
    }
    fermer();
    syncCombo(nom);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Au clic dans le champ : toute la liste, et le texte présélectionné pour
  // que la première lettre tapée remplace la sélection au lieu de s'y coller.
  input.addEventListener("focus", () => { input.select(); ouvrir(""); });
  input.addEventListener("input", () => ouvrir(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (liste.hidden) return ouvrir(input.value);
      const n = visibles.length;
      if (!n) return;
      actif = (actif + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      marquerActif();
    } else if (e.key === "Enter") {
      if (!liste.hidden && actif >= 0 && visibles[actif]) {
        e.preventDefault();
        choisir(visibles[actif].value);
      }
    } else if (e.key === "Escape") {
      if (!liste.hidden) { e.stopPropagation(); fermer(); }
      else { choisir(""); }
    }
  });

  // pointerdown : le clic doit être pris avant que le champ ne perde le focus,
  // sinon la liste se referme avant d'avoir reçu le clic.
  liste.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li[data-value]");
    if (!li) return;
    e.preventDefault();
    choisir(li.dataset.value);
  });

  // En quittant le champ, le texte revient sur la sélection réelle : on ne
  // laisse jamais une saisie à moitié tapée ressembler à un filtre actif.
  input.addEventListener("blur", () => {
    setTimeout(() => { fermer(); syncCombo(nom); }, 80);
  });

  vider?.addEventListener("click", () => { choisir(""); input.focus(); });
}

/* Remet le champ visible en accord avec le <select> qui porte la valeur. */
function syncCombo(nom) {
  const select = $(`#${nom}`);
  const boite = $(`.combo[data-combo="${nom}"]`);
  if (!select || !boite) return;
  const input = boite.querySelector(".combo-input");
  const vider = boite.querySelector(".combo-clear");
  input.value = select.value || "";
  if (vider) vider.hidden = !select.value;
  boite.classList.toggle("chosen", Boolean(select.value));
}

function buildAxisFilters() {
  $("#axis-filters").innerHTML = AXIS_ORDER.map((axis) => `
    <label>
      <input type="checkbox" name="axis" value="${axis}">
      <span class="swatch" style="background:var(--axis-${axis})"></span>
      <span class="checks-label">${AXIS_LABELS[axis]}${info(
        `<b>${AXIS_LABELS[axis]}</b><p>${AXIS_HELP[axis]}</p>`)}</span>
      <span class="mono checks-count" data-axis-count="${axis}"></span>
    </label>`).join("");
}

function tabPool() {
  switch (currentTab) {
    case "fav":
      return favoritePool();
    case "soon":
      return DATA.offers.filter((o) => {
        const d = daysUntil(bestExpiry(o));
        return d !== null && d >= 0 && d <= EXPIRY_WINDOW_DAYS;
      });
    case "new":
      return DATA.offers.filter(isNewOffer);
    case "archive":
      return archivePool();
    case "track":
      return DATA.offers.filter((o) => PREFS.tracking[o.id]?.status);
    case "reco":
      return recommendations().map((r) => {
        r.offer._because = r.because;
        r.offer._affinity = r.affinity;
        r.offer._parts = r.parts;
        return r.offer;
      });
    default:
      return DATA.offers;
  }
}

function currentFilters() {
  return {
    q: $("#q").value.trim().toLowerCase(),
    min: Number($("#minscore").value),
    country: $("#country").value,
    company: $("#company").value,
    duration: $("#duration").value,
    startAfter: $("#start-after").value,
    axes: $$('input[name="axis"]:checked').map((i) => i.value),
    excluded: PREFS.excludedCountries || [],
    sort: $("#sort").value,
  };
}

/* Changement de filtre : la liste est entièrement renouvelée. Rester au
   milieu de l'ancienne n'a plus de sens — on ramène l'utilisateur en tête des
   résultats, sans remonter jusqu'au titre de la page. */
/* Après un changement de filtre, on remonte en haut de la liste — mais
   JAMAIS on ne descend.

   Le problème que cette fonction résout au départ : être au milieu d'une
   longue liste, retirer un filtre, et se retrouver dans le vide bien en
   dessous de la nouvelle liste, plus courte.

   Le problème qu'elle créait sur téléphone : là, les filtres ne sont pas
   dans une colonne à gauche mais dépliés AU-DESSUS de la liste. Descendre
   jusqu'aux résultats les faisait donc sortir de l'écran à chaque clic — on
   ne pouvait pas choisir un pays puis une durée sans remonter entre les
   deux.

   D'où la règle : on ne bouge que si la liste a défilé sous nos pieds. Si
   l'on est déjà au-dessus — c'est-à-dire en train de régler les filtres —
   on ne touche à rien. */
function scrollToResults() {
  const head = document.querySelector(".results-head");
  if (!head) return;
  const tabs = document.querySelector(".tabs");
  const marge = (tabs ? tabs.offsetHeight : 0) + 12;
  const cible = Math.max(0, head.getBoundingClientRect().top + window.scrollY - marge);

  // Au-dessus du haut de la liste, ou tout près : on reste où l'on est.
  if (window.scrollY <= cible + 40) return;

  const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: cible, behavior: doux ? "smooth" : "auto" });
}

/* Applique les filtres depuis le début de la liste. */
function refilter() {
  shown = PAGE_STEP;
  apply();
  scrollToResults();
}

function apply() {
  const f = currentFilters();
  PREFS.filters = f;
  savePrefs();

  filtered = sansMasquees(tabPool()).filter((o) => {
    if (o.score < f.min) return false;
    // Un pays choisi explicitement l'emporte sur les exclusions : demander la
    // Belgique alors qu'elle est exclue n'aurait aucun sens autrement.
    if (f.country) {
      if (o.country !== f.country) return false;
    } else if (f.excluded.length && f.excluded.includes(o.country)) {
      return false;
    }
    if (f.company && o.company !== f.company) return false;
    if (f.axes.length && !f.axes.includes(o.dominant_axis)) return false;
    if (f.duration) {
      const months = Number(o.duration) || 0;
      if (f.duration === "short" && !(months && months <= 12)) return false;
      if (f.duration === "mid" && !(months > 12 && months <= 18)) return false;
      if (f.duration === "long" && !(months > 18)) return false;
    }
    if (f.startAfter) {
      const start = parseDate(o.start_date);
      if (!start || start < new Date(f.startAfter)) return false;
    }
    if (f.q) {
      const hay = [o.title, o.company, o.country, o.city, o.description,
                   o.sector, o.mission, o.profile].join(" ").toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });

  const byDate = (field, dir) => (a, b) => {
    const da = field === "expiry" ? bestExpiry(a) : parseDate(a[field]);
    const db = field === "expiry" ? bestExpiry(b) : parseDate(b[field]);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return dir * (da - db);
  };

  const sorters = {
    score: (a, b) => b.score - a.score,
    affinity: (a, b) => (b._affinity || 0) - (a._affinity || 0),
    start: byDate("start_date", 1),
    expiry: byDate("expiry", 1),
    publish: (a, b) => {
      // Toutes les annonces ne portent pas de date de publication : on se
      // rabat alors sur la date de première détection, qui l'approche bien.
      const da = parseDate(a.publish_date) || parseDate(a.first_seen);
      const db = parseDate(b.publish_date) || parseDate(b.first_seen);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    },
    company: (a, b) => (a.company || "").localeCompare(b.company || "", "fr"),
  };
  const key = currentTab === "reco" && f.sort === "score" ? "affinity" : f.sort;
  filtered.sort(sorters[key] || sorters.score);

  renderChips(f);
  render();
  updateAxisCounts();
}

function renderChips(f) {
  const chips = [];
  if (f.q) chips.push(["q", `« ${f.q} »`]);
  if (f.min > 0) chips.push(["minscore", `score ≥ ${f.min}`]);
  if (f.country) chips.push(["country", f.country]);
  if (f.company) chips.push(["company", f.company]);
  if (f.duration) chips.push(["duration", { short: "≤ 12 mois", mid: "12 à 18 mois", long: "> 18 mois" }[f.duration]]);
  if (f.startAfter) chips.push(["start-after", `départ après ${formatDate(f.startAfter)}`]);
  for (const a of f.axes) chips.push([`axis:${a}`, AXIS_LABELS[a]]);

  const box = $("#chips");
  box.innerHTML = chips.map(([key, label]) =>
    `<button type="button" class="chip" data-key="${escapeHtml(key)}">${escapeHtml(label)}<span aria-hidden="true">×</span></button>`
  ).join("");
  box.hidden = chips.length === 0;

  box.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.key;
      if (key.startsWith("axis:")) {
        const input = $$('input[name="axis"]').find((i) => i.value === key.slice(5));
        if (input) input.checked = false;
      } else if (key === "q") $("#q").value = "";
      else if (key === "minscore") { $("#minscore").value = 0; $("#minscore-out").textContent = "0"; }
      else $(`#${key}`).value = "";
      refilter();
    });
  });
}

function resetFilters() {
  $("#q").value = "";
  ["country", "company", "duration", "start-after"].forEach((id) => { $(`#${id}`).value = ""; });
  for (const nom of ["country", "company"]) syncCombo(nom);
  $("#sort").value = "score";
  $("#sort-top").value = "score";
  $("#minscore").value = 0;
  $("#minscore-out").textContent = "0";
  $$('input[name="axis"]').forEach((i) => { i.checked = false; });
  // Les pays exclus et les offres écartées ne sont pas des filtres de
  // session : ce sont des choix durables, que « Réinitialiser » respecte.
  refilter();
}

function restoreFilters() {
  if (PREFS.pageSize !== undefined) {
    $("#page-size").value = String(PREFS.pageSize);
    PAGE_STEP = PREFS.pageSize > 0 ? PREFS.pageSize : Number.MAX_SAFE_INTEGER;
    shown = PAGE_STEP;
  }

  const f = PREFS.filters;
  if (!f) return;
  $("#q").value = f.q || "";
  $("#minscore").value = f.min || 0;
  $("#minscore-out").textContent = String(f.min || 0);
  if (f.sort) {
    $("#sort").value = f.sort;
    $("#sort-top").value = f.sort;
  }
  for (const id of ["country", "company", "duration", "start-after"]) {
    const el = $(`#${id}`);
    const val = id === "start-after" ? f.startAfter : f[id];
    if (!val) continue;
    if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === val)) continue;
    el.value = val;
  }
  $$('input[name="axis"]').forEach((i) => { i.checked = (f.axes || []).includes(i.value); });
  for (const nom of ["country", "company"]) syncCombo(nom);
}

/* ============================ Pondération ============================ */

function buildWeightPanel() {
  const byAxis = {};
  for (const fam of DATA.families) (byAxis[fam.axis] ||= []).push(fam);

  $("#weights").innerHTML = AXIS_ORDER.filter((a) => byAxis[a]).map((axis) => `
    <div class="weight-group">
      <h4><span class="swatch" style="background:var(--axis-${axis})"></span>${AXIS_LABELS[axis]}</h4>
      ${byAxis[axis].map((fam) => `
        <div class="weight-row">
          <label for="w-${fam.id}">${escapeHtml(fam.source)}</label>
          <input type="range" id="w-${fam.id}" data-family="${fam.id}"
                 min="0" max="20" step="1" value="${weightOf(fam.id)}">
          <output class="mono" for="w-${fam.id}">${weightOf(fam.id)}</output>
        </div>`).join("")}
    </div>`).join("");

  $("#weights").addEventListener("input", (e) => {
    if (!e.target.matches("input[type=range]")) return;
    const id = e.target.dataset.family;
    PREFS.weights[id] = Number(e.target.value);
    e.target.nextElementSibling.textContent = e.target.value;
    savePrefs();
    rescoreAll();
    updateTabCounts();
    apply();          // pas de remontée ici : les curseurs sont dans le rail,
  });                 // et l'utilisateur suit l'effet de son réglage
}

/* ============================ Infobulles ============================ */

/* Petit « i » explicatif. Le contenu est encodé dans un attribut pour rester
   lisible au survol comme au clavier, sans dépendance externe. */
function info(html, extraClass) {
  return `<span class="info ${extraClass || ""}">
    <button type="button" class="info-btn" aria-label="Explication"
            aria-expanded="false">i</button>
    <span class="info-bubble" role="tooltip">${html}</span>
  </span>`;
}

const AXIS_HELP = {
  rd: "Postes de recherche, développement et laboratoire : élaboration d'alliages, caractérisation microstructurale, corrosion, fatigue, essais mécaniques. Modules de référence : Métallurgie, Propriétés mécaniques, Dégradation des matériaux, Rupture et fatigue.",
  prod: "Postes en usine et en méthodes : mise en forme, fonderie, assemblage et soudage, industrialisation, outillages, amélioration continue. Modules : Mise en forme par déformation plastique, Solidification, Assemblage, Outils de production.",
  qual: "Postes de contrôle et d'assurance qualité : contrôles non destructifs, audits et normes, plans d'expériences, métrologie, analyse de défaillance. Modules : Contrôles non destructifs, Qualité et normes, Plans d'expériences.",
  calc: "Axe transverse : éléments finis, simulation numérique, CAO, résistance des matériaux, dimensionnement. Modules : Introduction aux éléments finis, CAO, RDM, Élastoplasticité. Présent dans presque toutes les autres familles de postes.",
};

function scoreHelp(o) {
  const rows = AXIS_ORDER.map((a) =>
    `<tr><td><span class="swatch" style="background:var(--axis-${a})"></span>${AXIS_LABELS[a]}</td>
     <td class="mono">${o.axis_scores?.[a] || 0}</td></tr>`).join("");
  const bonuses = (o.bonuses || []).map((b) =>
    `<tr><td>${escapeHtml(b.label)}</td><td class="mono">${b.points > 0 ? "+" : ""}${b.points}</td></tr>`
  ).join("") || '<tr><td colspan="2">Aucun bonus ni malus</td></tr>';

  return `<b>Comment ce score est obtenu</b>
    <p>Chaque famille de mots-clés du programme rapporte ses points une seule fois,
       même si l'offre répète ses termes. On obtient un score par domaine :</p>
    <table class="help-table">${rows}</table>
    <p>Le domaine dominant compte pour 60 %, le deuxième pour 25 %, les deux
       derniers pour 15 %. On ajoute ensuite :</p>
    <table class="help-table">${bonuses}</table>
    <p>Le résultat est ramené entre 0 et 100. Les curseurs « Pondérer les
       critères » modifient les points de chaque famille et recalculent tout.</p>`;
}

function affinityHelp(o) {
  const p = o._parts || {};
  return `<b>Comment cette affinité est obtenue</b>
    <p>Elle compare l'offre à la moyenne de tes favoris, sans tenir compte du score.</p>
    <table class="help-table">
      <tr><td>Ressemblance de forme (60 %)</td><td class="mono">${p.shape ?? "—"} %</td></tr>
      <tr><td>Mots-clés partagés (40 %)</td><td class="mono">${p.overlap ?? "—"} %</td></tr>
      <tr><td>Familles communes</td><td class="mono">${p.shared ?? "—"} / ${p.total ?? "—"}</td></tr>
    </table>
    <p><b>Attention :</b> la forme mesure des proportions, pas une intensité. Une
       offre faible mais orientée comme tes favoris peut afficher une affinité
       élevée avec un score modeste. Croise toujours les deux chiffres.</p>`;
}

/* Pays écartés des résultats.

   Le menu « Pays » sert à ne voir qu'un pays ; celui-ci fait l'inverse, et
   accepte plusieurs entrées. Utile pour retirer durablement une destination
   qui ne t'intéresse pas — un pays frontalier, par exemple, qui n'a pas
   grand-chose d'un volontariat international. */
function renderExcludedCountries() {
  const boite = $("#excluded-countries");
  if (!boite) return;
  const liste = PREFS.excludedCountries || [];

  boite.innerHTML = liste.map((pays) =>
    `<button type="button" class="chip" data-pays="${escapeHtml(pays)}">
       ${escapeHtml(pays)}<span aria-hidden="true">×</span>
     </button>`).join("");
  boite.hidden = liste.length === 0;

  boite.querySelectorAll(".chip").forEach((puce) => {
    puce.addEventListener("click", () => {
      PREFS.excludedCountries = (PREFS.excludedCountries || [])
        .filter((p) => p !== puce.dataset.pays);
      savePrefs();
      renderExcludedCountries();
      refilter();
    });
  });
}

function excludeCurrentCountry() {
  const pays = $("#country").value;
  if (!pays) {
    alert("Choisis d'abord un pays dans la liste, puis clique sur « Exclure ».");
    return;
  }
  PREFS.excludedCountries = PREFS.excludedCountries || [];
  if (!PREFS.excludedCountries.includes(pays)) PREFS.excludedCountries.push(pays);

  // Le menu revient sur « Tous » : garder le pays sélectionné ET exclu
  // afficherait une liste vide, ce qui ressemblerait à une panne.
  $("#country").value = "";
  syncCombo("country");
  savePrefs();
  renderExcludedCountries();
  refilter();
}

/* ============================ Rendu ============================ */

function updateTabCounts() {
  const vues = sansMasquees(DATA.offers);
  const counts = {
    all: vues.length,
    fav: sansMasquees(favoritePool()).length,
    reco: sansMasquees(recommendations()).length,
    soon: vues.filter((o) => {
      const d = daysUntil(bestExpiry(o));
      return d !== null && d >= 0 && d <= EXPIRY_WINDOW_DAYS;
    }).length,
    new: vues.filter(isNewOffer).length,
    track: Object.values(PREFS.tracking).filter((t) => t.status).length,
    archive: Object.keys(PREFS.archive).length,
  };
  for (const [tab, n] of Object.entries(counts)) {
    const el = $(`.tab[data-tab="${tab}"] .tab-count`);
    if (el) el.textContent = n;
  }

  // Le compteur du panneau de filtres annonce ce qui est mis de côté
  const compteur = $("#hidden-count");
  if (compteur) compteur.textContent = PREFS.hidden.length || "";
}

function updateAxisCounts() {
  const pool = sansMasquees(tabPool());
  for (const axis of AXIS_ORDER) {
    const el = $(`[data-axis-count="${axis}"]`);
    if (el) el.textContent = pool.filter((o) => o.dominant_axis === axis).length;
  }
}

function stampVersion() {
  const el = document.getElementById("ui-version");
  if (el) el.textContent = `Interface v${UI_VERSION}`;
}

function updateFreshness() {
  const stamp = DATA.generated_at
    ? new Date(DATA.generated_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : "jamais";
  // Contrôle d'exhaustivité : la collecte a-t-elle bien vu toutes les offres
  // que l'API déclare publier ?
  const scanned = DATA.total_scanned || 0;
  const announced = DATA.total_announced || 0;
  let coverage = "";
  if (announced && scanned < announced) {
    coverage = `<br><span class="incomplete">Collecte incomplète :
      ${scanned} sur ${announced} annoncées</span>`;
  } else if (announced) {
    coverage = `<br><span class="complete">Toutes les offres publiées
      ont été examinées (${announced})</span>`;
  }

  $("#freshness").innerHTML =
    `Dernière recherche<br><strong>${escapeHtml(stamp)}</strong><br><br>` +
    `${scanned} offres examinées, ${DATA.total_kept || 0} retenues.` + coverage;
}

const EMPTY_MESSAGES = {
  fav: ["Aucun favori pour l'instant",
        "Clique l'étoile d'une offre pour la retrouver ici. Les favoris alimentent aussi l'onglet Recommandées."],
  reco: ["Les recommandations attendent tes favoris",
         "Mets deux ou trois offres en favori : le site en déduira ce qui t'intéresse et classera le reste par ressemblance."],
  soon: ["Aucune échéance proche",
         `Rien n'expire dans les ${EXPIRY_WINDOW_DAYS} prochains jours — ou l'API ne fournit pas de date d'expiration pour ces offres.`],
  new: ["Aucune nouveauté",
        `Aucune offre détectée dans les ${NEW_WINDOW_HOURS} dernières heures. Les offres restent ici 24 h après leur apparition.`],
  archive: ["Aucune offre archivée",
            "Chaque offre mise en favori est automatiquement copiée ici : intitulé, entreprise, lieu, score et profil restent consultables même après le retrait de l'annonce."],
  track: ["Aucune candidature suivie",
          "Déplie une offre et choisis un statut : elle apparaîtra ici, avec tes notes."],
};

function render() {
  const n = filtered.length;
  const pool = tabPool().length;

  $("#count").innerHTML = n === 0
    ? "Aucune offre"
    : `<strong>${n}</strong> offre${n > 1 ? "s" : ""}` +
      (n < pool ? ` <span class="of-total">sur ${pool}</span>` : "");

  // Sur téléphone, la liste est hors de l'écran pendant qu'on règle les
  // filtres : sans cela, cocher un pays ne produirait aucun retour visible.
  // Le décompte est donc répété sur le bouton qui déplie les filtres.
  const bascule = $("#filter-toggle");
  if (bascule) {
    bascule.innerHTML = `Filtrer les offres <span class="toggle-count">` +
      (n === 0 ? "aucune offre" : `${n} offre${n > 1 ? "s" : ""}`) + `</span>`;
  }

  if (n === 0) {
    let title, body;
    if (DATA.offers.length === 0) {
      title = "La recherche d'offres n'a rien rapporté";
      body = `Le fichier de données est vide. Double-clique <code>Diagnostic.command</code>
              pour identifier la cause — ce n'est pas un problème de filtres.`;
    } else if (pool === 0 && EMPTY_MESSAGES[currentTab]) {
      [title, body] = EMPTY_MESSAGES[currentTab];
    } else {
      title = "Rien à ce niveau de filtrage";
      body = "Baisse le score minimum ou retire un filtre.";
    }
    $("#list").innerHTML = `<div class="empty"><h3>${title}</h3><p>${body}</p>
      ${pool > 0 ? '<button type="button" class="reset" id="reset-empty">Tout réafficher</button>' : ""}</div>`;
    $("#reset-empty")?.addEventListener("click", resetFilters);
    $("#more-wrap").hidden = true;
    return;
  }

  const slice = filtered.slice(0, shown);
  $("#list").innerHTML = slice.map(card).join("");

  const remaining = n - slice.length;
  $("#more-wrap").hidden = remaining <= 0;
  if (remaining > 0) {
    const step = Math.min(PAGE_STEP, remaining);
    $("#more").textContent =
      `Afficher ${step} offre${step > 1 ? "s" : ""} de plus (${remaining} restante${remaining > 1 ? "s" : ""})`;
  }
}

function card(o) {
  const place = [o.city, o.country].filter(Boolean).join(", ");
  const totalAxis = AXIS_ORDER.reduce((s, a) => s + (o.axis_scores?.[a] || 0), 0) || 1;
  const track = PREFS.tracking[o.id] || {};
  const expiry = bestExpiry(o);
  const left = daysUntil(expiry);

  const badges = [];
  if (o._archived) {
    badges.push('<span class="badge archived">Archivée · plus en ligne</span>');
  }
  if (!o._archived && isNewOffer(o)) badges.push('<span class="badge new">Nouvelle</span>');
  if (!o._archived && left !== null && left >= 0 && left <= EXPIRY_WINDOW_DAYS) {
    badges.push(`<span class="badge urgent">Expire dans ${left} j</span>`);
  }
  if (currentTab === "reco" && o._affinity) {
    badges.push(`<span class="badge reco">Affinité ${o._affinity}%${info(affinityHelp(o), "on-badge")}</span>`);
  }
  if (track.status) {
    badges.push(`<span class="badge track-badge">${escapeHtml(STATUSES[track.status] || "")}</span>`);
  }
  if (o._archived) {
    badges.push(o._online
      ? '<span class="badge online">Toujours en ligne</span>'
      : '<span class="badge offline">Retirée de Business France</span>');
    if (o.archived_at) {
      badges.push(`<span class="badge track-badge">Archivée le ${formatDate(o.archived_at,
        { day: "numeric", month: "short", year: "numeric" })}</span>`);
    }
  }

  const composition = AXIS_ORDER.map((a) => {
    const v = o.axis_scores?.[a] || 0;
    return v ? `<span data-axis="${a}" style="flex:${v}"></span>` : "";
  }).join("");

  const modules = (o.matched_families || []).map((m) =>
    `<li><b>${escapeHtml(m.source)}</b>${m.terms?.length ? " · " + escapeHtml(m.terms.join(", ")) : ""}</li>`
  ).join("");

  const meta = [
    o.company ? `<strong>${escapeHtml(o.company)}</strong>` : "",
    place ? escapeHtml(place) : "",
    o.duration ? `${escapeHtml(String(o.duration))} mois` : "",
    publicationLabel(o) ? escapeHtml(publicationLabel(o)) : "",
    o.start_date ? `départ ${formatDate(o.start_date)}` : "",
    expiry ? `expire le ${formatDate(expiry, { day: "numeric", month: "short", year: "numeric" })}` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const body = (o.summary || [o.description, o.mission].filter(Boolean).join("\n\n")).slice(0, 1400);

  const because = currentTab === "reco" && o._because
    ? `<p class="because">Proche de ton favori : <b>${escapeHtml(o._because.title)}</b></p>` : "";

  return `
    <article class="offer${isHidden(o.id) ? " ecartee" : ""}" data-axis="${o.dominant_axis || ""}"
             data-id="${escapeHtml(o.id)}" data-status="${escapeHtml(track.status || "")}"
             tabindex="0" aria-expanded="false">
      <div class="offer-head">
        <div class="offer-id">
          ${badges.length ? `<p class="badges">${badges.join("")}</p>` : ""}
          <h3>${escapeHtml(o.title)}</h3>
          <p class="meta">${meta}</p>
        </div>
        <div class="gauge">
          <span class="gauge-actions">
            <button type="button" class="fav-btn ${isFavorite(o.id) ? "on" : ""}"
                    data-id="${escapeHtml(o.id)}" aria-pressed="${isFavorite(o.id)}"
                    title="Mettre en favori">★</button>
            <button type="button" class="hide-btn" data-id="${escapeHtml(o.id)}"
                    title="${isHidden(o.id) ? "Remettre dans la liste" : "Écarter cette offre"}"
                    aria-label="${isHidden(o.id) ? "Remettre dans la liste" : "Écarter cette offre"}"
            >${isHidden(o.id) ? "↩" : "✕"}</button>
          </span>
          <b>${o.score}</b>
          <span>${escapeHtml(o.label || "")}${info(scoreHelp(o))}</span>
        </div>
      </div>

      ${because}

      <div class="composition" role="img" aria-label="Composition : ${AXIS_ORDER.map(
        (a) => `${AXIS_LABELS[a]} ${Math.round(100 * (o.axis_scores?.[a] || 0) / totalAxis)}%`).join(", ")}">
        ${composition}
      </div>

      <ul class="modules">${modules}</ul>

      <div class="detail-panel">
       <div class="detail-inner">
        ${o._archived ? `<p class="archived-note">
          Cette annonce n'apparaît plus dans la collecte de Business France.
          Ce qui suit est la copie conservée lors de sa mise en favori,
          le ${escapeHtml(formatDate(o.archived_at, { day: "numeric", month: "long", year: "numeric" }))}.
          Le lien d'origine peut ne plus fonctionner.
        </p>` : ""}
        ${body ? `<div class="summary-block">
          <h4>Le poste</h4>
          <p class="offer-body">${escapeHtml(body)}</p>
        </div>` : ""}
        ${profileBlock(o)}
        <div class="track">
          <label>Statut
            <select class="status-select">
              ${Object.entries(STATUSES).map(([v, l]) =>
                `<option value="${v}" ${track.status === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
          <label class="note-label">Notes
            <textarea class="note-field" rows="2"
              placeholder="Contact, relance prévue, éléments à préparer…">${escapeHtml(track.note || "")}</textarea>
          </label>
        </div>
       </div>
      </div>

      <p class="actions">
        <a class="apply ${o._archived && !o._online ? "stale" : ""}"
           href="${escapeHtml(o.url)}" target="_blank" rel="noopener">
          ${o._archived && !o._online
            ? "Tenter l'annonce d'origine →"
            : "Voir l'offre sur Business France →"}</a>
        ${o._archived ? `<button type="button" class="drop-archive"
          data-id="${escapeHtml(o.id)}">Retirer de l'archive</button>` : ""}
        <span class="expand-hint"><span>Lire le détail</span></span>
      </p>
    </article>`;
}

/* Profil recherché, mis en évidence en tête du détail. Les termes qui ont
   déclenché des points sont surlignés : on voit d'un coup d'œil ce que
   l'entreprise demande et ce que la formation couvre. */
function profileBlock(o) {
  const text = (o.profile || "").trim();
  if (!text) return "";

  const terms = [...new Set((o.matched_families || [])
    .flatMap((m) => m.terms || [])
    .filter((t) => t.length > 3))];

  let html = escapeHtml(text);
  for (const term of terms.sort((a, b) => b.length - a.length)) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`(${safe})`, "gi"), "<mark>$1</mark>");
  }

  return `<div class="profile-block">
    <h4>Profil recherché
      ${o.profile_extracted ? '<span class="extracted">extrait de l\'annonce</span>' : ""}
    </h4>
    <p>${html}</p>
  </div>`;
}

function renderCorpus() {
  if (!DATA.offers.length) return;
  const totals = {};
  for (const axis of AXIS_ORDER) totals[axis] = DATA.offers.filter((o) => o.dominant_axis === axis).length;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;

  $("#corpus-bar").innerHTML = AXIS_ORDER.map((a) =>
    totals[a] ? `<span data-axis="${a}" style="flex:${totals[a]}"></span>` : "").join("");

  $("#corpus-stats").innerHTML = AXIS_ORDER.map((a) => `
    <div><dt><span class="swatch" style="background:var(--axis-${a})"></span>${AXIS_LABELS[a]}</dt>
    <dd>${totals[a]} · ${Math.round(100 * totals[a] / sum)}%</dd></div>`).join("");

  $("#corpus").hidden = false;
}

function renderCompanies() {
  $("#companies").innerHTML = COMPANIES.map((c) => {
    const query = encodeURIComponent(`VIE "${c.name}" offre volontariat international`);
    return `<li><a href="https://duckduckgo.com/?q=${query}" target="_blank" rel="noopener">
      ${escapeHtml(c.name)}<small>${escapeHtml(c.sector)}</small></a></li>`;
  }).join("");
}

/* ============================ Export / import ============================ */

function exportCsv() {
  // Inclure les favoris archivés : c'est précisément pour ces offres
  // disparues que l'export a le plus de valeur.
  const tracked = DATA.offers.filter((o) => PREFS.tracking[o.id]?.status && !isFavorite(o.id));
  const rows = [...favoritePool(), ...tracked];
  if (!rows.length) {
    alert("Aucun favori ni candidature suivie à exporter pour l'instant.");
    return;
  }
  const header = ["Intitulé", "Entreprise", "Pays", "Ville", "Durée", "Départ",
                  "Expiration", "Score", "Domaine", "Statut", "Notes", "État", "Lien"];
  const lines = [header, ...rows.map((o) => {
    const t = PREFS.tracking[o.id] || {};
    return [o.title, o.company, o.country, o.city, o.duration,
            formatDate(o.start_date), formatDate(bestExpiry(o)), o.score,
            AXIS_LABELS[o.dominant_axis] || "", STATUSES[t.status] || "", t.note || "",
            o._archived ? "Archivée — plus en ligne" : "En ligne", o.url];
  })];
  const csv = "\uFEFF" + lines.map((r) =>
    r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), "mes-offres-vie.csv");
}

/* ==================== Synchronisation entre appareils ====================

   Un navigateur cloisonne les données par adresse : le site local, le site en
   ligne et le téléphone sont trois stockages distincts qui s'ignorent. Aucun
   serveur ne conserve ta sélection — c'est délibéré, tes candidatures ne
   regardent personne.

   Le pont est donc un lien : favoris, notes, archives et pondérations y sont
   compressés puis encodés. L'ouvrir sur un autre appareil y verse le contenu.
   La fusion est additive : ce qui existe déjà des deux côtés est conservé. */

const SYNC_PREFIX = "#sync=";
const SYNC_MAX = 30000;      // au-delà, un lien devient impraticable

function b64urlEncode(bytes) {
  let binaire = "";
  for (const o of bytes) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(texte) {
  const s = texte.replace(/-/g, "+").replace(/_/g, "/");
  const complement = "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s + complement), (c) => c.charCodeAt(0));
}

async function compresser(texte) {
  if (typeof CompressionStream === "undefined") return null;
  const flux = new Blob([texte]).stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

async function decompresser(octets) {
  const flux = new Blob([octets]).stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(flux).text();
}

function etatSynchronisable() {
  return {
    v: 1,
    favorites: PREFS.favorites,
    tracking: PREFS.tracking,
    archive: PREFS.archive,
    weights: PREFS.weights,
    hidden: PREFS.hidden,
    excludedCountries: PREFS.excludedCountries,
  };
}

async function construireLienSync() {
  const json = JSON.stringify(etatSynchronisable());
  const compresse = await compresser(json);
  const charge = compresse
    ? "z" + b64urlEncode(compresse)
    : "p" + b64urlEncode(new TextEncoder().encode(json));
  return location.origin + location.pathname + SYNC_PREFIX + charge;
}

async function partagerSync() {
  const favoris = PREFS.favorites.length;
  const archives = Object.keys(PREFS.archive).length;
  const suivies = Object.values(PREFS.tracking).filter((t) => t.status).length;

  if (!favoris && !archives && !suivies) {
    alert("Rien à synchroniser pour l'instant : aucun favori, aucune archive, "
      + "aucune candidature suivie.");
    return;
  }

  let lien;
  try {
    lien = await construireLienSync();
  } catch (err) {
    alert("Création du lien impossible : " + err.message);
    return;
  }

  if (lien.length > SYNC_MAX) {
    alert(`Ta sélection est trop volumineuse pour tenir dans un lien `
      + `(${Math.round(lien.length / 1000)} ko).\n\n`
      + `Utilise « Sauvegarder mes favoris » et transfère le fichier obtenu.`);
    return;
  }

  const resume = `${favoris} favori${favoris > 1 ? "s" : ""}, `
    + `${archives} archive${archives > 1 ? "s" : ""}, `
    + `${suivies} candidature${suivies > 1 ? "s" : ""}`;

  try {
    await navigator.clipboard.writeText(lien);
    alert(`Lien de synchronisation copié (${resume}).\n\n`
      + `Sur l'autre appareil : soit tu colles ce lien dans la barre d'adresse, `
      + `soit — depuis l'application de l'écran d'accueil, qui n'en a pas — tu `
      + `utilises le bouton « Recevoir une synchronisation ».\n\n`
      + `Entre un Mac et un iPhone reliés au même compte Apple, le presse-papier `
      + `est commun : le coller suffit.`);
  } catch (err) {
    prompt(`Copie ce lien (${resume}) :`, lien);
  }
}

/* Applique un code de synchronisation, d'où qu'il vienne : adresse du site ou
   collage manuel. Les deux chemins existent parce qu'une application ajoutée à
   l'écran d'accueil n'a pas de barre d'adresse — et, sur iOS, son stockage est
   distinct de celui de Safari. Sans collage manuel, elle serait injoignable. */
async function appliquerCodeSync(charge) {
  const mode = charge[0];
  const corps = charge.slice(1);

  let donnees;
  try {
    const octets = b64urlDecode(corps);
    const json = mode === "z"
      ? await decompresser(octets)
      : new TextDecoder().decode(octets);
    donnees = JSON.parse(json);
    if (!donnees || typeof donnees !== "object") throw new Error("contenu inattendu");
  } catch (err) {
    alert("Ce code de synchronisation est illisible ou incomplet.\n\n"
      + "Vérifie que tu as copié le lien en entier, jusqu'au dernier caractère.");
    return false;
  }

  const favoris = (donnees.favorites || []).length;
  const archives = Object.keys(donnees.archive || {}).length;
  const suivies = Object.values(donnees.tracking || {})
    .filter((t) => t && t.status).length;

  const ok = confirm(
    `Cette synchronisation contient ${favoris} favori(s), ${archives} archive(s) `
    + `et ${suivies} candidature(s) suivie(s).\n\n`
    + `Les ajouter à cet appareil ? Rien de ce qui s'y trouve déjà ne sera perdu.`);
  if (!ok) return false;

  // --- Fusion ----------------------------------------------------------
  // Principe directeur : ne jamais perdre une information saisie à la main.
  // En cas de divergence, on garde les deux et c'est l'utilisateur qui
  // tranche — reconstituer une note effacée coûte plus cher que supprimer
  // une ligne en trop.

  // Favoris : union, sans doublon possible
  PREFS.favorites = [...new Set([...PREFS.favorites, ...(donnees.favorites || [])])];

  // Archives : fusion champ à champ, en conservant la PREMIÈRE date
  // d'archivage. Si le Mac a archivé une offre le 1er et le téléphone le 5,
  // la fiche reste datée du 1er : c'est ce jour-là qu'elle est entrée dans
  // ta sélection.
  for (const [id, recue] of Object.entries(donnees.archive || {})) {
    const locale = PREFS.archive[id];
    const fusionnee = { ...locale, ...recue };
    if (locale && locale.archived_at && recue.archived_at) {
      fusionnee.archived_at =
        locale.archived_at < recue.archived_at ? locale.archived_at : recue.archived_at;
    }
    PREFS.archive[id] = fusionnee;
  }

  // Suivi de candidature : deux notes différentes sur une même offre sont
  // conservées l'une sous l'autre, séparées par un repère visible. Un statut
  // vide ne chasse jamais un statut renseigné.
  let notesFusionnees = 0;
  for (const [id, recu] of Object.entries(donnees.tracking || {})) {
    const local = PREFS.tracking[id];
    if (!local) {
      PREFS.tracking[id] = recu;
      continue;
    }
    const fusionne = { ...local, ...recu };
    fusionne.status = recu.status || local.status || "";

    const noteLocale = (local.note || "").trim();
    const noteRecue = (recu.note || "").trim();
    if (noteLocale && noteRecue && noteLocale !== noteRecue) {
      fusionne.note = `${noteLocale}\n--- note de l'autre appareil ---\n${noteRecue}`;
      notesFusionnees += 1;
    } else {
      fusionne.note = noteRecue || noteLocale;
    }
    PREFS.tracking[id] = fusionne;
  }

  // Offres écartées et pays exclus : union, comme les favoris. Un choix de
  // mise à l'écart fait sur un appareil vaut sur l'autre.
  PREFS.hidden = [...new Set([...(PREFS.hidden || []), ...(donnees.hidden || [])])];
  PREFS.excludedCountries = [...new Set([
    ...(PREFS.excludedCountries || []), ...(donnees.excludedCountries || []),
  ])];

  // Pondérations : simple valeur numérique, la version reçue fait foi
  PREFS.weights = { ...PREFS.weights, ...(donnees.weights || {}) };
  savePrefs();

  buildWeightPanel();
  rescoreAll();
  refreshArchive();
  renderExcludedCountries();
  updateTabCounts();
  apply();
  let message = `Synchronisation effectuée : ${PREFS.favorites.length} favori(s), `
    + `${Object.keys(PREFS.archive).length} archive(s) sur cet appareil.`;
  if (notesFusionnees) {
    message += `\n\n${notesFusionnees} note(s) différaient entre les deux appareils. `
      + `Les deux versions ont été conservées, séparées par « note de l'autre `
      + `appareil » — à relire dans l'onglet Candidatures.`;
  }
  alert(message);
  return true;
}

/* Lecture d'un code présent dans l'adresse du site (navigateur classique). */
async function appliquerLienSync() {
  const fragment = location.hash;
  if (!fragment.startsWith(SYNC_PREFIX)) return;
  const charge = fragment.slice(SYNC_PREFIX.length);
  // L'adresse est nettoyée dans tous les cas : un rechargement ne doit pas
  // reproposer la même importation.
  history.replaceState(null, "", location.pathname);
  await appliquerCodeSync(charge);
}

/* Collage manuel : seul chemin disponible depuis l'écran d'accueil. Accepte
   indifféremment le lien complet ou le code seul. */
async function recevoirSync() {
  const saisie = prompt(
    "Colle ici le lien de synchronisation reçu de ton autre appareil "
    + "(appui long puis « Coller ») :");
  if (!saisie) return;

  const texte = saisie.trim();
  const position = texte.indexOf(SYNC_PREFIX);
  const charge = position >= 0
    ? texte.slice(position + SYNC_PREFIX.length)
    : texte;

  if (!charge) {
    alert("Rien à importer : le texte collé est vide.");
    return;
  }
  await appliquerCodeSync(charge);
}

function exportPrefs() {
  const blob = new Blob([JSON.stringify(PREFS, null, 1)], { type: "application/json" });
  download(blob, "veille-vie-preferences.json");
}

function importPrefs(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      PREFS = { ...PREFS, ...incoming };
      savePrefs();
      buildWeightPanel();
      rescoreAll();
      updateTabCounts();
      apply();
      alert("Favoris, notes et pondérations importés.");
    } catch (err) {
      alert("Fichier illisible : " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================ Utilitaires ============================ */

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

document.addEventListener("DOMContentLoaded", load);
