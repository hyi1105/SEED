const TONE = {
  soft: "#5a6e65",
  user: "#1f6fbf",
  guide: "#0c5c4d",
  manager: "#b45309",
  hr: "#6d4a9e",
};

/** @type {any} */
let pack = null;

/** @type {Record<string, any>} */
let packLibrary = {};

const els = {
  app: document.getElementById("app"),
  title: document.getElementById("title"),
  eyebrow: document.getElementById("eyebrow"),
  formTitle: document.getElementById("form-title"),
  formSub: document.getElementById("form-sub"),
  sections: document.getElementById("sections"),
  submitRow: document.getElementById("submit-row"),
  submitBtn: document.getElementById("submit-btn"),
  actionRow: document.getElementById("action-row"),
  statusPill: document.getElementById("status-pill"),
  summary: document.getElementById("summary"),
  toast: document.getElementById("toast"),
  roleTabs: document.getElementById("role-tabs"),
  chatLog: document.getElementById("chat-log"),
  chatBar: document.getElementById("chat-bar"),
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),
  fileImport: document.getElementById("file-import"),
  formSheet: document.getElementById("form-sheet"),
  formToolbar: document.getElementById("form-toolbar"),
  stageWrap: document.getElementById("stage-wrap"),
  stageFit: document.getElementById("stage-fit"),
  storyStage: document.getElementById("story-stage"),
  storyBoard: document.getElementById("story-board"),
  storyCanvas: document.getElementById("story-canvas"),
  storyLanes: document.getElementById("story-lanes"),
  storyFlowSvg: document.getElementById("story-flow-svg"),
  storyKicker: document.getElementById("story-kicker"),
  storyLegend: document.getElementById("story-legend"),
};

/** 避免下一步時舊的連線重繪蓋掉新座標 */
let storyEdgeToken = 0;
let storyEdgeScrollBound = false;

const state = {
  mode: "show",
  nodeId: null,
  formId: null,
  docId: null,
  /** @type {Record<string, {id:string, formId:string, title?:string, values:Record<string,string>}>} */
  docs: {},
  /** @type {{from:string,to:string,label?:string}[]} */
  links: [],
  values: {},
  unlocked: new Set(),
  openSections: new Set(),
  busy: false,
  typeToken: 0,
  roleId: null,
  history: [],
  chat: [],
  boardOnly: false,
  /** @type {{id:string,lane:string,row:string,label:string,kind:string,from?:string,edgeLabel?:string,hot?:boolean}[]} */
  storyBeats: [],
};

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isGraphPack() {
  return (pack.forms || []).length > 1 || !!(pack.demo && pack.demo.docs);
}

function forms() {
  return pack.forms || [];
}

function formById(id) {
  return forms().find((f) => f.id === id) || forms()[0];
}

function activeForm() {
  return formById(state.formId);
}

function firstSectionId(form = activeForm()) {
  return form?.sections?.[0]?.id || "main";
}

function storageKeyGraph() {
  return `seed-graph:${pack.meta.id}`;
}

function storageKeyPack() {
  return `seed-pack:${pack.meta.id}`;
}

function castOf(id) {
  return pack.show.cast.find((c) => c.id === id) || { id, label: id, tone: "guide" };
}

function roleOf(id) {
  return pack.roles.find((r) => r.id === id);
}

function allFields(form = activeForm()) {
  return (form?.sections || []).flatMap((s) =>
    s.fields.map((f) => ({ ...f, sectionId: s.id, formId: form.id }))
  );
}

function allFieldsInPack() {
  return forms().flatMap((f) => allFields(f));
}

function fieldById(id, form = activeForm()) {
  return allFields(form).find((f) => f.id === id);
}

function aclOf(field) {
  return (
    field.acl || {
      requiredFrom: field.required ? [pack.roles[0]?.id].filter(Boolean) : [],
      read: pack.roles.map((r) => r.id),
      write: field.write || [],
    }
  );
}

function canWrite(field, roleId) {
  return (aclOf(field).write || []).includes(roleId);
}

function canRead(field, roleId) {
  const read = aclOf(field).read;
  if (!read || !read.length) return true;
  return read.includes(roleId);
}

function isRequired(field, roleId) {
  return (aclOf(field).requiredFrom || []).includes(roleId);
}

function statusOf(doc) {
  const form = formById(doc.formId);
  return doc.values?.[form.statusField] || "草稿";
}

function status() {
  return state.values[activeForm()?.statusField] || "草稿";
}

function isDone(doc) {
  const form = formById(doc.formId);
  const st = statusOf(doc);
  const doneWhen = form.doneWhen || ["已完成", "已就緒", "已回寫", "已核准"];
  return doneWhen.includes(st);
}

function demoValue(key) {
  return pack.demo?.values?.[key];
}

function nodeOf(id) {
  return pack.show.nodes[id];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function docTitle(doc) {
  if (!doc) return "";
  if (doc.title) return doc.title;
  const form = formById(doc.formId);
  const key = form?.titleField;
  if (key && doc.values?.[key]) return doc.values[key];
  return doc.id;
}

function flushActiveDoc() {
  if (!state.docId || !state.docs[state.docId]) return;
  state.docs[state.docId].values = { ...state.values };
}

function loadActiveDocValues() {
  const doc = state.docs[state.docId];
  state.values = { ...(doc?.values || {}) };
  const sf = activeForm()?.statusField;
  if (sf && !state.values[sf]) state.values[sf] = "草稿";
}

function persistGraph() {
  flushActiveDoc();
  localStorage.setItem(
    storageKeyGraph(),
    JSON.stringify({
      docs: state.docs,
      links: state.links,
      formId: state.formId,
      docId: state.docId,
      updatedAt: new Date().toISOString(),
    })
  );
}

function seedGraphFromDemo() {
  const demoDocs = pack.demo?.docs;
  if (demoDocs?.length) {
    state.docs = {};
    for (const d of demoDocs) {
      state.docs[d.id] = {
        id: d.id,
        formId: d.formId,
        title: d.title,
        values: { ...(d.values || {}) },
      };
    }
    state.links = (pack.demo.links || []).map((l) => ({ ...l }));
    state.formId = demoDocs[0].formId;
    state.docId = demoDocs[0].id;
    return;
  }
  const form = forms()[0];
  const id = "main";
  state.docs = {
    [id]: {
      id,
      formId: form.id,
      title: form.title,
      values: { [form.statusField]: "草稿" },
    },
  };
  state.links = [];
  state.formId = form.id;
  state.docId = id;
}

function loadGraph() {
  try {
    const raw = localStorage.getItem(storageKeyGraph());
    if (raw) {
      const data = JSON.parse(raw);
      if (data.docs && Object.keys(data.docs).length) {
        state.docs = data.docs;
        state.links = data.links || [];
        state.formId = data.formId || Object.values(data.docs)[0].formId;
        state.docId = data.docId || Object.keys(data.docs)[0];
        loadActiveDocValues();
        return;
      }
    }
  } catch (_) {}
  seedGraphFromDemo();
  loadActiveDocValues();
}

function persistPackEdits() {
  localStorage.setItem(storageKeyPack(), JSON.stringify(pack));
}

function loadPackEdits(base) {
  try {
    const raw = localStorage.getItem(`seed-pack:${base.meta.id}`);
    if (!raw) return base;
    const edited = JSON.parse(raw);
    return {
      ...base,
      ...edited,
      show: edited.show || base.show,
      demo: edited.demo || base.demo,
      forms: edited.forms || base.forms,
      form: edited.form || base.form,
      actions: edited.actions || base.actions,
      roles: edited.roles || base.roles,
      tables: edited.tables || base.tables,
      linkRules: edited.linkRules || base.linkRules,
      meta: { ...base.meta, ...edited.meta },
    };
  } catch (_) {
    return base;
  }
}

/** Accept forms[] graph packs; shim legacy single form */
function normalizePack(raw) {
  let base = raw;
  if (!(raw.meta && (raw.form || raw.forms) && raw.show)) {
    if (raw.form && raw.nodes) {
      base = {
        meta: { id: raw.id || "system", title: raw.title || "未命名系統", subtitle: raw.subtitle || "" },
        roles: raw.roles || [],
        form: raw.form,
        actions: raw.actions || [],
        tables: raw.tables || [],
        show: { cast: raw.cast || [], start: raw.start, nodes: raw.nodes },
        demo: raw.demo || { values: {}, persona: {} },
      };
    } else {
      throw new Error("缺少 meta/form|forms/show");
    }
  }
  const packOut = structuredClone(base);
  if (!packOut.forms?.length && packOut.form) {
    packOut.forms = [
      {
        id: packOut.form.id || "main",
        label: packOut.form.label || packOut.form.title || "表單",
        level: packOut.form.level || "A",
        title: packOut.form.title,
        titleField: packOut.form.titleField,
        statusField: packOut.form.statusField,
        doneWhen: packOut.form.doneWhen,
        sections: packOut.form.sections,
      },
    ];
  }
  packOut.form = packOut.forms[0];
  packOut.linkRules = packOut.linkRules || [];
  packOut.actions = packOut.actions || [];
  return packOut;
}

function snapshotShow() {
  flushActiveDoc();
  return {
    formId: state.formId,
    docId: state.docId,
    docs: structuredClone(state.docs),
    links: structuredClone(state.links),
    values: { ...state.values },
    unlocked: [...state.unlocked],
    openSections: [...state.openSections],
    boardOnly: state.boardOnly,
    storyBeats: structuredClone(state.storyBeats),
  };
}

function restoreShow(snap) {
  state.docs = structuredClone(snap.docs);
  state.links = structuredClone(snap.links);
  state.formId = snap.formId;
  state.docId = snap.docId;
  state.values = { ...snap.values };
  state.unlocked = new Set(snap.unlocked);
  state.openSections = new Set(snap.openSections);
  state.boardOnly = !!snap.boardOnly;
  state.storyBeats = structuredClone(snap.storyBeats || []);
}

function resolveFills(node) {
  const out = {};
  const map = node.mapFill || {};
  for (const demoKey of node.fillFromDemo || []) {
    const fieldId = map[demoKey] || demoKey;
    const val = demoValue(demoKey);
    if (val != null) out[fieldId] = String(val);
  }
  Object.assign(out, node.fill || {});
  return out;
}

function switchContext(formId, docId, { rebuild = true } = {}) {
  flushActiveDoc();
  if (formId) state.formId = formId;
  if (docId) state.docId = docId;
  if (!state.docs[state.docId]) {
    const form = activeForm();
    state.docs[state.docId] = {
      id: state.docId,
      formId: state.formId,
      values: { [form.statusField]: "草稿" },
    };
  }
  // keep doc.formId authoritative
  state.formId = state.docs[state.docId].formId;
  loadActiveDocValues();
  state.openSections = new Set([firstSectionId()]);
  if (rebuild && state.mode === "show" && !state.boardOnly) buildShowForm();
}

function ensureDoc(spec) {
  if (!spec?.id) return;
  if (!state.docs[spec.id]) {
    const formId = spec.formId || state.formId;
    const form = formById(formId);
    const values = { [form.statusField]: spec.status || "草稿", ...(spec.values || {}) };
    state.docs[spec.id] = {
      id: spec.id,
      formId,
      title: spec.title,
      values,
    };
  } else {
    if (spec.title) state.docs[spec.id].title = spec.title;
    if (spec.values) Object.assign(state.docs[spec.id].values, spec.values);
    if (spec.status) state.docs[spec.id].values[formById(state.docs[spec.id].formId).statusField] = spec.status;
  }
}

function addLink(link) {
  if (!link?.from || !link?.to) return;
  const exists = state.links.some((l) => l.from === link.from && l.to === link.to && (l.label || "") === (link.label || ""));
  if (!exists) state.links.push({ from: link.from, to: link.to, label: link.label || "" });
}

function buildShowForm() {
  const form = activeForm();
  const doc = state.docs[state.docId];
  els.formSheet.hidden = false;
  els.formSheet.classList.remove("is-schema");
  els.formTitle.textContent = `${form.level ? form.level + " · " : ""}${form.title}`;
  els.formSub.textContent = `Show · 獨立表單「${form.label}」· 單據 ${docTitle(doc) || doc?.id || ""}`;
  els.sections.innerHTML = form.sections
    .map(
      (sec) => `<section class="section" data-section="${sec.id}" id="sec-${sec.id}">
        <p class="section-label">${escapeHtml(sec.label)}</p>
        <div class="fields">
          ${sec.fields
            .map(
              (f) => `<div class="field" data-field="${f.id}" id="field-${f.id}">
                <div class="field-label">${escapeHtml(f.label)}</div>
                <div class="field-value empty" data-value="${f.id}">尚空白</div>
              </div>`
            )
            .join("")}
        </div>
      </section>`
    )
    .join("");
  paintShowForm();
}

function paintShowForm() {
  const form = activeForm();
  if (!form || state.boardOnly) return;
  form.sections.forEach((sec) => {
    const secEl = document.getElementById(`sec-${sec.id}`);
    const showSec =
      state.openSections.has(sec.id) ||
      sec.fields.some((f) => state.unlocked.has(f.id));
    secEl?.classList.toggle("open", showSec);
    sec.fields.forEach((f) => {
      const el = document.getElementById(`field-${f.id}`);
      if (!el) return;
      const valEl = el.querySelector("[data-value]");
      el.classList.toggle("open", state.unlocked.has(f.id));
      const val = state.values[f.id];
      if (val == null || val === "") {
        if (!valEl.classList.contains("typing")) {
          valEl.textContent = "尚空白";
          valEl.classList.add("empty");
        }
      } else if (!valEl.classList.contains("typing")) {
        valEl.textContent = val;
        valEl.classList.remove("empty");
      }
    });
  });
  els.statusPill.textContent = `${form.level || ""} ${status()}`.trim();
}

function stepFieldIds(node) {
  if (!node) return [];
  const ids = new Set();
  if (node.focus && node.focus !== "btn_submit") ids.add(node.focus);
  (node.reveal || []).forEach((id) => ids.add(id));
  Object.keys(resolveFills(node)).forEach((id) => ids.add(id));
  return [...ids];
}

function resetStudyFit() {
  const host = els.stageFit;
  if (!host) return;
  host.style.transform = "";
  host.style.marginBottom = "";
  host.dataset.scale = "1";
}

/** Show：自動縮放，讓當步重點欄位落在同一可視範圍（學習不斷斷續續） */
function fitStudyView(node, focusId) {
  const stage = els.stageWrap;
  const host = els.stageFit;
  if (!stage || !host || state.mode !== "show" || state.boardOnly) {
    resetStudyFit();
    return;
  }

  const ids = stepFieldIds(node);
  const nodes = ids
    .map((id) => document.getElementById(`field-${id}`))
    .filter((el) => el && el.classList.contains("open"));

  resetStudyFit();
  if (!nodes.length) {
    if (focusId === "btn_submit") {
      els.submitRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return;
  }

  // 先量自然尺寸，再決定要縮多少
  requestAnimationFrame(() => {
    const stageRect = stage.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    if (stageRect.height < 40 || hostRect.width < 40) return;

    let top = Infinity;
    let bottom = -Infinity;
    nodes.forEach((el) => {
      const r = el.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    });
    // 帶一點區塊標題上下文
    const first = nodes[0].closest(".section");
    const label = first?.querySelector(".section-label");
    if (label) top = Math.min(top, label.getBoundingClientRect().top);

    const clusterH = Math.max(48, bottom - top);
    const viewH = Math.max(120, stage.clientHeight);
    // 只縮小、不放大；留一點邊，避免貼邊
    const scale = Math.min(1, Math.max(0.62, (viewH * 0.9) / clusterH));

    host.style.transformOrigin = "top center";
    host.style.transform = `scale(${scale})`;
    host.dataset.scale = String(scale);
    // transform 不佔版面：補負 margin，捲動高度才對
    const naturalH = host.offsetHeight;
    host.style.marginBottom = `${Math.min(0, naturalH * (scale - 1))}px`;

    const targetId = focusId && focusId !== "btn_submit" ? focusId : ids[0];
    const target = document.getElementById(`field-${targetId}`) || nodes[0];
    requestAnimationFrame(() => {
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
}

function setFocus(fieldId) {
  document.querySelectorAll(".field").forEach((el) => el.classList.remove("focus"));
  if (!fieldId || fieldId === "btn_submit") {
    if (state.mode === "show") {
      fitStudyView(nodeOf(state.nodeId), fieldId);
    } else if (fieldId === "btn_submit") {
      els.submitRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return;
  }
  const el = document.getElementById(`field-${fieldId}`);
  if (el) {
    el.classList.add("focus");
    if (state.mode === "show") {
      fitStudyView(nodeOf(state.nodeId), fieldId);
    } else {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
}

async function typeValue(fieldId, text) {
  const el = document.getElementById(`field-${fieldId}`);
  const valEl = el?.querySelector("[data-value]");
  if (!valEl) {
    state.values[fieldId] = text;
    flushActiveDoc();
    return;
  }
  state.unlocked.add(fieldId);
  paintShowForm();
  setFocus(fieldId);
  const token = ++state.typeToken;
  valEl.classList.remove("empty");
  valEl.classList.add("typing");
  valEl.textContent = "";
  for (let i = 1; i <= text.length; i++) {
    if (token !== state.typeToken) return;
    valEl.textContent = text.slice(0, i);
    await sleep(text.length > 18 ? 24 : 36);
  }
  if (token !== state.typeToken) return;
  valEl.classList.remove("typing");
  state.values[fieldId] = text;
  flushActiveDoc();
}

function prepareReveal(node) {
  if (node.unlockSection) state.openSections.add(node.unlockSection);
  (node.reveal || []).forEach((id) => state.unlocked.add(id));
  Object.keys(resolveFills(node)).forEach((id) => state.unlocked.add(id));
  if (node.showSubmit) els.submitRow.classList.add("open");
  paintShowForm();
  if (node.focus) setFocus(node.focus);
  else fitStudyView(node, null);
  if (node.flashSubmit) {
    els.submitBtn.classList.remove("flash");
    void els.submitBtn.offsetWidth;
    els.submitBtn.classList.add("flash");
  }
}

async function applyFills(node) {
  const fills = resolveFills(node);
  const keys = Object.keys(fills);
  if (!keys.length) return;
  if (node.typewriter) {
    for (const key of keys) {
      state.unlocked.add(key);
      paintShowForm();
      await typeValue(key, String(fills[key]));
      await sleep(80);
    }
  } else {
    for (const key of keys) {
      state.unlocked.add(key);
      state.values[key] = String(fills[key]);
    }
    flushActiveDoc();
    paintShowForm();
  }
}

function linkedFrom(docId) {
  return state.links.filter((l) => l.from === docId);
}

function linkedTo(docId) {
  return state.links.filter((l) => l.to === docId);
}

function useStoryStage() {
  return isGraphPack() && forms().length > 1;
}

/** 導引圖圖形語彙（固定意義，不是裝飾） */
const STORY_KIND = {
  start: "start",
  end: "end",
  process: "process",
  io: "io",
  decision: "decision",
};

function normalizeStoryKind(kind, { hasChoices = false } = {}) {
  const k = String(kind || "").toLowerCase();
  if (k === "start") return STORY_KIND.start;
  if (k === "end" || k === "done") return STORY_KIND.end;
  if (k === "io" || k === "input" || k === "fill") return STORY_KIND.io;
  if (k === "decision" || k === "choice") return STORY_KIND.decision;
  if (k === "process" || k === "action" || k === "link") return STORY_KIND.process;
  if (hasChoices) return STORY_KIND.decision;
  return STORY_KIND.process;
}

/** 泳道列＝人：旁白列＋各角色（左側用短名） */
function storyPeople() {
  const short = { planner: "企劃", warehouse: "倉庫", buyer: "採購" };
  const roles = pack?.roles || [];
  return [
    { id: "narrator", label: "旁白" },
    ...roles.map((r) => ({ id: r.id, label: short[r.id] || r.label })),
  ];
}

/** speaker／beat.row → 左側人列 id */
function storyRowId(node, beat = {}) {
  if (beat.row) return String(beat.row);
  const sp = node?.speaker || "";
  const map = {
    narrator: "narrator",
    you: "narrator",
    guide: "narrator",
    planner: "planner",
    wh: "warehouse",
    warehouse: "warehouse",
    buyer: "buyer",
  };
  if (map[sp]) return map[sp];
  if (rolesOf().some((r) => r.id === sp)) return sp;
  return "narrator";
}

function rolesOf() {
  return pack?.roles || [];
}

function hideStoryStage() {
  if (els.storyStage) els.storyStage.hidden = true;
  els.app?.classList.remove("story-on");
  storyEdgeToken += 1;
  if (els.storyFlowSvg) els.storyFlowSvg.innerHTML = "";
}

function storyShellSignature() {
  return `${forms()
    .map((f) => f.level || f.id)
    .join(",")}|${storyPeople()
    .map((p) => p.id)
    .join(",")}`;
}

function showStoryStageShell() {
  if (!els.storyStage || !els.storyLanes) return;
  els.storyStage.hidden = false;
  els.app?.classList.add("story-on");
  const cols = forms();
  const rows = storyPeople();
  const matrix = els.storyLanes;
  const sig = storyShellSignature();
  // 結構沒變就不要整表重建，避免下一步時格子跳動、線跟著跑掉
  if (matrix.dataset.sig === sig && matrix.querySelector(".story-cell")) {
    return;
  }
  matrix.dataset.sig = sig;
  matrix.className = "story-lanes story-matrix";
  matrix.style.setProperty("--cols", String(Math.max(1, cols.length)));
  matrix.style.setProperty("--rows", String(Math.max(1, rows.length)));
  const lastLane = cols[cols.length - 1]?.level || cols[cols.length - 1]?.id;
  const lastRow = rows[rows.length - 1]?.id;
  const colHeads = cols
    .map((f) => {
      const lane = f.level || f.id;
      const end = lane === lastLane ? " end-col" : "";
      return `<div class="story-col-head${end}" data-lane="${escapeHtml(lane)}">
        <span class="lvl">${escapeHtml(f.level || "?")}</span>
        <span class="story-col-title">${escapeHtml(f.label || f.title || f.id)}</span>
      </div>`;
    })
    .join("");
  const body = rows
    .map((person) => {
      const endRow = person.id === lastRow ? " end-row" : "";
      const cells = cols
        .map((f) => {
          const lane = f.level || f.id;
          const endCol = lane === lastLane ? " end-col" : "";
          return `<div class="story-cell${endCol}${endRow}" data-lane="${escapeHtml(lane)}" data-row="${escapeHtml(person.id)}"></div>`;
        })
        .join("");
      return `<div class="story-row-head${endRow}" data-row="${escapeHtml(person.id)}"><span>${escapeHtml(person.label)}</span></div>${cells}`;
    })
    .join("");
  matrix.innerHTML = `<div class="story-corner" aria-hidden="true"><span class="corner-y">人</span><span class="corner-x">表單</span></div>${colHeads}${body}`;
}

function storyKindTitle(kind) {
  return (
    {
      start: "開始",
      end: "結束",
      process: "處理",
      io: "輸入／填寫",
      decision: "判斷",
    }[kind] || "處理"
  );
}

function collectStoryEdges() {
  const beats = state.storyBeats.filter((b) => !b.ghost);
  const ids = new Set(beats.map((b) => b.id));
  /** @type {{from:string,to:string,label?:string}[]} */
  const edges = [];
  beats.forEach((beat, idx) => {
    if (beat.from && ids.has(beat.from)) {
      edges.push({ from: beat.from, to: beat.id, label: beat.edgeLabel || "" });
      return;
    }
    // 未指定 from：接到上一顆非 decision 分支的節點
    if (idx === 0) return;
    const prev = beats[idx - 1];
    if (!prev || prev.kind === "decision") return;
    edges.push({ from: prev.id, to: beat.id, label: beat.edgeLabel || "" });
  });
  return edges;
}

/** 從節點中心往目標方向，取與外框相交點（線貼邊，不穿心） */
function storyBoxEdgePoint(rect, rootRect, towardX, towardY) {
  const cx = rect.left + rect.width / 2 - rootRect.left;
  const cy = rect.top + rect.height / 2 - rootRect.top;
  const hw = Math.max(rect.width / 2 - 2, 4);
  const hh = Math.max(rect.height / 2 - 2, 4);
  let dx = towardX - cx;
  let dy = towardY - cy;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { x: cx, y: cy + hh };
  const ax = Math.abs(dx) / hw;
  const ay = Math.abs(dy) / hh;
  const t = Math.max(ax, ay) || 1;
  return { x: cx + dx / t, y: cy + dy / t };
}

function paintStoryEdges() {
  const svg = els.storyFlowSvg;
  const canvas = els.storyCanvas || els.storyBoard;
  const matrix = els.storyLanes;
  if (!svg || !canvas || !matrix) return;
  const edges = collectStoryEdges();
  const w = Math.max(matrix.offsetWidth, canvas.offsetWidth, 1);
  const h = Math.max(matrix.offsetHeight, canvas.offsetHeight, 1);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  // 座標相對 canvas（SVG 與 matrix 同層），不要混 scroll／board，否則下一步會跑線
  const rootRect = canvas.getBoundingClientRect();
  const marker = `
    <defs>
      <marker id="story-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e3a4a"></path>
      </marker>
    </defs>`;
  const paths = edges
    .map((e) => {
      const a = matrix.querySelector(`[data-beat="${CSS.escape(e.from)}"]`);
      const b = matrix.querySelector(`[data-beat="${CSS.escape(e.to)}"]`);
      if (!a || !b) return "";
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const acx = ar.left + ar.width / 2 - rootRect.left;
      const acy = ar.top + ar.height / 2 - rootRect.top;
      const bcx = br.left + br.width / 2 - rootRect.left;
      const bcy = br.top + br.height / 2 - rootRect.top;
      const p1 = storyBoxEdgePoint(ar, rootRect, bcx, bcy);
      const p2 = storyBoxEdgePoint(br, rootRect, acx, acy);
      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      let d;
      if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else if (Math.abs(y2 - y1) >= Math.abs(x2 - x1)) {
        // 先垂直再水平：同欄上下、跨列較穩
        d = `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
      } else {
        d = `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
      }
      const label =
        e.label &&
        `<text class="story-edge-label" x="${mx + 4}" y="${my - 4}">${escapeHtml(e.label)}</text>`;
      return `<path class="story-edge-path" d="${d}" marker-end="url(#story-arrow)"></path>${label || ""}`;
    })
    .join("");
  svg.innerHTML = marker + paths;
}

function bindStoryEdgeRelayout() {
  if (storyEdgeScrollBound || !els.storyBoard) return;
  storyEdgeScrollBound = true;
  let t = 0;
  const relayout = () => {
    clearTimeout(t);
    t = setTimeout(() => paintStoryEdges(), 40);
  };
  els.storyBoard.addEventListener("scroll", relayout, { passive: true });
  window.addEventListener("resize", relayout);
}

function scheduleStoryEdges() {
  const token = ++storyEdgeToken;
  bindStoryEdgeRelayout();
  const run = () => {
    if (token !== storyEdgeToken) return;
    paintStoryEdges();
  };
  // 等 DOM 排版穩定再量座標；淡入結束後再量一次
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      run();
      setTimeout(run, 80);
      setTimeout(run, 320);
    });
  });
}

function paintStoryStage({ hotId } = {}) {
  if (!useStoryStage() || !els.storyLanes) return;
  showStoryStageShell();
  els.storyLanes.querySelectorAll(".story-cell").forEach((c) => {
    c.innerHTML = "";
  });
  let hotEl = null;
  state.storyBeats
    .filter((b) => !b.ghost)
    .forEach((beat) => {
      const host = els.storyLanes.querySelector(
        `.story-cell[data-lane="${CSS.escape(beat.lane)}"][data-row="${CSS.escape(beat.row || "narrator")}"]`
      );
      if (!host) return;
      const kind = normalizeStoryKind(beat.kind);
      const hot = beat.id === hotId || beat.hot;
      const el = document.createElement("div");
      el.className = `story-node kind-${kind}${hot ? " hot" : ""}`;
      el.dataset.beat = beat.id;
      el.dataset.kind = kind;
      el.title = `${storyKindTitle(kind)}：${beat.label}`;
      el.innerHTML = `<span class="node-kind">${escapeHtml(storyKindTitle(kind))}</span><span class="node-text">${escapeHtml(beat.label)}</span>`;
      host.appendChild(el);
      if (hot) hotEl = el;
    });
  // 先瞬間對準焦點（不要 smooth，否則量線時座標還在動）
  if (hotEl && els.storyBoard) {
    const board = els.storyBoard;
    const br = board.getBoundingClientRect();
    const nr = hotEl.getBoundingClientRect();
    if (nr.top < br.top + 8 || nr.bottom > br.bottom - 8 || nr.left < br.left + 8 || nr.right > br.right - 8) {
      hotEl.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    }
  }
  scheduleStoryEdges();
  if (els.storyKicker) {
    const live = state.storyBeats.filter((b) => !b.ghost).length;
    els.storyKicker.textContent = live
      ? `導引圖 · ${live} 個符號 · 圖形種類見上方圖例 · 箭頭＝下一步`
      : "導引圖 · 空圖：下一步會長出「開始」符號，再依流程接箭頭";
  }
}

function normalizeStoryBeats(node) {
  if (!node) return [];
  const raw = node.story;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const hasChoices = !!(node.choices?.length);
  return list
    .filter((b) => !b.ghost)
    .map((b, i) => ({
      id: b.id || `${state.nodeId}-${i}`,
      lane: String(b.lane || formById(node.form)?.level || "A"),
      row: storyRowId(node, b),
      label: b.label || node.line?.slice(0, 18) || "…",
      kind: normalizeStoryKind(b.kind, { hasChoices }),
      from: b.from || undefined,
      edgeLabel: b.edgeLabel || "",
      hot: true,
    }));
}

function applyStoryBeats(node, { fromPrev = false } = {}) {
  if (!useStoryStage()) {
    hideStoryStage();
    return;
  }
  if (node.showBoard && !node.showSwimlane) {
    hideStoryStage();
    return;
  }
  const incoming = normalizeStoryBeats(node);
  if (!fromPrev) {
    if (node.storyReplace) state.storyBeats = [];
    state.storyBeats.forEach((b) => {
      b.hot = false;
    });
    // 清掉舊版佔位 ghost
    state.storyBeats = state.storyBeats.filter((b) => !b.ghost);
    for (const beat of incoming) {
      const exists = state.storyBeats.find((b) => b.id === beat.id);
      if (exists) {
        Object.assign(exists, beat, { hot: true });
      } else {
        // 未寫 from 時，自動接到上一顆
        if (!beat.from) {
          const last = [...state.storyBeats].reverse().find((b) => b.kind !== "decision");
          if (last) beat.from = last.id;
        }
        state.storyBeats.push(beat);
      }
    }
    // 抉擇：只畫一顆菱形（判斷），選項在對話列——符合導引圖定義
    if (node.choices?.length && !state.storyBeats.some((b) => b.kind === "decision" && b.id.startsWith(`${state.nodeId}`))) {
      const hasDecision = incoming.some((b) => b.kind === "decision");
      if (!hasDecision) {
        const lane = formById(node.form)?.level || forms()[0]?.level || "A";
        const row = storyRowId(node, {});
        const last = [...state.storyBeats].reverse().find((b) => b.kind !== "decision");
        state.storyBeats.push({
          id: `${state.nodeId}-decision`,
          lane,
          row,
          label: "怎麼走？",
          kind: "decision",
          from: last?.id,
          hot: true,
        });
      }
    }
  }
  const hotId = incoming[0]?.id || state.storyBeats.find((b) => b.hot)?.id;
  paintStoryStage({ hotId });
}

/** 把開場四張紙縮進可視區，字可小但四張都要同時看見 */
function fitSchemaToStage() {
  const stage = els.stageWrap;
  const host = els.stageFit;
  if (!stage || !host || state.mode !== "show") return;
  host.style.transform = "";
  host.style.marginBottom = "";
  host.dataset.scale = "1";
  requestAnimationFrame(() => {
    const map = els.sections?.querySelector(".schema-map");
    if (!map) return;
    const stageH = Math.max(120, stage.clientHeight - 8);
    const stageW = Math.max(160, stage.clientWidth - 8);
    const rect = host.getBoundingClientRect();
    if (rect.height < 40 || rect.width < 40) return;
    const scale = Math.min(1, Math.max(0.42, Math.min(stageW / rect.width, stageH / rect.height) * 0.96));
    host.style.transformOrigin = "top center";
    host.style.transform = `scale(${scale})`;
    host.dataset.scale = String(scale);
    host.style.marginBottom = `${Math.min(0, host.offsetHeight * (scale - 1))}px`;
  });
}

/** 多表單開場：同一套紙本外型；四張同屏；連線先用精簡圖例（風格待補） */
function renderFormSchema({ highlightLevels = [], highlightRules = [] } = {}) {
  const hiLv = new Set(highlightLevels.map(String));
  const hiRule = new Set(highlightRules.map(String));
  const list = forms();
  els.formSheet.hidden = false;
  els.formSheet.classList.add("is-schema");
  els.formTitle.textContent = pack.meta?.title || "表單關係";
  els.formSub.textContent = "四張同屏 · 同一紙本 · 字小但都看得見";
  els.statusPill.textContent = `${list.length} 張 · 唯讀`;
  els.submitRow.classList.remove("open");
  els.actionRow.classList.remove("open");
  els.actionRow.innerHTML = "";

  const sheets = list
    .map((f) => {
      const on = !hiLv.size || hiLv.has(f.level) || hiLv.has(f.id);
      const fields = (f.sections || []).flatMap((sec) => sec.fields || []);
      const rows = fields
        .map(
          (field) => `<div class="field open readonly schema-field">
            <div class="field-label">${escapeHtml(field.label)}</div>
            <div class="field-value empty" aria-hidden="true"></div>
          </div>`
        )
        .join("");
      return `<article class="mini-sheet ${on ? "hi" : "dim"}" data-form="${escapeHtml(f.id)}">
        <h3 class="form-title">${escapeHtml(f.level ? `${f.level} · ${f.label || f.title}` : f.label || f.title)}</h3>
        <div class="status-wrap"><span class="status-pill">${escapeHtml(f.level || "")} 草稿</span></div>
        <div class="section open">
          <div class="fields">${rows}</div>
        </div>
      </article>`;
    })
    .join("");

  const key = (pack.linkRules || [])
    .map((r, idx) => {
      const from = formById(r.from);
      const to = formById(r.to);
      const id = r.id || `${r.from}->${r.to}`;
      const hot = !hiRule.size || hiRule.has(id) || hiRule.has(String(idx));
      return `<span class="schema-key-item ${hot ? "hot" : ""}" title="${escapeHtml(r.label || "")}">
        <b>${escapeHtml(from?.level || "?")}→${escapeHtml(to?.level || "?")}</b>
        <i>${escapeHtml(r.cardinality || "")}</i>
      </span>`;
    })
    .join("");

  els.sections.innerHTML = `
    <div class="schema-map">
      <div class="schema-sheets count-${list.length}">${sheets}</div>
      <div class="schema-key" aria-label="表單連線圖例">
        <span class="schema-key-label">連線</span>
        ${key || `<span class="muted">尚無 linkRules</span>`}
      </div>
    </div>`;
  fitSchemaToStage();
}

function renderBoard({ highlight = [] } = {}) {
  const hi = new Set(highlight);
  const rows = Object.values(state.docs).sort((a, b) => {
    const la = formById(a.formId)?.level || "Z";
    const lb = formById(b.formId)?.level || "Z";
    return la.localeCompare(lb) || a.id.localeCompare(b.id);
  });
  const doneCount = rows.filter(isDone).length;
  els.formSheet.hidden = false;
  els.formSheet.classList.remove("is-schema");
  els.formTitle.textContent = "關聯總表";
  els.formSub.textContent = `圖狀關聯 · ${doneCount}/${rows.length} 張已完成狀態`;
  els.statusPill.textContent = `${state.links.length} 條連結`;
  els.submitRow.classList.remove("open");
  els.actionRow.classList.remove("open");
  els.actionRow.innerHTML = "";

  const rules = (pack.linkRules || [])
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.from)}</strong> → <strong>${escapeHtml(r.to)}</strong>${
          r.cardinality ? `（${escapeHtml(r.cardinality)}）` : ""
        } ${escapeHtml(r.label || "")}</li>`
    )
    .join("");

  els.sections.innerHTML = `
    <div class="board">
      <p class="board-lead">A／B／C／D 是<strong>同級獨立表單</strong>；一張 A 可掛多張 B，一張 B 可掛多張 C。狀態在總表一次看完。</p>
      ${rules ? `<ul class="board-rules">${rules}</ul>` : ""}
      <div class="board-table-wrap">
        <table class="board-table">
          <thead>
            <tr>
              <th>層級</th>
              <th>表單</th>
              <th>單據</th>
              <th>狀態</th>
              <th>完成</th>
              <th>連出</th>
              <th>連入</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((doc) => {
                const form = formById(doc.formId);
                const outs = linkedFrom(doc.id);
                const ins = linkedTo(doc.id);
                const done = isDone(doc);
                return `<tr class="${hi.has(doc.id) ? "hi" : ""} ${done ? "done" : ""}" data-open-doc="${doc.id}">
                  <td><span class="lvl">${escapeHtml(form?.level || "?")}</span></td>
                  <td>${escapeHtml(form?.label || doc.formId)}</td>
                  <td><strong>${escapeHtml(docTitle(doc))}</strong><div class="muted">${escapeHtml(doc.id)}</div></td>
                  <td>${escapeHtml(statusOf(doc))}</td>
                  <td>${done ? "✓" : "·"}</td>
                  <td>${outs.map((l) => `<div>${escapeHtml(l.label || "→")} <code>${escapeHtml(l.to)}</code></div>`).join("") || "—"}</td>
                  <td>${ins.map((l) => `<div><code>${escapeHtml(l.from)}</code></div>`).join("") || "—"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="board-graph">
        ${state.links
          .map((l) => {
            const a = state.docs[l.from];
            const b = state.docs[l.to];
            return `<div class="edge ${hi.has(l.from) || hi.has(l.to) ? "hi" : ""}">
              <span class="edge-a">${escapeHtml(formById(a?.formId)?.level || "")} ${escapeHtml(docTitle(a) || l.from)}</span>
              <span class="edge-arrow">→</span>
              <span class="edge-b">${escapeHtml(formById(b?.formId)?.level || "")} ${escapeHtml(docTitle(b) || l.to)}</span>
              <span class="edge-label">${escapeHtml(l.label || "")}</span>
            </div>`;
          })
          .join("") || `<p class="muted">尚無連結</p>`}
      </div>
    </div>`;

  els.sections.querySelectorAll("[data-open-doc]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.getAttribute("data-open-doc");
      const doc = state.docs[id];
      if (!doc) return;
      state.boardOnly = false;
      switchContext(doc.formId, id);
      if (state.mode === "board") setMode("form");
      else if (state.mode === "show") {
        state.unlocked = new Set(Object.keys(doc.values || {}).filter((k) => doc.values[k]));
        buildShowForm();
      }
    });
  });
}

function renderSummary() {
  els.summary.classList.add("show");
  els.summary.innerHTML = `
    <h2>這個系統收成 ${forms().length} 種獨立表單 · ${(pack.tables || []).length} 張說明表</h2>
    <p>A／B／C／D 同級；用連結組成圖。每一欄都能追回對話裡的那句話：</p>
    ${(pack.tables || [])
      .map(
        (t) => `<div class="table-card">
          <h3>${escapeHtml(t.label)}</h3>
          <ul>${(t.fields || [])
            .map(
              (f) =>
                `<li><strong>${escapeHtml(f.label)}</strong> <span class="origin">— ${escapeHtml(f.origin)}</span></li>`
            )
            .join("")}</ul>
        </div>`
      )
      .join("")}`;
}

function clearSummary() {
  els.summary.classList.remove("show");
  els.summary.innerHTML = "";
}

function appendChat(node, { replaceLast = false } = {}) {
  const cast = castOf(node.speaker);
  const side = cast.tone === "user" ? "me" : "them";
  const item = {
    id: `${state.nodeId}-${state.chat.length}`,
    speaker: cast.label,
    line: node.line,
    side,
    tone: cast.tone,
  };
  if (replaceLast && state.chat.length) state.chat[state.chat.length - 1] = item;
  else state.chat.push(item);
  paintChat();
}

function paintChat() {
  els.chatLog.innerHTML = state.chat
    .map((m) => {
      const color = TONE[m.tone] || TONE.guide;
      return `<div class="bubble-row ${m.side}">
        <div class="bubble" style="--tone:${color}">
          <div class="who">${escapeHtml(m.speaker)}</div>
          <div class="line">${escapeHtml(m.line)}</div>
        </div>
      </div>`;
    })
    .join("");
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderChatExtras(node) {
  const slot = document.getElementById("chat-extra");
  if (!slot) return;
  if (node.choices?.length) {
    slot.innerHTML = `<div class="choice-row">${node.choices
      .map(
        (c) =>
          `<button type="button" class="choice-btn" data-next="${escapeHtml(c.next)}">${escapeHtml(c.label)}</button>`
      )
      .join("")}</div>`;
    slot.querySelectorAll("[data-next]").forEach((b) =>
      b.addEventListener("click", () => goNext(b.getAttribute("data-next")))
    );
  } else if (node.ending && node.cta?.length) {
    slot.innerHTML = `<div class="choice-row">${node.cta
      .map((c) => {
        if (c.action === "open-form")
          return `<button type="button" class="cta-btn" data-action="open-form">${escapeHtml(c.label)}</button>`;
        if (c.action === "open-settings")
          return `<button type="button" class="cta-btn" data-action="open-settings">${escapeHtml(c.label)}</button>`;
        if (c.action === "open-board")
          return `<button type="button" class="cta-btn" data-action="open-board">${escapeHtml(c.label)}</button>`;
        if (c.action === "restart")
          return `<button type="button" class="cta-btn" data-action="restart">${escapeHtml(c.label)}</button>`;
        return "";
      })
      .join("")}</div>`;
    slot.querySelectorAll("[data-action=open-form]").forEach((b) =>
      b.addEventListener("click", () => setMode("form"))
    );
    slot.querySelectorAll("[data-action=open-settings]").forEach((b) =>
      b.addEventListener("click", () => setMode("settings"))
    );
    slot.querySelectorAll("[data-action=open-board]").forEach((b) =>
      b.addEventListener("click", () => setMode("board"))
    );
    slot.querySelectorAll("[data-action=restart]").forEach((b) =>
      b.addEventListener("click", () => restartShow())
    );
  } else {
    slot.innerHTML = "";
  }
  els.btnNext.disabled = !!(node.choices?.length || node.ending);
  els.btnPrev.disabled = state.history.length === 0;
}

async function renderNode({ fromPrev = false } = {}) {
  const node = nodeOf(state.nodeId);
  if (!node) return;
  state.busy = true;
  els.btnNext.disabled = true;
  els.btnPrev.disabled = true;

  flushActiveDoc();
  if (node.ensureDoc) ensureDoc(node.ensureDoc);
  if (node.ensureDocs) node.ensureDocs.forEach(ensureDoc);
  if (node.link) addLink(node.link);
  if (node.links) node.links.forEach(addLink);
  if (state.docs[state.docId]) {
    state.values = { ...state.docs[state.docId].values };
  }

  const wantForm = node.form || state.formId;
  const wantDoc = node.doc || state.docId;
  const storyUi = !!(node.showSwimlane || (useStoryStage() && node.story && !node.showBoard));

  if (node.showSwimlane || storyUi) {
    state.boardOnly = true;
    resetStudyFit();
    if (els.formSheet) els.formSheet.hidden = true;
    applyStoryBeats(node, { fromPrev });
    // 背景仍可灌 demo，供表單模式使用
    if (wantForm) {
      switchContext(wantForm, wantDoc || state.docId, { rebuild: false });
      if (!fromPrev) {
        Object.assign(state.values, resolveFills(node));
        flushActiveDoc();
      }
    }
  } else if (node.showSchema) {
    hideStoryStage();
    state.boardOnly = true;
    if (els.formSheet) els.formSheet.hidden = false;
    renderFormSchema({
      highlightLevels: node.schemaHighlight || [],
      highlightRules: node.schemaRules || [],
    });
  } else if (node.showBoard) {
    hideStoryStage();
    resetStudyFit();
    state.boardOnly = true;
    if (els.formSheet) els.formSheet.hidden = false;
    renderBoard({ highlight: node.boardHighlight || [] });
    persistGraph();
  } else {
    hideStoryStage();
    resetStudyFit();
    const formChanged = wantForm !== state.formId || wantDoc !== state.docId || state.boardOnly;
    state.boardOnly = false;
    if (els.formSheet) els.formSheet.hidden = false;
    if (formChanged) {
      switchContext(wantForm, wantDoc, { rebuild: true });
      Object.entries(state.values).forEach(([k, v]) => {
        if (v) state.unlocked.add(k);
      });
    }
  }

  if (!fromPrev) appendChat(node);
  else paintChat();

  if (!node.showBoard && !node.showSchema && !storyUi) {
    prepareReveal(node);
    if (!fromPrev) await applyFills(node);
    else paintShowForm();
  }

  if (node.summary || node.ending) renderSummary();
  else if (!fromPrev) clearSummary();

  renderChatExtras(node);
  state.busy = false;
  if (!node.choices?.length && !node.ending) els.btnNext.disabled = false;
  els.btnPrev.disabled = state.history.length === 0;
}

async function goNext(forcedNext) {
  if (state.busy) return;
  const node = nodeOf(state.nodeId);
  if (!node || node.ending) return;
  if (node.choices?.length && !forcedNext) return;
  const next = forcedNext || node.next;
  if (!next) return;
  state.history.push({
    nodeId: state.nodeId,
    snap: snapshotShow(),
    chatLen: state.chat.length,
  });
  state.nodeId = next;
  await renderNode();
}

function goPrev() {
  if (state.busy || !state.history.length) return;
  const prev = state.history.pop();
  state.nodeId = prev.nodeId;
  restoreShow(prev.snap);
  state.chat = state.chat.slice(0, prev.chatLen);
  renderNode({ fromPrev: true });
}

function restartShow() {
  state.typeToken += 1;
  state.nodeId = pack.show.start;
  state.storyBeats = [];
  seedGraphFromDemo();
  // for demo.values-only packs, clear main values for show typing
  if (!pack.demo?.docs) {
    const form = activeForm();
    state.docs.main.values = { [form.statusField]: "草稿" };
  }
  loadActiveDocValues();
  state.unlocked = new Set();
  state.openSections = new Set([firstSectionId()]);
  state.history = [];
  state.chat = [];
  state.busy = false;
  state.boardOnly = false;
  els.submitRow.classList.remove("open");
  clearSummary();
  buildShowForm();
  paintShowForm();
  renderNode();
}

/* ——— Real form / board ——— */

function renderFormTabs() {
  const host = document.getElementById("form-type-tabs");
  if (!host) return;
  if (!isGraphPack()) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.innerHTML = forms()
    .map(
      (f) =>
        `<button type="button" class="role-tab ${f.id === state.formId ? "active" : ""}" data-form="${f.id}">${escapeHtml(f.level || "")} ${escapeHtml(f.label)}</button>`
    )
    .join("");
  host.querySelectorAll("[data-form]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const formId = btn.getAttribute("data-form");
      const existing = Object.values(state.docs).find((d) => d.formId === formId);
      if (existing) switchContext(formId, existing.id, { rebuild: false });
      else {
        const id = `${formId}-${Date.now().toString(36).slice(-4)}`;
        ensureDoc({ id, formId, title: `新${formById(formId).label}` });
        switchContext(formId, id, { rebuild: false });
      }
      buildRealForm();
    });
  });
}

function renderDocList() {
  const host = document.getElementById("doc-list");
  if (!host) return;
  if (!isGraphPack()) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  host.hidden = false;
  const same = Object.values(state.docs).filter((d) => d.formId === state.formId);
  host.innerHTML = `
    <div class="doc-list-head">
      <span>此表單的單據（同級獨立）</span>
      <button type="button" class="ghost-btn" id="btn-new-doc">＋ 新建</button>
    </div>
    <div class="doc-chips">
      ${same
        .map(
          (d) =>
            `<button type="button" class="doc-chip ${d.id === state.docId ? "active" : ""}" data-doc="${d.id}">
              ${escapeHtml(docTitle(d))} <small>${escapeHtml(statusOf(d))}</small>
            </button>`
        )
        .join("")}
    </div>
    <div class="link-panel">
      <div class="doc-list-head"><span>連結（可多對多）</span>
        <button type="button" class="ghost-btn" id="btn-add-link">＋ 連到…</button>
      </div>
      <ul class="link-ul">
        ${linkedFrom(state.docId)
          .map((l) => {
            const t = state.docs[l.to];
            return `<li>→ ${escapeHtml(l.label || "")} <strong>${escapeHtml(docTitle(t) || l.to)}</strong> <span class="muted">(${escapeHtml(formById(t?.formId)?.level || "")})</span></li>`;
          })
          .join("") || "<li class='muted'>尚未連出</li>"}
        ${linkedTo(state.docId)
          .map((l) => {
            const t = state.docs[l.from];
            return `<li>← 來自 <strong>${escapeHtml(docTitle(t) || l.from)}</strong></li>`;
          })
          .join("")}
      </ul>
    </div>`;
  host.querySelectorAll("[data-doc]").forEach((b) =>
    b.addEventListener("click", () => {
      switchContext(state.formId, b.getAttribute("data-doc"), { rebuild: false });
      buildRealForm();
    })
  );
  document.getElementById("btn-new-doc")?.addEventListener("click", () => {
    const form = activeForm();
    const id = `${form.id}-${Date.now().toString(36).slice(-4)}`;
    ensureDoc({ id, formId: form.id, title: `新${form.label}` });
    switchContext(form.id, id, { rebuild: false });
    persistGraph();
    buildRealForm();
  });
  document.getElementById("btn-add-link")?.addEventListener("click", () => {
    const targets = Object.values(state.docs).filter((d) => d.id !== state.docId);
    if (!targets.length) {
      toast("請先建立其他表單的單據");
      return;
    }
    const labels = targets.map((d, i) => `${i + 1}. [${formById(d.formId)?.level}] ${docTitle(d)}`).join("\n");
    const pick = prompt(`連到哪一張？輸入序號：\n${labels}`, "1");
    const idx = Number(pick) - 1;
    if (!targets[idx]) return;
    const label = prompt("連結說明（例如：需要備料）", "") || "";
    addLink({ from: state.docId, to: targets[idx].id, label });
    persistGraph();
    buildRealForm();
    toast("已建立連結");
  });
}

function buildRealForm() {
  loadActiveDocValues();
  const form = activeForm();
  if (!state.values[form.statusField]) state.values[form.statusField] = "草稿";

  els.formSheet.hidden = false;
  els.formTitle.textContent = `${form.level ? form.level + " · " : ""}${form.title}`;
  els.formSub.textContent = isGraphPack()
    ? "獨立表單 · 用連結組成圖 · 依角色 ACL"
    : "真實表單 · 依角色 ACL 顯示／編輯";
  renderFormTabs();
  renderDocList();

  els.sections.innerHTML = form.sections
    .map((sec) => {
      const visibleFields = sec.fields.filter((f) => canRead(f, state.roleId));
      if (!visibleFields.length) return "";
      return `<section class="section open" data-section="${sec.id}">
        <p class="section-label">${escapeHtml(sec.label)}</p>
        <div class="fields">
          ${visibleFields
            .map((f) => {
              const writable = canWrite(f, state.roleId);
              const req = isRequired(f, state.roleId);
              const val = state.values[f.id] ?? "";
              const meaning = f.meaning
                ? `<div class="field-hint">${escapeHtml(f.meaning)}${req ? " · 必填" : ""}</div>`
                : req
                  ? `<div class="field-hint">必填</div>`
                  : "";
              let control = "";
              if (f.type === "select") {
                const opts = (f.options || [])
                  .map(
                    (o) =>
                      `<option value="${escapeHtml(o)}" ${val === o ? "selected" : ""}>${escapeHtml(o)}</option>`
                  )
                  .join("");
                control = `<select class="field-input" data-input="${f.id}" ${writable ? "" : "disabled"}>
                  <option value="">—</option>${opts}</select>`;
              } else if (f.type === "textarea") {
                control = `<textarea class="field-input" data-input="${f.id}" ${writable ? "" : "readonly"} placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea>`;
              } else {
                control = `<input class="field-input" data-input="${f.id}" type="${escapeHtml(f.type || "text")}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" ${writable ? "" : "readonly"} />`;
              }
              return `<div class="field open" data-field="${f.id}">
                <div class="field-label">${escapeHtml(f.label)}${req ? " *" : ""}</div>
                ${control}
                ${meaning}
              </div>`;
            })
            .join("")}
        </div>
      </section>`;
    })
    .join("");

  els.sections.querySelectorAll("[data-input]").forEach((input) => {
    const sync = () => {
      state.values[input.getAttribute("data-input")] = input.value;
      const tField = activeForm().titleField;
      if (tField && input.getAttribute("data-input") === tField && state.docs[state.docId]) {
        state.docs[state.docId].title = input.value;
      }
      persistGraph();
      els.statusPill.textContent = status();
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
  });

  els.statusPill.textContent = status();
  renderRoleTabs();
  renderActions();
}

function renderRoleTabs() {
  els.roleTabs.innerHTML = pack.roles
    .map(
      (r) =>
        `<button type="button" class="role-tab ${r.id === state.roleId ? "active" : ""}" data-role="${r.id}">${escapeHtml(r.label)}</button>`
    )
    .join("");
  els.roleTabs.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.roleId = btn.getAttribute("data-role");
      if (state.mode === "form") buildRealForm();
      else if (state.mode === "settings") buildSettings();
    });
  });
}

function actionAvailable(action) {
  if (action.form && action.form !== state.formId) return false;
  if (action.role !== state.roleId) return false;
  const st = status();
  const when = action.whenStatus || [];
  return when.includes(st) || (when.includes("") && (!st || st === "草稿"));
}

function renderActions() {
  const acts = (pack.actions || []).filter(actionAvailable);
  els.submitRow.classList.remove("open");
  els.actionRow.classList.add("open");
  if (!acts.length) {
    els.actionRow.innerHTML = `<span class="progress">目前角色在「${escapeHtml(status())}」沒有可做的動作</span>
      <button type="button" class="ghost-btn" id="btn-reset-doc">清空此單</button>`;
  } else {
    els.actionRow.innerHTML =
      acts.map((a) => `<button type="button" class="primary-btn" data-action-id="${a.id}">${escapeHtml(a.label)}</button>`).join("") +
      `<button type="button" class="ghost-btn" id="btn-reset-doc">清空此單</button>`;
  }
  els.actionRow.querySelectorAll("[data-action-id]").forEach((btn) => {
    btn.addEventListener("click", () => runAction(btn.getAttribute("data-action-id")));
  });
  document.getElementById("btn-reset-doc")?.addEventListener("click", () => {
    if (!confirm("清空這張單，從頭開始？")) return;
    const form = activeForm();
    state.values = { [form.statusField]: "草稿" };
    flushActiveDoc();
    persistGraph();
    buildRealForm();
    toast("已清空");
  });
}

function runAction(actionId) {
  const action = pack.actions.find((a) => a.id === actionId);
  if (!action || !actionAvailable(action)) return;
  for (const req of action.require || []) {
    if (!String(state.values[req] || "").trim()) {
      const f = fieldById(req);
      toast(`請先填「${f?.label || req}」`);
      document.querySelector(`[data-input="${req}"]`)?.focus();
      return;
    }
  }
  const persona = pack.demo?.persona?.[state.roleId] || roleOf(state.roleId)?.label || "";
  for (const id of action.autoPersona || []) state.values[id] = persona;
  for (const id of action.autoToday || []) state.values[id] = today();
  Object.assign(state.values, action.set || {});
  for (const [from, to] of Object.entries(action.copy || {})) {
    if (state.values[from] != null && state.values[from] !== "") {
      state.values[to] = state.values[from];
    }
  }
  flushActiveDoc();
  persistGraph();
  buildRealForm();
  toast(action.message || "已完成");
}

function buildSettings() {
  els.formTitle.textContent = "欄位設定";
  els.formSub.textContent = "依「獨立表單」分開設定 · 誰必填／可看／可編 · 可匯出";
  els.statusPill.textContent = pack.meta.title;
  els.submitRow.classList.remove("open");
  els.actionRow.classList.remove("open");
  els.actionRow.innerHTML = "";
  document.getElementById("doc-list") && (document.getElementById("doc-list").hidden = true);
  document.getElementById("form-type-tabs") && (document.getElementById("form-type-tabs").hidden = true);

  els.sections.innerHTML = `<div class="settings-list">
    ${forms()
      .map((form) => {
        const fields = allFields(form);
        return `<div class="settings-form-block">
          <h2 class="settings-form-title">${escapeHtml(form.level || "")} · ${escapeHtml(form.label)}</h2>
          ${fields
            .map((f) => {
              const acl = aclOf(f);
              const checks = (key) =>
                pack.roles
                  .map(
                    (r) =>
                      `<label><input type="checkbox" data-acl="${form.id}:${f.id}:${key}:${r.id}" ${(acl[key] || []).includes(r.id) ? "checked" : ""}/> ${escapeHtml(r.label)}</label>`
                  )
                  .join("");
              return `<article class="acl-card">
                <h3>${escapeHtml(f.label)} <span class="progress">(${escapeHtml(f.id)})</span></h3>
                <p class="meaning">${escapeHtml(f.meaning || "")}</p>
                <div class="acl-grid">
                  <div class="acl-row"><span>必填</span><div class="acl-checks">${checks("requiredFrom")}</div></div>
                  <div class="acl-row"><span>可看</span><div class="acl-checks">${checks("read")}</div></div>
                  <div class="acl-row"><span>可編</span><div class="acl-checks">${checks("write")}</div></div>
                </div>
              </article>`;
            })
            .join("")}
        </div>`;
      })
      .join("")}
    <div class="settings-actions">
      <button type="button" class="ghost-btn" id="btn-export">匯出 JSON</button>
      <button type="button" class="primary-btn" id="btn-save-acl">儲存設定</button>
    </div>
  </div>`;

  els.sections.querySelectorAll("[data-acl]").forEach((input) => {
    input.addEventListener("change", () => {
      const [formId, fieldId, key, roleId] = input.getAttribute("data-acl").split(":");
      const field = fieldById(fieldId, formById(formId));
      if (!field.acl) field.acl = { requiredFrom: [], read: [], write: [] };
      // mutate source field in pack.forms
      const src = formById(formId).sections.flatMap((s) => s.fields).find((x) => x.id === fieldId);
      if (!src.acl) src.acl = { requiredFrom: [], read: [], write: [] };
      const set = new Set(src.acl[key] || []);
      if (input.checked) set.add(roleId);
      else set.delete(roleId);
      src.acl[key] = [...set];
    });
  });

  document.getElementById("btn-save-acl")?.addEventListener("click", () => {
    persistPackEdits();
    toast("已儲存設定（此瀏覽器）");
  });
  document.getElementById("btn-export")?.addEventListener("click", exportPack);
  renderRoleTabs();
}

function exportPack() {
  flushActiveDoc();
  const out = {
    ...pack,
    demo: {
      ...(pack.demo || {}),
      values: pack.demo?.values || {},
      persona: pack.demo?.persona || {},
      docs: Object.values(state.docs),
      links: state.links,
    },
  };
  // keep legacy form mirror for single-form
  if (out.forms?.length === 1) out.form = { ...out.forms[0] };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${pack.meta.id || "system"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("已匯出 JSON（含單據與連結）");
}

function importPackFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      const normalized = normalizePack(json);
      pack = normalized;
      packLibrary[pack.meta.id] = structuredClone(normalized);
      syncPackSelect();
      localStorage.removeItem(storageKeyPack());
      localStorage.removeItem(storageKeyGraph());
      persistPackEdits();
      bootPack();
      toast(`已載入：${pack.meta.title}`);
    } catch (err) {
      console.error(err);
      toast("JSON 格式不正確");
    }
  };
  reader.readAsText(file);
}

function syncPackSelect() {
  const sel = document.getElementById("pack-select");
  if (!sel) return;
  const ids = Object.keys(packLibrary);
  sel.innerHTML = ids
    .map((id) => {
      const p = packLibrary[id];
      const label = p?.meta?.title || id;
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  if (pack?.meta?.id) sel.value = pack.meta.id;
  sel.hidden = ids.length < 2;
}

function switchPack(id) {
  const base = packLibrary[id];
  if (!base) return;
  pack = normalizePack(structuredClone(base));
  const url = new URL(location.href);
  url.searchParams.set("system", id);
  history.replaceState(null, "", url);
  bootPack();
  toast(`切換：${pack.meta.title}`);
}

function setMode(mode) {
  state.mode = mode;
  els.app.dataset.mode = mode === "board" ? "form" : mode;
  if (mode === "board") els.app.dataset.board = "1";
  else delete els.app.dataset.board;

  document.querySelectorAll(".mode-tab[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
  });
  clearSummary();
  els.actionRow.classList.remove("open");
  state.boardOnly = mode === "board";
  // 離開 Show 時還原縮放，避免表單／設定被壓扁
  if (mode !== "show") resetStudyFit();

  if (mode === "show") {
    els.eyebrow.textContent = "Show · LINE 對話";
    restartShow();
  } else {
    hideStoryStage();
    if (els.formSheet) els.formSheet.hidden = false;
    if (mode === "form") {
      els.eyebrow.textContent = isGraphPack() ? "獨立表單 · 圖狀連結" : "真實表單";
      state.roleId = state.roleId || pack.roles[0].id;
      if (!Object.keys(state.docs || {}).length) loadGraph();
      else {
        flushActiveDoc();
        persistGraph();
      }
      state.boardOnly = false;
      buildRealForm();
    } else if (mode === "board") {
      els.eyebrow.textContent = "關聯總表";
      state.roleId = state.roleId || pack.roles[0].id;
      if (!Object.keys(state.docs || {}).length) loadGraph();
      else {
        flushActiveDoc();
        persistGraph();
      }
      renderFormTabs();
      const dl = document.getElementById("doc-list");
      if (dl) dl.hidden = true;
      const ft = document.getElementById("form-type-tabs");
      if (ft) ft.hidden = true;
      renderBoard();
      renderRoleTabs();
    } else if (mode === "settings") {
      els.eyebrow.textContent = "欄位設定";
      state.roleId = state.roleId || pack.roles[0].id;
      buildSettings();
    }
  }

  const url = new URL(location.href);
  url.searchParams.set("mode", mode);
  history.replaceState(null, "", url);
}

function bindChrome() {
  document.querySelectorAll(".mode-tab[data-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setMode(btn.getAttribute("data-mode"));
    });
  });
  els.btnPrev?.addEventListener("click", goPrev);
  els.btnNext?.addEventListener("click", () => goNext());
  document.getElementById("btn-restart")?.addEventListener("click", () => {
    if (state.mode === "show") restartShow();
    else if (state.mode === "form" || state.mode === "board") {
      if (!confirm("重設所有單據與連結為示範資料？")) return;
      localStorage.removeItem(storageKeyGraph());
      seedGraphFromDemo();
      persistGraph();
      if (state.mode === "board") renderBoard();
      else buildRealForm();
      toast("已重來");
    } else toast("設定請用儲存／匯出");
  });
  document.getElementById("btn-export-top")?.addEventListener("click", exportPack);
  els.fileImport?.addEventListener("change", () => {
    const file = els.fileImport.files?.[0];
    if (file) importPackFile(file);
    els.fileImport.value = "";
  });
  document.getElementById("pack-select")?.addEventListener("change", (e) => {
    switchPack(e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if (state.mode !== "show" || state.busy) return;
    if (e.key === "ArrowRight" || e.key === "Enter") {
      const node = nodeOf(state.nodeId);
      if (!node?.choices && !node?.ending) {
        e.preventDefault();
        goNext();
      }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  });
  window.addEventListener("resize", () => {
    clearTimeout(window.__studyFitResize);
    window.__studyFitResize = setTimeout(() => {
      if (state.mode !== "show") return;
      const node = nodeOf(state.nodeId);
      if (!node) return;
      if (node.showSchema) fitSchemaToStage();
      else if (!state.boardOnly) fitStudyView(node, node.focus || null);
    }, 120);
  });
}

function bootPack() {
  pack = loadPackEdits(pack);
  pack = normalizePack(pack);
  els.title.textContent = pack.meta.title;
  state.roleId = pack.roles[0]?.id;
  const bootMode = new URLSearchParams(location.search).get("mode");
  const mode = ["show", "form", "settings", "board"].includes(bootMode)
    ? bootMode
    : "show";
  // show board tab only for graph packs
  const boardTab = document.querySelector('.mode-tab[data-mode="board"]');
  if (boardTab) boardTab.hidden = !isGraphPack() && forms().length < 2;
  setMode(mode);
}

function boot() {
  const libraryEl = document.getElementById("vn-library");
  const embedded = document.getElementById("vn-data");
  if (libraryEl?.textContent?.trim()) {
    const lib = JSON.parse(libraryEl.textContent);
    packLibrary = {};
    for (const [id, raw] of Object.entries(lib)) {
      packLibrary[id] = normalizePack(raw);
    }
  } else {
    const one = normalizePack(JSON.parse(embedded.textContent));
    packLibrary = { [one.meta.id]: one };
  }
  const want =
    new URLSearchParams(location.search).get("system") ||
    embedded?.dataset?.default ||
    Object.keys(packLibrary)[0];
  pack = normalizePack(structuredClone(packLibrary[want] || Object.values(packLibrary)[0]));
  bindChrome();
  syncPackSelect();
  bootPack();
}

boot();
