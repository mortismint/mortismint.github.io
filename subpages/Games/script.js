const lists = {
  Playing: document.getElementById("playing-list"),
  Planning: document.getElementById("planning-list"),
  Completed: document.getElementById("completed-list"),
  Paused: document.getElementById("paused-list"),
  Dropped: document.getElementById("dropped-list"),
};

function renderStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? "★" : "☆";
  }
  return stars;
}

function createGameEntry(game) {
  const entry = document.createElement("div");
  entry.className = "game-entry";

  entry.innerHTML = `
<div class="game-card">
<img class="cover" src="${game.cover}" alt="${game.title} cover">
<div class="info">
<div class="title">${game.title}</div>
<div class="stars">${renderStars(game.rating)}</div>
<span class="status">${game.status}</span>
</div>
</div>


<div class="game-details">
<div class="details-grid">
${game.started ? `<div><strong>Started:</strong> ${game.started}</div>` : ""}
${game.finished ? `<div><strong>Finished:</strong> ${game.finished}</div>` : ""}
${
  game.genres
    ? `<div><strong>Genre:</strong> ${game.genres.join(", ")}</div>`
    : ""
}
${
  game.playtime
    ? `<div><strong>Playtime:</strong> ~${game.playtime}h</div>`
    : ""
}
${game.release ? `<div><strong>Release:</strong> ${game.release}</div>` : ""}
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

fetch("games.json")
  .then((res) => res.json())
  .then((games) => {
    games.forEach((game) => {
      if (lists[game.status]) {
        lists[game.status].appendChild(createGameEntry(game));
      }
    });
  })
  .catch((err) => console.error("Failed to load games.json", err));
