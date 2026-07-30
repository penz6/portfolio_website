const workConsole = document.querySelector("#work-console");
const skillsGrid = document.querySelector("#skills-grid");

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadJSON(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

function renderLogo(role) {
  if (role.logo) {
    return `<div class="logo"><img src="${escapeHTML(role.logo)}" alt="" loading="lazy"></div>`;
  }

  return `<div class="logo text-logo" aria-hidden="true">${escapeHTML(role.logoText || role.companyShort)}</div>`;
}

function renderExperience(roles) {
  const timeline = roles.map((role, index) => {
    const active = index === 0;

    return `
      <button
        class="timeline-entry${role.current ? " current" : ""}${active ? " active" : ""}"
        id="tab-${escapeHTML(role.id)}"
        type="button"
        role="tab"
        aria-selected="${active}"
        aria-controls="job-${escapeHTML(role.id)}"
        data-job="job-${escapeHTML(role.id)}"
        ${active ? "" : 'tabindex="-1"'}
      >
        <span class="timeline-year">${escapeHTML(role.timelineLabel)}</span>
        <i aria-hidden="true"></i>
        <span>
          <b>${escapeHTML(role.companyShort)}</b>
          <em>${escapeHTML(role.title)}</em>
        </span>
      </button>`;
  }).join("");

  const records = roles.map((role, index) => `
    <article
      class="work-record${index === 0 ? " active" : ""}"
      id="job-${escapeHTML(role.id)}"
      role="tabpanel"
      aria-labelledby="tab-${escapeHTML(role.id)}"
      ${index === 0 ? "" : "hidden"}
    >
      <div class="record-code">${escapeHTML(role.code)}</div>
      <div class="record-head">
        ${renderLogo(role)}
        <div>
          <p>${escapeHTML(role.company)}</p>
          <h3>${escapeHTML(role.title)}</h3>
        </div>
        <time>${escapeHTML(role.dates)}</time>
      </div>
      <p class="job-desc">${escapeHTML(role.description)}</p>
    </article>`).join("");

  workConsole.innerHTML = `
    <div class="timeline-index" role="tablist" aria-label="Work history" aria-orientation="vertical">
      ${timeline}
    </div>
    <div class="work-records">${records}</div>`;

  initializeTimeline();
}

function initializeTimeline() {
  const timelineEntries = [...workConsole.querySelectorAll(".timeline-entry")];
  const workRecords = [...workConsole.querySelectorAll(".work-record")];

  function selectRecord(entry, moveFocus = false) {
    const targetId = entry.dataset.job;

    timelineEntries.forEach((item) => {
      const active = item === entry;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });

    workRecords.forEach((record) => {
      const active = record.id === targetId;
      record.classList.toggle("active", active);
      record.hidden = !active;
    });

    if (moveFocus) entry.focus();
  }

  timelineEntries.forEach((entry, index) => {
    entry.addEventListener("mouseenter", () => selectRecord(entry));
    entry.addEventListener("focus", () => selectRecord(entry));
    entry.addEventListener("click", () => selectRecord(entry));
    entry.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      let nextIndex = index;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = (index + 1) % timelineEntries.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex = (index - 1 + timelineEntries.length) % timelineEntries.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = timelineEntries.length - 1;
      }

      selectRecord(timelineEntries[nextIndex], true);
    });
  });
}

function renderSkills(groups) {
  skillsGrid.innerHTML = groups.map((group) => `
    <div class="skill-group">
      <h3>${escapeHTML(group.name)}</h3>
      <div class="chips">
        ${group.items.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
      </div>
    </div>`).join("");
}

function renderError(container, label) {
  container.innerHTML = `<p class="data-error">Could not load ${escapeHTML(label)}. Check the JSON file and refresh the page.</p>`;
}

async function initializeContent() {
  const [experienceResult, skillsResult] = await Promise.allSettled([
    loadJSON("data/experience.json"),
    loadJSON("data/skills.json")
  ]);

  if (experienceResult.status === "fulfilled" && Array.isArray(experienceResult.value.roles)) {
    renderExperience(experienceResult.value.roles);
  } else {
    renderError(workConsole, "work history");
    console.error("Experience data failed to load:", experienceResult.reason);
  }

  if (skillsResult.status === "fulfilled" && Array.isArray(skillsResult.value.groups)) {
    renderSkills(skillsResult.value.groups);
  } else {
    renderError(skillsGrid, "skills");
    console.error("Skills data failed to load:", skillsResult.reason);
  }
}

function initializeStretchCursor() {
  const cursor = document.querySelector("#stretch-cursor");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!cursor || reducedMotion || !finePointer) {
    cursor?.remove();
    return;
  }

  const pointer = { x: -100, y: -100 };
  const position = { x: -100, y: -100 };
  const mergeCleanupTimers = new WeakMap();
  let mergedTarget = null;
  let animationFrame = 0;
  let colorResetTimer = 0;
  let releaseAngle = 0;
  let releaseStretch = 0;
  let visible = false;
  let pressed = false;

  function updatePalette(element) {
    cursor.classList.toggle("is-action", Boolean(element?.closest("a, button")));
    cursor.classList.toggle(
      "is-dark",
      !element?.closest("a, button")
        && Boolean(element?.closest(".nav, .hero, footer, .timeline-entry.active"))
    );
  }

  function mergeIntoTarget(target) {
    const cleanupTimer = mergeCleanupTimers.get(target);
    if (cleanupTimer) clearTimeout(cleanupTimer);
    if (colorResetTimer) clearTimeout(colorResetTimer);

    const onDark = Boolean(target.closest(".nav, .hero, footer, .timeline-entry.active"));
    const fill = onDark ? "#d2612d" : "#176b75";
    const ink = onDark ? "#092c39" : "#f4f1e7";

    target.style.setProperty("--cursor-merge-fill", fill);
    target.style.setProperty("--cursor-merge-ink", ink);
    target.classList.add("cursor-mergeable");
    target.getBoundingClientRect();
    target.classList.add("cursor-merge-target");

    mergedTarget = target;
    cursor.style.color = ink;
    cursor.classList.add("is-merged");
  }

  function leaveMergedTarget() {
    if (!mergedTarget) return;

    const target = mergedTarget;
    const bounds = target.getBoundingClientRect();
    const fill = target.style.getPropertyValue("--cursor-merge-fill");
    const originX = Math.min(Math.max(pointer.x, bounds.left), bounds.right);
    const originY = Math.min(Math.max(pointer.y, bounds.top), bounds.bottom);

    target.classList.remove("cursor-merge-target");
    mergeCleanupTimers.set(target, window.setTimeout(() => {
      if (target !== mergedTarget) {
        target.classList.remove("cursor-mergeable");
        target.style.removeProperty("--cursor-merge-fill");
        target.style.removeProperty("--cursor-merge-ink");
      }
    }, 180));

    mergedTarget = null;
    position.x = originX;
    position.y = originY;
    releaseAngle = Math.atan2(pointer.y - originY, pointer.x - originX);
    releaseStretch = 0.8;
    cursor.classList.remove("is-merged");
    cursor.style.color = fill;

    if (colorResetTimer) clearTimeout(colorResetTimer);
    colorResetTimer = window.setTimeout(() => {
      cursor.style.removeProperty("color");
    }, 170);
  }

  function render() {
    const targetX = pointer.x;
    const targetY = pointer.y;
    let angle = 0;
    let scaleX = 1;
    let scaleY = 1;

    const previousX = position.x;
    const previousY = position.y;
    position.x += (targetX - position.x) * 0.24;
    position.y += (targetY - position.y) * 0.24;

    const deltaX = position.x - previousX;
    const deltaY = position.y - previousY;
    const motionStretch = Math.min(Math.hypot(deltaX, deltaY) * 0.045, 0.55);
    const stretch = Math.max(motionStretch, releaseStretch);

    angle = releaseStretch > motionStretch
      ? releaseAngle
      : Math.atan2(deltaY, deltaX);
    scaleX = 1 + stretch;
    scaleY = 1 - stretch * 0.28;
    releaseStretch *= 0.76;

    if (mergedTarget) {
      scaleX = 0.46;
      scaleY = 0.46;
    } else if (pressed) {
      scaleX *= 0.86;
      scaleY *= 0.86;
    }

    cursor.style.transform = `translate3d(${position.x - 7}px, ${position.y - 7}px, 0) rotate(${angle}rad) scale(${scaleX}, ${scaleY})`;

    const unsettled = Math.hypot(targetX - position.x, targetY - position.y) > 0.1
      || releaseStretch > 0.01;
    if (visible && unsettled) {
      animationFrame = requestAnimationFrame(render);
    } else {
      animationFrame = 0;
    }
  }

  function queueRender() {
    if (!animationFrame) animationFrame = requestAnimationFrame(render);
  }

  function hideCursor() {
    visible = false;
    pressed = false;
    releaseStretch = 0;
    cursor.classList.remove("is-visible", "is-merged");
    cursor.style.removeProperty("color");
    document.documentElement.classList.remove("custom-cursor-ready");

    if (mergedTarget) {
      mergedTarget.classList.remove("cursor-mergeable", "cursor-merge-target");
      mergedTarget.style.removeProperty("--cursor-merge-fill");
      mergedTarget.style.removeProperty("--cursor-merge-ink");
      mergedTarget = null;
    }
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (!visible) {
      position.x = pointer.x;
      position.y = pointer.y;
      visible = true;
      cursor.classList.add("is-visible");
      document.documentElement.classList.add("custom-cursor-ready");
    }

    const element = document.elementFromPoint(pointer.x, pointer.y);
    const interactive = element?.closest("a, button") || null;

    if (interactive !== mergedTarget) {
      leaveMergedTarget();
      if (interactive) mergeIntoTarget(interactive);
    }

    updatePalette(element);
    queueRender();
  }, { passive: true });

  window.addEventListener("pointerdown", () => {
    pressed = true;
    queueRender();
  }, { passive: true });

  window.addEventListener("pointerup", () => {
    pressed = false;
    queueRender();
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", hideCursor);
  window.addEventListener("blur", hideCursor);
}

initializeContent();
initializeStretchCursor();
