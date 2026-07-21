const REPO = "hyi1105/SEED";
const BRANCH = "main";
const SEEDS_PATH = "docs/seeds.json";
const LAYOUT_HISTORY_PATH = "docs/puzzle-layouts.json";
const MAX_LAYOUT_VERSIONS = 30;
const MAX_LAYOUT_SERIES = 20;
const MAX_REVS_PER_LAYOUT = 30;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const API = `https://api.github.com/repos/${REPO}`;
const LAYOUT_KEY = "seed-map-layout-v1";
const COMMUNITY_KEY = "seed-community-v1";
const COMMUNITY_START_POINTS = 50;
const COMMUNITY_SAVE_BONUS = 10;
const TOKEN_KEY = "seed-github-token-v1";
const AI_KEY = "seed-openai-key-v1";
const AI_BASE_KEY = "seed-openai-base-v1";
const MEMBER_KEY = "seed-member-code-v1";
const RECENT_PATH_KEY = "seed-recent-paths-v1";
const SEED_TRAY_KEY = "seed-tray-v1";
const SEED_META_KEY = "seed-meta-v1";
const SYSTEM_SEED_KEY = "system-seed-catalog-v1";
const MAP_VIEW_KEY = "seed-map-view-v1";
const DEFAULT_AI_BASE = "https://api.openai.com/v1";

const state = {
  seeds: [],
  map: {
    cols: 10,
    rows: 10,
    title: "SEED 棋盤",
    note: "",
    kind: "personal",
    visibility: "public",
    template: "grid-10",
    view: localStorage.getItem(MAP_VIEW_KEY) || "fit",
  },
  catalog: null,
  config: { apiBase: "" },
  current: null,
  versions: [],
  panel: "list",
  docMode: "edit",
  dragId: null,
  touchDragging: false,
  touchHighlightCell: null,
  claimCell: null,
  suppressClick: false,
  originalText: "",
  workingText: "",
  editing: false,
  draftAccepted: false,
  frames: [],
  frameDragFrom: -1,
  contentSaveTimer: null,
  layoutSaveTimer: null,
  autosaving: false,
  archivedSeedIds: [],
  importedOriginal: null,
  importedText: "",
  systemBrowse: {
    step: "types",
    seedType: "",
    templateId: "",
  },
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
let toastTimer = null;
let notifyLog = [];

function setStatus(text) {
  statusEl.textContent = text;
}

function formatSavedAt(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 16);
  }
}

function formatSavedAtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  } catch {
    return String(iso).slice(0, 10);
  }
}

function templateDisplayLabel() {
  const id = state.map.template || "grid-10";
  const full = PUZZLE_TEMPLATES[id]?.label || id;
  return full.replace(/^空白(?:拼圖|棋盤)\s*/, "");
}

function showToast(msg, type = "info") {
  addNotify(msg);
  const el = $("toast");
  if (!el) {
    setStatus(msg);
    return;
  }
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 4200);
}

function addNotify(msg) {
  notifyLog.unshift({ at: new Date().toISOString(), msg });
  notifyLog = notifyLog.slice(0, 20);
  const badge = $("notify-badge");
  if (badge) badge.classList.toggle("hidden", notifyLog.length === 0);
  renderNotifyList();
}

function renderNotifyList() {
  const list = $("notify-list");
  if (!list) return;
  if (!notifyLog.length) {
    list.innerHTML = '<li class="notify-empty">還沒有訊息</li>';
    return;
  }
  list.innerHTML = notifyLog
    .map(
      (n) =>
        `<li><time>${escapeHtml(formatSavedAt(n.at))}</time><span>${escapeHtml(n.msg)}</span></li>`
    )
    .join("");
}

function showPanel(name) {
  state.panel = name;
  for (const id of ["list", "read", "history", "diff", "system-seed"]) {
    $(`panel-${id}`).classList.toggle("hidden", id !== name);
  }

  const onMap = name === "list";
  const chrome = $("chrome");
  const docBar = $("doc-bar");
  if (chrome) chrome.dataset.mode = onMap || name === "system-seed" ? "map" : "doc";
  // 種子內操作列先隱藏：路徑用 SEED、段落用框編輯
  if (docBar) docBar.setAttribute("hidden", "");
  closeAllPopovers();

  const stage = document.querySelector(".stage");
  if (stage) stage.scrollTop = 0;
  const panel = $(`panel-${name}`);
  if (panel) panel.scrollTop = 0;
  if (name === "system-seed") renderSystemSeedPanel();
  if (name !== "list") pushRecentPath();
  updatePathBrand();
  updateModeChips();
  updateSyncUi();
}

function updateDraftBar() {
  /* draft-bar 已移除；改自動儲存 */
}

function normalizeFrame(frame) {
  if (frame && typeof frame === "object") {
    return { note: String(frame.note || ""), body: String(frame.body ?? "") };
  }
  return { note: "", body: String(frame ?? "") };
}

function textToFrames(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  const parts = raw.split(/\n{2,}/);
  return parts.map((part) => {
    const m = part.match(/^<<<NOTE\n([\s\S]*?)\n>>>\n?([\s\S]*)$/);
    if (m) return { note: m[1], body: m[2] };
    return { note: "", body: part };
  });
}

function framesToText(frames) {
  return (frames || [])
    .map((f) => {
      const frame = normalizeFrame(f);
      const note = frame.note.trim();
      if (note) return `<<<NOTE\n${frame.note}\n>>>\n${frame.body}`;
      return frame.body;
    })
    .join("\n\n");
}

function framesToPrintableText(frames) {
  return (frames || [])
    .map((f) => normalizeFrame(f).body)
    .filter((b) => String(b).trim())
    .join("\n\n");
}

function isApprovalTemplate(seed) {
  return seed?.seedType === "approval" && seed.approvalIsTemplate !== false && !seed.approvalTemplateId;
}

function isApprovalInstance(seed) {
  return seed?.seedType === "approval" && Boolean(seed.approvalTemplateId);
}

function listApprovalInstances(templateId) {
  return state.seeds.filter((seed) => seed.approvalTemplateId === templateId);
}

function isApproverRole(activeRole, config) {
  if (!activeRole) return false;
  if (activeRole.startsWith("Approver") || activeRole.includes("_Delegate")) return true;
  return config.stages.some((stage) => stage.name === activeRole);
}

function resolveApprovalFieldPermission(config, field, options = {}) {
  const { fillMode = false, preview = false } = options;
  const permissionRole = isApproverRole(config.activeRole, config) ? "Approver" : config.activeRole;
  const permission = config.permissions.find((item) => item.fieldId === field.id && item.role === permissionRole) || {
    view: true,
    edit: true,
    required: false,
  };
  if (preview) return permission;
  if (["Owner", "Admin"].includes(config.activeRole)) {
    return { ...permission, view: true, edit: !options.readonly };
  }
  if (fillMode && ["Requester", "Filler"].includes(config.activeRole) && !["Draft", "Submitted"].includes(config.status)) {
    return { ...permission, edit: false };
  }
  if (fillMode && isApproverRole(config.activeRole, config) && ["Draft"].includes(config.status)) {
    return { ...permission, view: permission.view, edit: false };
  }
  return permission;
}

function syncApprovalActiveRole(config) {
  if (["Draft", "Submitted"].includes(config.status)) {
    config.activeRole = "Requester";
    config.currentApprover = config.roles.Requester || "申請人";
    config.currentLevel = 0;
    return;
  }
  if (config.status === "In Process") {
    const level = Math.max(0, Number(config.currentLevel) || 0);
    const stage = config.stages[level - 2];
    if (stage) {
      config.activeRole = stage.name;
      config.currentApprover = stage.people || stage.name;
    }
  }
}

function findApprovalPersonForRole(roleName, config) {
  if (roleName === "Requester") return config.roles.Requester || "申請人";
  if (roleName === "Filler") return config.roles.Filler || "填寫人";
  const stage = config.stages.find((item) => item.name === roleName);
  return stage?.people || roleName;
}

function deleteApprovalInstance(instanceId) {
  const instance = state.seeds.find((seed) => seed.id === instanceId);
  if (!instance || !isApprovalInstance(instance)) return;
  if (!window.confirm(`刪除申請單「${instance.title}」？`)) return;
  localStorage.removeItem(`seed-draft:${instanceId}`);
  localStorage.removeItem(`seed-versions:${instanceId}`);
  const metadata = loadSeedMetadata();
  delete metadata[instanceId];
  localStorage.setItem(SEED_META_KEY, JSON.stringify(metadata));
  state.seeds = state.seeds.filter((seed) => seed.id !== instanceId);
  const tray = loadSeedTrayState();
  localStorage.setItem(
    SEED_TRAY_KEY,
    JSON.stringify({
      archived: state.seeds.filter((seed) => seed.archived).map((seed) => seed.id),
      deleted: tray.deleted,
      custom: state.seeds.filter((seed) => seed.localOnly),
    })
  );
  renderMap();
  if (state.current?.id === instanceId) {
    const template = state.seeds.find((seed) => seed.id === instance.approvalTemplateId);
    if (template) selectSeed(template).catch((err) => setStatus(err.message || String(err)));
    else setStatus("申請單已刪除");
  }
  showToast("已刪除申請單", "ok");
}

function cloneApprovalTemplate(templateSeed) {
  ensureApprovalModel(templateSeed);
  const config = templateSeed.approvalConfig;
  const id = `local-${Date.now().toString(36)}`;
  const instance = {
    id,
    title: `申請－${templateSeed.title}`,
    alias: `申請－${templateSeed.title}`,
    short: Array.from(`申請${templateSeed.title}`).slice(0, 4).join(""),
    path: "",
    blurb: "",
    col: 0,
    row: 0,
    archived: true,
    localOnly: true,
    seedType: "approval",
    approvalIsTemplate: false,
    approvalTemplateId: templateSeed.id,
    formFields: JSON.parse(JSON.stringify(templateSeed.formFields || [])),
    approvalConfig: JSON.parse(JSON.stringify({
      ...config,
      tab: "fill",
      activeRole: "Requester",
      status: "Draft",
      currentLevel: 0,
      currentApprover: config.roles?.Requester || "申請人",
      lastSubmitDate: "",
      lastApprovalDate: "",
      answers: {},
      comments: [],
      auditTrail: [],
      roleViewInitialized: false,
    })),
  };
  return instance;
}

function createApprovalInstance(templateSeed) {
  const instance = cloneApprovalTemplate(templateSeed);
  state.seeds.push(instance);
  localStorage.setItem(`seed-draft:${instance.id}`, "");
  saveSeedTrayState();
  renderMap();
  return instance;
}

function syncWorkingFromFrames() {
  if (state.current?.seedType === "approval") {
    state.workingText = approvalToText(state.current);
  } else if (state.current?.seedType === "discussion") {
    state.workingText = discussionToText(state.current);
  } else if (isPersonCardDocument(state.current)) {
    state.workingText = personCardToText(state.current);
  } else {
    state.workingText = framesToText(state.frames);
  }
  if ($("edit-body")) $("edit-body").value = state.workingText;
}

function isPersonCardDocument(seed) {
  return seed?.seedType === "document" && seed.documentLayout === "person-card";
}

function makePersonFieldId() {
  return `pcf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const PERSON_FIELD_TYPES = [
  { id: "text", label: "單行文字" },
  { id: "textarea", label: "多行文字" },
  { id: "select", label: "下拉選單" },
];

function personFieldTypeLabel(type) {
  return PERSON_FIELD_TYPES.find((item) => item.id === type)?.label || "單行文字";
}

function defaultPersonCardField(type = "text", label = "") {
  return {
    id: makePersonFieldId(),
    type,
    label,
    viewers: ["本人"],
    editors: ["本人"],
    options: "",
    sourceType: "manual",
    sourceName: "",
    sourceRows: [],
    sourceColumn: 0,
    firstRowHeader: true,
    allowManual: false,
  };
}

function defaultPersonCard() {
  return {
    fields: [
      defaultPersonCardField("text", "簽名1"),
      defaultPersonCardField("text", "簽名2"),
      defaultPersonCardField("text", "簽名3"),
    ],
  };
}

function ensurePersonCardModel(seed) {
  seed.documentLayout = "person-card";
  const card = (seed.personCard ||= defaultPersonCard());
  card.fields = Array.isArray(card.fields) ? card.fields : defaultPersonCard().fields;
  card.fields.forEach((field) => {
    field.id ||= makePersonFieldId();
    field.type ||= "text";
    field.label ||= "";
    field.viewers = Array.isArray(field.viewers) && field.viewers.length ? field.viewers : ["本人"];
    field.editors = Array.isArray(field.editors) && field.editors.length ? field.editors : ["本人"];
    if (field.type === "select") {
      field.options ||= "";
      field.sourceType ||= "manual";
      field.sourceName ||= "";
      field.sourceRows = Array.isArray(field.sourceRows) ? field.sourceRows : [];
      field.sourceColumn = Number.isFinite(field.sourceColumn) ? field.sourceColumn : 0;
      field.firstRowHeader = field.firstRowHeader !== false;
      field.allowManual = Boolean(field.allowManual);
      if (field.sourceType === "file") refreshFieldOptionsFromFile(field);
    } else {
      delete field.options;
      delete field.sourceType;
      delete field.sourceName;
      delete field.sourceRows;
      delete field.sourceColumn;
      delete field.firstRowHeader;
      delete field.allowManual;
    }
    delete field.value;
  });
  delete card.photo;
  delete card.readers;
  delete card.editors;
  return card;
}

function personCardPermissionSummary(list) {
  return (list || ["本人"]).join("、");
}

function personCardToText(seed) {
  const card = ensurePersonCardModel(seed);
  const lines = [`# ${seed.title}`, seed.subtitle || "", "", "## 欄位設計"];
  card.fields.forEach((field, index) => {
    const type = personFieldTypeLabel(field.type);
    const extra = field.type === "select"
      ? `｜選項：${field.sourceType === "file" ? field.sourceName || "CSV／Excel" : (field.options || "手動")}`
      : "";
    lines.push(
      `- 欄位 ${index + 1}｜${type}｜${field.label || "未命名"}｜可見：${personCardPermissionSummary(field.viewers)}｜可編輯：${personCardPermissionSummary(field.editors)}${extra}`
    );
  });
  return lines.join("\n");
}

function approvalToText(seed) {
  const config = ensureApprovalModel(seed);
  const lines = [`# ${seed.title}`, seed.subtitle || "", "", "## 申請單狀態"];
  lines.push(`- Status：${config.status}`);
  lines.push(`- Current Approver：${config.currentApprover}`);
  lines.push(`- Current Level：${config.currentLevel}`);
  lines.push(`- Last Submit Date：${config.lastSubmitDate || "—"}`);
  lines.push(`- Last Approval Date：${config.lastApprovalDate || "—"}`);
  lines.push("", "## 填寫欄位");
  (seed.formFields || []).forEach((field) => {
    const source = field.sourceType === "file" ? `${field.sourceName || "CSV／Excel"} ${approvalColumnName(field.sourceColumn || 0)} 欄` : "手動選項";
    const kind = field.type === "select" ? `選單：${source}` : field.type === "textarea" ? "多行文字" : "單行文字";
    lines.push(`- ${field.label || "未命名欄位"}（${kind}）：${config.answers[field.id] || ""}`);
  });
  lines.push("", "## 簽核流程");
  config.stages.forEach((stage, index) => {
    lines.push(`- Level ${index + 1}｜${stage.name}｜${stage.people || "尚未設定"}｜${stage.mode === "parallel" ? `平行簽核（${stage.approvalRule === "any" ? "一人同意" : "全部同意"}）` : "依序簽核"}`);
  });
  lines.push("", "## Comment");
  config.comments.forEach((item) => lines.push(`- ${item.role}｜${formatWhen(item.when)}：${item.text}`));
  return lines.join("\n");
}

function discussionToText(seed) {
  const lines = [
    `# ${seed.title}`,
    seed.subtitle || "",
    "",
    "## 畫面文字",
    seed.liveContent || "",
    "",
    "## 評論",
  ];
  (seed.messages || []).forEach((message) => {
    lines.push(`- ${message.name || "匿名"}：${message.text}`);
  });
  return lines.join("\n");
}

function scheduleContentAutosave(actor = "人") {
  if (state.current) state.current.lastActor = actor;
  syncWorkingFromFrames();
  if (state.contentSaveTimer) clearTimeout(state.contentSaveTimer);
  state.contentSaveTimer = setTimeout(() => {
    saveDraftLocally();
  }, 500);
}

function scheduleLayoutAutosave() {
  saveLayout();
  if (state.layoutSaveTimer) clearTimeout(state.layoutSaveTimer);
  state.layoutSaveTimer = setTimeout(() => {
    autosavePuzzleLayout().catch((err) => setStatus(err.message || String(err)));
  }, 900);
}

function saveDraftLocally() {
  if (!state.current) return;
  syncWorkingFromFrames();
  const text = state.workingText;
  localStorage.setItem(`seed-draft:${state.current.id}`, text);
  setStatus(text === state.originalText ? "沒有未存變更" : "草稿已暫存；按 Save 建立版本");
  updateSyncUi();
}

async function autosavePuzzleLayout() {
  if (!getToken()) {
    setStatus("棋盤位置已暫存本機（尚未設定鑰匙）");
    updateSyncUi();
    return;
  }
  if (!hasUnsavedPuzzleChanges()) return;
  try {
    await savePuzzleLayout({ forceDialog: false, silent: true });
    setStatus("棋盤位置已自動儲存");
  } catch (err) {
    setStatus(err.message || String(err));
  }
}

function renderInsertGap(index) {
  const gap = document.createElement("button");
  gap.type = "button";
  gap.className = "frame-insert-gap";
  gap.textContent = "+";
  gap.title = "在這裡插入一格";
  gap.setAttribute("aria-label", "在這裡插入一格");
  gap.addEventListener("click", () => {
    state.frames.splice(index, 0, { note: "", body: "" });
    syncWorkingFromFrames();
    renderFrameBoard();
    scheduleContentAutosave();
  });
  return gap;
}

function renderSeedHeading(board, editing, options = {}) {
  const { showSubtitle = true } = options;
  const seed = state.current;
  const header = document.createElement("header");
  header.className = editing ? "seed-heading-editor" : "seed-document-heading";
  if (!editing) {
    const title = document.createElement("h1");
    title.textContent = seed.title;
    header.appendChild(title);
    if (seed.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.textContent = seed.subtitle;
      header.appendChild(subtitle);
    }
    board.appendChild(header);
    return;
  }
  const title = document.createElement("input");
  title.type = "text";
  title.className = "seed-title-input";
  title.value = seed.title || "";
  title.placeholder = "文件標題";
  title.setAttribute("aria-label", "文件標題");
  title.addEventListener("input", () => {
    seed.title = title.value || "未命名 SEED";
    $("read-title").textContent = seed.title;
    saveSeedMetadata(seed);
    if (seed.seedType === "discussion") {
      board.querySelector(".live-preview")?.replaceWith(renderLivePreview(seed));
    }
  });
  if (showSubtitle) {
    const subtitle = document.createElement("input");
    subtitle.type = "text";
    subtitle.className = "seed-subtitle-input";
    subtitle.value = seed.subtitle || "";
    subtitle.placeholder = "副標題（選填）";
    subtitle.setAttribute("aria-label", "文件副標題");
    subtitle.addEventListener("input", () => {
      seed.subtitle = subtitle.value;
      saveSeedMetadata(seed);
      if (seed.seedType === "discussion") {
        board.querySelector(".live-preview")?.replaceWith(renderLivePreview(seed));
      }
    });
    header.append(title, subtitle);
  } else {
    header.append(title);
  }
  board.appendChild(header);
}

function renderFrameBoard() {
  const board = $("read-body");
  if (!board) return;
  const seedType = state.current?.seedType || "document";
  if (seedType === "approval") {
    renderApprovalEditor(board);
    return;
  }
  if (seedType === "discussion") {
    renderDiscussionEditor(board);
    return;
  }
  if (isPersonCardDocument(state.current)) {
    board.className = "prose frame-board person-card-board";
    board.classList.toggle("a4-view", state.docMode === "a4");
    board.innerHTML = "";
    if (state.docMode === "a4") {
      renderPersonCardPrintView(board, state.current);
      return;
    }
    renderPersonCardEditor(board, state.current);
    return;
  }
  board.className = "prose frame-board";
  board.classList.toggle("a4-view", state.docMode === "a4");
  board.innerHTML = "";

  if (state.docMode === "a4") {
    const printable = framesToPrintableText(state.frames);
    renderSeedHeading(board, false);
    const content = document.createElement("div");
    content.className = "document-printable";
    content.textContent = printable || "（尚無可列印內容）";
    board.appendChild(content);
    return;
  }

  state.frames = state.frames.map(normalizeFrame);
  renderSeedHeading(board, true);
  if (!state.frames.length) {
    board.appendChild(renderInsertGap(0));
  }

  state.frames.forEach((frame, index) => {
    const block = document.createElement("div");
    block.className = "frame-block";
    block.draggable = true;
    block.dataset.index = String(index);

    const body = document.createElement("textarea");
    body.className = "frame-body";
    body.rows = Math.max(2, String(frame.body || "").split("\n").length);
    body.placeholder = "這一格的內容（會列印）";
    body.value = frame.body || "";
    body.addEventListener("input", () => {
      state.frames[index].body = body.value;
      body.rows = Math.max(2, body.value.split("\n").length);
      scheduleContentAutosave();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "frame-remove";
    remove.textContent = "×";
    remove.title = "刪除這一格";
    remove.setAttribute("aria-label", "刪除這一格");
    remove.addEventListener("click", () => deleteFrame(index));

    block.appendChild(body);

    const note = document.createElement("input");
    note.type = "text";
    note.className = "frame-note";
    note.placeholder = "註解（不列印）";
    note.value = frame.note || "";
    note.addEventListener("input", () => {
      state.frames[index].note = note.value;
      scheduleContentAutosave();
    });
    const removeIfEmpty = () => {
      setTimeout(() => {
        if (group.contains(document.activeElement)) return;
        const currentIndex = state.frames.indexOf(frame);
        if (currentIndex < 0) return;
        const current = state.frames[currentIndex];
        if (!current.body.trim() && !current.note.trim()) deleteFrame(currentIndex, true);
      }, 0);
    };
    body.addEventListener("blur", removeIfEmpty);
    note.addEventListener("blur", removeIfEmpty);

    block.addEventListener("dragstart", (e) => {
      state.frameDragFrom = index;
      block.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });
    block.addEventListener("dragend", () => {
      block.classList.remove("is-dragging");
      state.frameDragFrom = -1;
    });
    block.addEventListener("dragover", (e) => {
      e.preventDefault();
      block.classList.add("drop-target");
    });
    block.addEventListener("dragleave", () => block.classList.remove("drop-target"));
    block.addEventListener("drop", (e) => {
      e.preventDefault();
      block.classList.remove("drop-target");
      const from = state.frameDragFrom;
      const to = index;
      if (from < 0 || from === to) return;
      const [moved] = state.frames.splice(from, 1);
      state.frames.splice(to, 0, moved);
      syncWorkingFromFrames();
      renderFrameBoard();
      scheduleContentAutosave();
    });

    const group = document.createElement("div");
    group.className = "frame-group";
    const tools = document.createElement("aside");
    tools.className = "frame-tools";
    const number = document.createElement("strong");
    number.className = "frame-number";
    number.textContent = String(index + 1);
    tools.append(number, note);
    block.append(remove, renderInsertGap(index + 1));
    group.append(tools, block);
    board.appendChild(group);
  });
}

function renderPersonCardPrintView(board, seed) {
  const card = ensurePersonCardModel(seed);
  renderSeedHeading(board, false, { showSubtitle: false });
  const grid = document.createElement("div");
  grid.className = "person-card-print-fields";
  card.fields.forEach((field) => {
    const item = document.createElement("div");
    item.innerHTML = `<small>${escapeHtml(personFieldTypeLabel(field.type))}</small><strong>${escapeHtml(field.label || "欄位")}</strong>`;
    grid.appendChild(item);
  });
  board.appendChild(grid);
}

function renderPersonCardPermissionCol(seed, field, key, title) {
  const wrap = document.createElement("div");
  wrap.className = "person-card-perm-col";
  const label = document.createElement("span");
  label.className = "info-label";
  label.textContent = title;
  const row = document.createElement("div");
  row.className = "person-card-perm-btns";
  ["本人", "所有人"].forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn person-card-visibility-btn";
    button.classList.toggle("is-active", (field[key] || []).includes(name));
    button.textContent = name;
    button.addEventListener("click", () => {
      field[key] ||= ["本人"];
      if (field[key].includes(name)) {
        field[key] = field[key].filter((item) => item !== name);
        if (!field[key].length) field[key] = ["本人"];
      } else if (name === "所有人") {
        field[key] = ["所有人"];
      } else {
        field[key] = field[key].filter((item) => item !== "所有人");
        if (!field[key].includes(name)) field[key].push(name);
      }
      persistPersonCard(seed);
      renderFrameBoard();
    });
    row.appendChild(button);
  });
  const custom = document.createElement("button");
  custom.type = "button";
  custom.className = "btn person-card-visibility-btn";
  custom.textContent = "＋ 指定";
  custom.addEventListener("click", () => {
    const name = window.prompt(`指定${title}：`);
    if (!name) return;
    field[key] ||= [];
    field[key] = field[key].filter((item) => item !== "所有人");
    const trimmed = name.trim();
    if (!field[key].includes(trimmed)) field[key].push(trimmed);
    persistPersonCard(seed);
    renderFrameBoard();
  });
  row.appendChild(custom);
  wrap.append(label, row);
  return wrap;
}

function renderPersonCardPermissions(seed, field) {
  const row = document.createElement("div");
  row.className = "person-card-perm-row";
  row.append(
    renderPersonCardPermissionCol(seed, field, "editors", "可編輯"),
    renderPersonCardPermissionCol(seed, field, "viewers", "可見")
  );
  return row;
}

function renderPersonCardSelectOptions(seed, field) {
  const panel = document.createElement("div");
  panel.className = "person-card-select-options";
  panel.innerHTML = `
    <label class="person-card-select-source">選項來源
      <select class="source-type">
        <option value="manual">手動輸入</option>
        <option value="file">CSV／Excel</option>
      </select>
    </label>
    <label class="manual-options">選項
      <input class="manual-options-input" placeholder="選項，用逗號分隔">
    </label>
    <div class="file-options hidden">
      <label>參考檔案<input class="source-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls"></label>
      <span class="source-name"></span>
      <label>使用欄位<select class="source-column"></select></label>
      <label class="person-card-checkbox"><input class="source-header" type="checkbox"> 第一列是標題，不列入選項</label>
      <label class="person-card-checkbox"><input class="source-manual" type="checkbox"> 允許手動輸入</label>
    </div>`;
  const sourceType = panel.querySelector(".source-type");
  const manual = panel.querySelector(".manual-options");
  const manualInput = panel.querySelector(".manual-options-input");
  const fileOptions = panel.querySelector(".file-options");
  const column = panel.querySelector(".source-column");
  const header = panel.querySelector(".source-header");
  const allowManual = panel.querySelector(".source-manual");
  const sourceName = panel.querySelector(".source-name");

  const renderSource = () => {
    manual.classList.toggle("hidden", sourceType.value !== "manual");
    fileOptions.classList.toggle("hidden", sourceType.value !== "file");
    const count = Math.max(1, ...(field.sourceRows || []).map((row) => row.length));
    column.innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i}">${approvalColumnName(i)}${field.firstRowHeader && field.sourceRows?.[0]?.[i] ? `－${escapeHtml(String(field.sourceRows[0][i]))}` : ""}</option>`).join("");
    column.value = String(field.sourceColumn || 0);
    sourceName.textContent = field.sourceName || "尚未選擇檔案";
  };

  sourceType.value = field.sourceType || "manual";
  manualInput.value = field.options || "";
  header.checked = field.firstRowHeader !== false;
  allowManual.checked = Boolean(field.allowManual);
  renderSource();

  sourceType.addEventListener("change", () => {
    field.sourceType = sourceType.value;
    renderSource();
    persistPersonCard(seed);
  });
  manualInput.addEventListener("input", () => {
    field.options = manualInput.value;
    persistPersonCard(seed);
  });
  panel.querySelector(".source-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importFieldOptionsFromFile(field, file);
      persistPersonCard(seed);
      renderFrameBoard();
    } catch (err) {
      setStatus(err.message || String(err));
    }
  });
  column.addEventListener("change", () => {
    field.sourceColumn = Number(column.value);
    refreshFieldOptionsFromFile(field);
    persistPersonCard(seed);
  });
  header.addEventListener("change", () => {
    field.firstRowHeader = header.checked;
    refreshFieldOptionsFromFile(field);
    renderSource();
    persistPersonCard(seed);
  });
  allowManual.addEventListener("change", () => {
    field.allowManual = allowManual.checked;
    persistPersonCard(seed);
  });
  return panel;
}

function renderPersonCardEditor(board, seed) {
  const card = ensurePersonCardModel(seed);
  renderSeedHeading(board, true, { showSubtitle: false });

  const fields = document.createElement("div");
  fields.className = "person-card-fields";
  card.fields.forEach((field, index) => {
    const item = document.createElement("div");
    item.className = "person-card-field";

    const labelRow = document.createElement("div");
    labelRow.className = "info-row person-card-label-row";
    const nameLabel = document.createElement("span");
    nameLabel.className = "info-label";
    nameLabel.textContent = "名稱";
    const typeLabel = document.createElement("span");
    typeLabel.className = "info-label";
    typeLabel.textContent = "類別";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "frame-remove person-card-remove";
    remove.textContent = "×";
    remove.title = "刪除此欄";
    remove.addEventListener("click", () => {
      if (card.fields.length <= 1) return;
      card.fields.splice(index, 1);
      persistPersonCard(seed);
      renderFrameBoard();
    });
    labelRow.append(nameLabel, typeLabel, remove);

    const valueRow = document.createElement("div");
    valueRow.className = "info-row person-card-value-row";
    const nameInput = document.createElement("input");
    nameInput.className = "person-card-value person-card-value-name";
    nameInput.placeholder = "例如簽名1";
    nameInput.value = field.label || "";
    nameInput.addEventListener("input", () => {
      field.label = nameInput.value;
      persistPersonCard(seed);
    });
    const type = document.createElement("select");
    type.className = "person-card-value person-card-value-type";
    PERSON_FIELD_TYPES.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.id;
      opt.textContent = option.label;
      type.appendChild(opt);
    });
    type.value = field.type || "text";
    type.addEventListener("change", () => {
      field.type = type.value;
      ensurePersonCardModel(seed);
      persistPersonCard(seed);
      renderFrameBoard();
    });
    valueRow.append(nameInput, type);

    item.append(labelRow, valueRow, renderPersonCardPermissions(seed, field));
    if (field.type === "select") {
      item.appendChild(renderPersonCardSelectOptions(seed, field));
    }
    fields.appendChild(item);
  });
  board.appendChild(fields);

  const addWrap = document.createElement("div");
  addWrap.className = "person-card-add-wrap";
  const addLabel = document.createElement("p");
  addLabel.className = "person-card-add-label";
  addLabel.textContent = "＋ 新增欄位";
  const addTypes = document.createElement("div");
  addTypes.className = "person-card-add-types";
  PERSON_FIELD_TYPES.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn person-card-add-type";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      const next = card.fields.length + 1;
      card.fields.push(defaultPersonCardField(option.id, `簽名${next}`));
      persistPersonCard(seed);
      renderFrameBoard();
    });
    addTypes.appendChild(button);
  });
  addWrap.append(addLabel, addTypes);
  board.appendChild(addWrap);
}

function persistPersonCard(seed) {
  ensurePersonCardModel(seed);
  syncWorkingFromFrames();
  saveSeedTrayState();
  scheduleContentAutosave();
}

function renderDocumentMetaPanel(board, seed) {
  const panel = document.createElement("section");
  panel.className = "document-meta-panel";
  const format = document.createElement("div");
  format.className = "document-meta-item";
  format.innerHTML = "<small>文件格式</small><strong>文字模板</strong>";
  const descLabel = document.createElement("label");
  descLabel.className = "document-meta-item document-meta-description";
  const descTitle = document.createElement("small");
  descTitle.textContent = "文件說明";
  const desc = document.createElement("textarea");
  desc.className = "document-description-input";
  desc.rows = 2;
  desc.placeholder = "簡短描述這份文件的用途（選填）";
  desc.value = seed.blurb || "";
  desc.addEventListener("input", () => {
    seed.blurb = desc.value;
    saveSeedTrayState();
  });
  descLabel.append(descTitle, desc);
  panel.append(format, descLabel);
  board.appendChild(panel);
}

function renderDocumentHistoryPanel(board, seed) {
  const panel = document.createElement("section");
  panel.className = "document-history-panel";
  const head = document.createElement("div");
  head.className = "document-history-head";
  head.innerHTML = "<h3>歷程</h3>";
  const viewAll = document.createElement("button");
  viewAll.type = "button";
  viewAll.className = "btn";
  viewAll.textContent = "完整歷程記錄";
  viewAll.addEventListener("click", () => {
    setDocMode("diff").catch((err) => setStatus(err.message || String(err)));
  });
  head.appendChild(viewAll);
  panel.appendChild(head);
  const list = document.createElement("ul");
  list.className = "document-history-list";
  if (!state.versions.length) {
    const empty = document.createElement("li");
    empty.className = "meta";
    empty.textContent = "尚無版本。編輯後按 Save 建立第一版。";
    list.appendChild(empty);
  } else {
    state.versions.slice(0, 5).forEach((version) => {
      const item = document.createElement("li");
      item.className = "document-history-item";
      const info = document.createElement("div");
      info.innerHTML = `
        <strong>${escapeHtml(formatWhen(version.when))}</strong>
        <span class="meta">${escapeHtml(version.author || "未知")}－${version.actor === "AI" ? "AI 編輯" : "編輯"}－${escapeHtml(version.message || "")}</span>`;
      const actions = document.createElement("div");
      actions.className = "document-history-actions";
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn";
      openBtn.textContent = "預覽";
      openBtn.addEventListener("click", async () => {
        const text = await fetchFileAt(version.sha);
        state.workingText = text;
        $("read-title").textContent = `${seed.title}（${formatWhen(version.when)}）`;
        setViewMode(text);
        setStatus("已打開舊版預覽");
      });
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "btn btn-primary";
      useBtn.textContent = "用這版繼續改";
      useBtn.addEventListener("click", async () => {
        const text = await fetchFileAt(version.sha);
        if (!state.originalText) await loadSeedText();
        state.workingText = text;
        $("read-title").textContent = `${seed.title}（從舊版繼續）`;
        setEditMode(text);
        setStatus("已載入舊版當草稿；確認後按 Save");
      });
      actions.append(openBtn, useBtn);
      item.append(info, actions);
      list.appendChild(item);
    });
  }
  panel.appendChild(list);
  board.appendChild(panel);
}

function persistStructuredSeed(actor = "人") {
  if (state.current) state.current.lastActor = actor;
  saveSeedTrayState();
  scheduleContentAutosave(actor);
}

function makeApprovalId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function ensureApprovalModel(seed) {
  seed.formFields = Array.isArray(seed.formFields) ? seed.formFields : [];
  seed.formFields.forEach((field) => {
    field.id ||= makeApprovalId("field");
    field.label ||= "";
    field.type ||= "text";
    field.options ||= "";
    field.sourceType ||= "manual";
    field.sourceName ||= "";
    field.sourceRows = Array.isArray(field.sourceRows) ? field.sourceRows : [];
    field.sourceColumn = Number(field.sourceColumn) || 0;
    field.firstRowHeader = field.firstRowHeader !== false;
    field.allowManual = Boolean(field.allowManual);
  });
  if (!seed.formFields.length && !isApprovalTemplate(seed)) {
    seed.formFields.push({
      id: makeApprovalId("field"),
      label: "申請說明",
      type: "textarea",
      options: "",
      sourceType: "manual",
      sourceName: "",
      sourceRows: [],
      sourceColumn: 0,
      firstRowHeader: true,
      allowManual: false,
    });
  }
  const config = (seed.approvalConfig ||= {});
  config.tab ||= isApprovalTemplate(seed) ? "design" : "fill";
  if (config.tab === "request" || config.tab === "fields" || config.tab === "preview") {
    config.tab = isApprovalTemplate(seed) ? "design" : "fill";
  }
  config.activeRole ||= "Requester";
  config.status ||= "Draft";
  config.currentLevel = Number(config.currentLevel) || 0;
  config.currentApprover ||= "申請人";
  config.lastSubmitDate ||= "";
  config.lastApprovalDate ||= "";
  config.commentsEnabled = config.commentsEnabled !== false;
  config.roles = {
    Requester: "申請人",
    Filler: "填寫人",
    CopyTo: "",
    FYI: "",
    Admin: "",
    Owner: "Owner",
    ...(config.roles || {}),
  };
  config.stages = Array.isArray(config.stages) && config.stages.length
    ? config.stages
    : [{
        id: makeApprovalId("stage"),
        name: "Approver1",
        mode: "sequential",
        people: "部門主管",
        approvalRule: "all",
        replaceable: true,
        allowBlank: false,
        reminderDays: 2,
        timeoutAction: "wait",
      }];
  config.permissions = Array.isArray(config.permissions) ? config.permissions : [];
  const permissionRoles = ["Requester", "Filler", "Approver", "CopyTo", "FYI"];
  seed.formFields.forEach((field) => {
    permissionRoles.forEach((role) => {
      if (config.permissions.some((item) => item.fieldId === field.id && item.role === role)) return;
      config.permissions.push({
        fieldId: field.id,
        role,
        view: !["CopyTo", "FYI"].includes(role),
        edit: role === "Requester" || role === "Filler",
        required: role === "Requester",
        condition: "",
        lookup: "",
      });
    });
  });
  config.notifications = {
    submit: { label: "Submit", subject: "申請已送出：{{title}}", prefix: "您好，", editable: "以下申請已送出。", suffix: "請登入 SEED 查看。", reminderDays: 0 },
    approve: { label: "Approve", subject: "簽核已通過：{{title}}", prefix: "您好，", editable: "此階段已通過。", suffix: "系統將繼續下一階段。", reminderDays: 0 },
    deny: { label: "Deny", subject: "申請已拒絕：{{title}}", prefix: "您好，", editable: "申請未獲通過。", suffix: "請查看簽核意見。", reminderDays: 0 },
    return: { label: "Return", subject: "申請已退回：{{title}}", prefix: "您好，", editable: "申請需要補充資料。", suffix: "請修改後重新 Submit。", reminderDays: 0 },
    delegate: { label: "Delegate", subject: "簽核已委派：{{title}}", prefix: "您好，", editable: "您收到一項委派簽核。", suffix: "完成後將回到原簽核者確認。", reminderDays: 0 },
    reminder: { label: "Reminder", subject: "待簽提醒：{{title}}", prefix: "您好，", editable: "您仍有待處理的申請。", suffix: "請於期限前完成。", reminderDays: 2 },
    complete: { label: "Complete", subject: "申請已完成：{{title}}", prefix: "您好，", editable: "整張申請已完成。", suffix: "此通知寄給 FYI。", reminderDays: 0 },
    ...(config.notifications || {}),
  };
  config.answers ||= {};
  config.comments = Array.isArray(config.comments) ? config.comments : [];
  config.auditTrail = Array.isArray(config.auditTrail) ? config.auditTrail : [];
  config.delegations = Array.isArray(config.delegations) ? config.delegations : [];
  config.flowView ||= "stage";
  config.mailPreviewKey ||= "";
  return config;
}

function approvalFlowNotificationKey(stepIndex, nodeCount) {
  if (stepIndex <= 0) return "submit";
  if (stepIndex >= nodeCount - 2) return "complete";
  return "approve";
}

function formatApprovalMailPreview(notification, seed) {
  if (!notification) return "";
  const title = seed?.title || "申請單";
  return [
    notification.subject.replace("{{title}}", title),
    "",
    notification.prefix,
    notification.editable,
    notification.suffix,
    notification.reminderDays ? `\nReminder：${notification.reminderDays} 天後` : "",
  ].filter(Boolean).join("\n");
}

function renderApprovalMailPreview(board, seed, key) {
  const config = ensureApprovalModel(seed);
  const notification = config.notifications[key];
  if (!notification) return;
  const panel = document.createElement("section");
  panel.className = "approval-mail-preview";
  panel.innerHTML = `
    <header><strong>${escapeHtml(notification.label || key)} 通知預覽</strong><button type="button" class="frame-remove" title="關閉">×</button></header>
    <p class="meta">尚未寄出；實際寄信需後端服務。</p>
    <pre>${escapeHtml(formatApprovalMailPreview(notification, seed))}</pre>`;
  panel.querySelector(".frame-remove").addEventListener("click", () => {
    config.mailPreviewKey = "";
    persistStructuredSeed();
    renderFrameBoard();
  });
  board.appendChild(panel);
}

function buildApprovalStageNodes(config) {
  return [
    { role: "Requester", name: config.roles.Requester || "申請人" },
    { role: "Filler", name: config.roles.Filler || "填寫人" },
    ...config.stages.map((stage) => ({ role: stage.name, name: stage.people || stage.name, stage })),
    { role: "Complete", name: "完成" },
  ];
}

function buildApprovalPeopleNodes(config) {
  const nodes = [];
  const seen = new Set();
  [
    { role: "Requester", name: config.roles.Requester || "申請人" },
    { role: "Filler", name: config.roles.Filler || "填寫人" },
    ...config.stages.map((stage) => ({ role: stage.name, name: stage.people || stage.name, stage })),
  ].forEach((node) => {
    const name = String(node.name || "").trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    nodes.push({ role: node.role, name, stage: node.stage });
  });
  nodes.push({ role: "Complete", name: "完成" });
  return nodes;
}

function buildApprovalDelegationLoops(config) {
  return config.stages
    .filter((stage) => stage.delegatedFrom)
    .map((stage) => ({
      delegate: stage.people || stage.name,
      delegatorRole: stage.delegatedFrom,
      delegator: findApprovalPersonForRole(stage.delegatedFrom, config),
      stageName: stage.name,
    }));
}

function renderApprovalFlow(seed, options = {}) {
  const { compact = false, allowRoleSwitch = true, allowMailPreview = true, fillMode = false } = options;
  const config = ensureApprovalModel(seed);
  const wrap = document.createElement("div");
  wrap.className = "approval-flow-wrap";

  const toggle = document.createElement("div");
  toggle.className = "approval-flow-toggle";
  [["stage", "依階段"], ["people", "以人為主"]].forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.classList.toggle("is-active", config.flowView === key);
    button.textContent = label;
    button.addEventListener("click", () => {
      config.flowView = key;
      persistStructuredSeed();
      renderFrameBoard();
    });
    toggle.appendChild(button);
  });
  wrap.appendChild(toggle);

  const flow = document.createElement("div");
  flow.className = `approval-flow${compact ? " compact" : ""}${config.flowView === "people" ? " is-people" : ""}`;
  const nodes = config.flowView === "people" ? buildApprovalPeopleNodes(config) : buildApprovalStageNodes(config);
  const loops = config.flowView === "people" ? buildApprovalDelegationLoops(config) : [];
  const switchRole = (node) => {
    if (!allowRoleSwitch) return;
    if (node.role === "Complete") return;
    config.activeRole = node.stage?.name || node.role;
    if (node.stage) config.currentApprover = node.name;
    else if (node.role === "Requester") config.currentApprover = node.name;
    else if (node.role === "Filler") config.currentApprover = config.roles.Requester || node.name;
    persistStructuredSeed();
    renderFrameBoard();
  };
  nodes.forEach((node, index) => {
    const person = document.createElement("button");
    person.type = "button";
    person.className = "approval-person";
    const isCurrentPerson = fillMode
      ? (node.stage ? node.stage.name === config.activeRole : node.role === config.activeRole)
      : config.flowView === "stage" && index === config.currentLevel;
    if (isCurrentPerson) person.classList.add("is-current");
    if (fillMode && config.activeRole === node.role) person.classList.add("is-viewing");
    person.innerHTML = `<span>${escapeHtml(node.name.slice(0, 1) || "?")}</span><strong>${escapeHtml(node.role)}</strong><small>${escapeHtml(node.name)}</small>`;
    if (allowRoleSwitch && node.role !== "Complete") {
      person.title = isCurrentPerson ? "目前檢視角色" : `以 ${node.name} 視角檢視`;
      person.addEventListener("click", () => switchRole(node));
    } else {
      person.disabled = node.role === "Complete";
      person.title = node.name;
    }
    flow.appendChild(person);
    if (index < nodes.length - 1) {
      const arrow = document.createElement("button");
      arrow.type = "button";
      arrow.className = "approval-arrow";
      arrow.innerHTML = "→<small>通知</small>";
      const mailKey = approvalFlowNotificationKey(index, nodes.length);
      arrow.title = "查看這個階段的通知內容";
      arrow.addEventListener("click", () => {
        if (!allowMailPreview) return;
        config.mailPreviewKey = config.mailPreviewKey === mailKey ? "" : mailKey;
        persistStructuredSeed();
        renderFrameBoard();
      });
      flow.appendChild(arrow);
    }
  });
  wrap.appendChild(flow);

  if (loops.length) {
    const loopPanel = document.createElement("div");
    loopPanel.className = "approval-delegation-loops";
    loopPanel.innerHTML = "<p class='meta'>委派回簽</p>";
    loops.forEach((loop) => {
      const row = document.createElement("div");
      row.className = "approval-delegation-loop";
      row.innerHTML = `
        <span class="approval-delegation-person">${escapeHtml(loop.delegator.slice(0, 1))}</span>
        <span class="approval-delegation-arrow">→ ${escapeHtml(loop.delegate)} →</span>
        <span class="approval-delegation-person is-return">${escapeHtml(loop.delegator.slice(0, 1))}</span>
        <small>${escapeHtml(loop.delegator)} 委派 ${escapeHtml(loop.delegate)}，完成後回簽</small>`;
      loopPanel.appendChild(row);
    });
    wrap.appendChild(loopPanel);
  }

  if (fillMode) {
    const hint = document.createElement("p");
    hint.className = "meta approval-flow-hint";
    hint.textContent = `目前視角：${config.activeRole}。點流程人頭可切換 Requester／Approver 檢視。`;
    wrap.appendChild(hint);
  }

  if (config.mailPreviewKey && allowMailPreview) {
    renderApprovalMailPreview(wrap, seed, config.mailPreviewKey);
  }
  return wrap;
}

function approvalColumnName(index) {
  let value = Number(index) + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function refreshApprovalFieldOptions(field) {
  refreshFieldOptionsFromFile(field);
}

function refreshFieldOptionsFromFile(field) {
  if (field.sourceType !== "file" || !field.sourceRows.length) return;
  const start = field.firstRowHeader ? 1 : 0;
  field.options = field.sourceRows
    .slice(start)
    .map((row) => String(row[field.sourceColumn] ?? "").trim())
    .filter(Boolean)
    .join(",");
}

async function importApprovalLookup(field, file) {
  await importFieldOptionsFromFile(field, file);
}

async function importFieldOptionsFromFile(field, file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rows = [];
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const text = await file.text();
    const separator = ext === "tsv" ? "\t" : ",";
    rows = text.split(/\r?\n/).filter(Boolean).map((line) => line.split(separator).map((cell) => cell.trim()));
  } else {
    if (!window.XLSX) throw new Error("Excel 解析器尚未載入，請稍後再試");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  }
  field.sourceName = file.name;
  field.sourceRows = rows.slice(0, 1000);
  field.sourceColumn = 0;
  refreshApprovalFieldOptions(field);
}

function renderApprovalQuestionnaire(board, seed, options = {}) {
  const {
    readonly = false,
    showActions = !readonly,
    showRoleBar = false,
    showFlow = !readonly,
    showMetrics = !readonly,
    preview = false,
    fillMode = false,
  } = options;
  const config = ensureApprovalModel(seed);
  if (showMetrics) {
    const metrics = document.createElement("div");
    metrics.className = "approval-metrics";
    [
      ["Current Approver", config.currentApprover],
      ["Current Level", String(config.currentLevel)],
      ["Status", config.status],
      ["Last Submit", config.lastSubmitDate ? formatWhen(config.lastSubmitDate) : "—"],
      ["Last Approval", config.lastApprovalDate ? formatWhen(config.lastApprovalDate) : "—"],
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      item.innerHTML = `<small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>`;
      metrics.appendChild(item);
    });
    board.appendChild(metrics);
  }
  if (showFlow) {
    board.appendChild(renderApprovalFlow(seed, {
      compact: true,
      allowRoleSwitch: true,
      allowMailPreview: true,
      fillMode,
    }));
  }

  if (showRoleBar || fillMode) {
    const roleBar = document.createElement("div");
    roleBar.className = "approval-role-bar";
    const roles = fillMode
      ? ["Requester", "Filler", ...config.stages.map((stage) => stage.name)]
      : ["Requester", "Filler", ...config.stages.map((stage) => stage.name), "CopyTo", "FYI", "Owner", "Admin"];
    roles.forEach((role) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn";
      button.classList.toggle("is-active", config.activeRole === role);
      button.textContent = role;
      button.addEventListener("click", () => {
        config.activeRole = role;
        const stage = config.stages.find((item) => item.name === role);
        if (stage) config.currentApprover = stage.people || stage.name;
        else if (role === "Requester") config.currentApprover = config.roles.Requester || "申請人";
        persistStructuredSeed();
        renderFrameBoard();
      });
      roleBar.appendChild(button);
    });
    board.appendChild(roleBar);
  }

  const form = document.createElement("form");
  form.className = `approval-questionnaire${preview ? " is-preview" : ""}`;
  form.noValidate = true;
  seed.formFields.forEach((field, index) => {
    const permission = resolveApprovalFieldPermission(config, field, { fillMode, preview, readonly });
    if (!preview && !permission.view) return;
    const card = document.createElement("label");
    card.className = "questionnaire-field";
    if (fillMode && !permission.edit && permission.view) card.classList.add("is-readonly");
    const number = document.createElement("span");
    number.className = "questionnaire-number";
    number.textContent = String(index + 1);
    const label = document.createElement("span");
    label.className = "questionnaire-label";
    label.textContent = `${field.label || "未命名欄位"}${permission?.required ? " *" : ""}`;
    card.append(number, label);
    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 4;
    } else if (field.type === "select" && !field.allowManual) {
      input = document.createElement("select");
      input.innerHTML = `<option value="">請選擇</option>${field.options.split(",").filter(Boolean).map((item) => `<option>${escapeHtml(item.trim())}</option>`).join("")}`;
    } else {
      input = document.createElement("input");
      input.type = "text";
      if (field.type === "select") input.setAttribute("list", `options-${field.id}`);
    }
    input.className = "questionnaire-input";
    input.value = config.answers[field.id] || "";
    input.readOnly = readonly || (fillMode && !permission.edit);
    input.disabled = readonly || (fillMode && !permission.edit);
    if (!readonly && !input.disabled) {
      input.addEventListener("input", () => {
        config.answers[field.id] = input.value;
        persistStructuredSeed();
      });
    }
    card.appendChild(input);
    if (field.type === "select" && field.allowManual) {
      const datalist = document.createElement("datalist");
      datalist.id = `options-${field.id}`;
      field.options.split(",").filter(Boolean).forEach((item) => {
        const option = document.createElement("option");
        option.value = item.trim();
        datalist.appendChild(option);
      });
      card.appendChild(datalist);
    }
    form.appendChild(card);
  });
  board.appendChild(form);

  if (!readonly && config.commentsEnabled && (fillMode ? isApproverRole(config.activeRole, config) || ["Requester", "Filler"].includes(config.activeRole) : true)) {
    const comment = document.createElement("label");
    comment.className = "questionnaire-field questionnaire-comment";
    comment.innerHTML = "<span class='questionnaire-label'>Comment</span>";
    const input = document.createElement("textarea");
    input.className = "questionnaire-input";
    input.placeholder = "補充說明或簽核意見…";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn";
    add.textContent = "加入 Comment";
    add.addEventListener("click", () => {
      if (!input.value.trim()) return;
      config.comments.push({ role: config.activeRole, text: input.value.trim(), when: new Date().toISOString() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    comment.append(input, add);
    board.appendChild(comment);
    config.comments.slice(-5).forEach((item) => {
      const commentItem = document.createElement("p");
      commentItem.className = "approval-comment-item";
      commentItem.textContent = `${item.role}－${formatWhen(item.when)}：${item.text}`;
      board.appendChild(commentItem);
    });
  }

  if (!showActions) return;
  const actions = document.createElement("div");
  actions.className = "approval-actions";
  const addAction = (label, className, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${className || ""}`.trim();
    button.textContent = label;
    button.addEventListener("click", handler);
    actions.appendChild(button);
  };
  const now = () => new Date().toISOString();
  const isRequesterSide = ["Requester", "Filler"].includes(config.activeRole);
  const isApproverSide = isApproverRole(config.activeRole, config);
  if (isRequesterSide) {
    addAction("Save 草稿", "", () => {
      config.status = "Draft";
      syncApprovalActiveRole(config);
      config.auditTrail.push({ action: "Save", role: config.activeRole, when: now() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    addAction("Submit 送出", "btn-primary", () => {
      config.status = "In Process";
      config.currentLevel = 2;
      config.currentApprover = config.stages[0]?.people || "Approver1";
      config.activeRole = config.stages[0]?.name || "Approver1";
      config.lastSubmitDate = now();
      config.auditTrail.push({ action: "Submit", role: config.activeRole, when: now() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    addAction("Call 這張單", "", () => {
      const targets = [
        config.currentApprover,
        ...config.stages.map((stage) => stage.people).filter(Boolean),
        config.roles.CopyTo,
        config.roles.Owner,
      ].flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean);
      const uniqueTargets = [...new Set(targets)];
      const selected = window.prompt(
        `Call 通知對象（逗號分隔，預設 Current Approver 與相關人）：\n${uniqueTargets.join("、")}`,
        uniqueTargets.slice(0, 3).join(", ")
      );
      if (selected === null) return;
      config.auditTrail.push({
        action: `Call → ${selected || uniqueTargets.join(", ")}`,
        role: config.activeRole,
        when: now(),
      });
      showToast("已建立 Call 通知紀錄（實際寄信需後端）", "info");
      persistStructuredSeed();
    });
  } else if (isApproverSide) {
    addAction("Approve", "approval-approve", () => {
      config.lastApprovalDate = now();
      config.currentLevel += 1;
      const next = config.stages[config.currentLevel - 2];
      config.currentApprover = next?.people || "完成";
      config.status = next ? "In Process" : "Approved";
      config.auditTrail.push({ action: "Approve", role: config.activeRole, when: now() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    addAction("Deny", "approval-deny", () => {
      config.status = "Denied";
      config.auditTrail.push({ action: "Deny", role: config.activeRole, when: now() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    addAction("Return", "", () => {
      const options = ["Requester", ...config.stages.slice(0, Math.max(0, config.currentLevel - 1)).map((stage) => stage.name)];
      const target = window.prompt(`退回到？\n可選：${options.join("、")}`, "Requester");
      if (!target) return;
      config.status = "Submitted";
      if (target === "Requester") {
        config.currentLevel = 0;
        config.currentApprover = config.roles.Requester || "申請人";
        config.activeRole = "Requester";
      } else {
        const stageIndex = config.stages.findIndex((stage) => stage.name === target);
        config.currentLevel = stageIndex + 2;
        config.currentApprover = config.stages[stageIndex]?.people || target;
        config.activeRole = target;
      }
      config.auditTrail.push({ action: `Return → ${target}`, role: config.activeRole, when: now() });
      persistStructuredSeed();
      renderFrameBoard();
    });
    addAction("Delegate", "", () => {
      const delegate = window.prompt("委派給誰？");
      if (!delegate) return;
      config.stages.splice(Math.max(0, config.currentLevel - 2), 0, {
        id: makeApprovalId("stage"),
        name: `${config.activeRole}_Delegate`,
        mode: "sequential",
        people: delegate,
        approvalRule: "all",
        delegatedFrom: config.activeRole,
        reminderDays: 2,
        timeoutAction: "wait",
      });
      config.auditTrail.push({ action: `Delegate ${config.activeRole} → ${delegate} → ${config.activeRole}`, role: config.activeRole, when: now() });
      config.currentApprover = delegate;
      config.activeRole = `${config.activeRole}_Delegate`;
      persistStructuredSeed();
      renderFrameBoard();
    });
  }
  board.appendChild(actions);
}

function renderApprovalTemplateInstances(board, seed) {
  const instances = listApprovalInstances(seed.id).sort((a, b) => {
    const aTime = a.approvalConfig?.lastSubmitDate || a.approvalConfig?.lastApprovalDate || "";
    const bTime = b.approvalConfig?.lastSubmitDate || b.approvalConfig?.lastApprovalDate || "";
    return bTime.localeCompare(aTime);
  });
  const section = document.createElement("section");
  section.className = "approval-instance-list";
  section.innerHTML = "<h3>由此範本建立的申請單</h3><p>範本只負責設定；實際填寫會複製成獨立申請單。</p>";
  const create = document.createElement("button");
  create.type = "button";
  create.className = "btn btn-primary";
  create.textContent = "＋ 建立申請單";
  create.addEventListener("click", () => {
    const instance = createApprovalInstance(seed);
    showToast(`已建立「${instance.title}」`, "ok");
    selectSeed(instance).catch((err) => setStatus(err.message || String(err)));
  });
  section.appendChild(create);
  if (!instances.length) {
    const empty = document.createElement("p");
    empty.className = "meta";
    empty.textContent = "尚無申請單。按上方按鈕從此範本複製一份開始填寫。";
    section.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "approval-instance-items";
    instances.forEach((instance) => {
      ensureApprovalModel(instance);
      const cfg = instance.approvalConfig;
      const item = document.createElement("li");
      item.className = "approval-instance-row";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "btn approval-instance-open";
      open.textContent = instance.title;
      open.addEventListener("click", () => {
        selectSeed(instance).catch((err) => setStatus(err.message || String(err)));
      });
      const meta = document.createElement("div");
      meta.className = "approval-instance-meta";
      const status = document.createElement("span");
      status.className = `approval-status approval-status-${String(cfg.status || "Draft").toLowerCase().replace(/\s+/g, "-")}`;
      status.textContent = cfg.status || "Draft";
      const dates = document.createElement("span");
      dates.className = "meta";
      const submit = cfg.lastSubmitDate ? formatWhen(cfg.lastSubmitDate) : "—";
      const approval = cfg.lastApprovalDate ? formatWhen(cfg.lastApprovalDate) : "—";
      dates.textContent = `送出 ${submit}｜簽核 ${approval}`;
      meta.append(status, dates);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "frame-remove approval-instance-delete";
      remove.title = "刪除此申請單";
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteApprovalInstance(instance.id);
        renderFrameBoard();
      });
      item.append(open, meta, remove);
      list.appendChild(item);
    });
    section.appendChild(list);
  }
  board.appendChild(section);
}

function renderApprovalFields(board, seed) {
  seed.formFields.forEach((field, index) => {
    const card = document.createElement("section");
    card.className = "approval-field-card";
    card.innerHTML = `
      <input class="field-label" value="${escapeHtml(field.label)}" placeholder="欄位名稱">
      <select class="field-type"><option value="text">單行文字</option><option value="textarea">多行文字</option><option value="select">下拉選單</option></select>
      <button type="button" class="frame-remove" title="刪除欄位">×</button>
      <div class="approval-source hidden">
        <label>選項來源<select class="source-type"><option value="manual">手動輸入</option><option value="file">CSV／Excel</option></select></label>
        <label class="manual-options">選項<input value="${escapeHtml(field.options)}" placeholder="選項，用逗號分隔"></label>
        <div class="file-options hidden">
          <label>參考檔案<input class="source-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls"></label>
          <span class="source-name">${escapeHtml(field.sourceName || "尚未選擇檔案")}</span>
          <label>使用欄位<select class="source-column"></select></label>
          <label><input class="source-header" type="checkbox"> 第一列是標題，不列入選項</label>
          <label><input class="source-manual" type="checkbox"> 允許使用者手動輸入</label>
        </div>
      </div>`;
    const label = card.querySelector(".field-label");
    const type = card.querySelector(".field-type");
    const source = card.querySelector(".approval-source");
    const sourceType = card.querySelector(".source-type");
    const manual = card.querySelector(".manual-options");
    const manualInput = manual.querySelector("input");
    const fileOptions = card.querySelector(".file-options");
    const column = card.querySelector(".source-column");
    const header = card.querySelector(".source-header");
    const allowManual = card.querySelector(".source-manual");
    const renderSource = () => {
      source.classList.toggle("hidden", type.value !== "select");
      manual.classList.toggle("hidden", sourceType.value !== "manual");
      fileOptions.classList.toggle("hidden", sourceType.value !== "file");
      const count = Math.max(1, ...field.sourceRows.map((row) => row.length));
      column.innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i}">${approvalColumnName(i)}${field.firstRowHeader && field.sourceRows[0]?.[i] ? `－${escapeHtml(String(field.sourceRows[0][i]))}` : ""}</option>`).join("");
      column.value = String(field.sourceColumn);
    };
    type.value = field.type;
    sourceType.value = field.sourceType;
    header.checked = field.firstRowHeader;
    allowManual.checked = field.allowManual;
    renderSource();
    label.addEventListener("input", () => { field.label = label.value; persistStructuredSeed(); });
    type.addEventListener("change", () => { field.type = type.value; renderSource(); persistStructuredSeed(); });
    sourceType.addEventListener("change", () => { field.sourceType = sourceType.value; renderSource(); persistStructuredSeed(); });
    manualInput.addEventListener("input", () => { field.options = manualInput.value; persistStructuredSeed(); });
    card.querySelector(".source-file").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await importApprovalLookup(field, file);
        persistStructuredSeed();
        renderFrameBoard();
      } catch (err) {
        setStatus(err.message || String(err));
      }
    });
    column.addEventListener("change", () => {
      field.sourceColumn = Number(column.value);
      refreshApprovalFieldOptions(field);
      persistStructuredSeed();
    });
    header.addEventListener("change", () => {
      field.firstRowHeader = header.checked;
      refreshApprovalFieldOptions(field);
      renderSource();
      persistStructuredSeed();
    });
    allowManual.addEventListener("change", () => { field.allowManual = allowManual.checked; persistStructuredSeed(); });
    card.querySelector(".frame-remove").addEventListener("click", () => {
      seed.formFields.splice(index, 1);
      seed.approvalConfig.permissions = seed.approvalConfig.permissions.filter((item) => item.fieldId !== field.id);
      persistStructuredSeed();
      renderFrameBoard();
    });
    board.appendChild(card);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn form-add";
  add.textContent = "＋ 新增欄位";
  add.addEventListener("click", () => {
    seed.formFields.push({ id: makeApprovalId("field"), label: "", type: "text", options: "", sourceType: "manual", sourceRows: [] });
    ensureApprovalModel(seed);
    persistStructuredSeed();
    renderFrameBoard();
  });
  board.appendChild(add);
}

function renderApprovalWorkflow(board, seed) {
  const config = ensureApprovalModel(seed);
  const roles = document.createElement("section");
  roles.className = "approval-config-section";
  roles.innerHTML = "<h3>角色</h3><p>預設只能看與自己相關的申請；Admin 可看此 SEED 全部申請，Owner 可設計欄位、權限與流程。</p>";
  [["Requester", "申請人"], ["Filler", "填寫人"], ["CopyTo", "送出時通知"], ["FYI", "完成後通知"], ["Admin", "Admin"], ["Owner", "Owner"]].forEach(([key, label]) => {
    const row = document.createElement("label");
    row.className = "structured-row";
    row.innerHTML = `<span>${label}</span>`;
    const input = document.createElement("input");
    input.value = config.roles[key] || "";
    input.placeholder = key === "CopyTo" || key === "FYI" ? "多人用逗號分隔" : "預設人員或角色";
    input.addEventListener("input", () => { config.roles[key] = input.value; persistStructuredSeed(); });
    row.appendChild(input);
    roles.appendChild(row);
  });
  const commentToggle = document.createElement("label");
  commentToggle.className = "approval-inline-check";
  commentToggle.innerHTML = `<input type="checkbox" ${config.commentsEnabled ? "checked" : ""}> 允許每位簽核者填寫 Comment`;
  commentToggle.querySelector("input").addEventListener("change", (e) => {
    config.commentsEnabled = e.target.checked;
    persistStructuredSeed();
  });
  roles.appendChild(commentToggle);
  board.append(roles, renderApprovalFlow(seed, { allowRoleSwitch: true, allowMailPreview: true }));

  config.stages.forEach((stage, index) => {
    const card = document.createElement("section");
    card.className = "approval-stage-card";
    card.innerHTML = `
      <strong>Level ${index + 1}</strong>
      <input class="stage-name" value="${escapeHtml(stage.name)}" placeholder="Approver1">
      <input class="stage-people" value="${escapeHtml(stage.people || "")}" placeholder="簽核者，多人用逗號">
      <select class="stage-mode"><option value="sequential">依序簽核</option><option value="parallel">平行簽核</option></select>
      <select class="stage-rule"><option value="all">全部同意才通過</option><option value="any">一人同意即通過</option></select>
      <label><input class="stage-replace" type="checkbox"> 申請人可替換預設人</label>
      <label><input class="stage-blank" type="checkbox"> 允許此階段為空</label>
      <label>幾天後 Reminder<input class="stage-reminder" type="number" min="0" value="${Number(stage.reminderDays) || 0}"></label>
      <label>超時動作<select class="stage-timeout"><option value="wait">繼續等待</option><option value="approve">自動 Approve</option><option value="deny">自動 Deny</option></select></label>
      <button type="button" class="frame-remove" title="刪除階段">×</button>`;
    card.querySelector(".stage-mode").value = stage.mode || "sequential";
    card.querySelector(".stage-rule").value = stage.approvalRule || "all";
    card.querySelector(".stage-timeout").value = stage.timeoutAction || "wait";
    card.querySelector(".stage-replace").checked = stage.replaceable !== false;
    card.querySelector(".stage-blank").checked = Boolean(stage.allowBlank);
    const bind = (selector, key, convert = (value) => value) => {
      card.querySelector(selector).addEventListener("input", (e) => {
        stage[key] = convert(e.target.type === "checkbox" ? e.target.checked : e.target.value);
        persistStructuredSeed();
      });
    };
    bind(".stage-name", "name");
    bind(".stage-people", "people");
    bind(".stage-mode", "mode");
    bind(".stage-rule", "approvalRule");
    bind(".stage-replace", "replaceable");
    bind(".stage-blank", "allowBlank");
    bind(".stage-reminder", "reminderDays", Number);
    bind(".stage-timeout", "timeoutAction");
    card.querySelector(".frame-remove").addEventListener("click", () => {
      config.stages.splice(index, 1);
      persistStructuredSeed();
      renderFrameBoard();
    });
    board.appendChild(card);
  });
  const addStage = document.createElement("button");
  addStage.type = "button";
  addStage.className = "btn";
  addStage.textContent = "＋ 新增簽核階段";
  addStage.addEventListener("click", () => {
    const number = config.stages.length + 1;
    config.stages.push({ id: makeApprovalId("stage"), name: `Approver${number}`, mode: "sequential", people: "", approvalRule: "all", replaceable: true, allowBlank: false, reminderDays: 2, timeoutAction: "wait" });
    persistStructuredSeed();
    renderFrameBoard();
  });
  board.appendChild(addStage);

  const delegation = document.createElement("section");
  delegation.className = "approval-config-section";
  delegation.innerHTML = "<h3>全域代理</h3><p>指定期間內，該人所有簽核自動委派給代理人；代理人 Approve 視同本人 Approve。</p>";
  const delegateRow = document.createElement("div");
  delegateRow.className = "approval-delegate-row";
  delegateRow.innerHTML = "<input placeholder='原簽核人'><input placeholder='代理人'><input type='date'><input type='date'><button type='button' class='btn'>加入代理</button>";
  delegateRow.querySelector("button").addEventListener("click", () => {
    const values = [...delegateRow.querySelectorAll("input")].map((input) => input.value);
    if (!values[0] || !values[1]) return;
    config.delegations.push({ person: values[0], proxy: values[1], from: values[2], to: values[3] });
    persistStructuredSeed();
    renderFrameBoard();
  });
  delegation.appendChild(delegateRow);
  config.delegations.forEach((item) => {
    const row = document.createElement("p");
    row.className = "meta";
    row.textContent = `${item.person} → ${item.proxy}（${item.from || "立即"}～${item.to || "未設定"}）`;
    delegation.appendChild(row);
  });
  board.appendChild(delegation);
}

function renderApprovalPermissions(board, seed) {
  const config = ensureApprovalModel(seed);
  const note = document.createElement("p");
  note.className = "approval-help";
  note.textContent = "Owner 可用表格大量設定每個欄位對各角色是否可看、可編輯、必填，以及條件顯示或 lookup 來源。Admin 永遠可看所有申請。";
  const table = document.createElement("div");
  table.className = "approval-permission-table";
  table.innerHTML = "<div class='permission-head'><b>欄位</b><b>角色</b><b>可看</b><b>可編輯</b><b>必填</b><b>條件／Lookup</b></div>";
  config.permissions.forEach((permission) => {
    const field = seed.formFields.find((item) => item.id === permission.fieldId);
    if (!field) return;
    const row = document.createElement("div");
    row.className = "permission-row";
    row.innerHTML = `
      <span>${escapeHtml(field.label || "未命名欄位")}</span>
      <span>${escapeHtml(permission.role)}</span>
      <input class="permission-view" type="checkbox" ${permission.view ? "checked" : ""}>
      <input class="permission-edit" type="checkbox" ${permission.edit ? "checked" : ""}>
      <input class="permission-required" type="checkbox" ${permission.required ? "checked" : ""}>
      <input class="permission-lookup" value="${escapeHtml(permission.lookup || permission.condition || "")}" placeholder="條件或 CSV／Excel lookup">`;
    [[".permission-view", "view"], [".permission-edit", "edit"], [".permission-required", "required"]].forEach(([selector, key]) => {
      row.querySelector(selector).addEventListener("change", (e) => { permission[key] = e.target.checked; persistStructuredSeed(); });
    });
    row.querySelector(".permission-lookup").addEventListener("input", (e) => { permission.lookup = e.target.value; persistStructuredSeed(); });
    table.appendChild(row);
  });
  board.append(note, table);
}

function renderApprovalNotifications(board, seed) {
  const config = ensureApprovalModel(seed);
  const overview = document.createElement("p");
  overview.className = "approval-help";
  overview.textContent = "流程箭頭代表通知。可預覽尚未寄出的標題、內容與時間；固定前後段由 Owner 鎖定，中間段可讓 Requester 編輯。實際寄信與排程需後端服務。";
  board.appendChild(overview);
  Object.entries(config.notifications).forEach(([key, notification]) => {
    const card = document.createElement("section");
    card.className = "approval-notification-card";
    card.innerHTML = `
      <h3>${escapeHtml(notification.label || key)}</h3>
      <label>Mail 標題<input class="mail-subject" value="${escapeHtml(notification.subject || "")}"></label>
      <label>固定前段<textarea class="mail-prefix">${escapeHtml(notification.prefix || "")}</textarea></label>
      <label>可變更內容<textarea class="mail-editable">${escapeHtml(notification.editable || "")}</textarea></label>
      <label>固定後段<textarea class="mail-suffix">${escapeHtml(notification.suffix || "")}</textarea></label>
      <label>幾天後寄 Reminder<input class="mail-reminder" type="number" min="0" value="${Number(notification.reminderDays) || 0}"></label>
      <p class="meta">預覽：${escapeHtml(notification.subject || "")}｜${escapeHtml(notification.prefix || "")}${escapeHtml(notification.editable || "")}${escapeHtml(notification.suffix || "")}</p>`;
    [[".mail-subject", "subject"], [".mail-prefix", "prefix"], [".mail-editable", "editable"], [".mail-suffix", "suffix"], [".mail-reminder", "reminderDays"]].forEach(([selector, property]) => {
      card.querySelector(selector).addEventListener("input", (e) => {
        notification[property] = property === "reminderDays" ? Number(e.target.value) : e.target.value;
        persistStructuredSeed();
      });
    });
    board.appendChild(card);
  });
}

function appendApprovalDesignerField(seed, type = "text") {
  const field = {
    id: makeApprovalId("field"),
    label: "",
    type,
    options: "",
    sourceType: "manual",
    sourceName: "",
    sourceRows: [],
    sourceColumn: 0,
    firstRowHeader: true,
    allowManual: false,
  };
  seed.formFields.push(field);
  ensureApprovalModel(seed);
  persistStructuredSeed();
  renderFrameBoard();
}

function bindApprovalDesignerField(card, seed, field, index) {
  const label = card.querySelector(".designer-label");
  const type = card.querySelector(".designer-type");
  const source = card.querySelector(".approval-source");
  const sourceType = card.querySelector(".source-type");
  const manual = card.querySelector(".manual-options");
  const manualInput = manual?.querySelector("input");
  const fileOptions = card.querySelector(".file-options");
  const column = card.querySelector(".source-column");
  const header = card.querySelector(".source-header");
  const allowManual = card.querySelector(".source-manual");
  const preview = card.querySelector(".designer-preview");
  const renderSource = () => {
    if (!source) return;
    source.classList.toggle("hidden", type.value !== "select");
    manual?.classList.toggle("hidden", sourceType.value !== "manual");
    fileOptions?.classList.toggle("hidden", sourceType.value !== "file");
    const count = Math.max(1, ...field.sourceRows.map((row) => row.length));
    if (column) {
      column.innerHTML = Array.from({ length: count }, (_, i) => `<option value="${i}">${approvalColumnName(i)}${field.firstRowHeader && field.sourceRows[0]?.[i] ? `－${escapeHtml(String(field.sourceRows[0][i]))}` : ""}</option>`).join("");
      column.value = String(field.sourceColumn);
    }
  };
  const renderPreview = () => {
    if (!preview) return;
    preview.innerHTML = "";
    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.placeholder = "填寫者會在這裡輸入多行文字";
    } else if (field.type === "select" && !field.allowManual) {
      input = document.createElement("select");
      input.innerHTML = `<option value="">請選擇</option>${field.options.split(",").filter(Boolean).map((item) => `<option>${escapeHtml(item.trim())}</option>`).join("")}`;
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.placeholder = field.type === "select" ? "可選清單或手動輸入" : "填寫者會在這裡輸入";
    }
    input.className = "questionnaire-input";
    input.disabled = true;
    preview.appendChild(input);
  };
  type.value = field.type;
  if (sourceType) sourceType.value = field.sourceType;
  if (header) header.checked = field.firstRowHeader;
  if (allowManual) allowManual.checked = field.allowManual;
  renderSource();
  renderPreview();
  label.addEventListener("input", () => { field.label = label.value; persistStructuredSeed(); });
  type.addEventListener("change", () => {
    field.type = type.value;
    renderSource();
    renderPreview();
    persistStructuredSeed();
  });
  sourceType?.addEventListener("change", () => { field.sourceType = sourceType.value; renderSource(); persistStructuredSeed(); });
  manualInput?.addEventListener("input", () => { field.options = manualInput.value; renderPreview(); persistStructuredSeed(); });
  card.querySelector(".source-file")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importApprovalLookup(field, file);
      renderSource();
      renderPreview();
      persistStructuredSeed();
      renderFrameBoard();
    } catch (err) {
      setStatus(err.message || String(err));
    }
  });
  column?.addEventListener("change", () => {
    field.sourceColumn = Number(column.value);
    refreshApprovalFieldOptions(field);
    renderPreview();
    persistStructuredSeed();
  });
  header?.addEventListener("change", () => {
    field.firstRowHeader = header.checked;
    refreshApprovalFieldOptions(field);
    renderSource();
    persistStructuredSeed();
  });
  allowManual?.addEventListener("change", () => { field.allowManual = allowManual.checked; renderPreview(); persistStructuredSeed(); });
  card.querySelector(".frame-remove")?.addEventListener("click", () => {
    seed.formFields.splice(index, 1);
    seed.approvalConfig.permissions = seed.approvalConfig.permissions.filter((item) => item.fieldId !== field.id);
    persistStructuredSeed();
    renderFrameBoard();
  });
}

function renderApprovalDesignerField(board, seed, field, index) {
  const card = document.createElement("section");
  card.className = "questionnaire-field approval-designer-field";
  card.innerHTML = `
    <div class="approval-designer-field-head">
      <span class="questionnaire-number">${index + 1}</span>
      <input class="designer-label questionnaire-input" value="${escapeHtml(field.label)}" placeholder="題目名稱，例如：申請事由">
      <select class="designer-type questionnaire-input">
        <option value="text">單行文字</option>
        <option value="textarea">多行文字</option>
        <option value="select">下拉選單</option>
      </select>
      <button type="button" class="frame-remove" title="刪除此題">×</button>
    </div>
    <div class="approval-source hidden">
      <label>選項來源<select class="source-type"><option value="manual">手動輸入</option><option value="file">CSV／Excel</option></select></label>
      <label class="manual-options">選項<input value="${escapeHtml(field.options)}" placeholder="選項，用逗號分隔"></label>
      <div class="file-options hidden">
        <label>參考檔案<input class="source-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls"></label>
        <span class="source-name">${escapeHtml(field.sourceName || "尚未選擇檔案")}</span>
        <label>使用欄位<select class="source-column"></select></label>
        <label><input class="source-header" type="checkbox"> 第一列是標題，不列入選項</label>
        <label><input class="source-manual" type="checkbox"> 允許使用者手動輸入</label>
      </div>
    </div>
    <div class="designer-preview" aria-hidden="true"></div>`;
  bindApprovalDesignerField(card, seed, field, index);
  board.appendChild(card);
}

function renderApprovalFormDesigner(board, seed) {
  const intro = document.createElement("p");
  intro.className = "approval-help";
  intro.textContent = "像問卷一樣設計欄位。每題會依序顯示給填寫者；下方可加入單行、多行或下拉選單。";
  board.appendChild(intro);

  const form = document.createElement("div");
  form.className = "approval-form-designer";
  if (!seed.formFields.length) {
    const empty = document.createElement("p");
    empty.className = "approval-designer-empty meta";
    empty.textContent = "還沒有題目。從下方選一種欄位類型開始設計。";
    form.appendChild(empty);
  }
  seed.formFields.forEach((field, index) => renderApprovalDesignerField(form, seed, field, index));
  board.appendChild(form);

  const addBar = document.createElement("div");
  addBar.className = "approval-designer-add";
  [
    ["text", "＋ 單行文字"],
    ["textarea", "＋ 多行文字"],
    ["select", "＋ 下拉選單"],
  ].forEach(([type, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = label;
    button.addEventListener("click", () => appendApprovalDesignerField(seed, type));
    addBar.appendChild(button);
  });
  board.appendChild(addBar);

  const instances = document.createElement("section");
  instances.className = "approval-designer-instances";
  const create = document.createElement("button");
  create.type = "button";
  create.className = "btn btn-primary";
  create.textContent = "＋ 建立申請單（試填）";
  create.addEventListener("click", () => {
    const instance = createApprovalInstance(seed);
    showToast(`已建立「${instance.title}」`, "ok");
    selectSeed(instance).catch((err) => setStatus(err.message || String(err)));
  });
  instances.appendChild(create);
  board.appendChild(instances);

  const advanced = document.createElement("details");
  advanced.className = "approval-advanced";
  advanced.innerHTML = "<summary>進階設定（流程、權限、通知）</summary>";
  const advancedBody = document.createElement("div");
  advancedBody.className = "approval-advanced-body";
  renderApprovalWorkflow(advancedBody, seed);
  renderApprovalPermissions(advancedBody, seed);
  renderApprovalNotifications(advancedBody, seed);
  renderApprovalTemplateInstances(advancedBody, seed);
  advanced.appendChild(advancedBody);
  board.appendChild(advanced);
}

function renderApprovalTemplateEditor(board) {
  const seed = state.current;
  ensureApprovalModel(seed);
  board.className = "prose structured-editor approval-editor approval-template-editor";
  board.classList.toggle("a4-view", state.docMode === "a4");
  board.innerHTML = "";
  if (state.docMode === "a4") {
    renderSeedHeading(board, false);
    const property = document.createElement("p");
    property.className = "template-property";
    property.textContent = "版型：簽核範本（問卷預覽）";
    board.appendChild(property);
    renderApprovalQuestionnaire(board, seed, { readonly: true, preview: true, showActions: false, showRoleBar: false, showFlow: false, showMetrics: false });
    return;
  }
  renderSeedHeading(board, true);
  const property = document.createElement("p");
  property.className = "template-property";
  property.textContent = "版型：簽核範本（問卷設計）";
  board.append(property);
  renderApprovalFormDesigner(board, seed);
}

function renderApprovalInstanceEditor(board) {
  const seed = state.current;
  ensureApprovalModel(seed);
  const template = state.seeds.find((item) => item.id === seed.approvalTemplateId);
  board.className = "prose structured-editor approval-editor approval-instance-editor";
  board.classList.toggle("a4-view", state.docMode === "a4");
  board.innerHTML = "";
  renderSeedHeading(board, state.docMode !== "a4");
  const head = document.createElement("div");
  head.className = "approval-instance-head";
  const property = document.createElement("p");
  property.className = "template-property";
  property.textContent = `版型：簽核申請單${template ? `（來自「${template.title}」）` : ""}`;
  head.appendChild(property);
  if (template) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn";
    back.textContent = "← 回到範本";
    back.addEventListener("click", () => {
      selectSeed(template).catch((err) => setStatus(err.message || String(err)));
    });
    head.appendChild(back);
  }
  board.appendChild(head);
  const questionnaireOptions = {
    readonly: state.docMode === "a4",
    showActions: state.docMode !== "a4",
    showRoleBar: false,
    showFlow: true,
    showMetrics: true,
    fillMode: state.docMode !== "a4",
  };
  renderApprovalQuestionnaire(board, seed, questionnaireOptions);
}

function renderApprovalEditor(board) {
  if (isApprovalInstance(state.current)) {
    renderApprovalInstanceEditor(board);
    return;
  }
  renderApprovalTemplateEditor(board);
}

function renderLivePreview(seed) {
  const preview = document.createElement("section");
  preview.className = "live-preview";
  const heading = document.createElement("div");
  heading.className = "live-heading";
  const live = document.createElement("span");
  live.className = "live-badge";
  live.textContent = "LIVE";
  const title = document.createElement("h2");
  title.textContent = seed.title || "未命名討論";
  const subtitle = document.createElement("p");
  subtitle.textContent = seed.subtitle || "即時討論";
  heading.append(live, title, subtitle);
  const content = document.createElement("div");
  content.className = "live-main-content";
  content.textContent = seed.liveContent || "在編輯區輸入要呈現在截圖中的主要文字";
  const comments = document.createElement("div");
  comments.className = "live-comments";
  seed.messages.slice(-4).forEach((message) => {
    const item = document.createElement("article");
    const name = document.createElement("strong");
    name.textContent = message.name || "匿名";
    const text = document.createElement("span");
    text.textContent = message.text;
    item.append(name, text);
    comments.appendChild(item);
  });
  preview.append(heading, content, comments);
  return preview;
}

function renderDiscussionEditor(board) {
  const seed = state.current;
  seed.messages = Array.isArray(seed.messages) ? seed.messages : [];
  seed.liveContent = seed.liveContent || "";
  board.className = "prose discussion-editor";
  board.classList.toggle("a4-view", state.docMode === "a4");
  board.innerHTML = "";
  if (state.docMode === "a4") {
    board.appendChild(renderLivePreview(seed));
    return;
  }

  renderSeedHeading(board, true);
  const property = document.createElement("p");
  property.className = "template-property";
  property.textContent = "版型：討論直播截圖";
  const contentLabel = document.createElement("label");
  contentLabel.className = "live-content-editor";
  contentLabel.innerHTML = "<span>畫面主要文字</span>";
  const contentInput = document.createElement("textarea");
  contentInput.placeholder = "輸入希望顯示在截圖中的文字…";
  contentInput.value = seed.liveContent;
  contentInput.addEventListener("input", () => {
    seed.liveContent = contentInput.value;
    persistStructuredSeed();
    const currentPreview = board.querySelector(".live-preview");
    currentPreview?.replaceWith(renderLivePreview(seed));
  });
  contentLabel.appendChild(contentInput);
  board.append(property, contentLabel, renderLivePreview(seed));

  const compose = document.createElement("form");
  compose.className = "chat-compose";
  compose.innerHTML = "<input name='name' placeholder='評論者' maxlength='30'><textarea name='message' placeholder='新增一則畫面評論…' required></textarea><button class='btn btn-primary' type='submit'>加入評論</button>";
  compose.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(compose);
    const text = String(data.get("message") || "").trim();
    if (!text) return;
    seed.messages.push({
      name: String(data.get("name") || "").trim() || "你",
      text,
      when: new Date().toISOString(),
    });
    persistStructuredSeed();
    renderFrameBoard();
  });
  board.appendChild(compose);
}

function safeFileName(name) {
  return String(name || "SEED").replace(/[\\/:*?"<>|]+/g, "-").trim() || "SEED";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openOriginalDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("seed-documents", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("originals")) {
        request.result.createObjectStore("originals");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeOriginalDocument(seedId, record) {
  const db = await openOriginalDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("originals", "readwrite");
    tx.objectStore("originals").put(record, seedId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadOriginalDocument(seedId) {
  if (!seedId) return null;
  const db = await openOriginalDb();
  const record = await new Promise((resolve, reject) => {
    const request = db.transaction("originals", "readonly").objectStore("originals").get(seedId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}

async function extractPdfText(buffer) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@latest/build/pdf.worker.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n\n");
}

async function extractDocumentText(file, buffer) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "docx") {
    if (!window.mammoth) throw new Error("Word 解析元件尚未載入，請確認網路後重試");
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }
  if (ext === "pdf") return extractPdfText(buffer);
  if (["txt", "md", "csv", "tsv", "json"].includes(ext)) {
    return new TextDecoder("utf-8").decode(buffer);
  }
  throw new Error("目前支援 Word .docx、PDF、TXT、Markdown、CSV、TSV、JSON");
}

async function importDocumentFile(file) {
  if (!state.current || !file) return;
  setStatus(`正在匯入 ${file.name}…`);
  const buffer = await file.arrayBuffer();
  const text = (await extractDocumentText(file, buffer)).trim();
  state.current.seedType = "document";
  state.frames = textToFrames(text);
  state.workingText = framesToText(state.frames);
  state.importedText = state.workingText;
  if (!state.current.subtitle) state.current.subtitle = `匯入自 ${file.name}`;
  state.importedOriginal = {
    name: file.name,
    type: file.type || "application/octet-stream",
    bytes: buffer,
    importedText: state.importedText,
    seedTitle: state.current.title,
    seedSubtitle: state.current.subtitle || "",
  };
  await storeOriginalDocument(state.current.id, state.importedOriginal);
  saveSeedMetadata(state.current);
  if (state.current.localOnly) saveSeedTrayState();
  localStorage.setItem(`seed-draft:${state.current.id}`, state.workingText);
  await setDocMode("edit");
  showToast(`已把 ${file.name} 轉成 SEED 文字；原檔已保留`, "ok");
}

function exportWord() {
  const title = state.current?.title || "SEED";
  const body = $("read-body").innerText
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`;
  downloadBlob(
    new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }),
    `${safeFileName(title)}.doc`
  );
}

function exportImage() {
  const title = state.current?.title || "SEED";
  const canvas = document.createElement("canvas");
  if (state.current?.seedType === "discussion") {
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#173c31");
    gradient.addColorStop(1, "#071713");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f04f45";
    ctx.fillRect(72, 54, 82, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "700 19px system-ui, sans-serif";
    ctx.fillText("LIVE", 90, 78);
    ctx.font = "700 46px system-ui, sans-serif";
    ctx.fillText(title, 72, 145);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "24px system-ui, sans-serif";
    ctx.fillText(state.current.subtitle || "即時討論", 72, 182);

    const wrap = (text, maxWidth) => {
      const lines = [];
      String(text || "").split("\n").forEach((raw) => {
        let line = "";
        Array.from(raw).forEach((char) => {
          if (ctx.measureText(line + char).width > maxWidth && line) {
            lines.push(line);
            line = char;
          } else {
            line += char;
          }
        });
        lines.push(line);
      });
      return lines;
    };
    ctx.fillStyle = "#fff";
    let contentSize = 32;
    let contentLines = [];
    do {
      ctx.font = `${contentSize}px system-ui, sans-serif`;
      contentLines = wrap(state.current.liveContent || "", 1080);
      contentSize -= 1;
    } while (contentLines.length * (contentSize + 8) > 280 && contentSize > 15);
    ctx.font = `${contentSize}px system-ui, sans-serif`;
    contentLines.forEach((line, index) => ctx.fillText(line, 72, 245 + index * (contentSize + 8)));

    const comments = (state.current.messages || []).slice(-4);
    const commentTop = 690 - comments.length * 50;
    comments.forEach((message, index) => {
      const y = commentTop + index * 50;
      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.fillRect(72, y - 29, 1136, 40);
      const commentText = `${message.name || "匿名"}：${message.text || ""}`;
      let commentSize = 19;
      ctx.font = `700 ${commentSize}px system-ui, sans-serif`;
      while (ctx.measureText(commentText).width > 1100 && commentSize > 12) {
        commentSize -= 1;
        ctx.font = `700 ${commentSize}px system-ui, sans-serif`;
      }
      ctx.fillStyle = "#9fe1c6";
      ctx.fillText(`${message.name || "匿名"}：`, 88, y - 2);
      const nameWidth = ctx.measureText(`${message.name || "匿名"}：`).width;
      ctx.fillStyle = "#fff";
      ctx.font = `${commentSize}px system-ui, sans-serif`;
      ctx.fillText(String(message.text || ""), 88 + nameWidth, y - 2);
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${safeFileName(title)}.png`);
    }, "image/png");
    return;
  }
  const width = 1240;
  const padding = 110;
  const lineHeight = 38;
  const ctx = canvas.getContext("2d");
  ctx.font = "28px system-ui, sans-serif";
  const wrapped = [];
  for (const rawLine of $("read-body").innerText.split("\n")) {
    if (!rawLine) {
      wrapped.push("");
      continue;
    }
    let line = "";
    for (const char of Array.from(rawLine)) {
      const next = line + char;
      if (ctx.measureText(next).width > width - padding * 2 && line) {
        wrapped.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    wrapped.push(line);
  }
  canvas.width = width;
  canvas.height = Math.max(1754, padding * 2 + 90 + wrapped.length * lineHeight);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#171717";
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillText(title, padding, padding);
  ctx.font = "28px system-ui, sans-serif";
  wrapped.forEach((line, index) => ctx.fillText(line, padding, padding + 85 + index * lineHeight));
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${safeFileName(title)}.png`);
  }, "image/png");
}

async function exportA4(kind) {
  if (state.docMode !== "a4") return;
  syncWorkingFromFrames();
  const original = state.importedOriginal || (await loadOriginalDocument(state.current?.id));
  const unchanged =
    original &&
    state.workingText === original.importedText &&
    state.current?.title === original.seedTitle &&
    (state.current?.subtitle || "") === (original.seedSubtitle || "");
  const ext = original?.name?.split(".").pop()?.toLowerCase();
  if (unchanged && ((kind === "word" && ext === "docx") || (kind === "pdf" && ext === "pdf"))) {
    downloadBlob(new Blob([original.bytes], { type: original.type }), original.name);
    showToast("內容未修改，已匯出完全相同的原檔", "ok");
    return;
  }
  if (kind === "pdf") {
    if (original && ext === "pdf") showToast("內容已修改，PDF 將依目前文件重新產生", "info");
    window.print();
  } else if (kind === "word") {
    if (original && ext === "docx") showToast("內容已修改，Word 將依目前文件重新產生", "info");
    exportWord();
  } else if (kind === "image") {
    exportImage();
  }
}

function deleteFrame(index, silent = false) {
  if (!state.frames[index]) return;
  state.frames.splice(index, 1);
  syncWorkingFromFrames();
  renderFrameBoard();
  scheduleContentAutosave();
  if (!silent) showToast("已刪除這一格", "ok");
}

function setViewMode(text) {
  state.editing = false;
  state.frames = textToFrames(text);
  $("read-body").classList.remove("hidden");
  $("edit-body").classList.add("hidden");
  renderFrameBoard();
}

function setEditMode(text) {
  state.editing = true;
  state.docMode = "edit";
  if (isPersonCardDocument(state.current)) {
    ensurePersonCardModel(state.current);
    state.frames = [];
    state.workingText = personCardToText(state.current);
  } else {
    state.frames = textToFrames(text);
    state.workingText = text;
  }
  $("read-body").classList.remove("hidden");
  $("edit-body").classList.add("hidden");
  $("edit-body").value = isPersonCardDocument(state.current) ? state.workingText : text;
  $("export-bar")?.classList.add("hidden");
  renderFrameBoard();
  updateModeChips();
}

function visibilityLabel() {
  if (state.map.kind === "community") return "社群";
  return state.map.visibility === "private" ? "私人" : "公開";
}

function loadRecentPaths() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_PATH_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentPaths(list) {
  localStorage.setItem(RECENT_PATH_KEY, JSON.stringify((list || []).slice(0, 5)));
}

function currentPathEntry() {
  const steps = buildPathSteps();
  return {
    key: steps.map((s) => s.key).join("/"),
    label: steps.map((s) => s.label).join(" › "),
    panel: state.panel,
    seedId: state.current?.id || null,
    at: new Date().toISOString(),
  };
}

function pushRecentPath() {
  const entry = currentPathEntry();
  if (!entry.key || entry.key === "list") return;
  const list = loadRecentPaths().filter((x) => x.key !== entry.key);
  list.unshift(entry);
  saveRecentPaths(list);
}

function goRecentPath(entry) {
  if (!entry) return;
  if (entry.seedId) {
    const seed = state.seeds.find((s) => s.id === entry.seedId);
    if (seed) {
      selectSeed(seed).catch((err) => setStatus(err.message || String(err)));
      return;
    }
  }
  showPanel("list");
}

function toggleVisibilityPresentation() {
  if (state.map.kind === "community") {
    showToast("社群版沒有公開／私人切換（展示用）", "info");
    return;
  }
  state.map.visibility = state.map.visibility === "private" ? "public" : "private";
  updateSyncUi();
  scheduleLayoutAutosave();
  showToast(
    state.map.visibility === "private" ? "已標成私人（展示用）" : "已標成公開（展示用）",
    "ok"
  );
}

function updateModeChips() {
  const wrap = $("mode-chips");
  if (!wrap) return;
  const show = state.panel !== "list" && !!state.current;
  wrap.classList.toggle("hidden", !show);
  const mode =
    state.panel === "diff" || state.panel === "history"
      ? "diff"
      : state.docMode === "a4"
        ? "a4"
        : "edit";
  $("edit-actions")?.classList.toggle(
    "hidden",
    !show || mode !== "edit" || state.panel !== "read"
  );
  wrap.querySelectorAll(".mode-chip").forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-active", on);
  });
}

async function setDocMode(mode) {
  if (!state.current) {
    showPanel("list");
    return;
  }
  if (mode === "save") {
    await saveCurrentVersion();
    return;
  }
  if (mode === "diff") {
    state.docMode = "diff";
    if (!state.versions.length) await loadVersions();
    showPanel("diff");
    updateModeChips();
    if (state.versions.length >= 1) await runDiff();
    return;
  }
  if (mode === "a4") {
    state.docMode = "a4";
    syncWorkingFromFrames();
    showPanel("read");
    renderFrameBoard();
    $("export-bar")?.classList.remove("hidden");
    updateModeChips();
    setStatus("文件檢視：可匯入或匯出；框外註解不會出現");
    return;
  }
  state.docMode = "edit";
  state.editing = true;
  showPanel("read");
  renderFrameBoard();
  $("export-bar")?.classList.add("hidden");
  updateModeChips();
  setStatus("編輯模式：草稿會暫存；按 Save 才建立版本");
}

async function saveCurrentVersion(actor = null) {
  if (!state.current) return;
  if (!state.current.localOnly && !getToken()) {
    $("token-dialog").showModal();
    setStatus("請先設定鑰匙，再建立正式版本");
    return;
  }
  const resolvedActor = actor || state.current.lastActor || "人";
  await saveVersionToRepo(defaultVersionName(), { actor: resolvedActor });
  if (!state.current.localOnly) {
    await saveSeedCatalogMetadata(state.current);
  }
  state.current.lastActor = "人";
  if (state.current.localOnly) saveSeedTrayState();
  await loadVersions();
  if (state.panel === "read" && (state.current?.seedType || "document") === "document" && !isPersonCardDocument(state.current)) {
    renderFrameBoard();
  } else if (state.panel === "read" && isPersonCardDocument(state.current)) {
    renderFrameBoard();
  }
  showToast("已建立新版本", "ok");
  if (isPersonCardDocument(state.current)) {
    showPanel("list");
  }
}

async function saveSeedCatalogMetadata(seed) {
  const catalog = await fetchJson(`./seeds.json?ts=${Date.now()}`);
  const target = (catalog.seeds || []).find((item) => item.id === seed.id);
  if (!target) return;
  if (target.title === seed.title && (target.subtitle || "") === (seed.subtitle || "")) return;
  target.title = seed.title;
  target.subtitle = seed.subtitle || "";
  await putRepoFile(
    SEEDS_PATH,
    `${JSON.stringify(catalog, null, 2)}\n`,
    `更新 SEED 標題：${seed.title}`
  );
  state.catalog = catalog;
}
function defaultVersionName() {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`讀取失敗（${res.status}）`);
  return res.text();
}

async function fetchJson(url) {
  const isGithubApi = url.includes("api.github.com");
  const res = await fetch(
    url,
    isGithubApi ? { headers: { Accept: "application/vnd.github+json" } } : undefined
  );
  if (!res.ok) throw new Error(`讀取失敗（${res.status}）`);
  return res.json();
}

function loadSavedLayout() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
  } catch {
    return null;
  }
}

function saveLayout() {
  const payload = {};
  for (const s of state.seeds) payload[s.id] = { col: s.col, row: s.row };
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload));
}

function applySavedLayout() {
  const saved = loadSavedLayout();
  if (!saved) return;
  for (const s of state.seeds) {
    if (saved[s.id]) {
      s.col = saved[s.id].col;
      s.row = saved[s.id].row;
    }
  }
}

function seedAt(col, row) {
  return state.seeds.find((s) => !s.archived && s.col === col && s.row === row);
}

function loadSeedTrayState() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEED_TRAY_KEY) || "{}");
    return {
      archived: Array.isArray(raw.archived) ? raw.archived : [],
      deleted: Array.isArray(raw.deleted) ? raw.deleted : [],
      custom: Array.isArray(raw.custom) ? raw.custom : [],
    };
  } catch {
    return { archived: [], deleted: [], custom: [] };
  }
}

function loadSeedMetadata() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEED_META_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function saveSeedMetadata(seed) {
  if (!seed) return;
  const all = loadSeedMetadata();
  all[seed.id] = { title: seed.title, subtitle: seed.subtitle || "" };
  localStorage.setItem(SEED_META_KEY, JSON.stringify(all));
  if (seed.localOnly) saveSeedTrayState();
  updatePathBrand();
}

function saveSeedTrayState() {
  const custom = state.seeds.filter((s) => s.localOnly);
  const deleted = loadSeedTrayState().deleted;
  localStorage.setItem(
    SEED_TRAY_KEY,
    JSON.stringify({
      archived: state.seeds.filter((s) => s.archived).map((s) => s.id),
      deleted,
      custom,
    })
  );
}

function findFreeMapCell() {
  for (let row = 0; row < state.map.rows; row++) {
    for (let col = 0; col < state.map.cols; col++) {
      if (!seedAt(col, row)) return { col, row };
    }
  }
  return null;
}

function archiveSeed(id) {
  const seed = state.seeds.find((s) => s.id === id);
  if (!seed) return;
  seed.archived = true;
  saveSeedTrayState();
  renderMap();
  scheduleLayoutAutosave();
  setStatus(`「${seed.title}」已收到我的 SEED`);
}

function placeSeedOnMap(id) {
  const seed = state.seeds.find((s) => s.id === id);
  const cell = findFreeMapCell();
  if (!seed || !cell) {
    showToast("棋盤上沒有空位", "warn");
    return;
  }
  seed.archived = false;
  seed.col = cell.col;
  seed.row = cell.row;
  saveSeedTrayState();
  renderMap();
  scheduleLayoutAutosave();
  setStatus(`「${seed.title}」已派到棋盤`);
}

function deleteSeed(id) {
  const seed = state.seeds.find((s) => s.id === id);
  if (!seed || !window.confirm(`刪除「${seed.title}」？`)) return;
  const removeLocalSeed = (target) => {
    if (!target.localOnly) return;
    localStorage.removeItem(`seed-draft:${target.id}`);
    localStorage.removeItem(`seed-versions:${target.id}`);
  };
  removeLocalSeed(seed);
  if (isApprovalTemplate(seed)) {
    listApprovalInstances(seed.id).forEach(removeLocalSeed);
  }
  const metadata = loadSeedMetadata();
  delete metadata[seed.id];
  if (isApprovalTemplate(seed)) {
    listApprovalInstances(seed.id).forEach((instance) => delete metadata[instance.id]);
  }
  localStorage.setItem(SEED_META_KEY, JSON.stringify(metadata));
  const tray = loadSeedTrayState();
  if (!seed.localOnly && !tray.deleted.includes(id)) tray.deleted.push(id);
  state.seeds = state.seeds.filter((s) => {
    if (s.id === id) return false;
    if (isApprovalTemplate(seed) && s.approvalTemplateId === id) return false;
    return true;
  });
  localStorage.setItem(
    SEED_TRAY_KEY,
    JSON.stringify({
      archived: state.seeds.filter((s) => s.archived).map((s) => s.id),
      deleted: tray.deleted,
      custom: state.seeds.filter((s) => s.localOnly),
    })
  );
  renderMap();
  scheduleLayoutAutosave();
  showToast("已刪除 SEED", "ok");
}

const SYSTEM_SEED_TYPES = [
  { id: "document", label: "文件", desc: "人員卡片：照片＋三欄文字，可設權限" },
  { id: "approval", label: "簽核", desc: "欄位、流程、權限與通知範本" },
  { id: "discussion", label: "討論", desc: "直播風格畫面與評論截圖" },
];

function systemSeedTypeLabel(seedType) {
  return SYSTEM_SEED_TYPES.find((item) => item.id === seedType)?.label || seedType;
}

function buildBlankSystemSnapshot(seedType) {
  if (seedType === "approval") {
    const seed = {
      seedType: "approval",
      title: "未命名簽核",
      approvalIsTemplate: true,
      formFields: [],
    };
    ensureApprovalModel(seed);
    return captureSeedSnapshot(seed);
  }
  if (seedType === "discussion") {
    return {
      seedType: "discussion",
      title: "未命名討論",
      subtitle: "",
      messages: [],
      liveContent: "",
      text: discussionToText({
        title: "未命名討論",
        subtitle: "",
        messages: [],
        liveContent: "",
      }),
    };
  }
  return {
    seedType: "document",
    documentLayout: "person-card",
    title: "未命名文件",
    subtitle: "",
    blurb: "",
    personCard: defaultPersonCard(),
    text: "",
  };
}

function getBuiltinSystemSeedCatalog() {
  const now = "2026-07-21T12:00:00.000Z";
  return {
    document: [{
      id: "sys-doc-blank",
      name: "空白文件",
      builtin: true,
      desc: "人員卡片格式",
      versions: [{ rev: 1, label: "初版", savedAt: now, snapshot: buildBlankSystemSnapshot("document") }],
    }],
    approval: [{
      id: "sys-approval-blank",
      name: "空白簽核",
      builtin: true,
      versions: [{ rev: 1, label: "初版", savedAt: now, snapshot: buildBlankSystemSnapshot("approval") }],
    }],
    discussion: [{
      id: "sys-discussion-blank",
      name: "空白討論",
      builtin: true,
      versions: [{ rev: 1, label: "初版", savedAt: now, snapshot: buildBlankSystemSnapshot("discussion") }],
    }],
  };
}

function loadSystemSeedCatalog() {
  const catalog = getBuiltinSystemSeedCatalog();
  try {
    const raw = JSON.parse(localStorage.getItem(SYSTEM_SEED_KEY) || "{}");
    for (const type of Object.keys(catalog)) {
      const custom = Array.isArray(raw[type]) ? raw[type] : [];
      catalog[type] = [...catalog[type], ...custom];
    }
  } catch {
    /* ignore */
  }
  return catalog;
}

function saveSystemSeedCustomCatalog(customOnly) {
  localStorage.setItem(SYSTEM_SEED_KEY, JSON.stringify(customOnly));
}

function listCustomSystemTemplates() {
  try {
    const raw = JSON.parse(localStorage.getItem(SYSTEM_SEED_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function captureSeedSnapshot(seed) {
  if (!seed) return buildBlankSystemSnapshot("document");
  if (seed.seedType === "approval") ensureApprovalModel(seed);
  syncWorkingFromFrames();
  const snapshot = {
    seedType: seed.seedType || "document",
    documentLayout: seed.documentLayout || "",
    title: seed.title || "未命名 SEED",
    subtitle: seed.subtitle || "",
    blurb: seed.blurb || "",
    personCard: seed.personCard ? JSON.parse(JSON.stringify(seed.personCard)) : null,
    approvalIsTemplate: seed.approvalIsTemplate !== false && !seed.approvalTemplateId,
    approvalTemplateId: seed.approvalTemplateId || "",
    formFields: JSON.parse(JSON.stringify(seed.formFields || [])),
    approvalConfig: seed.approvalConfig ? JSON.parse(JSON.stringify(seed.approvalConfig)) : null,
    messages: JSON.parse(JSON.stringify(seed.messages || [])),
    liveContent: seed.liveContent || "",
    text: "",
  };
  if (seed.seedType === "approval") snapshot.text = approvalToText(seed);
  else if (seed.seedType === "discussion") snapshot.text = discussionToText(seed);
  else if (isPersonCardDocument(seed)) snapshot.text = personCardToText(seed);
  else snapshot.text = state.current?.id === seed.id ? state.workingText : (localStorage.getItem(`seed-draft:${seed.id}`) || "");
  return snapshot;
}

function applySnapshotToSeed(seed, snapshot) {
  seed.seedType = snapshot.seedType || "document";
  seed.documentLayout = snapshot.documentLayout || "";
  seed.title = snapshot.title || seed.title;
  seed.subtitle = snapshot.subtitle || "";
  seed.blurb = snapshot.blurb || "";
  if (snapshot.documentLayout === "person-card") {
    seed.personCard = JSON.parse(JSON.stringify(snapshot.personCard || defaultPersonCard()));
    ensurePersonCardModel(seed);
  }
  seed.approvalTemplateId = snapshot.approvalTemplateId || "";
  seed.approvalIsTemplate = snapshot.seedType === "approval"
    ? snapshot.approvalIsTemplate !== false && !snapshot.approvalTemplateId
    : false;
  if (seed.seedType === "approval") {
    seed.formFields = JSON.parse(JSON.stringify(snapshot.formFields || []));
    seed.approvalConfig = JSON.parse(JSON.stringify(snapshot.approvalConfig || {}));
    ensureApprovalModel(seed);
    if (isApprovalTemplate(seed)) {
      seed.approvalConfig.tab = "design";
      delete seed.approvalConfig.roleViewInitialized;
    } else if (isApprovalInstance(seed)) {
      seed.approvalConfig.tab = "fill";
      seed.approvalConfig.status ||= "Draft";
    }
  } else if (seed.seedType === "discussion") {
    seed.messages = JSON.parse(JSON.stringify(snapshot.messages || []));
    seed.liveContent = snapshot.liveContent || "";
  }
  localStorage.setItem(`seed-draft:${seed.id}`, snapshot.text || "");
}

function resetSystemBrowse(step = "types", seedType = "", templateId = "") {
  state.systemBrowse = { step, seedType, templateId };
}

function openSystemSeedBrowse(step = "types", seedType = "", templateId = "") {
  resetSystemBrowse(step, seedType, templateId);
  showPanel("system-seed");
}

function findSystemTemplate(catalog, seedType, templateId) {
  return (catalog[seedType] || []).find((item) => item.id === templateId) || null;
}

function forkSystemSeedVersion(template, version) {
  const seedType = version.snapshot?.seedType || template.seedType || "document";
  const title = `${template.name}（v${version.rev}）`;
  const seed = createSeed(title, seedType);
  applySnapshotToSeed(seed, version.snapshot);
  seed.title = title;
  seed.alias = title;
  seed.short = Array.from(title).slice(0, 4).join("");
  saveSeedTrayState();
  return seed;
}

function openSystemSeedTemplate(template, seedType) {
  const version = template.versions?.[0];
  if (!version) {
    showToast("這個範本還沒有版本", "warn");
    return;
  }
  const seed = forkSystemSeedVersion(template, version);
  if (seedType === "approval") {
    ensureApprovalModel(seed);
    seed.approvalConfig.tab = "design";
    seed.formFields = Array.isArray(version.snapshot?.formFields) ? JSON.parse(JSON.stringify(version.snapshot.formFields)) : [];
    seed.title = "未命名簽核";
    seed.alias = seed.title;
    seed.short = Array.from(seed.title).slice(0, 4).join("");
    saveSeedTrayState();
  } else if (seedType === "document") {
    seed.documentLayout = "person-card";
    ensurePersonCardModel(seed);
    if (version.snapshot?.personCard) {
      seed.personCard = JSON.parse(JSON.stringify(version.snapshot.personCard));
      ensurePersonCardModel(seed);
    }
    seed.title = "未命名文件";
    seed.alias = seed.title;
    seed.short = Array.from(seed.title).slice(0, 4).join("");
    seed.blurb = version.snapshot?.blurb || "";
    saveSeedTrayState();
  } else if (seedType === "discussion") {
    seed.title = "未命名討論";
    seed.alias = seed.title;
    seed.short = Array.from(seed.title).slice(0, 4).join("");
    saveSeedTrayState();
  }
  showToast(`已開啟「${seed.title}」`, "ok");
  selectSeed(seed).catch((err) => setStatus(err.message || String(err)));
}

function appendSystemSeedVersion(seedType, templateName, snapshot, sourceLabel = "") {
  const custom = listCustomSystemTemplates();
  custom[seedType] ||= [];
  let template = custom[seedType].find((item) => item.name === templateName);
  if (!template) {
    template = {
      id: `custom-${Date.now().toString(36)}`,
      name: templateName,
      builtin: false,
      versions: [],
    };
    custom[seedType].unshift(template);
  }
  const rev = (template.versions[0]?.rev || 0) + 1;
  template.versions.unshift({
    rev,
    label: sourceLabel || `v${rev}`,
    savedAt: new Date().toISOString(),
    snapshot,
  });
  template.versions = template.versions.slice(0, 30);
  saveSystemSeedCustomCatalog(custom);
  return { template, rev };
}

function saveCurrentAsSystemSeedTemplate() {
  if (!state.current) {
    showToast("請先打開一份 SEED", "warn");
    return;
  }
  const seedType = state.current.seedType || "document";
  const defaultName = state.current.title || `我的${systemSeedTypeLabel(seedType)}`;
  const templateName = window.prompt(`存成 System Seed 範本名稱：`, defaultName);
  if (!templateName) return;
  syncWorkingFromFrames();
  const snapshot = captureSeedSnapshot(state.current);
  const { template, rev } = appendSystemSeedVersion(seedType, templateName.trim(), snapshot, "從目前 SEED");
  showToast(`已存成 System Seed「${template.name}」v${rev}`, "ok");
  openSystemSeedBrowse("versions", seedType, template.id);
}

function renderSystemSeedPanel() {
  const board = $("system-seed-board");
  if (!board) return;
  board.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "system-seed-type-grid";
  SYSTEM_SEED_TYPES.forEach((type) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "system-seed-type-card";
    card.textContent = type.label;
    card.addEventListener("click", () => {
      const catalog = loadSystemSeedCatalog();
      const blank = (catalog[type.id] || []).find((item) => item.builtin) || catalog[type.id]?.[0];
      if (blank) openSystemSeedTemplate(blank, type.id);
      else showToast("尚無此類型範本", "warn");
    });
    grid.appendChild(card);
  });
  board.appendChild(grid);
}

function addSeed() {
  openSystemSeedBrowse("types");
}

function createSeed(title, seedType) {
  const id = `local-${Date.now().toString(36)}`;
  const seed = {
    id,
    title,
    alias: title,
    short: Array.from(title).slice(0, 4).join(""),
    path: "",
    blurb: "",
    col: 0,
    row: 0,
    archived: true,
    localOnly: true,
    seedType,
    approvalIsTemplate: seedType === "approval",
    approvalTemplateId: "",
    formFields: seedType === "approval" ? [] : [],
    approver: "",
    messages: [],
    liveContent: "",
  };
  state.seeds.push(seed);
  localStorage.setItem(`seed-draft:${id}`, "");
  saveSeedTrayState();
  renderMap();
  showToast(`已新增「${seed.title}」`, "ok");
  return seed;
}

function renderSeedTray() {
  const root = $("seed-tray-list");
  if (!root) return;
  root.innerHTML = "";
  const archived = state.seeds.filter((s) => s.archived);
  if (!archived.length) {
    root.innerHTML = '<p class="seed-tray-empty">把 SEED 拖到這裡收回；也可拖到上方棋盤出戰。</p>';
    return;
  }
  for (const seed of archived) {
    const card = document.createElement("div");
    card.className = "seed-tray-card";
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      state.dragId = seed.id;
      e.dataTransfer.setData("text/seed-id", seed.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      state.dragId = null;
    });
    const open = document.createElement("button");
    open.type = "button";
    open.className = "seed-tray-open";
    const typeLabel = { document: "文件", approval: seed.approvalTemplateId ? "申請" : "簽核範本", discussion: "討論" };
    open.textContent = seed.title;
    open.dataset.type = typeLabel[seed.seedType || "document"];
    open.addEventListener("click", () =>
      selectSeed(seed).catch((err) => setStatus(err.message || String(err)))
    );
    const actions = document.createElement("div");
    actions.className = "seed-tray-actions";
    if (isApprovalTemplate(seed)) {
      const spawn = document.createElement("button");
      spawn.type = "button";
      spawn.className = "seed-tray-spawn";
      spawn.textContent = "＋";
      spawn.title = "建立申請單";
      spawn.setAttribute("aria-label", `從「${seed.title}」建立申請單`);
      spawn.addEventListener("click", (event) => {
        event.stopPropagation();
        const instance = createApprovalInstance(seed);
        showToast(`已建立「${instance.title}」`, "ok");
        selectSeed(instance).catch((err) => setStatus(err.message || String(err)));
      });
      actions.appendChild(spawn);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "seed-tray-delete";
    remove.textContent = "×";
    remove.title = "刪除";
    remove.setAttribute("aria-label", `刪除 ${seed.title}`);
    remove.addEventListener("click", () => deleteSeed(seed.id));
    actions.appendChild(remove);
    card.append(open, actions);
    root.appendChild(card);
  }
}

function isStudio(seed) {
  return (seed.blurb || "").includes("工作室");
}

function loadCommunity() {
  try {
    const raw = JSON.parse(localStorage.getItem(COMMUNITY_KEY) || "null");
    if (raw && typeof raw === "object") {
      return { points: Number(raw.points) || COMMUNITY_START_POINTS, claims: raw.claims || {} };
    }
  } catch {
    /* ignore */
  }
  return { points: COMMUNITY_START_POINTS, claims: {} };
}

function saveCommunity(data) {
  localStorage.setItem(COMMUNITY_KEY, JSON.stringify(data));
}

function cellClaimCost(col, row) {
  const cx = (state.map.cols - 1) / 2;
  const cy = (state.map.rows - 1) / 2;
  const dist = Math.abs(col - cx) + Math.abs(row - cy);
  return Math.max(3, 5 + Math.round(dist * 2));
}

function resolveSeedAt(col, row) {
  if (state.map.kind === "community") {
    const comm = loadCommunity();
    const claim = comm.claims[`${col},${row}`];
    if (claim) {
      const s = state.seeds.find((x) => x.id === claim.seedId);
      if (s) return s;
    }
  }
  return seedAt(col, row);
}

function awardCommunityPoints(amount, reason) {
  if (state.map.kind !== "community" || amount <= 0) return null;
  const comm = loadCommunity();
  comm.points += amount;
  saveCommunity(comm);
  updateSyncUi();
  return comm.points;
}

function openClaimDialog(col, row) {
  const cost = cellClaimCost(col, row);
  const comm = loadCommunity();
  if (comm.points < cost) {
    setStatus(`點數不足：這格要 ${cost} 點，你現有 ${comm.points} 點`);
    return;
  }
  state.claimCell = { col, row, cost };
  const sel = $("claim-seed-select");
  sel.innerHTML = "";
  for (const s of state.seeds) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.title;
    sel.appendChild(opt);
  }
  $("claim-cost-label").textContent = `這格要 ${cost} 點（你現有 ${comm.points} 點）`;
  $("claim-dialog").showModal();
}

function commitClaim(seedId) {
  if (!state.claimCell) return;
  const { col, row, cost } = state.claimCell;
  const comm = loadCommunity();
  if (comm.points < cost) {
    setStatus(`點數不足：需要 ${cost} 點`);
    return;
  }
  comm.points -= cost;
  comm.claims[`${col},${row}`] = { seedId, spent: cost, at: new Date().toISOString() };
  saveCommunity(comm);
  state.claimCell = null;
  renderMap();
  setStatus(`已用 ${cost} 點佔 (${col + 1}, ${row + 1})；剩 ${comm.points} 點`);
}

function clearTouchHighlight() {
  if (state.touchHighlightCell) {
    state.touchHighlightCell.classList.remove("drop-target");
    state.touchHighlightCell = null;
  }
  document.querySelectorAll(".map-seed.touch-dragging").forEach((el) => {
    el.classList.remove("touch-dragging");
  });
}

function highlightCellAt(clientX, clientY) {
  clearTouchHighlight();
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el && el.closest(".map-cell");
  if (cell) {
    cell.classList.add("drop-target");
    state.touchHighlightCell = cell;
  }
}

function puzzleKindLabel() {
  if (state.map.kind === "community") return "社群版";
  return state.map.visibility === "private" ? "個人·私人" : "個人·公開";
}

function buildLayoutSnapshot() {
  return {
    map: {
      cols: state.map.cols,
      rows: state.map.rows,
      title: state.map.title,
      note: state.map.note,
      kind: state.map.kind,
      visibility: state.map.visibility,
      template: state.map.template,
    },
    positions: state.seeds.map((s) => ({ id: s.id, col: s.col, row: s.row })),
  };
}

async function loadLayoutHistoryFile() {
  try {
    return await fetchJson(`./puzzle-layouts.json?ts=${Date.now()}`);
  } catch {
    return { versions: [] };
  }
}

async function saveLayoutHistoryFile(data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await putRepoFile(LAYOUT_HISTORY_PATH, text, "Update puzzle layout history");
}

function normalizeLayoutHistory(raw) {
  if (raw?.layouts?.length) return { layouts: raw.layouts };
  const flat = raw?.versions || [];
  const layouts = [];
  const byName = new Map();
  for (const v of flat) {
    const name = v.label || formatSavedAtDate(v.savedAt) || "未命名";
    if (!byName.has(name)) {
      byName.set(name, {
        id: v.layoutId || `${name}-${v.id || Date.now()}`,
        name,
        versions: [],
      });
    }
    const layout = byName.get(name);
    layout.versions.push({
      rev: layout.versions.length + 1,
      savedAt: v.savedAt,
      map: v.map,
      positions: v.positions,
    });
  }
  for (const layout of byName.values()) {
    layout.versions.sort((a, b) => b.rev - a.rev);
    layouts.push(layout);
  }
  layouts.sort((a, b) => {
    const ta = a.versions[0]?.savedAt || "";
    const tb = b.versions[0]?.savedAt || "";
    return tb.localeCompare(ta);
  });
  return { layouts };
}

function getCurrentLayoutName() {
  return state.map.layoutName || state.catalog?.map?.layoutName || "";
}

function getCurrentLayoutRev() {
  const rev = state.map.layoutRev ?? state.catalog?.map?.layoutRev;
  return Number.isInteger(rev) ? rev : 0;
}

function layoutSaveLabel(saveInfo, name, rev) {
  if (saveInfo.mode === "new") return `另存棋盤：${name} v1`;
  return `存棋盤：${name} v${rev}`;
}

async function appendLayoutVersion(saveInfo) {
  const raw = await loadLayoutHistoryFile();
  const history = normalizeLayoutHistory(raw);
  const snapshot = buildLayoutSnapshot();
  const now = new Date().toISOString();
  let layout;
  let rev;

  if (saveInfo.mode === "new") {
    const name = saveInfo.name.trim();
    layout = { id: Date.now().toString(36), name, versions: [] };
    history.layouts.unshift(layout);
    rev = 1;
  } else {
    const name = getCurrentLayoutName() || defaultVersionName();
    layout = history.layouts.find((l) => l.name === name);
    if (!layout) {
      layout = { id: Date.now().toString(36), name, versions: [] };
      history.layouts.unshift(layout);
    }
    rev = (layout.versions[0]?.rev || 0) + 1;
  }

  layout.versions.unshift({
    rev,
    savedAt: now,
    map: snapshot.map,
    positions: snapshot.positions,
  });
  layout.versions = layout.versions.slice(0, MAX_REVS_PER_LAYOUT);
  history.layouts = [layout, ...history.layouts.filter((l) => l.id !== layout.id)].slice(
    0,
    MAX_LAYOUT_SERIES
  );

  state.map.layoutName = layout.name;
  state.map.layoutRev = rev;

  await saveLayoutHistoryFile(history);
  return { layout, rev };
}

function applyLayoutSnapshot(snapshot, meta = {}) {
  if (snapshot.map) {
    state.map = { ...state.map, ...snapshot.map };
    $("map-title").textContent = state.map.title || "SEED 棋盤";
    $("map-note").textContent = state.map.note || "";
  }
  if (meta.layoutName) state.map.layoutName = meta.layoutName;
  if (Number.isInteger(meta.rev)) state.map.layoutRev = meta.rev;
  if (snapshot.positions) {
    const pos = Object.fromEntries(snapshot.positions.map((p) => [p.id, p]));
    for (const s of state.seeds) {
      if (pos[s.id]) {
        s.col = pos[s.id].col;
        s.row = pos[s.id].row;
      }
    }
  }
  clampSeedsToMap();
  saveLayout();
  renderMap();
  updateSyncUi();
}

async function openLayoutHistoryDialog() {
  closeAllPopovers();
  const history = normalizeLayoutHistory(await loadLayoutHistoryFile());
  const list = $("layout-history-list");
  list.innerHTML = "";
  const layouts = history.layouts || [];
  if (!layouts.length) {
    list.innerHTML = '<li class="layout-history-empty">還沒有排版紀錄。先按存檔圖示或選單「存棋盤位置」。</li>';
  } else {
    for (const layout of layouts) {
      const group = document.createElement("li");
      group.className = "layout-history-group";
      const title = document.createElement("p");
      title.className = "layout-group-name";
      title.textContent = layout.name;
      group.appendChild(title);
      const sub = document.createElement("ul");
      sub.className = "layout-rev-list";
      for (const v of layout.versions || []) {
        const item = document.createElement("li");
        item.className = "layout-history-item";
        const head = document.createElement("div");
        head.className = "layout-history-head";
        head.innerHTML = `<strong>v${v.rev}</strong><span class="muted">${escapeHtml(formatSavedAt(v.savedAt))}</span>`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary";
        btn.textContent = "用這版";
        btn.addEventListener("click", () => {
          const ok = window.confirm(
            `恢復「${layout.name} v${v.rev}」？\n\n會先套用在畫面上；若要永久保存請再按存檔。`
          );
          if (!ok) return;
          applyLayoutSnapshot(v, { layoutName: layout.name, rev: v.rev });
          $("layout-history-dialog").close();
          showToast(`已套用 ${layout.name} v${v.rev}；記得按存檔寫進倉庫`, "info");
          showPanel("list");
        });
        item.appendChild(head);
        item.appendChild(btn);
        sub.appendChild(item);
      }
      group.appendChild(sub);
      list.appendChild(group);
    }
  }
  $("layout-history-dialog").showModal();
}

function hasUnsavedPuzzleChanges() {
  if (loadSavedLayout()) return true;
  const cat = state.catalog;
  if (!cat) return false;
  const baseMap = cat.map || {};
  if (
    (state.map.template || "grid-10") !== (baseMap.template || "grid-10") ||
    (state.map.kind || "personal") !== (baseMap.kind || "personal") ||
    (state.map.visibility || "public") !== (baseMap.visibility || "public") ||
    state.map.cols !== baseMap.cols ||
    state.map.rows !== baseMap.rows
  ) {
    return true;
  }
  const baseSeeds = Object.fromEntries((cat.seeds || []).map((s) => [s.id, s]));
  const liveRepoSeeds = state.seeds.filter((s) => !s.localOnly);
  if ((cat.seeds || []).length !== liveRepoSeeds.length) return true;
  return liveRepoSeeds.some((s) => {
    const base = baseSeeds[s.id];
    return (
      !base ||
      base.col !== s.col ||
      base.row !== s.row ||
      (base.archived === true) !== (s.archived === true)
    );
  });
}

function updateSyncUi() {
  const dirty = hasUnsavedPuzzleChanges();
  const savedAt = state.catalog?.map?.savedAt || null;

  const kindEl = $("header-kind-label");
  if (kindEl) kindEl.textContent = visibilityLabel();

  const dot = $("sync-dot");
  if (dot) {
    if (state.autosaving) dot.dataset.state = "dirty";
    else dot.dataset.state = dirty ? "dirty" : savedAt ? "saved" : "unknown";
  }

  const infoKindSwitch = $("info-kind-switch");
  if (infoKindSwitch) infoKindSwitch.textContent = visibilityLabel();

  const infoSaved = $("info-saved-at");
  if (infoSaved) {
    if (savedAt) {
      const dateLabel = formatSavedAtDate(savedAt);
      infoSaved.textContent = dirty ? `${dateLabel}（同步中）` : `${dateLabel} · 自動儲存`;
    } else {
      infoSaved.textContent = "自動儲存";
    }
  }

  const infoExtra = $("info-extra");
  if (infoExtra) {
    const parts = [];
    if (state.map.kind === "community") {
      const comm = loadCommunity();
      parts.push(`點數 ${comm.points}`);
    }
    if (state.map.kind === "personal" && state.map.visibility === "private") {
      parts.push("私人僅標記；真正隱私需登入（之後做）");
    }
    infoExtra.textContent = parts.join(" · ");
    infoExtra.classList.toggle("hidden", !parts.length);
  }

  updateHeaderLayoutActions();
  updateModeChips();
  renderNotifyChips();
}

async function refreshLayoutHistorySummary() {
  const histBtn = $("info-layout-history");
  if (!histBtn) return;
  histBtn.textContent = "自動儲存";
}

function updateHeaderLayoutActions() {
  const wrap = $("header-layout-actions");
  if (!wrap) return;
  wrap.classList.add("hidden");
}

async function resetPuzzleLayout() {
  localStorage.removeItem(LAYOUT_KEY);
  await loadCatalog();
  setStatus("已重置為倉庫預設位置");
  showPanel("list");
}

async function promptLayoutName() {
  const input = $("layout-name-input");
  const dlg = $("layout-name-dialog");
  const form = $("layout-name-form");
  const hint = $("layout-name-hint");
  if (!input || !dlg || !form) return null;
  const current = getCurrentLayoutName();
  input.value = "";
  if (current) {
    input.placeholder = `留空 = 更新「${current}」小版本`;
    if (hint) hint.textContent = `目前模板：${current} · v${getCurrentLayoutRev() || 1}。留空直接存小版本；輸入新名稱則另存新模板。`;
  } else {
    input.placeholder = defaultVersionName();
    if (hint) hint.textContent = "第一次存檔：留空會用預設名稱建立模板；也可自訂名稱。";
  }
  return new Promise((resolve) => {
    const onSubmit = (e) => {
      const submitter = e.submitter;
      if (submitter && submitter.value === "cancel") {
        form.removeEventListener("submit", onSubmit);
        resolve(null);
        return;
      }
      e.preventDefault();
      const typed = input.value.trim();
      form.removeEventListener("submit", onSubmit);
      dlg.close();
      if (typed) {
        if (current && typed === current) resolve({ mode: "minor" });
        else resolve({ mode: "new", name: typed });
      } else resolve({ mode: "minor" });
    };
    form.addEventListener("submit", onSubmit);
    dlg.showModal();
    input.focus();
  });
}

async function savePuzzleLayout(opts = {}) {
  const { forceDialog = false, silent = false } = opts;
  if (!getToken()) {
    if (!silent) {
      $("token-dialog").showModal();
      showToast("請先設定鑰匙，再存棋盤", "warn");
    }
    return;
  }
  let saveInfo;
  if (!forceDialog) {
    saveInfo = { mode: "minor" };
  } else {
    saveInfo = await promptLayoutName();
    if (!saveInfo) return;
  }
  await saveLayoutToRepo(saveInfo, { silent });
}

async function maybePromptSaveLayout(reason) {
  if (!getToken()) return;
  const ok = window.confirm(`${reason}\n\n要把棋盤設定寫進倉庫嗎？`);
  if (!ok) return;
  try {
    const saveInfo = getCurrentLayoutName() ? { mode: "minor" } : await promptLayoutName();
    if (!saveInfo) return;
    await saveLayoutToRepo(saveInfo);
  } catch (err) {
    setStatus(err.message || String(err));
  }
}

/** 拼圖短標：優先 short；否則用 alias／title（最多四字，方便辨識） */
function shortLabel(seed) {
  const raw = (seed.short || seed.alias || seed.title || "").replace(/\s+/g, "");
  const chars = Array.from(raw);
  if (!chars.length) return "書";
  if (seed.short) return chars.slice(0, 6).join("");
  return chars.slice(0, 4).join("");
}

function monogram(seed) {
  return shortLabel(seed);
}

/** Icon tile: cover image or monogram avatar + caption (future: book avatar) */
function iconHtml(seed) {
  const label = shortLabel(seed);
  const mono = monogram(seed);
  const cover = seed.cover;
  let avatar;
  if (cover) {
    avatar = `<span class="seed-avatar has-cover"><img src="${escapeHtml(cover)}" alt="" draggable="false" /></span>`;
  } else {
    avatar = `<span class="seed-avatar mono" aria-hidden="true">${escapeHtml(mono)}</span>`;
  }
  return `${avatar}<span class="seed-caption">${escapeHtml(label)}</span>`;
}

function applyMapView() {
  const view = state.map.view || "fit";
  const shell = document.querySelector(".map-shell");
  if (shell) shell.dataset.mapView = view;
}

function setMapView(view) {
  if (!["width", "height", "fit"].includes(view)) return;
  state.map.view = view;
  localStorage.setItem(MAP_VIEW_KEY, view);
  applyMapView();
  setStatus(
    view === "width" ? "棋盤以左右寬度為主" : view === "height" ? "棋盤以上下高度為主" : "顯示全部棋盤"
  );
}

function renderMap() {
  const root = $("knowledge-map");
  applyMapView();
  const { cols, rows } = state.map;
  root.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  root.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  root.innerHTML = "";

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = document.createElement("div");
      cell.className = "map-cell empty";
      cell.dataset.col = String(col);
      cell.dataset.row = String(row);
      cell.setAttribute("role", "gridcell");

      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        cell.classList.add("drop-target");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("drop-target"));
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.classList.remove("drop-target");
        const id = e.dataTransfer.getData("text/seed-id") || state.dragId;
        if (!id) return;
        moveSeed(id, col, row);
      });

      const seed = resolveSeedAt(col, row);
      if (seed) {
        cell.classList.remove("empty");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-seed icon" + (isStudio(seed) ? " studio" : "");
        btn.draggable = state.map.kind !== "community";
        btn.innerHTML = iconHtml(seed);
        btn.title = `${seed.title}\n短標：${shortLabel(seed)}\n${seed.blurb || ""}\n拖曳可改位置，點一下打開`;
        btn.setAttribute("aria-label", seed.title);
        btn.style.touchAction = "none";
        btn.addEventListener("dragstart", (e) => {
          state.dragId = seed.id;
          e.dataTransfer.setData("text/seed-id", seed.id);
          e.dataTransfer.effectAllowed = "move";
        });
        btn.addEventListener("dragend", () => {
          state.dragId = null;
        });
        btn.addEventListener(
          "touchstart",
          (e) => {
            if (e.touches.length !== 1) return;
            state.dragId = seed.id;
            state.touchDragging = true;
            btn.classList.add("touch-dragging");
          },
          { passive: true }
        );
        btn.addEventListener(
          "touchmove",
          (e) => {
            if (!state.touchDragging || state.dragId !== seed.id) return;
            e.preventDefault();
            const t = e.touches[0];
            highlightCellAt(t.clientX, t.clientY);
          },
          { passive: false }
        );
        btn.addEventListener(
          "touchend",
          (e) => {
            if (!state.touchDragging || !state.dragId) return;
            const t = e.changedTouches[0];
            const el = document.elementFromPoint(t.clientX, t.clientY);
            const cell = el && el.closest(".map-cell");
            const id = state.dragId;
            state.touchDragging = false;
            state.dragId = null;
            clearTouchHighlight();
            if (cell) {
              const col = Number(cell.dataset.col);
              const row = Number(cell.dataset.row);
              const seed = state.seeds.find((s) => s.id === id);
              if (seed && (seed.col !== col || seed.row !== row)) {
                state.suppressClick = true;
                moveSeed(id, col, row);
              }
            }
          },
          { passive: true }
        );
        btn.addEventListener(
          "touchcancel",
          () => {
            state.touchDragging = false;
            state.dragId = null;
            clearTouchHighlight();
          },
          { passive: true }
        );
        btn.addEventListener("click", () => {
          if (state.suppressClick) {
            state.suppressClick = false;
            return;
          }
          selectSeed(seed).catch((err) => setStatus(err.message || String(err)));
        });
        cell.appendChild(btn);
      } else if (state.map.kind === "community") {
        const cost = cellClaimCost(col, row);
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "claim-slot";
        slot.textContent = `${cost}點`;
        slot.title = `花 ${cost} 點搶這格`;
        slot.addEventListener("click", () => openClaimDialog(col, row));
        cell.appendChild(slot);
      }

      root.appendChild(cell);
    }
  }
  renderSeedTray();
  updateSyncUi();
}

function moveSeed(id, col, row) {
  const seed = state.seeds.find((s) => s.id === id);
  if (!seed) return;
  const occupant = seedAt(col, row);
  if (occupant && occupant.id !== id) {
    if (seed.archived) {
      occupant.archived = true;
    } else {
      occupant.col = seed.col;
      occupant.row = seed.row;
    }
  }
  seed.archived = false;
  seed.col = col;
  seed.row = row;
  saveSeedTrayState();
  scheduleLayoutAutosave();
  renderMap();
  setStatus(`已把「${seed.title}」派到棋盤 · 自動儲存中`);
}

const PUZZLE_TEMPLATES = {
  "grid-8": { cols: 8, rows: 8, label: "空白棋盤 8×8" },
  "grid-10": { cols: 10, rows: 10, label: "空白棋盤 10×10" },
  "grid-12": { cols: 12, rows: 12, label: "空白棋盤 12×12" },
  "demo-taiwan-roads": { cols: 10, rows: 10, label: "示範：台灣橫貫公路" },
};

function clampSeedsToMap() {
  const maxC = Math.max(0, (state.map.cols || 10) - 1);
  const maxR = Math.max(0, (state.map.rows || 10) - 1);
  for (const s of state.seeds) {
    s.col = Math.min(Math.max(0, s.col || 0), maxC);
    s.row = Math.min(Math.max(0, s.row || 0), maxR);
  }
}

function applyPuzzleTemplate(templateId) {
  const tpl = PUZZLE_TEMPLATES[templateId] || PUZZLE_TEMPLATES["grid-10"];
  state.map.template = templateId;
  state.map.cols = tpl.cols;
  state.map.rows = tpl.rows;
  state.map.title = "SEED 棋盤";
  state.map.note = `${tpl.label}；把我的 SEED 派到棋盤，點進去編輯`;
  clampSeedsToMap();
  localStorage.removeItem(LAYOUT_KEY);
  $("map-title").textContent = state.map.title;
  $("map-note").textContent = state.map.note;
  renderMap();
}

async function loadCatalog() {
  // Bust CDN cache after writes
  const data = await fetchJson(`./seeds.json?ts=${Date.now()}`);
  state.catalog = data;
  state.map = {
    cols: data.map?.cols || 10,
    rows: data.map?.rows || 10,
    title: "SEED 棋盤",
    note: String(data.map?.note || "").replaceAll("拼圖", "棋盤"),
    kind: data.map?.kind || "personal",
    visibility: data.map?.visibility || "public",
    template: data.map?.template || "grid-10",
    view: localStorage.getItem(MAP_VIEW_KEY) || "fit",
    savedAt: data.map?.savedAt || null,
    layoutName: data.map?.layoutName || "",
    layoutRev: Number.isInteger(data.map?.layoutRev) ? data.map.layoutRev : 0,
  };
  const hasTrayState = localStorage.getItem(SEED_TRAY_KEY) !== null;
  const tray = loadSeedTrayState();
  const metadata = loadSeedMetadata();
  if (!hasTrayState) {
    tray.archived = (data.seeds || []).slice(8).map((s) => s.id);
  }
  const custom = tray.custom.map((s) => ({
    ...s,
    ...(metadata[s.id] || {}),
    seedType: s.seedType || "document",
    archived: tray.archived.includes(s.id),
    localOnly: true,
  }));
  state.seeds = (data.seeds || [])
    .filter((s) => !tray.deleted.includes(s.id))
    .map((s) => ({
    ...s,
    ...(metadata[s.id] || {}),
    seedType: s.seedType || "document",
    col: Number.isInteger(s.col) ? s.col : 0,
    row: Number.isInteger(s.row) ? s.row : 0,
    archived: tray.archived.includes(s.id) || s.archived === true,
  }));
  state.seeds.push(...custom.filter((s) => !state.seeds.some((x) => x.id === s.id)));
  if (!hasTrayState) saveSeedTrayState();
  clampSeedsToMap();
  applySavedLayout();
  $("map-title").textContent = state.map.title;
  $("map-note").textContent = state.map.note;
  renderMap();
  updateSyncUi();
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  const t = (token || "").trim();
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

function getAiKey() {
  return localStorage.getItem(AI_KEY) || "";
}

function setAiKey(key) {
  const t = (key || "").trim();
  if (t) localStorage.setItem(AI_KEY, t);
  else localStorage.removeItem(AI_KEY);
}

function getAiBase() {
  return (localStorage.getItem(AI_BASE_KEY) || DEFAULT_AI_BASE).replace(/\/$/, "");
}

function setAiBase(base) {
  const t = (base || "").trim().replace(/\/$/, "");
  if (t && t !== DEFAULT_AI_BASE) localStorage.setItem(AI_BASE_KEY, t);
  else localStorage.removeItem(AI_BASE_KEY);
}

function getMemberCode() {
  return localStorage.getItem(MEMBER_KEY) || "";
}

function setMemberCode(code) {
  const t = (code || "").trim();
  if (t) localStorage.setItem(MEMBER_KEY, t);
  else localStorage.removeItem(MEMBER_KEY);
}

function apiBase() {
  return String(state.config.apiBase || "").replace(/\/$/, "");
}

function usePaidProxy() {
  return Boolean(apiBase());
}

function stripAiFences(text) {
  let t = (text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t;
}

async function askAiViaProxy(systemPrompt, userResponse) {
  const code = getMemberCode();
  if (!code) throw new Error("還沒輸入會員碼。付費後會拿到一組碼，請按「會員碼」設定。");
  const res = await fetch(`${apiBase()}/v1/ai/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${code}`,
    },
    body: JSON.stringify({
      title: state.current?.title || "未命名",
      systemPrompt,
      userResponse,
    }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    if (res.status === 402) throw new Error(data.error || "本月次數用完了");
    if (res.status === 401) throw new Error(data.error || "會員碼無效");
    throw new Error(data.error || `代辦失敗（${res.status}）`);
  }
  const out = stripAiFences(data.answer || "");
  if (!out) throw new Error("沒有產出內容");
  if (data.quota) {
    setStatus(`AI 已回應。本月還剩 ${data.quota.remaining} 次（已用 ${data.quota.used}/${data.quota.quota}）`);
  }
  return out;
}

async function askAiDirect(systemPrompt, userResponse) {
  const key = getAiKey();
  if (!key) throw new Error("還沒設定 AI 鑰匙，請先按「AI 鑰匙」");
  const res = await fetch(`${getAiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你是問答助手。請先理解 system 給的情境或提問，再根據 user 的回答直接作答。" +
            "只輸出給使用者看的回答，不要加 JSON、不要用 ``` 包起來、不要另外描述流程。",
        },
        {
          role: "user",
          content:
            `目前主題：${state.current?.title || "未命名"}\n\n` +
            `System：\n${systemPrompt}\n\n` +
            `User：\n${userResponse}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err.error?.message || JSON.stringify(err);
    } catch {
      detail = await res.text();
    }
    if (res.status === 401) throw new Error("AI 鑰匙無效，請重新設定「AI 鑰匙」");
    throw new Error(`AI 回答失敗（${res.status}）：${detail}`);
  }
  const data = await res.json();
  const out = stripAiFences(data.choices?.[0]?.message?.content || "");
  if (!out) throw new Error("AI 沒有產出內容，請換個說法再試");
  return out;
}

async function askAiToRespond(systemPrompt, userResponse) {
  if (!state.current) throw new Error("請先在棋盤上點一份 SEED");
  setStatus("AI 正在回應，請稍候…");
  if (usePaidProxy()) return askAiViaProxy(systemPrompt, userResponse);
  return askAiDirect(systemPrompt, userResponse);
}

async function loadAppConfig() {
  try {
    const data = await fetchJson(`./config.json?ts=${Date.now()}`);
    state.config = { apiBase: data.apiBase || "" };
  } catch {
    state.config = { apiBase: "" };
  }
  updateAiUiMode();
}

function updateAiUiMode() {
  const paid = usePaidProxy();
  const memberBtn = $("member-setup");
  const aiKeyBtn = $("ai-key-setup");
  if (memberBtn) memberBtn.classList.toggle("hidden", !paid);
  if (aiKeyBtn) aiKeyBtn.classList.toggle("hidden", paid);
}

function buildSeedsPayload() {
  const byId = Object.fromEntries(state.seeds.map((s) => [s.id, s]));
  const base = state.catalog || { repo: REPO, branch: BRANCH, map: state.map, seeds: [] };
  const seeds = (base.seeds || state.seeds)
    .filter((s) => byId[s.id] && !byId[s.id].localOnly)
    .map((s) => {
    const live = byId[s.id] || s;
    return {
      ...s,
      col: live.col,
      row: live.row,
      title: live.title ?? s.title,
      alias: live.alias ?? s.alias,
      short: live.short ?? s.short,
      cover: live.cover ?? s.cover ?? null,
      path: live.path ?? s.path,
      blurb: live.blurb ?? s.blurb,
      id: live.id ?? s.id,
      archived: live.archived === true,
    };
  });
  // Include any new seeds only in state
  for (const s of state.seeds) {
    if (!s.localOnly && !seeds.some((x) => x.id === s.id)) {
      seeds.push({
        id: s.id,
        title: s.title,
        alias: s.alias,
        short: s.short,
        cover: s.cover ?? null,
        path: s.path,
        blurb: s.blurb,
        col: s.col,
        row: s.row,
        archived: s.archived === true,
      });
    }
  }
  return {
    ...base,
    repo: base.repo || REPO,
    branch: base.branch || BRANCH,
    map: {
      ...(base.map || {}),
      ...state.map,
    },
    seeds,
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function githubFetch(url, options = {}) {
  const token = getToken();
  if (!token) throw new Error("還沒設定 GitHub 鑰匙，請先按「設定鑰匙」");
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err.message || JSON.stringify(err);
    } catch {
      detail = await res.text();
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`權杖無效或權限不足（${res.status}）。請重新設定鑰匙，Contents 要 Read and write。`);
    }
    throw new Error(`GitHub 寫入失敗（${res.status}）：${detail}`);
  }
  return res.json();
}

async function putRepoFile(path, text, message) {
  const content = bytesToBase64(new TextEncoder().encode(text));
  let sha;
  try {
    const meta = await githubFetch(`${API}/contents/${path}?ref=${BRANCH}`);
    sha = meta.sha;
  } catch (err) {
    // 404 = new file
    if (!String(err.message || "").includes("404")) throw err;
  }
  const body = {
    message,
    content,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  return githubFetch(`${API}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function saveLayoutToRepo(saveInfo, opts = {}) {
  const { silent = false } = opts;
  if (!silent) setStatus("正在存棋盤…");
  const now = new Date().toISOString();
  let historyResult;
  try {
    historyResult = await appendLayoutVersion(saveInfo);
  } catch (err) {
    if (!silent) showToast(`版本紀錄寫入失敗：${err.message || err}`, "warn");
    throw err;
  }
  const { layout, rev } = historyResult;
  state.map.savedAt = now;
  state.map.layoutName = layout.name;
  state.map.layoutRev = rev;
  const payload = buildSeedsPayload();
  payload.map = {
    ...(payload.map || {}),
    savedAt: now,
    layoutName: layout.name,
    layoutRev: rev,
  };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const result = await putRepoFile(
    SEEDS_PATH,
    text,
    layoutSaveLabel(saveInfo, layout.name, rev)
  );
  state.catalog = JSON.parse(JSON.stringify(payload));
  localStorage.removeItem(LAYOUT_KEY);
  const toastMsg =
    saveInfo.mode === "new"
      ? `另存模板 · ${layout.name} v1`
      : `已存檔 · ${layout.name} v${rev}`;
  if (!silent) showToast(toastMsg, "ok");
  setStatus(silent ? `棋盤已自動儲存 · ${layout.name} v${rev}` : toastMsg);
  await refreshLayoutHistorySummary();
  updateSyncUi();
  return result;
}

async function buildSeedPack() {
  setStatus("正在打包全部筆記與棋盤設定…");
  // Prefer live positions from state
  const catalog = buildSeedsPayload();
  const files = {};
  const paths = new Set([SEEDS_PATH]);
  for (const s of catalog.seeds || []) {
    if (s.path) paths.add(s.path);
    if (s.cover && typeof s.cover === "string" && !/^https?:\/\//i.test(s.cover)) {
      paths.add(s.cover.replace(/^\.\//, ""));
    }
  }
  // Also pull common memory docs that might not be on map yet
  for (const extra of [
    "memory/index.md",
    "README.md",
    "memory/topics/core-features.md",
  ]) {
    paths.add(extra);
  }

  let ok = 0;
  let fail = 0;
  for (const path of paths) {
    try {
      const text = await fetchText(`${RAW}${path}?ts=${Date.now()}`);
      files[path] = text;
      ok++;
      setStatus(`打包中… ${ok} 個檔案`);
    } catch {
      fail++;
    }
  }

  let layout = null;
  try {
    layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
  } catch {
    layout = null;
  }

  return {
    format: "seed-pack",
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceRepo: REPO,
    sourceBranch: BRANCH,
    map: catalog.map,
    seeds: catalog.seeds,
    files,
    settings: {
      layout,
      // 刻意不含 GitHub／AI 鑰匙
    },
    meta: {
      fileCount: ok,
      skipped: fail,
      note: "跨平台還原用。不含鑰匙。類似可帶走的完整備份，不是 PDF。",
    },
  };
}

function downloadSeedPack(pack) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([`${JSON.stringify(pack, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SEED-pack-${stamp}.seedpack.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportSeedPack() {
  const pack = await buildSeedPack();
  downloadSeedPack(pack);
  setStatus(
    `已打包帶走：${pack.meta.fileCount} 個檔案` +
      (pack.meta.skipped ? `（略過 ${pack.meta.skipped}）` : "") +
      "。可拷到別的裝置再「還原回來」。"
  );
}

async function restoreSeedPack(pack) {
  if (!pack || pack.format !== "seed-pack") {
    throw new Error("這不是 SEED 封包（需要 format: seed-pack）");
  }
  if (!getToken()) {
    $("token-dialog").showModal();
    throw new Error("還原需要 GitHub 鑰匙，請先設定");
  }
  const files = pack.files || {};
  const paths = Object.keys(files);
  if (!paths.length) throw new Error("封包裡沒有檔案內容");

  // Ensure seeds.json reflects pack catalog if present
  if (pack.seeds && pack.map) {
    const seedsJson = {
      repo: REPO,
      branch: BRANCH,
      map: pack.map,
      seeds: pack.seeds,
    };
    files[SEEDS_PATH] = `${JSON.stringify(seedsJson, null, 2)}\n`;
  }

  let i = 0;
  const allPaths = Object.keys(files);
  for (const path of allPaths) {
    i++;
    setStatus(`還原中… ${i}/${allPaths.length}：${path}`);
    await putRepoFile(path, files[path], `還原 SEED 封包：${path}`);
  }

  if (pack.settings?.layout) {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(pack.settings.layout));
  } else {
    localStorage.removeItem(LAYOUT_KEY);
  }

  state.catalog = null;
  await loadCatalog();
  setStatus(`還原完成：寫回 ${allPaths.length} 個檔案。可重新整理確認。`);
}

async function selectSeed(seed) {
  state.current = seed;
  if (isApprovalInstance(seed)) {
    const config = ensureApprovalModel(seed);
    if (!config.roleViewInitialized) {
      syncApprovalActiveRole(config);
      config.roleViewInitialized = true;
      persistStructuredSeed();
    }
  }
  state.importedOriginal = await loadOriginalDocument(seed.id).catch(() => null);
  state.importedText = state.importedOriginal?.importedText || "";
  state.originalText = "";
  state.workingText = "";
  state.draftAccepted = false;
  setStatus(`已選：${seed.title}`);
  await Promise.all([readCurrent(), loadVersions()]);
  showPanel("read");
}

async function loadSeedText() {
  if (!state.current) throw new Error("請先在棋盤上點一份 SEED");
  if (state.current.localOnly) {
    const text = localStorage.getItem(`seed-draft:${state.current.id}`) || "";
    state.originalText = text;
    state.workingText = text;
    return text;
  }
  const original = await fetchText(`${RAW}${state.current.path}?ts=${Date.now()}`);
  const draft = localStorage.getItem(`seed-draft:${state.current.id}`);
  state.originalText = original;
  state.workingText = draft !== null ? draft : original;
  return state.workingText;
}

async function readCurrent() {
  if (!state.current) {
    setStatus("請先在棋盤上點一份 SEED");
    showPanel("list");
    return;
  }
  setStatus("正在打開編輯…");
  const text = await loadSeedText();
  if ($("read-title")) $("read-title").textContent = state.current.title;
  setEditMode(text);
  setStatus(`編輯：${state.current.title}（按 Save 建立版本）`);
  showPanel("read");
}

async function startEdit() {
  if (!state.current) {
    setStatus("請先在棋盤上點一份 SEED");
    showPanel("list");
    return;
  }
  if (!state.originalText) await loadSeedText();
  if ($("read-title")) $("read-title").textContent = state.current.title;
  setEditMode(state.workingText ?? state.originalText);
  setStatus("編輯模式：框內直接改，會自動儲存");
  showPanel("read");
}

function showDraftDiff() {
  const parts = diffLines(state.originalText, state.workingText);
  renderDiffA4(parts);
  const adds = parts.filter((p) => p.type === "add").length;
  const dels = parts.filter((p) => p.type === "del").length;
  // Fill selects with pseudo options for this draft session
  $("diff-old").innerHTML = `<option value="original">存進倉庫前（舊的）</option>`;
  $("diff-new").innerHTML = `<option value="draft">你這次改的（新的）</option>`;
  setStatus(`這次修改：新增 ${adds} 行，刪除 ${dels} 行`);
  showPanel("diff");
}

function renderDiffA4(parts) {
  const out = $("diff-out");
  out.innerHTML = "";
  for (const part of parts) {
    const line = document.createElement("div");
    line.className = `diff-frame ${part.type}`;
    line.textContent = part.text || " ";
    if (part.type === "del") line.title = "刪除內容";
    if (part.type === "add") line.title = "變更／新增內容";
    out.appendChild(line);
  }
}

function keepDraft() {
  state.draftAccepted = true;
  setStatus("已採用這次的修改（還在畫面上；要永久保存請按「存成一版」）");
  updateDraftBar();
}

function discardDraft() {
  state.workingText = state.originalText;
  state.draftAccepted = false;
  if (state.editing) {
    setEditMode(state.originalText);
  } else {
    setViewMode(state.originalText);
  }
  updateDraftBar();
  setStatus("已放棄這次的修改，回到存進倉庫前的內容");
}

async function saveVersionToRepo(versionName, opts = {}) {
  const { silent = false, actor = "人" } = opts;
  if (!state.current) throw new Error("請先選一份筆記");
  if (state.editing || state.frames?.length) syncWorkingFromFrames();
  const text = state.workingText ?? state.originalText;
  if (text == null) throw new Error("沒有可存的內容");
  const label = versionName || defaultVersionName();
  if (state.current.localOnly) {
    const versions = loadLocalVersions(state.current.id);
    const version = {
      sha: `local-${Date.now().toString(36)}`,
      when: new Date().toISOString(),
      message: `${actor}｜Save｜${label}`,
      author: actor === "AI" ? "AI" : "你",
      actor,
      text,
    };
    versions.unshift(version);
    localStorage.setItem(`seed-versions:${state.current.id}`, JSON.stringify(versions.slice(0, 30)));
    state.originalText = text;
    localStorage.removeItem(`seed-draft:${state.current.id}`);
    await loadVersions();
    setStatus(`已建立版本：${formatWhen(version.when)} · ${version.author}`);
    return version;
  }
  if (!silent) setStatus("正在存成一版…");
  const content = bytesToBase64(new TextEncoder().encode(text));
  const path = state.current.path;
  const meta = await githubFetch(`${API}/contents/${path}?ref=${BRANCH}`);
  const result = await githubFetch(`${API}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `${actor}｜Save｜${label}`,
      content,
      sha: meta.sha,
      branch: BRANCH,
    }),
  });
  state.originalText = text;
  state.workingText = text;
  state.draftAccepted = false;
  if ($("read-title")) $("read-title").textContent = state.current.title;
  if (!silent) {
    setEditMode(text);
    await loadVersions();
    let msg = `已存成一版「${label}」（${String(result.commit?.sha || "").slice(0, 7)}）`;
    const afterPoints = awardCommunityPoints(COMMUNITY_SAVE_BONUS, label);
    if (afterPoints != null) msg += `；+${COMMUNITY_SAVE_BONUS} 點（現有 ${afterPoints} 點）`;
    setStatus(msg);
    showPanel("read");
  } else {
    localStorage.removeItem(`seed-draft:${state.current.id}`);
  }
  return result;
}

function loadLocalVersions(id) {
  try {
    const versions = JSON.parse(localStorage.getItem(`seed-versions:${id}`) || "[]");
    return Array.isArray(versions) ? versions : [];
  } catch {
    return [];
  }
}

function formatWhen(iso) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function loadVersions() {
  if (!state.current) return;
  setStatus("正在載入舊版本…");
  if (state.current.localOnly) {
    state.versions = loadLocalVersions(state.current.id);
  } else {
    const path = encodeURIComponent(state.current.path);
    const commits = await fetchJson(
      `${API}/commits?sha=${BRANCH}&path=${path}&per_page=30`
    );
    state.versions = commits.map((c) => ({
      sha: c.sha,
      short: c.sha.slice(0, 7),
      when: c.commit.author?.date || c.commit.committer?.date,
      message: (c.commit.message || "").split("\n")[0],
      author: c.commit.author?.name || c.author?.login || "未知",
      actor: /^AI[｜:]/.test(c.commit.message || "") ? "AI" : "人",
    }));
  }

  const list = $("version-list");
  list.innerHTML = "";
  if (!state.versions.length) {
    list.innerHTML = "<li class='meta'>還沒有版本紀錄</li>";
    fillDiffSelects();
    setStatus("還沒有版本紀錄；按 Save 建立第一版");
    return;
  }

  for (const v of state.versions) {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(formatWhen(v.when))}</strong>
        <div class="meta">${escapeHtml(v.author || "未知")}－${v.actor === "AI" ? "AI 編輯" : "編輯"}－${escapeHtml(v.message)}</div>
      </div>
      <div class="row-actions">
        <button type="button" class="btn" data-side="open">打開這版</button>
      </div>
    `;
    li.querySelector('[data-side="open"]').addEventListener("click", async () => {
      const text = await fetchFileAt(v.sha);
      state.originalText = state.originalText || text;
      state.workingText = text;
      $("read-title").textContent = `${state.current.title}（舊版 ${formatWhen(v.when)}）`;
      setViewMode(text);
      setStatus("已打開舊版預覽。若要用這版繼續改，按「自己改」再「存成一版」");
      showPanel("read");
    });
    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn btn-primary";
    useBtn.textContent = "用這版繼續改";
    useBtn.addEventListener("click", async () => {
      const text = await fetchFileAt(v.sha);
      if (!state.originalText) await loadSeedText();
      state.workingText = text;
      $("read-title").textContent = `${state.current.title}（從舊版繼續）`;
      setEditMode(text);
      setStatus("已載入舊版當草稿；確認後按「存成一版」才會寫回倉庫");
      showPanel("read");
    });
    li.querySelector(".row-actions").appendChild(useBtn);
    list.appendChild(li);
  }

  fillDiffSelects();
  setStatus(`已載入 ${state.versions.length} 個版本`);
}

function fillDiffSelects() {
  const single = $("diff-version");
  if (single) {
    single.innerHTML = "";
    const current = document.createElement("option");
    current.value = "current";
    current.textContent = "目前畫面內容 · 尚未 Save 的草稿";
    single.appendChild(current);
    state.versions.forEach((v, index) => {
      const opt = document.createElement("option");
      opt.value = v.sha;
      const actor = v.actor || (/^AI[｜:]/.test(v.message || "") ? "AI" : "人");
      opt.textContent = `${v.author || "未知"}－${actor === "AI" ? "AI 編輯" : "編輯"}－${formatWhen(v.when)}`;
      opt.disabled = index === state.versions.length - 1;
      single.appendChild(opt);
    });
    single.value = "current";
  }
  for (const id of ["diff-old", "diff-new"]) {
    const sel = $(id);
    const prev = sel.value;
    sel.innerHTML = "";
    for (const v of state.versions) {
      const opt = document.createElement("option");
      opt.value = v.sha;
      opt.textContent = `${formatWhen(v.when)} — ${v.message}`;
      sel.appendChild(opt);
    }
    if (prev && [...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
    }
  }
  if (state.versions.length >= 2) {
    $("diff-old").value = state.versions[1].sha;
    $("diff-new").value = state.versions[0].sha;
  }
}

async function fetchFileAt(sha) {
  if (String(sha).startsWith("local-")) {
    const version = state.versions.find((v) => v.sha === sha);
    if (version) return version.text || "";
  }
  const url = `${API}/contents/${state.current.path}?ref=${sha}`;
  const data = await fetchJson(url);
  if (data.encoding === "base64" && data.content) {
    const bin = atob(data.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  throw new Error("無法解讀檔案內容");
}

function diffLines(aText, bText) {
  const a = aText.split("\n");
  const b = bText.split("\n");
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      parts.push({ type: "del", text: a[i] });
      i++;
    } else {
      parts.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) parts.push({ type: "del", text: a[i++] });
  while (j < m) parts.push({ type: "add", text: b[j++] });
  return parts;
}

async function runDiff() {
  if (!state.current) {
    setStatus("請先在棋盤上點一份 SEED");
    showPanel("list");
    return;
  }
  if (!state.versions.length) await loadVersions();
  const selectedSha = $("diff-version")?.value;
  const isCurrent = selectedSha === "current";
  const selectedIndex = state.versions.findIndex((v) => v.sha === selectedSha);
  if ((!isCurrent && (selectedIndex < 0 || selectedIndex >= state.versions.length - 1)) || !state.versions.length) {
    $("diff-meta").textContent = "這筆紀錄沒有更早版本可比對。";
    $("diff-out").innerHTML = "";
    return;
  }
  const newer = isCurrent
    ? {
        author: "你",
        actor: state.current.lastActor || "人",
        when: new Date().toISOString(),
      }
    : state.versions[selectedIndex];
  const older = isCurrent ? state.versions[0] : state.versions[selectedIndex + 1];
  setStatus("正在比對差異…");
  if (isCurrent) syncWorkingFromFrames();
  const oldText = await fetchFileAt(older.sha);
  const newText = isCurrent ? state.workingText : await fetchFileAt(newer.sha);
  const actor = newer.actor || (/^AI[｜:]/.test(newer.message || "") ? "AI" : "人");
  $("diff-meta").innerHTML = `
    <strong>${escapeHtml(newer.author || "未知")}</strong>
    <span>－ ${actor === "AI" ? "AI 編輯" : "編輯"} －</span>
    <time>${escapeHtml(formatWhen(newer.when))}</time>
    <span>${isCurrent ? "目前畫面自動比對上次 Save" : "自動比對上一次"}：${escapeHtml(formatWhen(older.when))}</span>
  `;
  const parts = diffLines(oldText, newText);
  renderDiffA4(parts);
  const adds = parts.filter((p) => p.type === "add").length;
  const dels = parts.filter((p) => p.type === "del").length;
  setStatus(`差異：新增 ${adds} 行，刪除 ${dels} 行`);
  showPanel("diff");
}

document.querySelector("#chrome").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  try {
    if (action === "list") showPanel("list");
    if (action === "read") await readCurrent();
    if (action === "edit") await startEdit();
    if (action === "ai") {
      if (!state.current) {
        setStatus("請先在棋盤上點一份 SEED");
        showPanel("list");
        return;
      }
      if (usePaidProxy()) {
        if (!getMemberCode()) {
          $("member-dialog").showModal();
          setStatus("請先輸入會員碼，再讓 AI 回答");
          return;
        }
      } else if (!getAiKey()) {
        $("ai-key-dialog").showModal();
        setStatus("請先設定 AI 鑰匙，再讓 AI 回答");
        return;
      }
      $("ai-system").value = state.current
        ? `請根據「${state.current.title}」這份內容，先理解 system 的情境，再根據 user 的回答直接回應。`
        : "";
      $("ai-user").value = "";
      $("ai-answer").textContent = "";
      $("ai-answer-box").classList.add("hidden");
      $("ai-dialog").showModal();
      $("ai-user").focus();
    }
    if (action === "save-version") {
      if (!state.current) {
        setStatus("請先在棋盤上點一份 SEED");
        showPanel("list");
        return;
      }
      if (state.editing) syncWorkingFromFrames();
      if (!getToken()) {
        $("token-dialog").showModal();
        setStatus("請先設定鑰匙，再存成一版");
        return;
      }
      $("version-name").value = defaultVersionName();
      $("version-dialog").showModal();
    }
    if (action === "history") {
      if (!state.current) {
        setStatus("請先在棋盤上點一份 SEED");
        showPanel("list");
        return;
      }
      if (!state.versions.length) await loadVersions();
      showPanel("history");
    }
    if (action === "diff") {
      if (!state.current) {
        setStatus("請先在棋盤上點一份 SEED");
        showPanel("list");
        return;
      }
      if (state.editing) state.workingText = $("edit-body").value;
      if (state.workingText && state.workingText !== state.originalText) {
        showDraftDiff();
        return;
      }
      if (!state.versions.length) await loadVersions();
      fillDiffSelects();
      showPanel("diff");
    }
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("edit-body").addEventListener("input", () => {
  state.workingText = $("edit-body").value;
  scheduleContentAutosave();
});

$("mode-chips")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-chip");
  if (!btn) return;
  setDocMode(btn.dataset.mode).catch((err) => setStatus(err.message || String(err)));
});

$("edit-save")?.addEventListener("click", () => {
  saveCurrentVersion().catch((err) => setStatus(err.message || String(err)));
});

$("version-form").addEventListener("submit", async (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") return;
  e.preventDefault();
  const name = $("version-name").value.trim() || defaultVersionName();
  $("version-dialog").close();
  try {
    if (state.editing) state.workingText = $("edit-body").value;
    await saveVersionToRepo(name);
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("reset-layout").addEventListener("click", async () => {
  closeAllPopovers();
  try {
    await resetPuzzleLayout();
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("header-reset-layout").addEventListener("click", async () => {
  try {
    await resetPuzzleLayout();
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("header-save-layout").addEventListener("click", async () => {
  try {
    await savePuzzleLayout();
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("token-setup").addEventListener("click", () => {
  closeAllPopovers();
  $("token-input").value = getToken() ? "••••••••（已儲存，要換就貼新的）" : "";
  $("token-dialog").showModal();
});

$("token-form").addEventListener("submit", (e) => {
  const submitter = e.submitter;
  const value = submitter && submitter.value;
  if (value === "cancel") return;
  const raw = $("token-input").value.trim();
  if (raw && !raw.startsWith("••")) {
    setToken(raw);
    setStatus("鑰匙已存在這台瀏覽器，可以按「存到倉庫」");
  } else if (!getToken()) {
    e.preventDefault();
    setStatus("請貼上 GitHub 權杖");
  }
});

$("token-clear").addEventListener("click", () => {
  setToken("");
  $("token-input").value = "";
  setStatus("已清除鑰匙");
});

$("ai-key-setup").addEventListener("click", () => {
  closeAllPopovers();
  $("ai-key-input").value = getAiKey() ? "••••••••（已儲存，要換就貼新的）" : "";
  $("ai-base-input").value = getAiBase();
  $("ai-key-dialog").showModal();
});

$("member-setup").addEventListener("click", () => {
  $("member-input").value = getMemberCode() ? "••••••••（已儲存，要換就貼新的）" : "";
  $("member-dialog").showModal();
});

$("member-form").addEventListener("submit", (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") return;
  const raw = $("member-input").value.trim();
  if (raw && !raw.startsWith("••")) setMemberCode(raw);
  if (!getMemberCode()) {
    e.preventDefault();
    setStatus("請貼上會員碼");
    return;
  }
  setStatus("會員碼已存好，可以按「AI 回答」");
});

$("member-clear").addEventListener("click", () => {
  setMemberCode("");
  $("member-input").value = "";
  setStatus("已清除會員碼");
});

$("ai-key-form").addEventListener("submit", (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") return;
  const raw = $("ai-key-input").value.trim();
  if (raw && !raw.startsWith("••")) setAiKey(raw);
  setAiBase($("ai-base-input").value.trim() || DEFAULT_AI_BASE);
  if (!getAiKey()) {
    e.preventDefault();
    setStatus("請貼上 AI 鑰匙");
    return;
  }
  setStatus("AI 鑰匙已存好，可以按「AI 回答」");
});

$("ai-key-clear").addEventListener("click", () => {
  setAiKey("");
  setAiBase(DEFAULT_AI_BASE);
  $("ai-key-input").value = "";
  $("ai-base-input").value = DEFAULT_AI_BASE;
  setStatus("已清除 AI 鑰匙");
});

$("ai-form").addEventListener("submit", async (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") return;
  e.preventDefault();
  const systemPrompt = $("ai-system").value.trim();
  const userResponse = $("ai-user").value.trim();
  if (!systemPrompt || !userResponse) {
    setStatus("請先填好 System 與 User 兩段內容");
    return;
  }
  try {
    const answer = await askAiToRespond(systemPrompt, userResponse);
    $("ai-answer").textContent = answer;
    $("ai-answer-box").classList.remove("hidden");
    setStatus("AI 已根據你的回答回應");
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("template-setup").addEventListener("click", () => {
  closeAllPopovers();
  $("template-select").value = state.map.template || "grid-10";
  $("puzzle-kind").value = state.map.kind || "personal";
  $("puzzle-visibility").value = state.map.visibility || "public";
  syncVisibilityField();
  $("template-dialog").showModal();
});

function syncVisibilityField() {
  const personal = $("puzzle-kind").value === "personal";
  $("visibility-label").style.display = personal ? "" : "none";
  $("template-hint").textContent = personal
    ? "個人版可設公開或私人。套用模板會改格子大小；記得再「存棋盤位置」。"
    : "社群版：點數搶空格。越靠近中心越貴；存成一版可賺點數。";
}

$("puzzle-kind").addEventListener("change", syncVisibilityField);

$("claim-form").addEventListener("submit", (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") {
    state.claimCell = null;
    return;
  }
  e.preventDefault();
  const seedId = $("claim-seed-select").value;
  if (!seedId) {
    setStatus("請選一顆種子");
    return;
  }
  commitClaim(seedId);
  $("claim-dialog").close();
});

$("template-form").addEventListener("submit", async (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.value === "cancel") return;
  e.preventDefault();
  const templateId = $("template-select").value;
  state.map.kind = $("puzzle-kind").value;
  state.map.visibility =
    state.map.kind === "personal" ? $("puzzle-visibility").value : "public";
  applyPuzzleTemplate(templateId);
  $("template-dialog").close();
  const tplLabel = PUZZLE_TEMPLATES[templateId]?.label || templateId;
  updateSyncUi();
  setStatus(
    state.map.kind === "community"
      ? `已套用「${tplLabel}」（社群版搶位之後再接）`
      : `已套用「${tplLabel}」；要永久保存請「存棋盤位置」`
  );
  if (state.map.kind !== "community") {
    await maybePromptSaveLayout(`已套用「${tplLabel}」`);
  }
});

$("save-layout").addEventListener("click", async () => {
  closeAllPopovers();
  try {
    await savePuzzleLayout({ forceDialog: true });
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("pack-export").addEventListener("click", () => {
  closeAllPopovers();
  exportSeedPack().catch((err) => setStatus(err.message || String(err)));
});

$("pack-import").addEventListener("click", () => {
  closeAllPopovers();
  $("pack-file").click();
});

$("pack-file").addEventListener("change", async () => {
  const file = $("pack-file").files && $("pack-file").files[0];
  $("pack-file").value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const pack = JSON.parse(text);
    const n = Object.keys(pack.files || {}).length;
    const ok = window.confirm(
      `要用這個封包還原嗎？\n\n檔案約 ${n} 個\n匯出時間：${pack.exportedAt || "未知"}\n\n會覆寫倉庫裡同名檔案（不含鑰匙）。`
    );
    if (!ok) {
      setStatus("已取消還原");
      return;
    }
    await restoreSeedPack(pack);
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("seed-add")?.addEventListener("click", addSeed);
$("system-seed-open")?.addEventListener("click", () => openSystemSeedBrowse("types"));

$("seed-create-dialog")?.addEventListener("click", (e) => {
  if (e.target.closest("[data-seed-create-close]")) {
    $("seed-create-dialog").close();
    return;
  }
  const choice = e.target.closest("[data-seed-type]");
  if (!choice) return;
  const seedType = choice.dataset.seedType;
  $("seed-create-dialog").close();
  const catalog = loadSystemSeedCatalog();
  const blank = (catalog[seedType] || []).find((item) => item.builtin) || catalog[seedType]?.[0];
  if (blank) openSystemSeedTemplate(blank, seedType);
  else openSystemSeedBrowse("types");
});

$("seed-tray-list")?.addEventListener("dragover", (e) => {
  e.preventDefault();
  $("seed-tray-list").classList.add("drop-target");
});
$("seed-tray-list")?.addEventListener("dragleave", () => {
  $("seed-tray-list").classList.remove("drop-target");
});
$("seed-tray-list")?.addEventListener("drop", (e) => {
  e.preventDefault();
  $("seed-tray-list").classList.remove("drop-target");
  const id = e.dataTransfer.getData("text/seed-id") || state.dragId;
  if (id) archiveSeed(id);
});

$("diff-version")?.addEventListener("change", () => {
  runDiff().catch((err) => setStatus(err.message || String(err)));
});

$("export-bar")?.addEventListener("click", (e) => {
  const button = e.target.closest("[data-export]");
  if (button) exportA4(button.dataset.export).catch((err) => setStatus(err.message || String(err)));
});

$("document-import")?.addEventListener("click", () => $("document-file").click());
$("document-file")?.addEventListener("change", () => {
  const file = $("document-file").files?.[0];
  importDocumentFile(file)
    .catch((err) => setStatus(err.message || String(err)))
    .finally(() => {
      $("document-file").value = "";
    });
});

function closeAllPopovers() {
  setPopoverOpen(null);
  setPathOpen(false);
}

function buildPathSteps() {
  const steps = [
    {
      key: "list",
      label: "首頁",
      depth: 0,
      go: () => showPanel("list"),
    },
  ];
  if (state.panel === "system-seed") {
    steps.push({
      key: "system-seed",
      label: "Seed",
      depth: 1,
      go: () => openSystemSeedBrowse("types"),
    });
    return steps;
  }
  if (state.current && state.panel !== "list") {
    steps.push({
      key: "seed",
      label: state.current.title,
      depth: 1,
      go: async () => {
        state.docMode = "edit";
        showPanel("read");
        if (!state.originalText) await loadSeedText();
        setEditMode(state.workingText ?? state.originalText);
      },
    });
  }
  return steps;
}

function renderPathLadder() {
  const ladder = $("path-ladder");
  if (!ladder) return;
  const steps = buildPathSteps();
  ladder.innerHTML = "";
  steps.forEach((step, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "path-step";
    if (index === steps.length - 1) btn.classList.add("is-current");
    btn.dataset.depth = String(step.depth);
    btn.textContent = step.label;
    btn.addEventListener("click", () => {
      step.go();
      setPathOpen(false);
    });
    ladder.appendChild(btn);
  });
}

function renderPathRecent() {
  const wrap = $("path-recent");
  if (!wrap) return;
  const list = loadRecentPaths();
  wrap.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "path-recent-empty";
    empty.textContent = "還沒有最近位置。點進種子後會出現這裡。";
    wrap.appendChild(empty);
    return;
  }
  for (const entry of list.slice(0, 5)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "path-recent-item";
    btn.textContent = entry.label;
    btn.title = entry.label;
    btn.addEventListener("click", () => {
      setPathOpen(false);
      goRecentPath(entry);
    });
    wrap.appendChild(btn);
  }
}

function setPathOpen(open) {
  const pop = $("path-popover");
  const btn = $("brand-home");
  if (!pop) return;
  if (open) {
    renderPathLadder();
    renderPathRecent();
    positionPopover(pop, btn);
    setPopoverOpen(null);
  }
  pop.classList.toggle("hidden", !open);
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  updatePathBrand();
}

function updatePathBrand() {
  const btn = $("brand-home");
  const crumb = $("path-crumb");
  if (!btn) return;
  const steps = buildPathSteps();
  if (crumb) {
    crumb.innerHTML = "";
    steps.forEach((step, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "›";
        crumb.appendChild(sep);
      }
      const el = document.createElement("button");
      el.type = "button";
      el.className = "crumb-item" + (index === steps.length - 1 ? " is-current" : "");
      el.textContent = step.label;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        step.go();
      });
      crumb.appendChild(el);
    });
  }
  btn.title = "點 SEED 開啟路徑選單";
  btn.classList.toggle("has-path", state.panel !== "list");
}

function setPopoverOpen(name) {
  if (name) setPathOpen(false);
  const me = $("me-popover");
  const notify = $("notify-popover");
  const meBtn = $("header-me-btn");
  const notifyBtn = $("notify-btn");
  if (me) me.classList.toggle("hidden", name !== "me");
  if (notify) notify.classList.toggle("hidden", name !== "notify");
  if (meBtn) meBtn.setAttribute("aria-expanded", name === "me" ? "true" : "false");
  if (notifyBtn) notifyBtn.setAttribute("aria-expanded", name === "notify" ? "true" : "false");
  if (name === "me") {
    positionPopover(me, meBtn);
    updateSyncUi();
  } else if (name === "notify") {
    positionPopover(notify, notifyBtn);
    renderNotifyChips();
  }
}

function positionPopover(popover, anchor) {
  if (!popover || !anchor) return;
  const chrome = $("chrome");
  if (!chrome) return;
  const chromeRect = chrome.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 16);
  let left = rect.left - chromeRect.left;
  if (left + width > chromeRect.width - 8) {
    left = Math.max(8, chromeRect.width - width - 8);
  }
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${rect.bottom - chromeRect.top + 6}px`;
  popover.style.right = "auto";
}

function renderNotifyChips() {
  const wrap = $("notify-chips");
  if (!wrap) return;
  const chips =
    state.panel === "list"
      ? [
          { label: "存棋盤", run: () => savePuzzleLayout() },
          { label: "排版紀錄", run: () => openLayoutHistoryDialog() },
          { label: "打包帶走", run: () => exportSeedPack() },
        ]
      : [
          { label: "回棋盤", run: () => showPanel("list") },
          { label: "存成一版", run: () => $("version-dialog").showModal() },
          { label: "AI 回答", run: () => $("ai-dialog").showModal() },
        ];
  wrap.innerHTML = "";
  for (const c of chips) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "notify-chip";
    b.textContent = c.label;
    b.addEventListener("click", () => {
      closeAllPopovers();
      c.run();
    });
    wrap.appendChild(b);
  }
}

function handleNotifyInput(text) {
  const t = (text || "").trim();
  if (!t) return;
  $("notify-input").value = "";
  closeAllPopovers();
  if (/存|儲存|存檔/.test(t)) {
    if (state.panel === "list") savePuzzleLayout();
    else $("version-dialog").showModal();
    return;
  }
  if (/重置|還原/.test(t) && state.panel === "list") {
    resetPuzzleLayout();
    return;
  }
  if (/模板|下載/.test(t)) {
    setPopoverOpen("me");
    return;
  }
  if (state.current && /ai|改|潤稿/.test(t.toLowerCase())) {
    $("ai-system").value = "請根據 system 與 user 的內容直接回應。";
    $("ai-user").value = t;
    $("ai-answer-box").classList.add("hidden");
    $("ai-dialog").showModal();
    return;
  }
  showToast("之後會由 AI 在這裡回答；現在先試上方快捷按鈕", "info");
}

$("brand-home").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("path-popover").classList.contains("hidden");
  setPathOpen(open);
});

$("header-me-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("me-popover").classList.contains("hidden");
  setPopoverOpen(open ? "me" : null);
  updateSyncUi();
});

$("notify-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const open = $("notify-popover").classList.contains("hidden");
  setPopoverOpen(open ? "notify" : null);
});

$("info-kind-switch").addEventListener("click", () => {
  toggleVisibilityPresentation();
});

$("info-layout-history").addEventListener("click", () => {
  closeAllPopovers();
  openLayoutHistoryDialog();
});

$("notify-form").addEventListener("submit", (e) => {
  e.preventDefault();
  handleNotifyInput($("notify-input").value);
});

document.addEventListener("click", (e) => {
  const me = $("me-popover");
  const notify = $("notify-popover");
  const path = $("path-popover");
  const meBtn = $("header-me-btn");
  const notifyBtn = $("notify-btn");
  const brandBtn = $("brand-home");
  if (me && !me.classList.contains("hidden")) {
    if (!me.contains(e.target) && !meBtn.contains(e.target)) setPopoverOpen(null);
  }
  if (notify && !notify.classList.contains("hidden")) {
    if (!notify.contains(e.target) && !notifyBtn.contains(e.target)) setPopoverOpen(null);
  }
  if (path && !path.classList.contains("hidden")) {
    if (!path.contains(e.target) && !brandBtn.contains(e.target)) setPathOpen(false);
  }
});

loadAppConfig()
  .then(() => loadCatalog())
  .then(() => {
    updatePathBrand();
    updateSyncUi();
    showToast("拖拉棋盤會自動存；點 SEED 直接編輯", "info");
  })
  .catch((err) => setStatus(err.message || String(err)));
