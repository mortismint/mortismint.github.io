let CET_TZ = "Europe/Berlin";

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
function parse12HourTime(timeStr) {
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return {
    h24: h,
    min,
    totalMinutes: h * 60 + min,
  };
}

function buildDayDateMap() {
  const generated = scheduleData?.generated
    ? new Date(scheduleData.generated)
    : new Date();

  const base = new Date(
    Date.UTC(
      generated.getUTCFullYear(),
      generated.getUTCMonth(),
      generated.getUTCDate(),
    ),
  );

  const weekdayIndex = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const out = {};
  for (const d of scheduleData.days) {
    const target = weekdayIndex[d.day];
    const current = base.getUTCDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7;

    const actual = new Date(base);
    actual.setUTCDate(base.getUTCDate() + delta);
    out[d.day] = actual;
  }

  return out;
}

function zonedTimeToUtc(dateObjUtc, h, min, tz) {
  const y = dateObjUtc.getUTCFullYear();
  const m = dateObjUtc.getUTCMonth() + 1;
  const d = dateObjUtc.getUTCDate();

  const naiveUtc = new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`,
  );

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc);

  const tzYear = parseInt(parts.find((p) => p.type === "year").value, 10);
  const tzMonth = parseInt(parts.find((p) => p.type === "month").value, 10);
  const tzDay = parseInt(parts.find((p) => p.type === "day").value, 10);
  const tzHour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const tzMinute = parseInt(parts.find((p) => p.type === "minute").value, 10);

  const desiredUtcMs = Date.UTC(y, m - 1, d, h, min);
  const observedUtcMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute);
  const diffMinutes = (desiredUtcMs - observedUtcMs) / 60000;

  return new Date(naiveUtc.getTime() + diffMinutes * 60000);
}

function buildRunDates(day) {
  const dayDateMap = buildDayDateMap();
  const baseDate = dayDateMap[day.day];
  if (!baseDate) return [];

  let rolloverDays = 0;
  let prevMinutes = -1;

  return day.runs.map((run) => {
    const parsed = parse12HourTime(run.start_time);
    if (!parsed) return null;

    if (prevMinutes !== -1 && parsed.totalMinutes < prevMinutes) {
      rolloverDays += 1;
    }
    prevMinutes = parsed.totalMinutes;

    const actualDate = new Date(baseDate);
    actualDate.setUTCDate(baseDate.getUTCDate() + rolloverDays);

    return zonedTimeToUtc(actualDate, parsed.h24, parsed.min, CET_TZ);
  });
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

/** Short timezone abbreviation, e.g. "CET", "CEST", "PDT" */
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
  if (origTzEl) {
    origTzEl.innerHTML = `All times originally in <strong style="color:var(--text)">${schedTzAbbr}</strong>`;
  }

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
    const runDates = buildRunDates(day);
    const firstUtc = runDates[0] || null;
    const lastUtc = runDates[runDates.length - 1] || null;

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

      const utcDate = runDates[ri];
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
