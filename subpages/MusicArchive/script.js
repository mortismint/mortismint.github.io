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

function renderTrack(track, index) {
  const li = document.createElement("li");
  li.className = "track-item" + (track.lost ? " is-lost" : "");

  const numEl = document.createElement("span");
  numEl.className = "track-num";
  numEl.textContent = String(index + 1).padStart(2, "0");

  const infoEl = document.createElement("div");
  infoEl.className = "track-info";

  const titleEl = document.createElement("span");
  titleEl.className = "track-title";
  titleEl.textContent = track.title;

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

function renderEra(eraData) {
  const div = document.createElement("div");
  div.className = "era";

  const genres = getUniqueGenres(eraData.tracks);

  const btn = document.createElement("button");
  btn.className = "era-header";
  btn.setAttribute("aria-expanded", "false");

  const yearEl = document.createElement("span");
  yearEl.className = "era-year";
  yearEl.textContent = eraData.year;

  const metaEl = document.createElement("div");
  metaEl.className = "era-meta";

  const countEl = document.createElement("span");
  countEl.className = "era-count";
  countEl.textContent =
    eraData.tracks.length +
    (eraData.tracks.length === 1 ? " track" : " tracks");
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
  eraData.tracks.forEach((track, i) => ul.appendChild(renderTrack(track, i)));
  body.appendChild(ul);

  btn.addEventListener("click", () => {
    const isOpen = div.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  div.appendChild(btn);
  div.appendChild(body);
  return div;
}

async function init() {
  const archive = document.getElementById("archive");
  try {
    const res = await fetch("./tracks.json");
    const data = await res.json();
    const sorted = [...data].sort((a, b) => b.year - a.year);

    const allTracks = sorted.flatMap((e) => e.tracks);
    const lostTracks = allTracks.filter((t) => t.lost).length;
    const downloadableTracks = allTracks.filter(
      (t) => !t.lost && t.driveUrl,
    ).length;
    const years = sorted.map((e) => e.year);
    const span =
      years.length > 1 ? Math.max(...years) - Math.min(...years) + 1 : 1;

    document.getElementById("stat-total").textContent = allTracks.length;
    document.getElementById("stat-available").textContent = downloadableTracks;
    document.getElementById("stat-lost").textContent = lostTracks;
    document.getElementById("stat-span").textContent = span;

    archive.innerHTML = "";
    sorted.forEach((era) => archive.appendChild(renderEra(era)));

    const firstEra = archive.querySelector(".era");
    if (firstEra) {
      firstEra.classList.add("open");
      firstEra
        .querySelector(".era-header")
        .setAttribute("aria-expanded", "true");
    }
  } catch (err) {
    archive.innerHTML = `<div class="empty-state">couldn't load tracks.json — make sure it's in the same folder.</div>`;
  }
}

init();
