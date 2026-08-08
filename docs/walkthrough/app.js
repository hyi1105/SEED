const ACTION_COLORS = {
  write: "var(--write)",
  lookup: "var(--lookup)",
  sync: "var(--sync)",
  auto: "var(--auto)",
  validate: "var(--validate)",
  approve: "var(--approve)",
  notify: "var(--notify)",
};

const MODE_COPY = {
  guide: { eyebrow: "Design Guide", hint: "從聊需求 → 欄位 → 權限 → 成檔 → 可用系統" },
  map: { eyebrow: "Map Dashboard", hint: "拖地圖、縮放，看欄位怎麼連" },
  slide: { eyebrow: "Paper Slide", hint: "一情境一張作業紙，①②③ 照順序填" },
  demo: { eyebrow: "Live Demo", hint: "模擬真人填寫，阿嬤照做就會" },
};

const SYSTEM_CATALOG = {
  resignation: {
    id: "resignation",
    label: "離職單",
    paths: ["./system.json", "https://cdn.jsdelivr.net/gh/hyi1105/SEED@main/docs/walkthrough/system.json"],
  },
  collection: {
    id: "collection",
    label: "催收單",
    paths: ["./systems/collection.json", "https://cdn.jsdelivr.net/gh/hyi1105/SEED@main/docs/walkthrough/systems/collection.json"],
  },
};

const WORLD = { w: 1400, h: 900 };

const state = {
  data: null,
  systemId: "resignation",
  mode: "map",
  roleId: null,
  scenarioId: null,
  stepIndex: 0,
  layout: {},
  cam: { x: 40, y: 40, scale: 1 },
  hintHidden: false,
  paperValues: {},
  demo: {
    playing: false,
    timer: null,
    token: 0,
  },
  guide: null,
  guidePhase: 0,
};

const els = {
  title: document.getElementById("sys-title"),
  sub: document.getElementById("sys-sub"),
  modeEyebrow: document.getElementById("mode-eyebrow"),
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
  coverageBlock: document.getElementById("coverage-block"),
  prev: document.getElementById("btn-prev"),
  next: document.getElementById("btn-next"),
  viewport: document.getElementById("viewport"),
  world: document.getElementById("world"),
  sheet: document.getElementById("sheet"),
  sheetToggle: document.getElementById("sheet-toggle"),
  mapHint: document.getElementById("map-hint"),
  viewMap: document.getElementById("view-map"),
  viewPaper: document.getElementById("view-paper"),
  paperForm: document.getElementById("paper-form"),
  paperGuide: document.getElementById("paper-guide"),
  paperCaption: document.getElementById("paper-caption"),
  demoControls: document.getElementById("demo-controls"),
  demoPlay: document.getElementById("demo-play"),
  demoRestart: document.getElementById("demo-restart"),
  demoLive: document.getElementById("demo-live"),
  viewGuide: document.getElementById("view-guide"),
  guidePhases: document.getElementById("guide-phases"),
  guideTitle: document.getElementById("guide-phase-title"),
  guideGoal: document.getElementById("guide-phase-goal"),
  guideTurns: document.getElementById("guide-turns"),
  guideBoard: document.getElementById("guide-board"),
  guideAcl: document.getElementById("guide-acl"),
  guideFile: document.getElementById("guide-file"),
  guideTip: document.getElementById("guide-tip"),
  guidePrev: document.getElementById("guide-prev"),
  guideNext: document.getElementById("guide-next"),
  guideCta: document.getElementById("guide-cta"),
  systemSelect: document.getElementById("system-select"),
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

function fieldMeta(ref) {
  const [entityId, fieldId] = ref.split(".");
  const entity = state.data.entities.find((e) => e.id === entityId);
  const field = entity?.fields?.find((f) => f.id === fieldId);
  return { entityId, fieldId, entity, field, label: field?.label || fieldId };
}

function scenariosForRole(roleId) {
  return state.data.scenarios.filter((s) => s.role === roleId);
}

function currentScenario() {
  return state.data.scenarios.find((s) => s.id === state.scenarioId);
}

function currentStep() {
  return currentScenario()?.steps?.[state.stepIndex] ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function cameraKey() {
  return `walkthrough-camera:${state.data?.system || "default"}`;
}

function loadLayout() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      state.layout = { ...defaultLayout(), ...JSON.parse(raw) };
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

function loadCamera() {
  try {
    const raw = localStorage.getItem(cameraKey());
    if (!raw) return false;
    const cam = JSON.parse(raw);
    if (
      typeof cam.x === "number" &&
      typeof cam.y === "number" &&
      typeof cam.scale === "number"
    ) {
      state.cam = {
        x: cam.x,
        y: cam.y,
        scale: clampScale(cam.scale),
      };
      return true;
    }
  } catch (_) {
    /* ignore */
  }
  return false;
}

function saveCamera() {
  localStorage.setItem(
    cameraKey(),
    JSON.stringify({
      x: state.cam.x,
      y: state.cam.y,
      scale: state.cam.scale,
    })
  );
}

function applyCamera() {
  const { x, y, scale } = state.cam;
  els.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function clampScale(s) {
  return Math.min(2.4, Math.max(0.35, s));
}

function fitCamera({ persist = true } = {}) {
  if (!els.viewport) return;
  const vp = els.viewport.getBoundingClientRect();
  const ids = Object.keys(state.layout);
  // 地圖容器高度曾塌成 0；尺寸未就緒時不要算相機
  if (!ids.length || vp.width < 10 || vp.height < 10) return;
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
  // 手機／平板：底部導覽面板會蓋住地圖，只對「看得見的上半部」做適合
  const sheetOpen = els.sheet?.getAttribute("data-open") === "true";
  const sheetH = els.sheet?.getBoundingClientRect().height || 0;
  const cover = window.matchMedia("(max-width: 899px)").matches
    ? Math.max(sheetOpen ? sheetH : 56, 56)
    : 0;
  const viewW = vp.width;
  const viewH = Math.max(120, vp.height - cover);
  const scale = clampScale(Math.min(viewW / bw, viewH / bh) * 0.92);
  state.cam.scale = scale;
  state.cam.x = (viewW - bw * scale) / 2 - (minX - pad) * scale;
  state.cam.y = (viewH - bh * scale) / 2 - (minY - pad) * scale;
  applyCamera();
  if (persist) saveCamera();
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
    // 切換步驟／重繪時不要自動 fit——保留使用者縮放與位置
    applyCamera();
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
      const labelY = (from.y + to.y) / 2 - 8;
      return `<path class="edge-path" data-edge="${edge.id}" d="${d}" />
        <text class="edge-label" data-edge-label="${edge.id}" x="${midX}" y="${labelY}" text-anchor="middle">${edge.label || ""}</text>`;
    })
    .join("");
  applyMapHighlight();
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

function applyMapHighlight() {
  const step = currentStep();
  const hotFields = new Set(step?.fields ?? []);
  const hotEdges = new Set(step?.edges ?? []);
  const color = ACTION_COLORS[step?.action] ?? "var(--glow)";
  els.canvas?.style.setProperty("--active", color);
  document.getElementById("edges-svg")?.style.setProperty("--active", color);

  els.canvas?.querySelectorAll(".field").forEach((node) => {
    const id = node.getAttribute("data-field");
    const on = hotFields.has(id);
    node.classList.toggle("hot", on);
    node.classList.toggle("dim", Boolean(step) && !on);
  });

  document.querySelectorAll(".edge-path").forEach((node) => {
    node.classList.toggle("hot", hotEdges.has(node.getAttribute("data-edge")));
  });
  document.querySelectorAll(".edge-label").forEach((node) => {
    node.classList.toggle(
      "hot",
      hotEdges.has(node.getAttribute("data-edge-label"))
    );
  });
}

function applyStepDetail() {
  const step = currentStep();
  if (!step) return;
  els.note.textContent = step.note;
  if (step.risks?.length) {
    els.risks.hidden = false;
    els.risks.innerHTML = step.risks.map((r) => `<li>風險：${r}</li>`).join("");
  } else {
    els.risks.hidden = true;
    els.risks.innerHTML = "";
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
  const touchedAll = touchedFieldsForScenarios(state.data.scenarios);
  const touchedRole = touchedFieldsForScenarios(scenariosForRole(state.roleId));
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

/* ---------- Paper / Demo ---------- */

function fieldMarks(ref) {
  const sc = currentScenario();
  if (!sc) return [];
  return sc.steps
    .filter((s) => (s.fields || []).includes(ref))
    .map((s) => ({ n: s.n, action: s.action }));
}

function orderedPaperFields() {
  const sc = currentScenario();
  if (!sc) return [];
  const seen = new Set();
  const ordered = [];
  for (const step of sc.steps) {
    for (const ref of step.fields || []) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      ordered.push(ref);
    }
  }
  return ordered;
}

function groupFieldsByEntity(refs) {
  const groups = [];
  const index = new Map();
  for (const ref of refs) {
    const { entityId, entity } = fieldMeta(ref);
    if (!index.has(entityId)) {
      index.set(entityId, groups.length);
      groups.push({ entity, refs: [] });
    }
    groups[index.get(entityId)].refs.push(ref);
  }
  return groups;
}

function resetPaperValues(uptoStepInclusive = -1) {
  const sc = currentScenario();
  state.paperValues = { ...(sc?.demoSeed || {}) };
  if (!sc) return;
  sc.steps.forEach((step, idx) => {
    if (idx <= uptoStepInclusive && step.fill) {
      Object.assign(state.paperValues, step.fill);
    }
  });
}

function slideValues() {
  const sc = currentScenario();
  const values = {
    ...(state.data.demo?.values || {}),
    ...(sc?.demoValues || {}),
    ...(sc?.demoSeed || {}),
  };
  sc?.steps?.forEach((step) => {
    if (step.fill) Object.assign(values, step.fill);
  });
  return values;
}

function renderPaper() {
  const sc = currentScenario();
  if (!sc || !els.paperForm) return;

  const refs = orderedPaperFields();
  const groups = groupFieldsByEntity(refs);
  const persona =
    state.data.demo?.persona?.[sc.role] || roleLabel(sc.role);
  const values =
    state.mode === "slide" ? slideValues() : state.paperValues;

  els.paperCaption.textContent =
    state.mode === "demo"
      ? `演示中：${roleLabel(sc.role)} · ${sc.title}`
      : `簡報全覽：${roleLabel(sc.role)} · ${sc.title}`;

  els.paperForm.innerHTML = `
    <div class="paper-head">
      <h2>${state.data.system}作業紙</h2>
      <p class="paper-meta">${persona}　／　情境：${sc.title}</p>
    </div>
    ${groups
      .map((g) => {
        const rows = g.refs
          .map((ref) => {
            const meta = fieldMeta(ref);
            const marks = fieldMarks(ref)
              .map((m) => `<span class="mark ${m.action}">${m.n}</span>`)
              .join("");
            const raw = values[ref];
            const shown =
              raw == null || raw === ""
                ? `<span class="empty-ph">（尚未填）</span>`
                : escapeHtml(String(raw));
            return `<div class="paper-row" data-paper-field="${ref}">
              <div class="step-marks">${marks || "<span></span>"}</div>
              <div class="paper-label">${meta.label}</div>
              <div class="paper-value ${raw ? "" : "empty"}" data-paper-value="${ref}">${shown}</div>
            </div>`;
          })
          .join("");
        return `<div class="paper-section-title">${g.entity?.label || ""}</div>${rows}`;
      })
      .join("")}
  `;

  els.paperGuide.innerHTML = `
    <h3>填寫順序（紙本感）</h3>
    ${sc.steps
      .map((step, idx) => {
        const color = ACTION_COLORS[step.action];
        return `<div class="guide-item ${idx === state.stepIndex ? "active" : ""}" data-step="${idx}" style="--active:${color}">
          <span class="mark ${step.action}">${step.n}</span>
          <div>
            <div class="g-note">${escapeHtml(step.note)}</div>
            <span class="g-action">${actionLabel(step.action)} · ${(step.fields || []).map((f) => fieldMeta(f).label).join("、")}</span>
          </div>
        </div>`;
      })
      .join("")}
  `;

  applyPaperHighlight();
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyPaperHighlight() {
  const step = currentStep();
  if (!step) return;
  const hot = new Set(step.fields || []);
  const color = ACTION_COLORS[step.action] ?? "var(--brand)";
  els.paperForm?.style.setProperty("--active", color);
  els.paperGuide?.style.setProperty("--active", color);

  els.paperForm?.querySelectorAll(".paper-row").forEach((row) => {
    const ref = row.getAttribute("data-paper-field");
    const on = hot.has(ref);
    row.classList.toggle("hot", on);
    row.classList.toggle(
      "dim",
      state.mode === "demo" && Boolean(step) && !on
    );
    row.classList.toggle(
      "circled",
      state.mode === "demo" &&
        on &&
        ["lookup", "auto", "validate", "approve", "sync"].includes(step.action)
    );
  });

  els.paperGuide?.querySelectorAll(".guide-item").forEach((item) => {
    const idx = Number(item.getAttribute("data-step"));
    item.classList.toggle("active", idx === state.stepIndex);
  });
}

async function typeIntoField(ref, text, token) {
  const node = els.paperForm?.querySelector(`[data-paper-value="${ref}"]`);
  if (!node) {
    state.paperValues[ref] = text;
    return;
  }
  node.classList.remove("empty");
  let out = "";
  for (const ch of String(text)) {
    if (token !== state.demo.token) return;
    out += ch;
    node.innerHTML = `${escapeHtml(out)}<span class="caret"></span>`;
    await sleep(42 + Math.random() * 36);
  }
  node.textContent = text;
  state.paperValues[ref] = text;
}

async function popIntoField(ref, text, token) {
  const node = els.paperForm?.querySelector(`[data-paper-value="${ref}"]`);
  state.paperValues[ref] = text;
  if (!node) return;
  node.classList.remove("empty");
  node.textContent = text;
  const row = node.closest(".paper-row");
  row?.classList.add("circled");
  await sleep(280);
  if (token !== state.demo.token) return;
}

async function playDemoStep(step, token) {
  const fills = step.fill || {};
  const action = step.action;
  setDemoLive(`${step.n}. ${step.note}`);

  if (action === "write") {
    for (const ref of step.fields || []) {
      if (token !== state.demo.token) return;
      const val = fills[ref] ?? state.data.demo?.values?.[ref] ?? "";
      await typeIntoField(ref, val, token);
    }
  } else {
    for (const ref of step.fields || []) {
      if (token !== state.demo.token) return;
      const val = fills[ref] ?? state.data.demo?.values?.[ref] ?? "";
      await popIntoField(ref, val, token);
    }
  }
  applyPaperHighlight();
  await sleep(520);
}

async function runDemo() {
  const sc = currentScenario();
  if (!sc) return;
  stopDemo();
  const token = ++state.demo.token;
  state.demo.playing = true;
  els.demoPlay.textContent = "⏸ 演示中…";
  els.demoPlay.disabled = true;
  resetPaperValues(-1);
  renderPaper();
  setDemoLive("開始演示：請看作業紙上的欄位");

  for (let i = 0; i < sc.steps.length; i++) {
    if (token !== state.demo.token) return;
    state.stepIndex = i;
    renderSteps();
    applyStepDetail();
    applyPaperHighlight();
    await playDemoStep(sc.steps[i], token);
  }

  if (token === state.demo.token) {
    setDemoLive("完成！這張單已依順序填完，可換下一個情境。");
    state.demo.playing = false;
    els.demoPlay.textContent = "▶ 再播一次";
    els.demoPlay.disabled = false;
  }
}

function stopDemo() {
  state.demo.token += 1;
  state.demo.playing = false;
  if (els.demoPlay) {
    els.demoPlay.textContent = "▶ 播放演示";
    els.demoPlay.disabled = false;
  }
}

function setDemoLive(text) {
  if (!els.demoLive) return;
  els.demoLive.hidden = !text;
  els.demoLive.textContent = text || "";
}


/* ---------- Guide ---------- */

async function fetchJson(urls) {
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
  throw lastErr || new Error("無法載入 JSON");
}

async function loadGuide() {
  const embedded = document.getElementById("guide-data");
  if (embedded?.textContent?.trim()) {
    return JSON.parse(embedded.textContent);
  }
  return fetchJson([
    "./guide.json",
    "https://cdn.jsdelivr.net/gh/hyi1105/SEED@main/docs/walkthrough/guide.json",
  ]);
}

function currentGuidePhase() {
  return state.guide?.phases?.[state.guidePhase] ?? null;
}

function renderGuide() {
  if (!state.guide || !els.guideTurns) return;
  const phases = state.guide.phases || [];
  els.guidePhases.innerHTML = phases
    .map(
      (p, i) =>
        `<li><button type="button" class="guide-phase-btn ${i === state.guidePhase ? "active" : ""}" data-guide-phase="${i}">${p.title}</button></li>`
    )
    .join("");

  const phase = currentGuidePhase();
  if (!phase) return;
  els.guideTitle.textContent = phase.title;
  els.guideGoal.textContent = phase.goal || "";

  els.guideTurns.innerHTML = (phase.turns || [])
    .map((t) => {
      const who = t.who === "user" ? "使用者" : "顧問導引";
      return `<div class="bubble ${t.who}"><span class="who">${who}</span>${escapeHtml(t.text)}</div>`;
    })
    .join("");

  if (phase.board?.fields?.length) {
    els.guideBoard.hidden = false;
    els.guideBoard.innerHTML = `<h3>${escapeHtml(phase.board.headline || "欄位板")}</h3>
      <div class="field-chips">${phase.board.fields
        .map((f) => {
          const cls = f.source === "guide" ? "guide-added" : "";
          const tag = f.tag ? `<span class="tag">${escapeHtml(f.tag)}</span>` : "";
          return `<span class="field-chip ${cls}">${escapeHtml(f.label)}${tag}</span>`;
        })
        .join("")}</div>`;
  } else {
    els.guideBoard.hidden = true;
    els.guideBoard.innerHTML = "";
  }

  if (phase.acl?.rows?.length) {
    els.guideAcl.hidden = false;
    els.guideAcl.innerHTML = `<h3>權限：${escapeHtml(phase.acl.role || "")}</h3>
      <table class="acl-table"><thead><tr><th>欄位</th><th>看</th><th>編</th></tr></thead><tbody>
      ${phase.acl.rows
        .map(
          (r) =>
            `<tr><td>${escapeHtml(r.field)}</td><td>${escapeHtml(r.view)}</td><td>${escapeHtml(r.edit)}</td></tr>`
        )
        .join("")}
      </tbody></table>`;
  } else {
    els.guideAcl.hidden = true;
    els.guideAcl.innerHTML = "";
  }

  if (phase.filePreview) {
    els.guideFile.hidden = false;
    const bullets = (phase.filePreview.bullets || [])
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");
    els.guideFile.innerHTML = `<h3>產出檔：${escapeHtml(phase.filePreview.name || "")}</h3><ul>${bullets}</ul>`;
  } else {
    els.guideFile.hidden = true;
    els.guideFile.innerHTML = "";
  }

  if (phase.tip) {
    els.guideTip.hidden = false;
    els.guideTip.textContent = phase.tip;
  } else {
    els.guideTip.hidden = true;
    els.guideTip.textContent = "";
  }

  els.guidePrev.disabled = state.guidePhase <= 0;
  els.guideNext.disabled = state.guidePhase >= phases.length - 1;
  const cta = phase.cta;
  if (cta) {
    els.guideCta.hidden = false;
    els.guideCta.textContent = cta.label || "打開系統導覽";
    els.guideCta.dataset.system = cta.system || "collection";
    els.guideCta.dataset.mode = cta.mode || "map";
  } else {
    els.guideCta.hidden = true;
  }
}

function setGuidePhase(index) {
  if (!state.guide) return;
  const max = state.guide.phases.length - 1;
  state.guidePhase = Math.max(0, Math.min(index, max));
  renderGuide();
}

async function switchSystem(systemId, { mode } = {}) {
  const meta = SYSTEM_CATALOG[systemId];
  if (!meta) return;
  stopDemo();
  state.systemId = systemId;
  if (els.systemSelect) els.systemSelect.value = systemId;

  if (systemId === "resignation") {
    const embedded = document.getElementById("system-data");
    if (embedded?.textContent?.trim()) {
      state.data = JSON.parse(embedded.textContent);
    } else {
      state.data = await fetchJson(meta.paths);
    }
  } else {
    state.data = await fetchJson(meta.paths);
  }

  els.title.textContent = state.data.system;
  state.roleId = state.data.roles[0].id;
  state.scenarioId = scenariosForRole(state.roleId)[0]?.id ?? null;
  state.stepIndex = 0;
  loadLayout();
  const hasSavedCam = loadCamera();
  fillRoles();
  els.role.value = state.roleId;
  fillLegend();
  renderCanvasStructure();
  refresh(true);
  if (!hasSavedCam && state.mode === "map") {
    requestAnimationFrame(() => fitCamera({ persist: true }));
  } else {
    applyCamera();
  }
  if (mode) setMode(mode);
}

function setMode(mode) {
  state.mode = mode;
  stopDemo();
  document.querySelectorAll(".mode-tab").forEach((btn) => {
    const on = btn.getAttribute("data-mode") === mode;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });

  const isMap = mode === "map";
  const isPaper = mode === "slide" || mode === "demo";
  const isGuide = mode === "guide";
  els.viewMap.hidden = !isMap;
  els.viewMap.dataset.active = isMap ? "true" : "false";
  els.viewPaper.hidden = !isPaper;
  els.viewPaper.dataset.active = isPaper ? "true" : "false";
  if (els.viewGuide) {
    els.viewGuide.hidden = !isGuide;
    els.viewGuide.dataset.active = isGuide ? "true" : "false";
  }
  els.demoControls.hidden = mode !== "demo";
  els.demoLive.hidden = mode !== "demo";
  if (els.coverageBlock) {
    els.coverageBlock.style.display = mode === "map" ? "" : "none";
  }
  // 導引時完全隱藏底部面板，避免擋住「下一階段」
  if (els.sheet) {
    if (isGuide) {
      els.sheet.hidden = true;
      els.sheet.setAttribute("data-open", "false");
      els.sheetToggle?.setAttribute("aria-expanded", "false");
    } else {
      els.sheet.hidden = false;
    }
  }

  const copy = MODE_COPY[mode] || MODE_COPY.map;
  if (els.modeEyebrow) els.modeEyebrow.textContent = copy.eyebrow;
  if (els.sub) els.sub.textContent = copy.hint;

  if (isGuide) {
    renderGuide();
  } else if (isMap) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawEdges();
        // 回到地圖只恢復鏡頭，絕不自動「適合」打亂使用者縮放
        applyCamera();
      });
    });
  } else if (mode === "slide") {
    renderPaper();
  } else if (mode === "demo") {
    resetPaperValues(-1);
    renderPaper();
    setDemoLive("按「播放演示」，看系統一步步幫你填");
  }

  if (!isGuide) refresh(false);
}

function refresh(resetPaper = true) {
  fillScenarios();
  renderSteps();
  applyStepDetail();
  applyMapHighlight();
  renderCoverage();
  if (state.mode === "slide") {
    renderPaper();
  } else if (state.mode === "demo") {
    if (resetPaper && !state.demo.playing) {
      resetPaperValues(state.stepIndex - 1);
      // apply current step fills for manual step browsing
      const step = currentStep();
      if (step?.fill) Object.assign(state.paperValues, step.fill);
      renderPaper();
    } else {
      applyPaperHighlight();
    }
  }
}

function setRole(roleId) {
  stopDemo();
  state.roleId = roleId;
  state.stepIndex = 0;
  refresh(true);
}

function setScenario(scenarioId) {
  stopDemo();
  state.scenarioId = scenarioId;
  const sc = currentScenario();
  if (sc) state.roleId = sc.role;
  els.role.value = state.roleId;
  state.stepIndex = 0;
  refresh(true);
}

function setStep(index) {
  const sc = currentScenario();
  if (!sc) return;
  if (state.demo.playing) stopDemo();
  state.stepIndex = Math.max(0, Math.min(index, sc.steps.length - 1));
  renderSteps();
  applyStepDetail();
  if (state.mode === "map") {
    // 只高亮，不平移／縮放——手機看得見的多半是上半部，鏡頭亂跳會看不到
    applyMapHighlight();
  } else if (state.mode === "slide") {
    applyPaperHighlight();
    els.paperGuide
      ?.querySelectorAll(".guide-item")
      .forEach((item) =>
        item.classList.toggle(
          "active",
          Number(item.getAttribute("data-step")) === state.stepIndex
        )
      );
  } else if (state.mode === "demo") {
    resetPaperValues(state.stepIndex);
    renderPaper();
  }
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

  vp.addEventListener("pointerdown", (e) => {
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
      hideHintSoon();
      e.preventDefault();
      return;
    }
    if (e.target.closest(".entity")) return;
    mode = "pan";
    last = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    vp.classList.add("panning");
    hideHintSoon();
  });

  vp.addEventListener("pointermove", (e) => {
    if (!mode || !last || last.pointerId !== e.pointerId) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (mode === "pan") {
      state.cam.x += dx;
      state.cam.y += dy;
      last.x = e.clientX;
      last.y = e.clientY;
      applyCamera();
    } else if (mode === "drag-entity") {
      const scale = state.cam.scale || 1;
      state.layout[last.id].x = last.ox + dx / scale;
      state.layout[last.id].y = last.oy + dy / scale;
      const node = els.canvas.querySelector(`[data-entity="${last.id}"]`);
      if (node) placeEntity(node, last.id);
      drawEdges();
    }
  });

  const end = (e) => {
    if (!last || last.pointerId !== e.pointerId) return;
    if (mode === "drag-entity") {
      els.canvas
        .querySelector(`[data-entity="${last.id}"]`)
        ?.classList.remove("dragging");
      saveLayout();
    } else if (mode === "pan") {
      saveCamera();
    }
    mode = null;
    last = null;
    vp.classList.remove("panning");
  };
  vp.addEventListener("pointerup", end);
  vp.addEventListener("pointercancel", end);

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
      saveCamera();
      hideHintSoon();
    },
    { passive: false }
  );

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
      saveCamera();
    }
  });

  document.getElementById("zoom-in")?.addEventListener("click", () => {
    state.cam.scale = clampScale(state.cam.scale * 1.15);
    applyCamera();
    saveCamera();
  });
  document.getElementById("zoom-out")?.addEventListener("click", () => {
    state.cam.scale = clampScale(state.cam.scale / 1.15);
    applyCamera();
    saveCamera();
  });
  document.getElementById("zoom-fit")?.addEventListener("click", () => {
    fitCamera({ persist: true });
  });
  document.getElementById("layout-reset")?.addEventListener("click", () => {
    localStorage.removeItem(storageKey());
    localStorage.removeItem(cameraKey());
    state.layout = defaultLayout();
    state.data.entities.forEach((entity) => {
      const node = els.canvas.querySelector(`[data-entity="${entity.id}"]`);
      if (node) placeEntity(node, entity.id);
    });
    drawEdges();
    fitCamera({ persist: true });
  });
}

function bindUi() {
  document.querySelectorAll(".mode-tab").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-mode")));
  });

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

  els.paperGuide?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-step]");
    if (!item) return;
    setStep(Number(item.getAttribute("data-step")));
  });

  els.demoPlay?.addEventListener("click", () => runDemo());
  els.demoRestart?.addEventListener("click", () => {
    stopDemo();
    state.stepIndex = 0;
    resetPaperValues(-1);
    renderSteps();
    renderPaper();
    setDemoLive("已重來，按播放開始");
  });

  els.systemSelect?.addEventListener("change", () => {
    switchSystem(els.systemSelect.value).catch((err) => {
      if (els.summary) els.summary.textContent = `切換系統失敗：${err.message}`;
      console.error(err);
    });
  });

  els.guidePrev?.addEventListener("click", () => setGuidePhase(state.guidePhase - 1));
  els.guideNext?.addEventListener("click", () => setGuidePhase(state.guidePhase + 1));
  els.guidePhases?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-guide-phase]");
    if (!btn) return;
    setGuidePhase(Number(btn.getAttribute("data-guide-phase")));
  });
  els.guideCta?.addEventListener("click", () => {
    const system = els.guideCta.dataset.system || "collection";
    const mode = els.guideCta.dataset.mode || "map";
    switchSystem(system, { mode }).catch(console.error);
  });

  els.sheetToggle?.addEventListener("click", () => {
    const open = els.sheet.getAttribute("data-open") === "true";
    els.sheet.setAttribute("data-open", open ? "false" : "true");
    els.sheetToggle.setAttribute("aria-expanded", open ? "false" : "true");
  });

  window.addEventListener("resize", () => {
    clearTimeout(window.__walkResize);
    window.__walkResize = setTimeout(() => {
      if (state.mode === "map") drawEdges();
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
  try {
    state.guide = await loadGuide();
  } catch (err) {
    console.warn("guide load failed", err);
    state.guide = null;
  }
  els.title.textContent = state.data.system;
  els.sub.textContent = MODE_COPY.map.hint;
  state.roleId = state.data.roles[0].id;
  state.scenarioId = scenariosForRole(state.roleId)[0]?.id ?? null;
  if (els.systemSelect) els.systemSelect.value = state.systemId;

  loadLayout();
  const hasSavedCam = loadCamera();
  fillRoles();
  els.role.value = state.roleId;
  fillLegend();
  renderCanvasStructure();
  bindMap();
  bindUi();
  refresh(true);

  if (window.matchMedia("(max-width: 899px)").matches) {
    els.sheet.setAttribute("data-open", "false");
    els.sheetToggle?.setAttribute("aria-expanded", "false");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (hasSavedCam) {
        applyCamera();
      } else {
        // 僅第一次沒有使用者鏡頭時自動適合；之後絕不因步驟而改
        fitCamera({ persist: true });
        setTimeout(() => fitCamera({ persist: true }), 120);
      }
    });
  });
}

boot().catch((err) => {
  if (els.summary) els.summary.textContent = `載入失敗：${err.message}`;
  console.error(err);
});
