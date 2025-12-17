/* =========================
   STATE
========================= */

let activeStatus = "All";
let activeTag = "All";
let sortMode = "desc"; // desc = high → low
let searchQuery = "";

let allGames = [];

/* =========================
   DOM REFERENCES
========================= */

const lists = {
  Playing: document.getElementById("playing-list"),
  Planning: document.getElementById("planning-list"),
  Completed: document.getElementById("completed-list"),
  Ongoing: document.getElementById("ongoing-list"),
  Paused: document.getElementById("paused-list"),
  Dropped: document.getElementById("dropped-list"),
};

/* =========================
   HELPERS
========================= */

function renderStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? "★" : "☆";
  }
  return stars;
}

function updateSectionVisibility() {
  document.querySelectorAll(".game-section").forEach((section) => {
    const status = section.dataset.status;
    section.style.display =
      activeStatus === "All" || activeStatus === status ? "" : "none";
  });
}

const searchInput = document.getElementById("search");

searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderGames();
});

/* =========================
   GAME CARD
========================= */

function createGameEntry(game) {
  const entry = document.createElement("div");
  entry.className = "game-entry";

  entry.dataset.status = game.status;
  entry.dataset.rating = game.rating || 0;
  entry.dataset.tags = game.tags ? game.tags.join(",") : "";

  entry.innerHTML = `
    <div class="game-card">
      <img class="cover" src="${game.cover}" alt="${game.title} cover">
      <div class="info">
        <div class="title-row">
          <span
            class="fav ${game.tags?.includes("favorite") ? "active" : ""}"
            title="Favorite"
          >★</span>
          <div class="title">${game.title}</div>
        </div>
        <div class="stars">${renderStars(game.rating || 0)}</div>
        <span class="status">${game.status}</span>
      </div>
    </div>
    <div class="game-details">
      <div class="details-grid">
        ${
          game.started
            ? `<div><strong>Started:</strong> ${game.started}</div>`
            : ""
        }
        ${
          game.finished
            ? `<div><strong>Finished:</strong> ${game.finished}</div>`
            : ""
        }
        ${
          game.genres
            ? `<div><strong>Genre:</strong> ${game.genres.join(", ")}</div>`
            : ""
        }
        ${
          game.console
            ? `<div><strong>Console:</strong> ${
                Array.isArray(game.console)
                  ? game.console.join(", ")
                  : game.console
              }</div>`
            : ""
        }
        ${
          game.playtime
            ? `<div><strong>Playtime:</strong> ~${game.playtime}h</div>`
            : ""
        }
        ${
          game.release
            ? `<div><strong>Release:</strong> ${game.release}</div>`
            : ""
        }
        ${
          game.dlc && game.dlc.length
            ? `<div><strong>DLCs:</strong> ${game.dlc.join(", ")}</div>`
            : ""
        }
        ${
          game.notes
            ? `<div class="notes"><strong>Notes:</strong> ${game.notes}</div>`
            : ""
        }
      </div>
    </div>
  `;

  const card = entry.querySelector(".game-card");
  card.addEventListener("click", () => {
    document.querySelectorAll(".game-entry.open").forEach((open) => {
      if (open !== entry) open.classList.remove("open");
    });
    entry.classList.toggle("open");
  });

  return entry;
}

/* =========================
   RENDERING
========================= */

function clearLists() {
  Object.values(lists).forEach((list) => (list.innerHTML = ""));
}

function renderGames() {
  clearLists();

  let filtered = allGames.filter((game) => {
    const statusMatch = activeStatus === "All" || game.status === activeStatus;

    const tagMatch =
      activeTag === "All" || (game.tags && game.tags.includes(activeTag));

    const searchMatch = game.title.toLowerCase().includes(searchQuery);

    return statusMatch && tagMatch && searchMatch;
  });

  filtered.sort((a, b) => {
    if (sortMode === "asc") return (a.rating || 0) - (b.rating || 0);
    return (b.rating || 0) - (a.rating || 0);
  });

  filtered.forEach((game) => {
    if (lists[game.status]) {
      lists[game.status].appendChild(createGameEntry(game));
    }
  });

  updateSectionVisibility();
}

/* =========================
   FILTER BUTTONS
========================= */

// Status
document.querySelectorAll(".status-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".status-filter")
      .forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");
    activeStatus = btn.dataset.status;
    renderGames();
  });
});

// Tags
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

/* =========================
   SORTING
========================= */

const sortSelect = document.getElementById("sort-score");

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    renderGames();
  });
}

/* =========================
   LOAD DATA
========================= */

fetch("games.json")
  .then((res) => res.json())
  .then((games) => {
    allGames = games;
    renderGames();
  })
  .catch((err) => console.error("Failed to load games.json", err));
