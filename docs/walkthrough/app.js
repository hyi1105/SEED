const ACTION_COLORS = {
  write: "var(--write)",
  lookup: "var(--lookup)",
  sync: "var(--sync)",
  auto: "var(--auto)",
  validate: "var(--validate)",
  approve: "var(--approve)",
  notify: "var(--notify)",
};

const WORLD = { w: 1400, h: 900 };

const state = {
  data: null,
  roleId: null,
  scenarioId: null,
  stepIndex: 0,
  layout: {},
  cam: { x: 40, y: 40, scale: 1 },
  hintHidden: false,
};

const els = {
  title: document.getElementById("sys-title"),
  sub: document.getElementById("sys-sub"),
  role: document.getElementById("role-select"),
  scenario: document.getElementById("scenario-select"),
  summary: document.getElementById("scenario-summary"),
  chain: document.getElementById("scenario-chain"),
  steps: document.getElementById("steps-list"),
  note: document.getElementById("step-note"),
  risks: document.getElementById("step-risks"),
  legend: document.getElementById("action-legend"),
  canvas: document.getElementById("lineage-canvas"),
  coverage: document.getElementById("coverage-grid"),
  prev: document.getElementById("btn-prev"),
  next: document.getElementById("btn-next"),
  viewport: document.getElementById("viewport"),
  world: document.getElementById("world"),
  sheet: document.getElementById("sheet"),
  sheetToggle: document.getElementById("sheet-toggle"),
  mapHint: document.getElementById("map-hint"),
};

function storageKey() {
  return `walkthrough-layout:${state.data?.system || "default"}`;
}

function actionLabel(id) {
  return state.data.actions.find((a) => a.id === id)?.label ?? id;
}

function roleLabel(id) {
  return state.data.roles.find((r) => r.id === id)?.label ?? id;
}

function scenariosForRole(roleId) {
  return state.data.scenarios.filter((s) => s.role === roleId);
}

function currentScenario() {
  return state.data.scenarios.find((s) => s.id === state.scenarioId);
}

function currentStep() {
  const sc = currentScenario();
  return sc?.steps?.[state.stepIndex] ?? null;
}

function defaultLayout() {
  const fromData = state.data.layout?.entities || {};
  const layout = {};
  state.data.entities.forEach((entity, i) => {
    layout[entity.id] = {
      x: fromData[entity.id]?.x ?? 40 + i * 300,
      y: fromData[entity.id]?.y ?? 60 + (i % 2) * 40,
      w: fromData[entity.id]?.w ?? 240,
    };
  });
  return layout;
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      state.layout = { ...defaultLayout(), ...parsed };
      return;
    }
  } catch (_) {
    /* ignore */
  }
  state.layout = defaultLayout();
}

function saveLayout() {
  localStorage.setItem(storageKey(), JSON.stringify(state.layout));
}

function applyCamera() {
  const { x, y, scale } = state.cam;
  els.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function clampScale(s) {
  return Math.min(2.4, Math.max(0.35, s));
}

function fitCamera() {
  const vp = els.viewport.getBoundingClientRect();
  const ids = Object.keys(state.layout);
  if (!ids.length) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  ids.forEach((id) => {
    const node = els.canvas.querySelector(`[data-entity="${id}"]`);
    const pos = state.layout[id];
    const w = pos.w || 240;
    const h = node?.offsetHeight || 180;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  });
  const pad = 48;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  const scale = clampScale(Math.min(vp.width / bw, vp.height / bh));
  state.cam.scale = scale;
  state.cam.x = (vp.width - bw * scale) / 2 - (minX - pad) * scale;
  state.cam.y = (vp.height - bh * scale) / 2 - (minY - pad) * scale;
  applyCamera();
}

function fillRoles() {
  els.role.innerHTML = state.data.roles
    .map((r) => `<option value="${r.id}">${r.label}</option>`)
    .join("");
}

function fillScenarios() {
  const list = scenariosForRole(state.roleId);
  els.scenario.innerHTML = list
    .map((s) => `<option value="${s.id}">${s.title}</option>`)
    .join("");
  if (!list.some((s) => s.id === state.scenarioId)) {
    state.scenarioId = list[0]?.id ?? null;
  }
  els.scenario.value = state.scenarioId ?? "";
}

function fillLegend() {
  els.legend.innerHTML = state.data.actions
    .map(
      (a) =>
        `<span><i style="--c:${ACTION_COLORS[a.id]}"></i>${a.label}</span>`
    )
    .join("");
}

function placeEntity(node, id) {
  const pos = state.layout[id];
  node.style.left = `${pos.x}px`;
  node.style.top = `${pos.y}px`;
  node.style.width = `${pos.w || 240}px`;
}

function renderCanvasStructure() {
  els.canvas.style.width = `${WORLD.w}px`;
  els.canvas.style.height = `${WORLD.h}px`;
  els.canvas.innerHTML = state.data.entities
    .map((entity) => {
      const fields = (entity.fields || [])
        .map((f) => {
          const auto = f.auto ? `<span class="auto-pill">AUTO</span>` : "";
          return `<li class="field" data-field="${entity.id}.${f.id}">
            <span class="fname">${f.label}</span>${auto}
          </li>`;
        })
        .join("");
      return `<article class="entity kind-${entity.kind}" data-entity="${entity.id}">
        <div class="entity-head" data-drag-handle="1">
          <h3>${entity.label}</h3>
          <span class="kind-tag">${entity.kind}</span>
        </div>
        <ul class="fields">${fields}</ul>
      </article>`;
    })
    .join("");

  state.data.entities.forEach((entity) => {
    const node = els.canvas.querySelector(`[data-entity="${entity.id}"]`);
    if (node) placeEntity(node, entity.id);
  });

  requestAnimationFrame(() => {
    drawEdges();
    fitCamera();
  });
}

function nodeAnchor(selector, side) {
  const el = els.canvas.querySelector(selector);
  if (!el) return null;
  const worldRect = els.canvas.getBoundingClientRect();
  const scale = state.cam.scale || 1;
  const r = el.getBoundingClientRect();
  const y = (r.top - worldRect.top) / scale + r.height / scale / 2;
  const x =
    side === "left"
      ? (r.left - worldRect.left) / scale
      : side === "right"
        ? (r.right - worldRect.left) / scale
        : (r.left - worldRect.left) / scale + r.width / scale / 2;
  return { x, y };
}

function resolveEdgeEndpoint(ref, preferSide) {
  if (ref.includes(".")) {
    return nodeAnchor(`[data-field="${ref}"]`, preferSide);
  }
  return (
    nodeAnchor(`[data-entity="${ref}"] .entity-head`, preferSide) ||
    nodeAnchor(`[data-entity="${ref}"]`, preferSide)
  );
}

function drawEdges() {
  const svg = document.getElementById("edges-svg");
  if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${WORLD.w} ${WORLD.h}`);
  svg.setAttribute("width", String(WORLD.w));
  svg.setAttribute("height", String(WORLD.h));

  svg.innerHTML = state.data.edges
    .map((edge) => {
      const from = resolveEdgeEndpoint(edge.from, "right");
      const to = resolveEdgeEndpoint(edge.to, "left");
      if (!from || !to) return "";
      const midX = (from.x + to.x) / 2;
      const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
      const labelX = midX;
      const labelY = (from.y + to.y) / 2 - 8;
      return `<path class="edge-path" data-edge="${edge.id}" d="${d}" />
        <text class="edge-label" data-edge-label="${edge.id}" x="${labelX}" y="${labelY}" text-anchor="middle">${edge.label || ""}</text>`;
    })
    .join("");

  applyHighlight();
}

function renderSteps() {
  const sc = currentScenario();
  if (!sc) {
    els.steps.innerHTML = "";
    els.summary.textContent = "此角色尚無情境。";
    els.chain.hidden = true;
    return;
  }

  els.summary.textContent = sc.summary || "";
  if (sc.next) {
    const next = state.data.scenarios.find((s) => s.id === sc.next);
    els.chain.hidden = false;
    els.chain.innerHTML = next
      ? `下一步情境：<button type="button" data-jump="${next.id}">${roleLabel(next.role)} · ${next.title}</button>`
      : "";
  } else {
    els.chain.hidden = true;
  }

  els.steps.innerHTML = sc.steps
    .map((step, idx) => {
      const short =
        step.note.length > 26 ? `${step.note.slice(0, 26)}…` : step.note;
      return `<li>
        <button type="button" class="step-item ${idx === state.stepIndex ? "active" : ""}" data-step="${idx}" style="--active:${ACTION_COLORS[step.action]}">
          <span class="step-n">${step.n}</span>
          <span class="step-title">${short}</span>
          <span class="badge ${step.action}">${actionLabel(step.action)}</span>
        </button>
      </li>`;
    })
    .join("");

  els.prev.disabled = state.stepIndex <= 0;
  els.next.disabled = state.stepIndex >= sc.steps.length - 1;
}

function applyHighlight() {
  const step = currentStep();
  const hotFields = new Set(step?.fields ?? []);
  const hotEdges = new Set(step?.edges ?? []);
  const color = ACTION_COLORS[step?.action] ?? "var(--glow)";
  els.canvas.style.setProperty("--active", color);
  document.getElementById("edges-svg")?.style.setProperty("--active", color);

  els.canvas.querySelectorAll(".field").forEach((node) => {
    const id = node.getAttribute("data-field");
    const on = hotFields.has(id);
    node.classList.toggle("hot", on);
    node.classList.toggle("dim", Boolean(step) && !on);
  });

  document.querySelectorAll(".edge-path").forEach((node) => {
    const id = node.getAttribute("data-edge");
    node.classList.toggle("hot", hotEdges.has(id));
  });
  document.querySelectorAll(".edge-label").forEach((node) => {
    const id = node.getAttribute("data-edge-label");
    node.classList.toggle("hot", hotEdges.has(id));
  });

  if (step) {
    els.note.textContent = step.note;
    if (step.risks?.length) {
      els.risks.hidden = false;
      els.risks.innerHTML = step.risks.map((r) => `<li>風險：${r}</li>`).join("");
    } else {
      els.risks.hidden = true;
      els.risks.innerHTML = "";
    }
  }
}

function touchedFieldsForScenarios(scenarios) {
  const map = new Map();
  for (const sc of scenarios) {
    for (const step of sc.steps) {
      for (const f of step.fields || []) {
        if (!map.has(f)) map.set(f, new Set());
        map.get(f).add(sc.id);
      }
    }
  }
  return map;
}

function renderCoverage() {
  const allScenarios = state.data.scenarios;
  const touchedAll = touchedFieldsForScenarios(allScenarios);
  const roleScenarios = scenariosForRole(state.roleId);
  const touchedRole = touchedFieldsForScenarios(roleScenarios);

  els.coverage.innerHTML = state.data.entities
    .map((entity) => {
      const rows = (entity.fields || [])
        .map((f) => {
          const ref = `${entity.id}.${f.id}`;
          const allHit = touchedAll.get(ref);
          const roleHit = touchedRole.get(ref);
          let pill;
          let cls;
          if (!allHit) {
            cls = "dead";
            pill = "候選死欄位";
          } else if (!roleHit) {
            cls = "partial";
            pill = "其他角色才用";
          } else {
            cls = "touched";
            pill = `出現 ${allHit.size} 情境`;
          }
          const note = f.note ? ` · ${f.note}` : "";
          return `<div class="cov-row"><span>${f.label}${note}</span><span class="pill ${cls}">${pill}</span></div>`;
        })
        .join("");
      return `<article class="cov-card"><h3>${entity.label}</h3>${rows}</article>`;
    })
    .join("");
}

function refresh() {
  fillScenarios();
  renderSteps();
  applyHighlight();
  renderCoverage();
}

function setRole(roleId) {
  state.roleId = roleId;
  state.stepIndex = 0;
  refresh();
}

function setScenario(scenarioId) {
  state.scenarioId = scenarioId;
  const sc = currentScenario();
  if (sc) state.roleId = sc.role;
  els.role.value = state.roleId;
  state.stepIndex = 0;
  refresh();
}

function setStep(index) {
  const sc = currentScenario();
  if (!sc) return;
  state.stepIndex = Math.max(0, Math.min(index, sc.steps.length - 1));
  renderSteps();
  applyHighlight();
  focusHotEntities();
}

function focusHotEntities() {
  const step = currentStep();
  if (!step?.fields?.length) return;
  const entityIds = [
    ...new Set(step.fields.map((f) => f.split(".")[0])),
  ];
  const vp = els.viewport.getBoundingClientRect();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  entityIds.forEach((id) => {
    const pos = state.layout[id];
    const node = els.canvas.querySelector(`[data-entity="${id}"]`);
    if (!pos || !node) return;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + (pos.w || 240));
    maxY = Math.max(maxY, pos.y + node.offsetHeight);
  });
  if (!Number.isFinite(minX)) return;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  state.cam.x = vp.width / 2 - cx * state.cam.scale;
  state.cam.y = vp.height / 2 - cy * state.cam.scale;
  applyCamera();
}

function hideHintSoon() {
  if (state.hintHidden) return;
  state.hintHidden = true;
  els.mapHint?.classList.add("hide");
}

function bindMap() {
  const vp = els.viewport;
  let mode = null;
  let last = null;
  let pinch = null;

  const onPointerDown = (e) => {
    const handle = e.target.closest("[data-drag-handle]");
    const entity = e.target.closest(".entity");

    if (handle && entity) {
      mode = "drag-entity";
      const id = entity.getAttribute("data-entity");
      entity.classList.add("dragging");
      last = {
        id,
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ox: state.layout[id].x,
        oy: state.layout[id].y,
      };
      entity.setPointerCapture?.(e.pointerId);
      hideHintSoon();
      e.preventDefault();
      return;
    }

    if (e.target.closest(".entity")) return;

    mode = "pan";
    last = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    vp.classList.add("panning");
    vp.setPointerCapture?.(e.pointerId);
    hideHintSoon();
  };

  const onPointerMove = (e) => {
    if (!mode || !last || last.pointerId !== e.pointerId) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;

    if (mode === "pan") {
      state.cam.x += dx;
      state.cam.y += dy;
      last.x = e.clientX;
      last.y = e.clientY;
      applyCamera();
      return;
    }

    if (mode === "drag-entity") {
      const scale = state.cam.scale || 1;
      state.layout[last.id].x = last.ox + dx / scale;
      state.layout[last.id].y = last.oy + dy / scale;
      const node = els.canvas.querySelector(`[data-entity="${last.id}"]`);
      if (node) placeEntity(node, last.id);
      drawEdges();
    }
  };

  const onPointerUp = (e) => {
    if (!last || last.pointerId !== e.pointerId) return;
    if (mode === "drag-entity") {
      const node = els.canvas.querySelector(`[data-entity="${last.id}"]`);
      node?.classList.remove("dragging");
      saveLayout();
    }
    mode = null;
    last = null;
    vp.classList.remove("panning");
  };

  vp.addEventListener("pointerdown", onPointerDown);
  vp.addEventListener("pointermove", onPointerMove);
  vp.addEventListener("pointerup", onPointerUp);
  vp.addEventListener("pointercancel", onPointerUp);

  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const before = state.cam.scale;
      const after = clampScale(before * (e.deltaY < 0 ? 1.08 : 0.92));
      const wx = (mx - state.cam.x) / before;
      const wy = (my - state.cam.y) / before;
      state.cam.scale = after;
      state.cam.x = mx - wx * after;
      state.cam.y = my - wy * after;
      applyCamera();
      hideHintSoon();
    },
    { passive: false }
  );

  // Pinch zoom
  vp.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        pinch = {
          dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          scale: state.cam.scale,
        };
        mode = "pinch";
      }
    },
    { passive: true }
  );

  vp.addEventListener(
    "touchmove",
    (e) => {
      if (mode !== "pinch" || e.touches.length !== 2 || !pinch) return;
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      state.cam.scale = clampScale(pinch.scale * (dist / pinch.dist));
      applyCamera();
      hideHintSoon();
    },
    { passive: true }
  );

  vp.addEventListener("touchend", () => {
    if (mode === "pinch") {
      mode = null;
      pinch = null;
    }
  });

  document.getElementById("zoom-in")?.addEventListener("click", () => {
    state.cam.scale = clampScale(state.cam.scale * 1.15);
    applyCamera();
  });
  document.getElementById("zoom-out")?.addEventListener("click", () => {
    state.cam.scale = clampScale(state.cam.scale / 1.15);
    applyCamera();
  });
  document.getElementById("zoom-fit")?.addEventListener("click", fitCamera);
  document.getElementById("layout-reset")?.addEventListener("click", () => {
    localStorage.removeItem(storageKey());
    state.layout = defaultLayout();
    state.data.entities.forEach((entity) => {
      const node = els.canvas.querySelector(`[data-entity="${entity.id}"]`);
      if (node) placeEntity(node, entity.id);
    });
    drawEdges();
    fitCamera();
  });
}

function bindUi() {
  els.role.addEventListener("change", () => setRole(els.role.value));
  els.scenario.addEventListener("change", () => setScenario(els.scenario.value));
  els.prev.addEventListener("click", () => setStep(state.stepIndex - 1));
  els.next.addEventListener("click", () => setStep(state.stepIndex + 1));

  els.steps.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-step]");
    if (!btn) return;
    setStep(Number(btn.getAttribute("data-step")));
  });

  els.chain.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-jump]");
    if (!btn) return;
    setScenario(btn.getAttribute("data-jump"));
  });

  els.sheetToggle?.addEventListener("click", () => {
    const open = els.sheet.getAttribute("data-open") === "true";
    els.sheet.setAttribute("data-open", open ? "false" : "true");
    els.sheetToggle.setAttribute("aria-expanded", open ? "false" : "true");
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__walkResize);
    window.__walkResize = setTimeout(() => {
      drawEdges();
    }, 120);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") setStep(state.stepIndex + 1);
    if (e.key === "ArrowLeft") setStep(state.stepIndex - 1);
  });
}

async function loadSystemData() {
  const embedded = document.getElementById("system-data");
  if (embedded?.textContent?.trim()) {
    return JSON.parse(embedded.textContent);
  }
  const urls = [
    "./system.json",
    "https://cdn.jsdelivr.net/gh/hyi1105/SEED@main/docs/walkthrough/system.json",
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("無法載入 system.json");
}

async function boot() {
  state.data = await loadSystemData();
  els.title.textContent = state.data.system;
  els.sub.textContent =
    state.data.subtitle || "拖地圖、縮放、點步驟看欄位活起來";
  state.roleId = state.data.roles[0].id;
  state.scenarioId = scenariosForRole(state.roleId)[0]?.id ?? null;

  loadLayout();
  fillRoles();
  els.role.value = state.roleId;
  fillLegend();
  renderCanvasStructure();
  bindMap();
  bindUi();
  refresh();

  // Mobile: start with sheet open once, then user can collapse
  if (window.matchMedia("(max-width: 899px)").matches) {
    els.sheet.setAttribute("data-open", "true");
  }
}

boot().catch((err) => {
  if (els.summary) els.summary.textContent = `載入失敗：${err.message}`;
  console.error(err);
});
