let CET_TZ = "Europe/Berlin";

const DAY_DATE = {
  Friday: "2025-01-10",
  Saturday: "2025-01-11",
  Sunday: "2025-01-12",
};

const DAY_CLASS = {
  Friday: "friday",
  Saturday: "saturday",
  Sunday: "sunday",
};

// State
let scheduleData = null;
let localTz = "Europe/Berlin"; // will be overwritten

// Boot
async function boot() {
  // Detect timezone
  try {
    localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // Fetch schedule
  try {
    const res = await fetch("./schedule.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    scheduleData = await res.json();
    if (scheduleData.timezone) CET_TZ = scheduleData.timezone;
  } catch {
    document.getElementById("loadingScreen").style.display = "none";
    document.getElementById("errorScreen").classList.add("visible");
    return;
  }

  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("page").style.display = "block";
  render();
}

// Time helpers
function parseCET(timeStr, dayName) {
  const date = DAY_DATE[dayName] || DAY_DATE.Friday;
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]),
    min = parseInt(m[2]);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;

  const naiveUtc = new Date(
    `${date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`,
  );
  const cetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: CET_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc);
  const cetH = parseInt(cetParts.find((p) => p.type === "hour").value);
  const cetMin = parseInt(cetParts.find((p) => p.type === "minute").value);
  const diff = h * 60 + min - (cetH * 60 + cetMin);
  return new Date(naiveUtc.getTime() - diff * 60000);
}

/** Format a Date in a given IANA timezone as "3:00 PM" */
function fmt(date, tz) {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "—";
  }
}

/** Short timezone abbreviation, e.g. "CET", "PST" */
function tzAbbr(tz, date) {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      })
        .formatToParts(date || new Date())
        .find((p) => p.type === "timeZoneName")?.value || tz
    );
  } catch {
    return tz;
  }
}

const isCET = () => localTz === CET_TZ;
const scheduleTzAbbrFn = () => tzAbbr(CET_TZ);

// RENDER
function render() {
  const abbrLocal = tzAbbr(localTz);
  const schedTzAbbr = scheduleTzAbbrFn();
  const same = isCET();

  // Event name / title
  if (scheduleData.event) {
    document.title = scheduleData.event + " — Schedule";
    const eyebrow = document.querySelector(".hero-tag");
    if (eyebrow) eyebrow.lastChild.textContent = scheduleData.event;
  }

  // Twitch channel link appended to footer
  if (scheduleData.twitch && !document.getElementById("twitchLink")) {
    const footer = document.querySelector(".site-footer .footer-left");
    if (footer) {
      const a = document.createElement("a");
      a.id = "twitchLink";
      a.href = scheduleData.twitch;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent =
        "▶ " +
        scheduleData.twitch.replace("https://www.twitch.tv/", "twitch.tv/");
      a.style.cssText =
        "color:var(--mauve);text-decoration:none;font-weight:600;font-size:12px;";
      footer.appendChild(a);
    }
  }

  // Total run count
  const totalRuns = scheduleData.days.reduce((n, d) => n + d.runs.length, 0);
  document.getElementById("runCount").textContent = totalRuns;

  // Tz badge + hero text
  document.getElementById("tzBadgeValue").textContent =
    `${abbrLocal} (${localTz})`;
  document.getElementById("localTzName").textContent = same
    ? schedTzAbbr
    : abbrLocal;
  document.getElementById("footerTz").textContent = abbrLocal;

  // Update footer "originally in X" label dynamically
  const origTzEl = document.querySelector(".footer-left span:first-child");
  if (origTzEl)
    origTzEl.innerHTML = `All times originally in <strong style="color:var(--text)">${schedTzAbbr}</strong>`;

  // Day tabs
  const tabsEl = document.getElementById("dayTabs");
  tabsEl.innerHTML = "";
  scheduleData.days.forEach((day, i) => {
    const cls = DAY_CLASS[day.day] || "friday";
    const btn = document.createElement("button");
    btn.className = `day-tab ${cls}${i === 0 ? " active" : ""}`;
    btn.innerHTML = `<span class="tab-dot"></span>${day.day}`;
    btn.onclick = () => {
      document
        .getElementById(`day-${day.day}`)
        .scrollIntoView({ behavior: "smooth" });
    };
    tabsEl.appendChild(btn);
  });

  // Schedule
  const wrap = document.getElementById("scheduleWrap");
  wrap.innerHTML = "";

  scheduleData.days.forEach((day) => {
    const cls = DAY_CLASS[day.day] || "friday";
    const firstRun = day.runs[0];
    const lastRun = day.runs[day.runs.length - 1];
    const firstUtc = firstRun ? parseCET(firstRun.start_time, day.day) : null;
    const lastUtc = lastRun ? parseCET(lastRun.start_time, day.day) : null;

    const section = document.createElement("section");
    section.className = "day-section";
    section.id = `day-${day.day}`;

    // Header
    const header = document.createElement("div");
    header.className = "day-section-header";

    const leftEl = document.createElement("div");
    leftEl.className = "day-section-left";
    leftEl.innerHTML = `
      <span class="day-section-kicker">Day ${scheduleData.days.indexOf(day) + 1} of ${scheduleData.days.length}</span>
      <div class="day-section-name ${cls}">${day.day}</div>
    `;

    const rightEl = document.createElement("div");
    rightEl.className = "day-section-times";

    if (!same && firstUtc && lastUtc) {
      rightEl.innerHTML = `
        <div class="day-time-cet">${day.window}</div>
        <div class="day-time-local">${fmt(firstUtc, localTz)} – ${fmt(lastUtc, localTz)}</div>
        <div class="day-time-tz">${abbrLocal}</div>
      `;
    } else {
      rightEl.innerHTML = `
        <div class="day-time-local" style="font-size:14px">${day.window}</div>
        <div class="day-time-tz">${schedTzAbbr}</div>
      `;
    }

    header.appendChild(leftEl);
    header.appendChild(rightEl);
    section.appendChild(header);

    // Runs list
    const list = document.createElement("div");
    list.className = "runs-list";

    day.runs.forEach((run, ri) => {
      // Break marker
      if (ri > 0 && scheduleData.break_mins > 0) {
        const bm = document.createElement("div");
        bm.className = "break-marker";
        bm.innerHTML = `<span class="break-marker-label">${scheduleData.break_mins} min break</span>`;
        list.appendChild(bm);
      }

      const utcDate = parseCET(run.start_time, day.day);
      const origStr = run.start_time;
      const localStr = utcDate ? fmt(utcDate, localTz) : "—";

      const card = document.createElement("div");
      card.className = `run-card ${cls}`;

      // Time column: show local big, original tz small (unless same tz)
      const timeHtml = same
        ? `<div class="run-time-local">${origStr}</div>`
        : `
          <div class="run-time-local">${localStr}</div>
          <div class="run-time-cet">${origStr}</div>
          <div class="run-time-cet-label">${schedTzAbbr}</div>
        `;

      // Runner: link to twitch if available, plain text otherwise
      const runnerHtml = run.twitch
        ? `<a href="${run.twitch}" target="_blank" rel="noopener" class="run-runner run-runner-link">${run.runner}</a>`
        : `<span class="run-runner">${run.runner}</span>`;

      card.innerHTML = `
        <div class="run-times">${timeHtml}</div>
        <div class="run-info">
          <div class="run-game">${run.game}</div>
          <div class="run-details">
            <span class="run-category">${run.category}</span>
            <span class="dot-sep"></span>
            ${runnerHtml}
            <span class="run-platform">${run.platform}</span>
          </div>
        </div>
        <div class="run-right">
          <span class="run-estimate">${run.estimate}</span>
          ${run.commentator ? `<span class="run-commentator">🎙 ${run.commentator}</span>` : ""}
        </div>
      `;

      list.appendChild(card);
    });

    section.appendChild(list);
    wrap.appendChild(section);
  });

  // Intersection observer to highlight active day tab
  const sections = document.querySelectorAll(".day-section");
  const tabs = document.querySelectorAll(".day-tab");

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace("day-", "");
          tabs.forEach((t) => {
            t.classList.toggle("active", t.textContent.trim() === id);
          });
        }
      });
    },
    { threshold: 0.3 },
  );

  sections.forEach((s) => obs.observe(s));
}

boot();
