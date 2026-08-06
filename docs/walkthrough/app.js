const ACTION_COLORS = {
  write: "var(--write)",
  lookup: "var(--lookup)",
  sync: "var(--sync)",
  auto: "var(--auto)",
  validate: "var(--validate)",
  approve: "var(--approve)",
  notify: "var(--notify)",
};

const state = {
  data: null,
  roleId: null,
  scenarioId: null,
  stepIndex: 0,
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
};

function actionLabel(id) {
  return state.data.actions.find((a) => a.id === id)?.label ?? id;
}

function roleLabel(id) {
  return state.data.roles.find((r) => r.id === id)?.label ?? id;
}

function fieldMeta(fieldRef) {
  const [entityId, fieldId] = fieldRef.split(".");
  const entity = state.data.entities.find((e) => e.id === entityId);
  const field = entity?.fields?.find((f) => f.id === fieldId);
  return { entityId, fieldId, entity, field };
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

function renderCanvasStructure() {
  const entitiesHtml = state.data.entities
    .map((entity) => {
      const fields = (entity.fields || [])
        .map((f) => {
          const auto = f.auto
            ? `<span class="auto-pill">AUTO</span>`
            : "";
          return `<li class="field" data-field="${entity.id}.${f.id}">
            <span class="fname">${f.label}</span>${auto}
          </li>`;
        })
        .join("");
      return `<article class="entity kind-${entity.kind}" data-entity="${entity.id}">
        <div class="entity-head">
          <h3>${entity.label}</h3>
          <span class="kind-tag">${entity.kind}</span>
        </div>
        <ul class="fields">${fields}</ul>
      </article>`;
    })
    .join("");

  els.canvas.innerHTML = `<svg class="edges-svg" id="edges-svg" aria-hidden="true"></svg>${entitiesHtml}`;
  requestAnimationFrame(drawEdges);
}

function nodeAnchor(selector, side) {
  const el = els.canvas.querySelector(selector);
  if (!el) return null;
  const canvasRect = els.canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const y = r.top - canvasRect.top + r.height / 2;
  const x =
    side === "left"
      ? r.left - canvasRect.left
      : side === "right"
        ? r.right - canvasRect.left
        : r.left - canvasRect.left + r.width / 2;
  return { x, y, el };
}

function resolveEdgeEndpoint(ref, preferSide) {
  if (ref.includes(".")) {
    return nodeAnchor(`[data-field="${ref}"]`, preferSide);
  }
  const head = nodeAnchor(`[data-entity="${ref}"] .entity-head`, preferSide);
  if (head) return head;
  return nodeAnchor(`[data-entity="${ref}"]`, preferSide);
}

function drawEdges() {
  const svg = document.getElementById("edges-svg");
  if (!svg) return;
  const rect = els.canvas.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute("width", String(rect.width));
  svg.setAttribute("height", String(rect.height));

  const paths = state.data.edges
    .map((edge) => {
      const from = resolveEdgeEndpoint(edge.from, "right");
      const to = resolveEdgeEndpoint(edge.to, "left");
      if (!from || !to) return "";
      const midX = (from.x + to.x) / 2;
      const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
      const labelX = midX;
      const labelY = (from.y + to.y) / 2 - 8;
      return `<path class="edge-path" data-edge="${edge.id}" d="${d}" />
        <text class="edge-label" data-edge-label="${edge.id}" x="${labelX}" y="${labelY}" text-anchor="middle">${edge.label}</text>`;
    })
    .join("");

  svg.innerHTML = paths;
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

  els.summary.textContent = sc.summary;
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
      return `<li>
        <button type="button" class="step-item ${idx === state.stepIndex ? "active" : ""}" data-step="${idx}" style="--active:${ACTION_COLORS[step.action]}">
          <span class="step-n">${step.n}</span>
          <span class="step-title">${step.note.length > 28 ? step.note.slice(0, 28) + "…" : step.note}</span>
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

  els.canvas.querySelectorAll(".field").forEach((node) => {
    const id = node.getAttribute("data-field");
    const on = hotFields.has(id);
    node.classList.toggle("hot", on);
    node.classList.toggle("dim", Boolean(step) && !on);
  });

  els.canvas.querySelectorAll(".edge-path").forEach((node) => {
    const id = node.getAttribute("data-edge");
    node.classList.toggle("hot", hotEdges.has(id));
    if (hotEdges.has(id)) node.style.setProperty("--active", color);
  });

  els.canvas.querySelectorAll(".edge-label").forEach((node) => {
    const id = node.getAttribute("data-edge-label");
    node.classList.toggle("hot", hotEdges.has(id));
    if (hotEdges.has(id)) node.style.setProperty("--active", color);
  });

  if (step) {
    els.note.textContent = step.note;
    if (step.risks?.length) {
      els.risks.hidden = false;
      els.risks.innerHTML = step.risks
        .map((r) => `<li>風險：${r}</li>`)
        .join("");
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
      return `<article class="cov-card"><h3>${entity.label}</h3>${rows || "<p class='hint'>無欄位</p>"}</article>`;
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
}

function bind() {
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

  window.addEventListener("resize", () => {
    clearTimeout(window.__walkResize);
    window.__walkResize = setTimeout(drawEdges, 120);
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
  els.sub.textContent = state.data.subtitle;
  state.roleId = state.data.roles[0].id;
  state.scenarioId = scenariosForRole(state.roleId)[0]?.id ?? null;

  fillRoles();
  els.role.value = state.roleId;
  fillLegend();
  renderCanvasStructure();
  bind();
  refresh();
}

boot().catch((err) => {
  els.summary.textContent = `載入失敗：${err.message}`;
  console.error(err);
});
