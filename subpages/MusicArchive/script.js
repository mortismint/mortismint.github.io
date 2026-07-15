const state = {
  search: "",
  genre: null,
};

let sortedData = [];

function getUniqueGenres(tracks) {
  return [...new Set(tracks.map((t) => t.genre).filter(Boolean))];
}

function makeDownloadUrl(driveUrl) {
  if (!driveUrl) return null;
  const match = driveUrl.match(/\/file\/d\/([^/]+)/);
  if (match)
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return driveUrl;
}

function trackMatches(track) {
  const matchesGenre = !state.genre || track.genre === state.genre;
  const matchesSearch =
    !state.search || track.title.toLowerCase().includes(state.search);
  return matchesGenre && matchesSearch;
}

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function highlightText(text, term) {
  if (!term) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return escapeHtml(text);
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + term.length);
  const after = text.slice(idx + term.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(match)}</mark>${escapeHtml(after)}`;
}

function renderTrack(track, index, searchTerm) {
  const li = document.createElement("li");
  li.className = "track-item" + (track.lost ? " is-lost" : "");

  const numEl = document.createElement("span");
  numEl.className = "track-num";
  numEl.textContent = String(index + 1).padStart(2, "0");

  const infoEl = document.createElement("div");
  infoEl.className = "track-info";

  const titleEl = document.createElement("span");
  titleEl.className = "track-title";
  titleEl.innerHTML = highlightText(track.title, searchTerm);

  const subEl = document.createElement("span");
  subEl.className = "track-sub";
  if (track.genre) {
    const g = document.createElement("span");
    g.className = "track-genre";
    g.textContent = track.genre;
    subEl.appendChild(g);
  }
  if (track.bpm) {
    const dot = document.createElement("span");
    dot.textContent = "·";
    const b = document.createElement("span");
    b.className = "track-bpm";
    b.textContent = track.bpm + " bpm";
    subEl.appendChild(dot);
    subEl.appendChild(b);
  }
  infoEl.appendChild(titleEl);
  infoEl.appendChild(subEl);

  const durEl = document.createElement("span");
  durEl.className = "track-dur";
  durEl.textContent = track.duration || "";

  li.appendChild(numEl);
  li.appendChild(infoEl);
  li.appendChild(durEl);

  if (track.lost) {
    const badge = document.createElement("span");
    badge.className = "lost-badge";
    badge.textContent = "lost";
    li.appendChild(badge);
    const ph = document.createElement("span");
    ph.style.width = "68px";
    li.appendChild(ph);
  } else if (track.driveUrl) {
    const dlUrl = makeDownloadUrl(track.driveUrl);
    const btn = document.createElement("a");
    btn.className = "dl-btn";
    btn.href = dlUrl;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>mp3`;
    li.appendChild(btn);
  } else if (track.youtubeUrl) {
    const btn = document.createElement("a");
    btn.className = "dl-btn yt-btn";
    btn.href = track.youtubeUrl;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>watch`;
    li.appendChild(btn);
  } else {
    const ph = document.createElement("span");
    ph.style.width = "68px";
    li.appendChild(ph);
  }

  return li;
}

function renderEra(eraData, filteredTracks, forceOpen) {
  const div = document.createElement("div");
  div.className = "era" + (forceOpen ? " open" : "");

  const genres = getUniqueGenres(filteredTracks);

  const btn = document.createElement("button");
  btn.className = "era-header";
  btn.setAttribute("aria-expanded", String(forceOpen));

  const yearEl = document.createElement("span");
  yearEl.className = "era-year";
  yearEl.textContent = eraData.year;

  const metaEl = document.createElement("div");
  metaEl.className = "era-meta";

  const countEl = document.createElement("span");
  countEl.className = "era-count";
  countEl.textContent =
    filteredTracks.length + (filteredTracks.length === 1 ? " track" : " tracks");
  metaEl.appendChild(countEl);

  const genresEl = document.createElement("div");
  genresEl.className = "era-genres";
  genres.slice(0, 3).forEach((g) => {
    const pill = document.createElement("span");
    pill.className = "genre-pill";
    pill.textContent = g.toLowerCase();
    genresEl.appendChild(pill);
  });
  metaEl.appendChild(genresEl);

  const chevron = document.createElement("span");
  chevron.className = "era-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  btn.appendChild(yearEl);
  btn.appendChild(metaEl);
  btn.appendChild(chevron);

  const body = document.createElement("div");
  body.className = "era-body";

  const ul = document.createElement("ul");
  ul.className = "track-list";
  filteredTracks.forEach((track, i) =>
    ul.appendChild(renderTrack(track, i, state.search)),
  );
  body.appendChild(ul);

  btn.addEventListener("click", () => {
    const isOpen = div.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
    updateToggleAllLabel();
  });

  div.appendChild(btn);
  div.appendChild(body);
  return div;
}

function updateResultsCount(count, isFiltering) {
  const el = document.getElementById("results-count");
  if (!el) return;
  el.textContent = isFiltering
    ? `${count} ${count === 1 ? "track" : "tracks"} found`
    : `${count} tracks`;
}

function updateToggleAllLabel() {
  const btn = document.getElementById("toggle-all");
  if (!btn) return;
  const eras = document.querySelectorAll(".era");
  if (eras.length === 0) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "";
  const allOpen = [...eras].every((e) => e.classList.contains("open"));
  btn.textContent = allOpen ? "collapse all" : "expand all";
}

function renderArchive() {
  const archive = document.getElementById("archive");
  archive.innerHTML = "";

  const isFiltering = Boolean(state.search || state.genre);
  let totalMatches = 0;

  sortedData.forEach((era) => {
    const filteredTracks = era.tracks.filter(trackMatches);
    if (filteredTracks.length === 0) return;
    totalMatches += filteredTracks.length;
    const eraEl = renderEra(era, filteredTracks, isFiltering);
    archive.appendChild(eraEl);
  });

  if (totalMatches === 0) {
    archive.innerHTML = `<div class="empty-state">no tracks match your search.</div>`;
  } else if (!isFiltering) {
    const firstEra = archive.querySelector(".era");
    if (firstEra) {
      firstEra.classList.add("open");
      firstEra
        .querySelector(".era-header")
        .setAttribute("aria-expanded", "true");
    }
  }

  updateResultsCount(totalMatches, isFiltering);
  updateToggleAllLabel();
}

function renderGenreFilters(allTracks) {
  const wrap = document.getElementById("genre-filters");
  const genres = getUniqueGenres(allTracks).sort((a, b) =>
    a.localeCompare(b),
  );

  genres.forEach((genre) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "genre-filter";
    pill.textContent = genre.toLowerCase();
    pill.dataset.genre = genre;
    pill.addEventListener("click", () => {
      state.genre = state.genre === genre ? null : genre;
      wrap
        .querySelectorAll(".genre-filter")
        .forEach((p) => p.classList.toggle("active", p.dataset.genre === state.genre));
      renderArchive();
    });
    wrap.appendChild(pill);
  });
}

function setupSearch() {
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    state.search = input.value.trim().toLowerCase();
    renderArchive();
  });
}

function setupToggleAll() {
  const btn = document.getElementById("toggle-all");
  btn.addEventListener("click", () => {
    const eras = document.querySelectorAll(".era");
    const allOpen = [...eras].every((e) => e.classList.contains("open"));
    eras.forEach((e) => {
      e.classList.toggle("open", !allOpen);
      e.querySelector(".era-header").setAttribute(
        "aria-expanded",
        String(!allOpen),
      );
    });
    updateToggleAllLabel();
  });
}

async function init() {
  const archive = document.getElementById("archive");
  try {
    const res = await fetch("./tracks.json");
    const data = await res.json();
    sortedData = [...data].sort((a, b) => b.year - a.year);

    const allTracks = sortedData.flatMap((e) => e.tracks);
    const lostTracks = allTracks.filter((t) => t.lost).length;
    const downloadableTracks = allTracks.filter(
      (t) => !t.lost && t.driveUrl,
    ).length;
    const years = sortedData.map((e) => e.year);
    const span =
      years.length > 1 ? Math.max(...years) - Math.min(...years) + 1 : 1;

    document.getElementById("stat-total").textContent = allTracks.length;
    document.getElementById("stat-available").textContent = downloadableTracks;
    document.getElementById("stat-lost").textContent = lostTracks;
    document.getElementById("stat-span").textContent = span;

    renderGenreFilters(allTracks);
    setupSearch();
    setupToggleAll();
    renderArchive();
  } catch (err) {
    archive.innerHTML = `<div class="empty-state">couldn't load tracks.json — make sure it's in the same folder.</div>`;
  }
}

init();