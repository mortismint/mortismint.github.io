// LSS Analyzer

let lastFileText = null;

function parseTimeToMs(t) {
  if (!t) return null;
  // Accept formats like 00:01:23.456 or 1:23.456 or 00:00:49.4706392
  const parts = t.split(":").map((s) => s.trim());
  if (parts.length === 0) return null;
  let h = 0,
    m = 0,
    s = 0;
  if (parts.length === 3) {
    h = parseInt(parts[0] || 0);
    m = parseInt(parts[1] || 0);
    s = parseFloat(parts[2] || 0);
  } else if (parts.length === 2) {
    m = parseInt(parts[0] || 0);
    s = parseFloat(parts[1] || 0);
  } else {
    s = parseFloat(parts[0] || 0);
  }
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
  return Math.round(((h * 60 + m) * 60 + s) * 1000);
}

function fmtMs(ms) {
  if (ms == null) return "-";
  const sign = ms < 0 ? "-" : "";
  ms = Math.abs(ms);
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const rem = Math.floor(ms % 1000);
  const frac = (rem / 1000).toFixed(3).slice(1);
  if (h > 0)
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:${String(s).padStart(2, "0")}${frac}`;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )}${frac}`;
}

function pickTime(node, mode) {
  if (!node) return null;
  const preferred = node.querySelector(mode);
  if (preferred && preferred.textContent) return preferred.textContent.trim();
  // fallback to either RealTime or GameTime
  const alt = node.querySelector(mode === "RealTime" ? "GameTime" : "RealTime");
  return alt ? alt.textContent.trim() : null;
}

function parseLss(text, mode) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const game = xml.querySelector("GameName")?.textContent?.trim() || "";
  const category = xml.querySelector("CategoryName")?.textContent?.trim() || "";
  const segments = [];
  const segNodes = xml.querySelectorAll("Segments > Segment");
  segNodes.forEach((snode) => {
    const name = snode.querySelector("Name")?.textContent?.trim() || "Unnamed";
    const splitTimeNode = Array.from(snode.querySelectorAll("SplitTime")).find(
      (st) => st.getAttribute("name") === "Personal Best"
    );
    const pbCumRaw = splitTimeNode ? pickTime(splitTimeNode, mode) : null;
    const bestRaw = pickTime(snode.querySelector("BestSegmentTime"), mode);
    const pbCumMs = parseTimeToMs(pbCumRaw);
    const bestMs = parseTimeToMs(bestRaw);
    segments.push({ name, pbCumRaw, pbCumMs, bestRaw, bestMs });
  });
  return { game, category, segments };
}

function computePerSegment(segments) {
  let prev = 0;
  return segments.map((s) => {
    const cum = s.pbCumMs != null ? s.pbCumMs : null;
    const pbSeg = cum != null ? Math.max(0, cum - prev) : null;
    const best = s.bestMs != null ? s.bestMs : null;
    const timesave = pbSeg != null && best != null ? pbSeg - best : null;
    prev = cum != null ? cum : prev + (pbSeg != null ? pbSeg : 0);
    return Object.assign({}, s, { pbSeg, timesave });
  });
}

function renderResults(data, mode) {
  const out = document.getElementById("results");
  out.innerHTML = "";
  if (!data) return;
  const segments = computePerSegment(data.segments);

  // compute full run time (PB cumulative of last segment) and best possible time (sum of BestSegmentTime)
  const fullRunMs =
    segments.length && segments[segments.length - 1].pbCumMs != null
      ? segments[segments.length - 1].pbCumMs
      : null;
  const bests = segments.map((s) => s.bestMs);
  const missingBest = bests.filter((b) => b == null).length;
  const bestSum = bests.reduce((a, b) => a + (b || 0), 0);

  const header = document.createElement("div");
  header.className = "meta";
  header.innerHTML = `<div><strong>${
    data.game || "Game"
  }</strong><div class="small">${
    data.category || ""
  }</div></div><div class="small">Mode: ${mode}<div>Full run: <strong>${
    fullRunMs != null ? fmtMs(fullRunMs) : "-"
  }</strong></div><div>Best possible: <strong>${
    missingBest === 0 ? fmtMs(bestSum) : fmtMs(bestSum) + " (partial)"
  }</strong></div></div>`;
  out.appendChild(header);

  const table = document.createElement("table");
  table.className = "segments-table";
  // Columns: #, Segment, Time (cumulative PB), PB seg, Best seg, Timesave, Visual
  table.innerHTML = `<thead><tr><th>#</th><th>Segment</th><th>Time</th><th>PB seg</th><th>Best seg</th><th>Timesave</th><th style="width:160px">Visual</th></tr></thead>`;
  const tbody = document.createElement("tbody");

  // find max positive timesave for scaling
  const maxSave = Math.max(0, ...segments.map((s) => s.timesave || 0));
  // compute global max timesave value for highlight
  const globalMax = Math.max(...segments.map((x) => x.timesave || 0));

  // --- Timesave summary panel (render at top) ---
  const summaryCountEl = document.getElementById("summaryCount");
  const configuredTopN = parseInt(summaryCountEl?.value || "3", 10) || 3;
  const positiveSavesTop = segments
    .map((s, i) => ({
      index: i,
      name: s.name
        .replace(/^[-\u2013\u2014]+\s*/, "")
        .replace(/^\{[^}]+\}\s*/, ""),
      timesave: s.timesave || 0,
    }))
    .filter((x) => x.timesave > 0);
  const totalSaveMsTop = positiveSavesTop.reduce((a, b) => a + b.timesave, 0);
  const summaryDivTop = document.createElement("div");
  summaryDivTop.className = "summary";
  if (positiveSavesTop.length === 0) {
    summaryDivTop.innerHTML = `<div class="summary-total">No positive timesaves found.</div>`;
  } else {
    const sortedTop = positiveSavesTop.sort((a, b) => b.timesave - a.timesave);
    const top = sortedTop.slice(0, configuredTopN);
    const maxSaveValTop = sortedTop[0].timesave || 1;
    const totalFmtTop = fmtMs(totalSaveMsTop);
    let htmlTop = `<div class="summary-header">Top ${top.length} timesaves — Total potential save: <strong>${totalFmtTop}</strong></div><div class="summary-list">`;
    top.forEach((t) => {
      const pct = Math.round((t.timesave / maxSaveValTop) * 100);
      htmlTop += `<div class="summary-item" data-idx="${
        t.index
      }"><div class="summary-name">${
        t.name
      }</div><div class="summary-value">${fmtMs(
        t.timesave
      )}</div><div class="summary-bar-wrap"><div class="summary-bar" style="width:${pct}%"></div></div></div>`;
    });
    htmlTop += `</div>`;
    summaryDivTop.innerHTML = htmlTop;
  }
  out.appendChild(summaryDivTop);
  segments.forEach((s, i) => {
    const tr = document.createElement("tr");
    if (s.timesave != null && s.timesave === globalMax)
      tr.className = "top-save";
    // assign an id so summary links can scroll to this segment
    tr.id = `seg-${i}`;
    const pbSegFmt = s.pbSeg != null ? fmtMs(s.pbSeg) : "-";
    const bestFmt = s.bestMs != null ? fmtMs(s.bestMs) : "-";
    const tsFmt = s.timesave != null ? fmtMs(s.timesave) : "-";
    const cumFmt = s.pbCumMs != null ? fmtMs(s.pbCumMs) : "-";
    const barWidth =
      s.timesave && s.timesave > 0 && maxSave > 0
        ? Math.round((s.timesave / maxSave) * 100)
        : 0;

    // Handle subsplit formatting: names like "{Parent} Child"
    let display = s.name || "";
    let parent = null;
    const m = display.match(/^\{([^}]+)\}\s*(.*)$/);
    let isSub = false;
    if (m) {
      parent = m[1].trim();
      display = m[2].trim();
      isSub = true;
    }
    // remove leading hyphens used for indentation in some splits
    display = display.replace(/^[-\u2013\u2014]+\s*/, "");

    // escape HTML for safety
    function esc(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    const nameHtml = isSub
      ? `<span class="sub-name">${esc(
          display
        )}</span> <span class="sub-parent">(${esc(parent)})</span>`
      : `<span class="seg-name">${esc(display)}</span>`;

    tr.innerHTML = `<td>${
      i + 1
    }</td><td>${nameHtml}</td><td>${cumFmt}</td><td>${pbSegFmt}</td><td>${bestFmt}</td><td class="timesave">${tsFmt}</td><td><div class="bar-wrap"><div class="bar" style="width:${barWidth}%"></div></div></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  out.appendChild(table);
  // clicking an item scrolls to its segment row and flashes it
  summaryDivTop.querySelectorAll(".summary-item").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const idx = el.getAttribute("data-idx");
      const target = document.getElementById(`seg-${idx}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1800);
      }
    });
  });
}

function handleFileText(text) {
  const toggle = document.getElementById("timeToggle");
  const mode = toggle && toggle.checked ? "GameTime" : "RealTime";

  const parsed = parseLss(text, mode);
  renderResults(parsed, mode);
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("fileInput");
  const nameEl = document.getElementById("fileName");
  input.addEventListener("change", (ev) => {
    const f = input.files && input.files[0];
    if (!f) return;
    nameEl.textContent = f.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const txt = String(e.target.result);
      lastFileText = txt;
      handleFileText(txt);
    };
    reader.readAsText(f);
  });

  const timeToggle = document.getElementById("timeToggle");

  if (timeToggle) {
    timeToggle.addEventListener("change", () => {
      if (lastFileText) {
        handleFileText(lastFileText);
        return;
      }

      const f = input.files && input.files[0];
      if (f) {
        const reader = new FileReader();
        reader.onload = (e) => {
          lastFileText = String(e.target.result);
          handleFileText(lastFileText);
        };
        reader.readAsText(f);
      }
    });
  }

  const summaryCountInput = document.getElementById("summaryCount");
  if (summaryCountInput) {
    summaryCountInput.addEventListener("change", () => {
      if (lastFileText) {
        handleFileText(lastFileText);
        return;
      }
      const f = input.files && input.files[0];
      if (f) {
        const reader = new FileReader();
        reader.onload = (e) => {
          lastFileText = String(e.target.result);
          handleFileText(lastFileText);
        };
        reader.readAsText(f);
      }
    });
  }
});
