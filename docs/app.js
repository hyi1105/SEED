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
const DEFAULT_AI_BASE = "https://api.openai.com/v1";

const state = {
  seeds: [],
  map: {
    cols: 10,
    rows: 10,
    title: "知識拼圖",
    note: "",
    kind: "personal",
    visibility: "public",
    template: "grid-10",
  },
  catalog: null,
  config: { apiBase: "" },
  current: null,
  versions: [],
  panel: "list",
  dragId: null,
  touchDragging: false,
  touchHighlightCell: null,
  claimCell: null,
  suppressClick: false,
  originalText: "",
  workingText: "",
  editing: false,
  draftAccepted: false,
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
  return full.replace(/^空白拼圖\s*/, "");
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
  for (const id of ["list", "read", "history", "diff"]) {
    $(`panel-${id}`).classList.toggle("hidden", id !== name);
  }

  const onMap = name === "list";
  const chrome = $("chrome");
  const docBar = $("doc-bar");
  if (chrome) chrome.dataset.mode = onMap ? "map" : "doc";
  if (docBar) {
    if (onMap) docBar.setAttribute("hidden", "");
    else docBar.removeAttribute("hidden");
  }
  closeAllPopovers();

  document.querySelectorAll("#doc-bar .btn[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const mapActions = {
      list: "list",
      read: "read",
      edit: "read",
      history: "history",
      diff: "diff",
    };
    if (mapActions[action]) {
      const pressed =
        mapActions[action] === name &&
        (action !== "edit" || state.editing) &&
        (action !== "read" || !state.editing);
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  });

  const stage = document.querySelector(".stage");
  if (stage) stage.scrollTop = 0;
  const panel = $(`panel-${name}`);
  if (panel) panel.scrollTop = 0;
  updatePathBrand();
  updateSyncUi();
}

function updateDraftBar() {
  const dirty = state.editing && state.workingText !== state.originalText;
  $("draft-bar").classList.toggle("hidden", !dirty);
}

function setViewMode(text) {
  state.editing = false;
  $("read-body").classList.remove("hidden");
  $("edit-body").classList.add("hidden");
  $("read-body").textContent = text;
  $("draft-bar").classList.add("hidden");
}

function setEditMode(text) {
  state.editing = true;
  $("read-body").classList.add("hidden");
  $("edit-body").classList.remove("hidden");
  $("edit-body").value = text;
  state.workingText = text;
  updateDraftBar();
  $("edit-body").focus();
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
  return state.seeds.find((s) => s.col === col && s.row === row);
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
  if (saveInfo.mode === "new") return `另存拼圖：${name} v1`;
  return `存拼圖：${name} v${rev}`;
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
    $("map-title").textContent = state.map.title || "知識拼圖";
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
    list.innerHTML = '<li class="layout-history-empty">還沒有排版紀錄。先按存檔圖示或選單「存拼圖位置」。</li>';
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
  return state.seeds.some((s) => {
    const base = baseSeeds[s.id];
    return !base || base.col !== s.col || base.row !== s.row;
  });
}

function updateSyncUi() {
  const dirty = hasUnsavedPuzzleChanges();
  const savedAt = state.catalog?.map?.savedAt || null;

  const kindEl = $("header-kind-label");
  if (kindEl) kindEl.textContent = puzzleKindLabel();

  const dot = $("sync-dot");
  if (dot) dot.dataset.state = dirty ? "dirty" : savedAt ? "saved" : "unknown";

  const infoKindSwitch = $("info-kind-switch");
  if (infoKindSwitch) infoKindSwitch.textContent = puzzleKindLabel();

  const infoSaved = $("info-saved-at");
  if (infoSaved) {
    if (savedAt) {
      const dateLabel = formatSavedAtDate(savedAt);
      infoSaved.textContent = dirty
        ? `${dateLabel}（有未存異動）`
        : dateLabel;
    } else {
      infoSaved.textContent = dirty ? "尚未存過（有異動）" : "尚未存過";
    }
  }

  const infoExtra = $("info-extra");
  if (infoExtra) {
    const parts = [];
    if (state.map.kind === "community") {
      const comm = loadCommunity();
      parts.push(`點數 ${comm.points}；存成一版 +${COMMUNITY_SAVE_BONUS} 點`);
    }
    if (state.map.kind === "personal" && state.map.visibility === "private") {
      parts.push("私人僅標記；真正隱私需登入（之後做）");
    }
    infoExtra.textContent = parts.join(" · ");
    infoExtra.classList.toggle("hidden", !parts.length);
  }

  const tplBtn = $("info-template");
  if (tplBtn) tplBtn.textContent = templateDisplayLabel();

  updateHeaderLayoutActions();
  renderNotifyChips();
}

async function refreshLayoutHistorySummary() {
  const histBtn = $("info-layout-history");
  if (!histBtn) return;
  const name = getCurrentLayoutName();
  const rev = getCurrentLayoutRev();
  if (name && rev) {
    histBtn.textContent = `${name} · v${rev}`;
    histBtn.title = `目前模板：${name} v${rev} · 點開看全部`;
    return;
  }
  try {
    const history = normalizeLayoutHistory(await loadLayoutHistoryFile());
    const latest = history.layouts[0];
    const latestRev = latest?.versions?.[0];
    if (latest && latestRev) {
      histBtn.textContent = `${latest.name} · v${latestRev.rev}`;
      histBtn.title = `最後排版：${formatSavedAt(latestRev.savedAt)} · 點開看全部`;
    } else {
      histBtn.textContent = "尚無紀錄";
      histBtn.title = "還沒存過排版；先按存檔圖示";
    }
  } catch {
    histBtn.textContent = "尚無紀錄";
  }
}

function updateHeaderLayoutActions() {
  const wrap = $("header-layout-actions");
  if (!wrap) return;
  const onMap = state.panel === "list";
  wrap.classList.toggle("hidden", !(onMap && hasUnsavedPuzzleChanges()));
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
  const { forceDialog = false } = opts;
  if (!getToken()) {
    $("token-dialog").showModal();
    showToast("請先設定鑰匙，再存拼圖", "warn");
    return;
  }
  let saveInfo;
  if (!forceDialog && getCurrentLayoutName()) {
    saveInfo = { mode: "minor" };
  } else {
    saveInfo = await promptLayoutName();
    if (!saveInfo) return;
  }
  await saveLayoutToRepo(saveInfo);
}

async function maybePromptSaveLayout(reason) {
  if (!getToken()) return;
  const ok = window.confirm(`${reason}\n\n要把拼圖設定寫進倉庫嗎？`);
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

function renderMap() {
  const root = $("knowledge-map");
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
  updateSyncUi();
}

function moveSeed(id, col, row) {
  const seed = state.seeds.find((s) => s.id === id);
  if (!seed) return;
  const occupant = seedAt(col, row);
  if (occupant && occupant.id !== id) {
    occupant.col = seed.col;
    occupant.row = seed.row;
  }
  seed.col = col;
  seed.row = row;
  saveLayout();
  renderMap();
  setStatus(`已移動「${seed.title}」；按 header 存檔圖示寫進倉庫`);
}

const PUZZLE_TEMPLATES = {
  "grid-8": { cols: 8, rows: 8, label: "空白拼圖 8×8" },
  "grid-10": { cols: 10, rows: 10, label: "空白拼圖 10×10" },
  "grid-12": { cols: 12, rows: 12, label: "空白拼圖 12×12" },
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
  state.map.title = "知識拼圖";
  state.map.note = `${tpl.label}；拖曳擺放，點進去看完整內容`;
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
    title: data.map?.title || "知識拼圖",
    note: data.map?.note || "",
    kind: data.map?.kind || "personal",
    visibility: data.map?.visibility || "public",
    template: data.map?.template || "grid-10",
    savedAt: data.map?.savedAt || null,
    layoutName: data.map?.layoutName || "",
    layoutRev: Number.isInteger(data.map?.layoutRev) ? data.map.layoutRev : 0,
  };
  state.seeds = (data.seeds || []).map((s) => ({
    ...s,
    col: Number.isInteger(s.col) ? s.col : 0,
    row: Number.isInteger(s.row) ? s.row : 0,
  }));
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

async function askAiViaProxy(instruction, source) {
  const code = getMemberCode();
  if (!code) throw new Error("還沒輸入會員碼。付費後會拿到一組碼，請按「會員碼」設定。");
  const res = await fetch(`${apiBase()}/v1/ai/revise`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${code}`,
    },
    body: JSON.stringify({
      title: state.current.title,
      instruction,
      content: source,
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
  const out = stripAiFences(data.revised || "");
  if (!out) throw new Error("沒有產出內容");
  if (data.quota) {
    setStatus(
      `AI 已改稿。本月還剩 ${data.quota.remaining} 次（已用 ${data.quota.used}/${data.quota.quota}）`
    );
  }
  return out;
}

async function askAiDirect(instruction, source) {
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
            "你是知識筆記編輯助手。根據使用者指示改寫 Markdown 全文。" +
            "只輸出完整 Markdown 正文，不要加解釋、不要用 ``` 包起來。" +
            "保留原有標題結構；專有名詞旁可加一句白話。語氣清楚、給人掃一眼也看得懂。",
        },
        {
          role: "user",
          content:
            `檔名／主題：${state.current.title}\n\n` +
            `修改指示：\n${instruction}\n\n` +
            `目前正文：\n${source}`,
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
    throw new Error(`AI 改稿失敗（${res.status}）：${detail}`);
  }
  const data = await res.json();
  const out = stripAiFences(data.choices?.[0]?.message?.content || "");
  if (!out) throw new Error("AI 沒有產出內容，請換個說法再試");
  return out;
}

async function askAiToRevise(instruction) {
  if (!state.current) throw new Error("請先在地圖上點一份筆記");
  if (!state.originalText) await loadSeedText();
  const source = state.editing ? $("edit-body").value : state.workingText || state.originalText;
  setStatus("AI 正在改稿，請稍候…");
  if (usePaidProxy()) return askAiViaProxy(instruction, source);
  return askAiDirect(instruction, source);
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
  const seeds = (base.seeds || state.seeds).map((s) => {
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
    };
  });
  // Include any new seeds only in state
  for (const s of state.seeds) {
    if (!seeds.some((x) => x.id === s.id)) {
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

async function saveLayoutToRepo(saveInfo) {
  setStatus("正在存拼圖…");
  const now = new Date().toISOString();
  let historyResult;
  try {
    historyResult = await appendLayoutVersion(saveInfo);
  } catch (err) {
    showToast(`版本紀錄寫入失敗：${err.message || err}`, "warn");
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
  showToast(toastMsg, "ok");
  setStatus(toastMsg);
  await refreshLayoutHistorySummary();
  updateSyncUi();
  return result;
}

async function buildSeedPack() {
  setStatus("正在打包全部筆記與拼圖設定…");
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
  state.originalText = "";
  state.workingText = "";
  state.draftAccepted = false;
  setStatus(`已選：${seed.title}`);
  await Promise.all([readCurrent(), loadVersions()]);
  showPanel("read");
}

async function loadSeedText() {
  if (!state.current) throw new Error("請先在地圖上點一份筆記");
  const text = await fetchText(`${RAW}${state.current.path}?ts=${Date.now()}`);
  state.originalText = text;
  state.workingText = text;
  return text;
}

async function readCurrent() {
  if (!state.current) {
    setStatus("請先在地圖上點一份筆記");
    showPanel("list");
    return;
  }
  setStatus("正在讀現在的內容…");
  const text = await loadSeedText();
  $("read-title").textContent = state.current.title;
  setViewMode(text);
  setStatus(`正在看：${state.current.title}`);
  showPanel("read");
}

async function startEdit() {
  if (!state.current) {
    setStatus("請先在地圖上點一份筆記");
    showPanel("list");
    return;
  }
  if (!state.originalText) await loadSeedText();
  $("read-title").textContent = `${state.current.title}（自己改）`;
  setEditMode(state.workingText || state.originalText);
  setStatus("直接改文字；改完可先「看看這次改了什麼」，再「存成一版」");
  showPanel("read");
}

function showDraftDiff() {
  const parts = diffLines(state.originalText, state.workingText);
  const out = $("diff-out");
  out.innerHTML = parts
    .map((p) => {
      const prefix = p.type === "add" ? "+ " : p.type === "del" ? "- " : "  ";
      return `<span class="${p.type}">${prefix}${escapeHtml(p.text)}</span>`;
    })
    .join("");
  const adds = parts.filter((p) => p.type === "add").length;
  const dels = parts.filter((p) => p.type === "del").length;
  // Fill selects with pseudo options for this draft session
  $("diff-old").innerHTML = `<option value="original">存進倉庫前（舊的）</option>`;
  $("diff-new").innerHTML = `<option value="draft">你這次改的（新的）</option>`;
  setStatus(`這次修改：新增 ${adds} 行，刪除 ${dels} 行`);
  showPanel("diff");
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
    $("edit-body").value = state.originalText;
  } else {
    setViewMode(state.originalText);
  }
  updateDraftBar();
  setStatus("已放棄這次的修改，回到存進倉庫前的內容");
}

async function saveVersionToRepo(versionName) {
  if (!state.current) throw new Error("請先選一份筆記");
  const text = state.editing ? $("edit-body").value : state.workingText || state.originalText;
  if (text == null) throw new Error("沒有可存的內容");
  setStatus("正在存成一版…");
  const content = bytesToBase64(new TextEncoder().encode(text));
  const path = state.current.path;
  const meta = await githubFetch(`${API}/contents/${path}?ref=${BRANCH}`);
  const label = versionName || defaultVersionName();
  const result = await githubFetch(`${API}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `存成一版：${label}`,
      content,
      sha: meta.sha,
      branch: BRANCH,
    }),
  });
  state.originalText = text;
  state.workingText = text;
  state.draftAccepted = false;
  $("read-title").textContent = state.current.title;
  setViewMode(text);
  await loadVersions();
  let msg = `已存成一版「${label}」（${String(result.commit?.sha || "").slice(0, 7)}）`;
  const afterPoints = awardCommunityPoints(COMMUNITY_SAVE_BONUS, label);
  if (afterPoints != null) msg += `；+${COMMUNITY_SAVE_BONUS} 點（現有 ${afterPoints} 點）`;
  setStatus(msg);
  showPanel("read");
  return result;
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
  const path = encodeURIComponent(state.current.path);
  const commits = await fetchJson(
    `${API}/commits?sha=${BRANCH}&path=${path}&per_page=30`
  );
  state.versions = commits.map((c) => ({
    sha: c.sha,
    short: c.sha.slice(0, 7),
    when: c.commit.author?.date || c.commit.committer?.date,
    message: (c.commit.message || "").split("\n")[0],
  }));

  const list = $("version-list");
  list.innerHTML = "";
  if (!state.versions.length) {
    list.innerHTML = "<li class='meta'>還沒有版本紀錄</li>";
    return;
  }

  for (const v of state.versions) {
    const li = document.createElement("li");
    li.className = "row";
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(formatWhen(v.when))}</strong>
        <div class="meta">${escapeHtml(v.message)}</div>
      </div>
      <div class="row-actions">
        <button type="button" class="btn" data-side="old">當成舊的（左）</button>
        <button type="button" class="btn" data-side="new">當成新的（右）</button>
        <button type="button" class="btn" data-side="open">打開這版</button>
      </div>
    `;
    li.querySelector('[data-side="old"]').addEventListener("click", () => {
      $("diff-old").value = v.sha;
      setStatus(`已選舊的：${formatWhen(v.when)}`);
    });
    li.querySelector('[data-side="new"]').addEventListener("click", () => {
      $("diff-new").value = v.sha;
      setStatus(`已選新的：${formatWhen(v.when)}`);
    });
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
  setStatus(`已載入 ${state.versions.length} 個舊版本`);
}

function fillDiffSelects() {
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
    setStatus("請先在地圖上點一份筆記");
    showPanel("list");
    return;
  }
  const oldSha = $("diff-old").value;
  const newSha = $("diff-new").value;
  if (oldSha === "original" && newSha === "draft") {
    showDraftDiff();
    return;
  }
  if (!state.versions.length) await loadVersions();
  if (!oldSha || !newSha) {
    setStatus("請先在「回到舊的」選兩個版本");
    return;
  }
  setStatus("正在比對差異…");
  const [oldText, newText] = await Promise.all([
    fetchFileAt(oldSha),
    fetchFileAt(newSha),
  ]);
  const parts = diffLines(oldText, newText);
  const out = $("diff-out");
  out.innerHTML = parts
    .map((p) => {
      const prefix = p.type === "add" ? "+ " : p.type === "del" ? "- " : "  ";
      return `<span class="${p.type}">${prefix}${escapeHtml(p.text)}</span>`;
    })
    .join("");
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
        setStatus("請先在地圖上點一份筆記");
        showPanel("list");
        return;
      }
      if (usePaidProxy()) {
        if (!getMemberCode()) {
          $("member-dialog").showModal();
          setStatus("請先輸入會員碼，再請 AI 改");
          return;
        }
      } else if (!getAiKey()) {
        $("ai-key-dialog").showModal();
        setStatus("請先設定 AI 鑰匙，再請 AI 改");
        return;
      }
      $("ai-instruction").value = "";
      $("ai-dialog").showModal();
      $("ai-instruction").focus();
    }
    if (action === "save-version") {
      if (!state.current) {
        setStatus("請先在地圖上點一份筆記");
        showPanel("list");
        return;
      }
      if (state.editing) state.workingText = $("edit-body").value;
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
        setStatus("請先在地圖上點一份筆記");
        showPanel("list");
        return;
      }
      if (!state.versions.length) await loadVersions();
      showPanel("history");
    }
    if (action === "diff") {
      if (!state.current) {
        setStatus("請先在地圖上點一份筆記");
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
  updateDraftBar();
});

$("draft-diff").addEventListener("click", () => {
  if (state.editing) state.workingText = $("edit-body").value;
  showDraftDiff();
});

$("draft-keep").addEventListener("click", () => {
  if (state.editing) state.workingText = $("edit-body").value;
  keepDraft();
});

$("draft-discard").addEventListener("click", () => {
  discardDraft();
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
  setStatus("會員碼已存好，可以按「請 AI 改」");
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
  setStatus("AI 鑰匙已存好，可以按「請 AI 改」");
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
  const instruction = $("ai-instruction").value.trim();
  if (!instruction) {
    setStatus("請先寫一句「我想這樣改」");
    return;
  }
  $("ai-dialog").close();
  try {
    const revised = await askAiToRevise(instruction);
    if (!state.originalText) await loadSeedText();
    state.workingText = revised;
    state.draftAccepted = false;
    $("read-title").textContent = `${state.current.title}（AI 建議稿）`;
    setEditMode(revised);
    updateDraftBar();
    showDraftDiff();
    setStatus("AI 已產出建議稿。可看差異，再「用這次的」或「不要」，最後「存成一版」");
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
    ? "個人版可設公開或私人。套用模板會改格子大小；記得再「存拼圖位置」。"
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
      : `已套用「${tplLabel}」；要永久保存請「存拼圖位置」`
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

$("run-diff").addEventListener("click", () => {
  runDiff().catch((err) => setStatus(err.message || String(err)));
});

function closeAllPopovers() {
  setPopoverOpen(null);
  setPathOpen(false);
}

function buildPathSteps() {
  const steps = [
    {
      key: "list",
      label: "知識拼圖",
      depth: 0,
      go: () => showPanel("list"),
    },
  ];
  if (state.current) {
    steps.push({
      key: "seed",
      label: state.current.title,
      depth: 1,
      go: async () => {
        showPanel("read");
        if (!state.originalText) await loadSeedText();
        setViewMode(state.workingText || state.originalText);
      },
    });
  }
  if (state.panel === "history") {
    steps.push({
      key: "history",
      label: "回到舊的",
      depth: state.current ? 2 : 1,
      go: () => showPanel("history"),
    });
  } else if (state.panel === "diff") {
    steps.push({
      key: "diff",
      label: "看看改了什麼",
      depth: state.current ? 2 : 1,
      go: () => showPanel("diff"),
    });
  } else if (state.editing && state.panel === "read") {
    steps.push({
      key: "edit",
      label: "自己改",
      depth: state.current ? 2 : 1,
      go: () => startEdit(),
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
    btn.dataset.depth = String(step.depth);
    btn.textContent = step.label;
    btn.addEventListener("click", () => {
      step.go();
      setPathOpen(false);
    });
    ladder.appendChild(btn);
  });
}

function setPathOpen(open) {
  const pop = $("path-popover");
  const btn = $("brand-home");
  if (!pop) return;
  if (open && state.panel === "list") {
    showPanel("list");
    return;
  }
  if (open) {
    renderPathLadder();
    positionPopover(pop, btn);
    setPopoverOpen(null);
  }
  pop.classList.toggle("hidden", !open);
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  updatePathBrand();
}

function updatePathBrand() {
  const btn = $("brand-home");
  if (!btn) return;
  const onMap = state.panel === "list";
  btn.title = onMap ? "知識拼圖首頁" : "點開路徑，選擇要回到哪一層";
  btn.classList.toggle("has-path", !onMap);
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
    refreshLayoutHistorySummary();
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
          { label: "換模板", run: () => $("template-setup").click() },
          { label: "排版紀錄", run: () => openLayoutHistoryDialog() },
          { label: "存拼圖", run: () => savePuzzleLayout() },
          { label: "打包帶走", run: () => exportSeedPack() },
        ]
      : [
          { label: "回拼圖", run: () => showPanel("list") },
          { label: "自己改", run: () => startEdit() },
          { label: "請 AI 改", run: () => $("ai-dialog").showModal() },
          { label: "存成一版", run: () => $("version-dialog").showModal() },
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
  if (/模板/.test(t)) {
    $("template-setup").click();
    return;
  }
  if (/排版|紀錄|歷史/.test(t)) {
    openLayoutHistoryDialog();
    return;
  }
  if (state.current && /ai|改|潤稿/.test(t.toLowerCase())) {
    $("ai-instruction").value = t;
    $("ai-dialog").showModal();
    return;
  }
  showToast("之後會由 AI 在這裡回答；現在先試上方快捷按鈕", "info");
}

$("brand-home").addEventListener("click", (e) => {
  e.stopPropagation();
  if (state.panel === "list") {
    closeAllPopovers();
    return;
  }
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
  closeAllPopovers();
  $("template-setup").click();
});

$("info-layout-history").addEventListener("click", () => {
  closeAllPopovers();
  openLayoutHistoryDialog();
});

$("info-template").addEventListener("click", () => {
  closeAllPopovers();
  $("template-setup").click();
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
  .then(() => refreshLayoutHistorySummary())
  .then(() => {
    updateSyncUi();
    showToast("拖曳可改拼圖；有異動時 header 會出現存檔", "info");
  })
  .catch((err) => setStatus(err.message || String(err)));
