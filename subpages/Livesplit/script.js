// LSS Analyzer

let lastFileText = null;
let chartInstance = null;

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
      "0",
    )}:${String(s).padStart(2, "0")}${frac}`;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0",
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

  // ── Attempt history ──
  const attemptNodes = xml.querySelectorAll("AttemptHistory > Attempt");
  const completedRuns = [];
  attemptNodes.forEach((a) => {
    const id = parseInt(a.getAttribute("id") || "0");
    const rtNode = a.querySelector("RealTime");
    const gtNode = a.querySelector("GameTime");
    const raw =
      mode === "GameTime"
        ? gtNode?.textContent?.trim() || rtNode?.textContent?.trim()
        : rtNode?.textContent?.trim() || gtNode?.textContent?.trim();
    if (raw) {
      const ms = parseTimeToMs(raw);
      if (ms != null && ms > 60000) {
        // filter sub-minute ghost entries
        const started = a.getAttribute("started") || "";
        completedRuns.push({ id, ms, started });
      }
    }
  });

  // ── Segments ──
  const segments = [];
  const segNodes = xml.querySelectorAll("Segments > Segment");
  segNodes.forEach((snode) => {
    const name = snode.querySelector("Name")?.textContent?.trim() || "Unnamed";
    const splitTimeNode = Array.from(snode.querySelectorAll("SplitTime")).find(
      (st) => st.getAttribute("name") === "Personal Best",
    );
    const pbCumRaw = splitTimeNode ? pickTime(splitTimeNode, mode) : null;
    const bestRaw = pickTime(snode.querySelector("BestSegmentTime"), mode);
    const pbCumMs = parseTimeToMs(pbCumRaw);
    const bestMs = parseTimeToMs(bestRaw);

    // ── Segment history: collect per-attempt times ──
    const historyTimes = [];
    snode.querySelectorAll("SegmentHistory > Time").forEach((t) => {
      const raw = pickTime(t, mode);
      if (raw) {
        const ms = parseTimeToMs(raw);
        if (ms != null && ms > 0) historyTimes.push(ms);
      }
    });
    const avgMs =
      historyTimes.length > 0
        ? Math.round(
            historyTimes.reduce((a, b) => a + b, 0) / historyTimes.length,
          )
        : null;

    segments.push({
      name,
      pbCumRaw,
      pbCumMs,
      bestRaw,
      bestMs,
      historyTimes,
      avgMs,
    });
  });

  return { game, category, segments, completedRuns };
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

function renderStatsGrid(data, segments) {
  const grid = document.getElementById("statsGrid");
  grid.innerHTML = "";
  grid.style.display = "flex";

  const runs = data.completedRuns;
  const pbMs = segments.length ? segments[segments.length - 1].pbCumMs : null;
  const bests = segments.map((s) => s.bestMs);
  const bestSum = bests.every((b) => b != null)
    ? bests.reduce((a, b) => a + b, 0)
    : null;
  const bestSumPartial = bests.reduce((a, b) => a + (b || 0), 0);

  // Filter sensible completed runs (ignore the 3m30s partial, etc — use > 10 min)
  const fullRuns = runs.filter((r) => r.ms > 600000);
  const avgMs =
    fullRuns.length > 0
      ? Math.round(fullRuns.reduce((a, b) => a + b.ms, 0) / fullRuns.length)
      : null;
  const worstMs =
    fullRuns.length > 0 ? Math.max(...fullRuns.map((r) => r.ms)) : null;

  // attempt stats
  const totalAttempts =
    data.completedRuns.length > 0
      ? Math.max(...data.completedRuns.map((r) => r.id))
      : 0;
  const completionRate =
    totalAttempts > 0 ? Math.round((fullRuns.length / totalAttempts) * 100) : 0;

  const cards = [
    {
      label: "Personal Best",
      value: pbMs != null ? fmtMs(pbMs) : "-",
      sub: "",
      cls: "highlight",
    },
    {
      label: "Average (full runs)",
      value: avgMs != null ? fmtMs(avgMs) : "-",
      sub:
        fullRuns.length > 0
          ? pbMs != null
            ? `${fmtMs(avgMs - pbMs)} off PB`
            : `${fullRuns.length} runs`
          : "No full runs",
      cls: "",
    },
    {
      label: "Sum of Best",
      value: fmtMs(bestSumPartial) + (bestSum == null ? " *" : ""),
      sub:
        bestSum != null
          ? pbMs != null
            ? `${fmtMs(pbMs - bestSumPartial)} time to save`
            : ""
          : "* some segs missing",
      cls: "gold",
    },
    {
      label: "Completed Runs",
      value: String(fullRuns.length),
      sub: `of ${totalAttempts} attempts`,
      cls: "",
    },
    {
      label: "Completion Rate",
      value: totalAttempts > 0 ? completionRate + "%" : "-",
      sub: `${totalAttempts - fullRuns.length} resets`,
      cls: completionRate < 25 ? "warn" : "",
    },
    {
      label: "Worst Run",
      value: worstMs != null ? fmtMs(worstMs) : "-",
      sub: "",
      cls: "",
    },
  ];

  cards.forEach((c) => {
    const div = document.createElement("div");
    div.className = "stat-card" + (c.cls ? " " + c.cls : "");
    div.innerHTML = `<div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div>${c.sub ? `<div class="stat-sub">${c.sub}</div>` : ""}`;
    grid.appendChild(div);
  });
}

function renderChart(data) {
  const section = document.getElementById("chartSection");
  section.style.display = "block";
  const fullRuns = data.completedRuns.filter((r) => r.ms > 600000);
  if (fullRuns.length < 2) {
    section.style.display = "none";
    return;
  }

  const canvas = document.getElementById("progressChart");
  const ctx = canvas.getContext("2d");

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const labels = fullRuns.map((r, i) => `Run ${i + 1}`);
  const values = fullRuns.map((r) => r.ms / 1000); // seconds for chart

  // compute linear trend
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const trendData = values.map((_, x) => intercept + slope * x);

  const minVal = Math.min(...values) * 0.97;
  const maxVal = Math.max(...values) * 1.02;

  function secToLabel(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  // Draw manually
  const W = canvas.offsetWidth || 800;
  const H = 160;
  canvas.width = W;
  canvas.height = H;

  const pad = { top: 10, right: 20, bottom: 28, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  // ── gridlines ──
  const yTicks = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= yTicks; i++) {
    const y = pad.top + (plotH / yTicks) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    const val = maxVal - ((maxVal - minVal) / yTicks) * i;
    ctx.fillStyle = "rgba(166,173,200,0.7)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(secToLabel(val), pad.left - 4, y + 3);
  }

  function xPos(i) {
    return pad.left + (i / (n - 1)) * plotW;
  }
  function yPos(v) {
    return pad.top + ((maxVal - v) / (maxVal - minVal)) * plotH;
  }

  // ── trend line ──
  ctx.beginPath();
  ctx.strokeStyle = "rgba(148,226,213,0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  trendData.forEach((v, i) => {
    const x = xPos(i),
      y = yPos(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // ── fill under line ──
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xPos(i),
      y = yPos(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xPos(n - 1), pad.top + plotH);
  ctx.lineTo(xPos(0), pad.top + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, "rgba(148,226,213,0.18)");
  grad.addColorStop(1, "rgba(148,226,213,0.01)");
  ctx.fillStyle = grad;
  ctx.fill();

  // ── main line ──
  ctx.beginPath();
  ctx.strokeStyle = "#94e2d5";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  values.forEach((v, i) => {
    const x = xPos(i),
      y = yPos(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // ── dots + x labels ──
  values.forEach((v, i) => {
    const x = xPos(i),
      y = yPos(v);
    const isPB = v === Math.min(...values);
    ctx.beginPath();
    ctx.arc(x, y, isPB ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isPB ? "#f9e2af" : "#94e2d5";
    ctx.fill();

    // x-axis label
    if (n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1) {
      ctx.fillStyle = "rgba(166,173,200,0.6)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`#${fullRuns[i].id}`, x, H - 6);
    }
  });

  // ── PB star label ──
  const pbIdx = values.indexOf(Math.min(...values));
  const pbX = xPos(pbIdx),
    pbY = yPos(values[pbIdx]);
  ctx.fillStyle = "#f9e2af";
  ctx.font = "bold 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("★ PB", pbX, pbY - 9);

  // slope annotation
  const improving = slope < 0;
  const slopeMin = Math.abs((slope * 60) / 1000).toFixed(1);
  ctx.fillStyle = improving ? "rgba(166,227,161,0.8)" : "rgba(243,139,168,0.8)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(
    improving
      ? `↓ ~${slopeMin}s/run avg improvement`
      : `↑ ~${slopeMin}s/run avg`,
    pad.left + plotW,
    pad.top + 12,
  );
}

function renderResults(data, mode) {
  const out = document.getElementById("results");
  out.innerHTML = "";
  if (!data) return;
  const segments = computePerSegment(data.segments);

  // ── Stats grid ──
  renderStatsGrid(data, segments);

  // ── Chart ──
  renderChart(data);

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
  // Columns: #, Segment, Time, PB seg, Best seg, Avg seg, Timesave, Visual
  table.innerHTML = `<thead><tr><th>#</th><th>Segment</th><th>Time</th><th>PB seg</th><th>Best seg</th><th title="Average across all recorded attempts for this segment">Avg seg</th><th>Timesave</th><th style="width:120px">Visual</th></tr></thead>`;
  const tbody = document.createElement("tbody");

  // find max positive timesave for scaling
  const maxSave = Math.max(0, ...segments.map((s) => s.timesave || 0));
  const globalMax = Math.max(...segments.map((x) => x.timesave || 0));

  // --- Timesave summary panel ---
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
        t.timesave,
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
    tr.id = `seg-${i}`;
    const pbSegFmt = s.pbSeg != null ? fmtMs(s.pbSeg) : "-";
    const bestFmt = s.bestMs != null ? fmtMs(s.bestMs) : "-";
    const tsFmt = s.timesave != null ? fmtMs(s.timesave) : "-";
    const cumFmt = s.pbCumMs != null ? fmtMs(s.pbCumMs) : "-";
    const barWidth =
      s.timesave && s.timesave > 0 && maxSave > 0
        ? Math.round((s.timesave / maxSave) * 100)
        : 0;

    // ── Avg column ──
    let avgHtml = "-";
    if (s.avgMs != null) {
      const avgFmt = fmtMs(s.avgMs);
      if (s.pbSeg != null) {
        const diff = s.avgMs - s.pbSeg;
        const diffFmt = (diff >= 0 ? "+" : "") + fmtMs(diff);
        const cls = diff > 0 ? "avg-slower" : "avg-faster";
        avgHtml = `${avgFmt} <span class="${cls}">(${diffFmt})</span>`;
      } else {
        avgHtml = `<span class="avg-only">${avgFmt}</span>`;
      }
    }

    // Handle subsplit formatting
    let display = s.name || "";
    let parent = null;
    const m = display.match(/^\{([^}]+)\}\s*(.*)$/);
    let isSub = false;
    if (m) {
      parent = m[1].trim();
      display = m[2].trim();
      isSub = true;
    }
    display = display.replace(/^[-\u2013\u2014]+\s*/, "");

    function esc(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    const nameHtml = isSub
      ? `<span class="sub-name">${esc(
          display,
        )}</span> <span class="sub-parent">(${esc(parent)})</span>`
      : `<span class="seg-name">${esc(display)}</span>`;

    tr.innerHTML = `<td>${
      i + 1
    }</td><td>${nameHtml}</td><td>${cumFmt}</td><td>${pbSegFmt}</td><td>${bestFmt}</td><td>${avgHtml}</td><td class="timesave">${tsFmt}</td><td><div class="bar-wrap"><div class="bar" style="width:${barWidth}%"></div></div></td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  out.appendChild(table);

  // clicking summary item scrolls to segment row
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

let lastData = null;

function handleFileText(text) {
  const toggle = document.getElementById("timeToggle");
  const mode = toggle && toggle.checked ? "GameTime" : "RealTime";
  lastData = parseLss(text, mode);
  renderResults(lastData, mode);
}

window.addEventListener("resize", () => {
  if (lastData) renderChart(lastData);
});

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
