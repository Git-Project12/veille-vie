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
const UI_VERSION = "9";   // affiché en pied de page : permet de vérifier
                          // quelle version de l'interface est réellement chargée
const EXPIRY_WINDOW_DAYS = 14;   // seuil de l'onglet « échéances »
const NEW_WINDOW_DAYS = 7;       // seuil de l'onglet « nouveautés »

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
let PREFS = { weights: {}, favorites: [], tracking: {}, archive: {}, lastVisit: null };
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
  if (!PREFS.archive) PREFS.archive = {};
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
  const max = { rd: 0, prod: 0, qual: 0, calc: 0 };

  for (const fam of DATA.families) max[fam.axis] += weightOf(fam.id);
  for (const hit of offer.matched_families || []) {
    points[hit.axis] += weightOf(hit.id);
  }

  const axisScores = {};
  for (const axis of AXIS_ORDER) {
    axisScores[axis] = max[axis] ? Math.round(100 * points[axis] / max[axis]) : 0;
  }

  const k = DATA.scoring || {};
  const topW = k.top_weights || [0.6, 0.25];
  const restW = k.rest_weight ?? 0.15;

  const ordered = AXIS_ORDER.map((a) => axisScores[a]).sort((a, b) => b - a);
  const rest = ordered.slice(topW.length);
  let score = ordered[0] * topW[0] + ordered[1] * topW[1] +
    (rest.length ? rest.reduce((s, v) => s + v, 0) / rest.length : 0) * restW;

  for (const bonus of offer.bonuses || []) score += bonus.points;

  score = Math.max(0, Math.min(100, Math.round(score)));

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

function isNewOffer(offer) {
  const seen = parseDate(offer.first_seen);
  if (!seen) return false;
  const ref = PREFS.lastVisit ? parseDate(PREFS.lastVisit) : null;
  if (ref) return seen > ref;
  return (new Date() - seen) / 86400000 <= NEW_WINDOW_DAYS;
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
  restoreFilters();
  bindEvents();
  updateFreshness();
  stampVersion();
  updateTabCounts();
  apply();

  // Mémoriser la visite pour l'onglet « nouveautés » de la prochaine fois
  setTimeout(() => {
    PREFS.lastVisit = new Date().toISOString();
    savePrefs();
  }, 4000);
}

function bindEvents() {
  $("#filters").addEventListener("change", () => { shown = PAGE_STEP; apply(); });
  $("#q").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { shown = PAGE_STEP; apply(); }, 140);
  });
  $("#minscore").addEventListener("input", (e) => {
    $("#minscore-out").textContent = e.target.value;
  });
  $("#reset").addEventListener("click", resetFilters);

  // Filtrage instantané des listes pays et entreprise
  for (const sel of ["#country", "#company"]) {
    $(`${sel}-search`)?.addEventListener("input", (e) => {
      renderSelect(sel, e.target.value);
    });
  }

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
      shown = PAGE_STEP;
      apply();
    });
  });

  $("#list").addEventListener("click", onListClick);
  bindInfoButtons(document.body);
  $("#list").addEventListener("change", onListChange);
  $("#list").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest(".fav-btn, select, textarea, a, .info")) return;
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
  $("#import-prefs").addEventListener("change", importPrefs);
  $("#filter-toggle").addEventListener("click", () => {
    const rail = $("#rail");
    $("#filter-toggle").setAttribute("aria-expanded", String(rail.classList.toggle("open")));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== $("#q") &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); $("#q").focus(); $("#q").select();
    }
    if (e.key === "Escape" && document.activeElement === $("#q")) {
      $("#q").value = ""; shown = PAGE_STEP; apply();
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
  if (e.target.closest("a, select, textarea, .track")) return;
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

function fillSelect(sel, entries) {
  OPTION_CACHE[sel] = entries;
  renderSelect(sel, "");
}

/* Redessine une liste déroulante en ne gardant que les entrées correspondant
   au texte saisi. La sélection courante est préservée même si elle ne
   correspond plus au filtre, pour ne jamais perdre un choix en cours. */
function renderSelect(sel, query) {
  const el = $(sel);
  const entries = OPTION_CACHE[sel] || [];
  const current = el.value;
  const needle = query.trim().toLowerCase();
  const placeholder = el.options[0]?.textContent || "Tous";

  const kept = entries.filter(([value]) =>
    !needle || value.toLowerCase().includes(needle));

  el.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` +
    kept.map(([value, count]) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)} (${count})</option>`).join("");

  if (current && !kept.some(([v]) => v === current)) {
    el.insertAdjacentHTML("beforeend",
      `<option value="${escapeHtml(current)}">${escapeHtml(current)} (sélection actuelle)</option>`);
  }
  el.value = current;

  const hint = $(`${sel}-search`);
  if (hint) {
    hint.setAttribute("aria-label",
      `${kept.length} résultat${kept.length > 1 ? "s" : ""} sur ${entries.length}`);
  }
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
    sort: $("#sort").value,
  };
}

function apply() {
  const f = currentFilters();
  PREFS.filters = f;
  savePrefs();

  filtered = tabPool().filter((o) => {
    if (o.score < f.min) return false;
    if (f.country && o.country !== f.country) return false;
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
    publish: byDate("publish_date", -1),
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
      shown = PAGE_STEP;
      apply();
    });
  });
}

function resetFilters() {
  $("#q").value = "";
  for (const sel of ["#country", "#company"]) {
    const search = $(`${sel}-search`);
    if (search) search.value = "";
    renderSelect(sel, "");
  }
  ["country", "company", "duration", "start-after"].forEach((id) => { $(`#${id}`).value = ""; });
  $("#sort").value = "score";
  $("#minscore").value = 0;
  $("#minscore-out").textContent = "0";
  $$('input[name="axis"]').forEach((i) => { i.checked = false; });
  shown = PAGE_STEP;
  apply();
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
  if (f.sort) $("#sort").value = f.sort;
  for (const id of ["country", "company", "duration", "start-after"]) {
    const el = $(`#${id}`);
    const val = id === "start-after" ? f.startAfter : f[id];
    if (!val) continue;
    if (el.tagName === "SELECT" && ![...el.options].some((o) => o.value === val)) continue;
    el.value = val;
  }
  $$('input[name="axis"]').forEach((i) => { i.checked = (f.axes || []).includes(i.value); });
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
    apply();
  });
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

/* ============================ Rendu ============================ */

function updateTabCounts() {
  const counts = {
    all: DATA.offers.length,
    fav: favoritePool().length,
    reco: recommendations().length,
    soon: DATA.offers.filter((o) => {
      const d = daysUntil(bestExpiry(o));
      return d !== null && d >= 0 && d <= EXPIRY_WINDOW_DAYS;
    }).length,
    new: DATA.offers.filter(isNewOffer).length,
    track: Object.values(PREFS.tracking).filter((t) => t.status).length,
    archive: Object.keys(PREFS.archive).length,
  };
  for (const [tab, n] of Object.entries(counts)) {
    const el = $(`.tab[data-tab="${tab}"] .tab-count`);
    if (el) el.textContent = n;
  }
}

function updateAxisCounts() {
  const pool = tabPool();
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
        "Rien de neuf depuis ta dernière visite. Relance le collecteur pour rafraîchir la liste."],
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
    o.start_date ? `départ ${formatDate(o.start_date)}` : "",
    expiry ? `expire le ${formatDate(expiry, { day: "numeric", month: "short", year: "numeric" })}` : "",
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const body = (o.summary || [o.description, o.mission].filter(Boolean).join("\n\n")).slice(0, 1400);

  const because = currentTab === "reco" && o._because
    ? `<p class="because">Proche de ton favori : <b>${escapeHtml(o._because.title)}</b></p>` : "";

  return `
    <article class="offer" data-axis="${o.dominant_axis || ""}" data-id="${escapeHtml(o.id)}"
             data-status="${escapeHtml(track.status || "")}" tabindex="0" aria-expanded="false">
      <div class="offer-head">
        <div class="offer-id">
          ${badges.length ? `<p class="badges">${badges.join("")}</p>` : ""}
          <h3>${escapeHtml(o.title)}</h3>
          <p class="meta">${meta}</p>
        </div>
        <div class="gauge">
          <button type="button" class="fav-btn ${isFavorite(o.id) ? "on" : ""}"
                  data-id="${escapeHtml(o.id)}" aria-pressed="${isFavorite(o.id)}"
                  title="Mettre en favori">★</button>
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
