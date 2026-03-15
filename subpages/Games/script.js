/* STATE */
let activeStatus = "All";
let activeTag = "All";
let sortMode = "desc";
let searchQuery = "";
let allGames = [];

/* DOM */
const lists = {
  Playing: document.getElementById("playing-list"),
  Planning: document.getElementById("planning-list"),
  Completed: document.getElementById("completed-list"),
  Ongoing: document.getElementById("ongoing-list"),
  Paused: document.getElementById("paused-list"),
  Dropped: document.getElementById("dropped-list"),
};

/* HELPERS */
function renderStars(rating) {
  let s = "";
  for (let i = 1; i <= 5; i++) s += i <= rating ? "★" : "☆";
  return s;
}

function updateSectionVisibility() {
  document.querySelectorAll(".game-section").forEach((sec) => {
    const st = sec.dataset.status;
    sec.style.display =
      activeStatus === "All" || activeStatus === st ? "" : "none";
  });
}

function updateSectionCounts(filtered) {
  const counts = {};
  filtered.forEach((g) => {
    counts[g.status] = (counts[g.status] || 0) + 1;
  });
  document.querySelectorAll(".section-count").forEach((el) => {
    el.textContent = counts[el.dataset.count] || 0;
  });
}

/* GAME CARD */
function createGameEntry(game) {
  const entry = document.createElement("div");
  entry.className = "game-entry";
  entry.dataset.status = game.status;
  entry.dataset.rating = game.rating || 0;
  entry.dataset.tags = game.tags ? game.tags.join(",") : "";

  const lastPlayed = game.lastPlayed || "Unknown";
  const isFav = game.tags?.includes("favorite");

  entry.innerHTML = `
        <div class="game-card">
          <img class="cover" src="${game.cover}" alt="${game.title} cover" onerror="this.style.background='var(--surface0)';this.removeAttribute('src')">
          <div class="main-info">
            <div class="title-row">
              <span class="fav ${isFav ? "active" : ""}">★</span>
              <div class="title">${game.title}</div>
            </div>
            <div class="stars">${renderStars(game.rating || 0)}</div>
            <span class="status-badge">${game.status}</span>
          </div>
          ${
            game.status !== "Planning"
              ? `
          <div class="side-info">
            <div class="progress-row">
              ${game.progress === 100 ? `<span class="platinum">🏆</span>` : ""}
              <div class="progress-bar">
                <div class="progress-fill" style="width:${game.progress || 0}%"></div>
              </div>
              <div class="progress-value">${game.progress || 0}%</div>
            </div>
            <div class="last-played">Last: ${lastPlayed}</div>
          </div>`
              : ""
          }
        </div>
        <div class="game-details">
          <div class="details-grid">
            ${game.started ? `<div><strong>Started:</strong> ${game.started}</div>` : ""}
            ${game.finished ? `<div><strong>Finished:</strong> ${game.finished}</div>` : ""}
            ${game.genres ? `<div><strong>Genre:</strong> ${game.genres.join(", ")}</div>` : ""}
            ${game.console ? `<div><strong>Console:</strong> ${Array.isArray(game.console) ? game.console.join(", ") : game.console}</div>` : ""}
            ${game.playtime ? `<div><strong>Playtime:</strong> ~${game.playtime}h</div>` : ""}
            ${game.release ? `<div><strong>Release:</strong> ${game.release}</div>` : ""}
            ${game.dlc?.length ? `<div><strong>DLCs:</strong> ${game.dlc.join(", ")}</div>` : ""}
            ${game.notes ? `<div class="notes"><strong>Notes:</strong> ${game.notes}</div>` : ""}
          </div>
        </div>
      `;

  entry.querySelector(".game-card").addEventListener("click", () => {
    document.querySelectorAll(".game-entry.open").forEach((o) => {
      if (o !== entry) o.classList.remove("open");
    });
    entry.classList.toggle("open");
  });

  return entry;
}

/* RENDER */
function clearLists() {
  Object.values(lists).forEach((l) => (l.innerHTML = ""));
}

function renderGames() {
  clearLists();

  let filtered = allGames.filter((g) => {
    const statusMatch = activeStatus === "All" || g.status === activeStatus;
    const tagMatch = activeTag === "All" || g.tags?.includes(activeTag);
    const searchMatch = g.title.toLowerCase().includes(searchQuery);
    return statusMatch && tagMatch && searchMatch;
  });

  filtered.sort((a, b) =>
    sortMode === "asc"
      ? (a.rating || 0) - (b.rating || 0)
      : (b.rating || 0) - (a.rating || 0),
  );

  filtered.forEach((g) => {
    if (lists[g.status]) lists[g.status].appendChild(createGameEntry(g));
  });

  updateSectionVisibility();
  updateSectionCounts(filtered);
}

/* STATS */
function updateStats() {
  const counts = {
    Total: allGames.length,
    Playing: allGames.filter((g) => g.status === "Playing").length,
    Planning: allGames.filter((g) => g.status === "Planning").length,
    Completed: allGames.filter((g) => g.status === "Completed").length,
    Paused: allGames.filter((g) => g.status === "Paused").length,
    Dropped: allGames.filter((g) => g.status === "Dropped").length,
  };
  document.getElementById("total-games").textContent = counts.Total;
  document.getElementById("playing-count").textContent = counts.Playing;
  document.getElementById("planning-count").textContent = counts.Planning;
  document.getElementById("completed-count").textContent = counts.Completed;
  document.getElementById("paused-count").textContent = counts.Paused;
  document.getElementById("dropped-count").textContent = counts.Dropped;
  document.getElementById("total-hours").textContent = allGames.reduce(
    (s, g) => s + (g.playtime || 0),
    0,
  );

  const withProgress = allGames.filter((g) => g.status !== "Planning");
  const avg = withProgress.length
    ? Math.round(
        withProgress.reduce((s, g) => s + (g.progress || 0), 0) /
          withProgress.length,
      )
    : 0;
  document.getElementById("avg-completion").textContent = avg;
  document.getElementById("avg-bar-fill").style.width = avg + "%";
}

/* EVENTS */
document.getElementById("search").addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderGames();
});

document.querySelectorAll(".filter-btn[data-status]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn[data-status]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeStatus = btn.dataset.status;
    renderGames();
  });
});

document.querySelectorAll(".tag-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tag-filter")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTag = btn.dataset.tag;
    renderGames();
  });
});

document.getElementById("sort-score").addEventListener("change", (e) => {
  sortMode = e.target.value;
  renderGames();
});

/* LOAD */
fetch("games.json")
  .then((r) => r.json())
  .then((games) => {
    allGames = games;
    renderGames();
    updateStats();
  })
  .catch((err) => console.error("Failed to load games.json:", err));
