const REPO = "hyi1105/SEED";
const BRANCH = "main";
const SEEDS_PATH = "docs/seeds.json";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const API = `https://api.github.com/repos/${REPO}`;
const LAYOUT_KEY = "seed-map-layout-v1";
const TOKEN_KEY = "seed-github-token-v1";
const AI_KEY = "seed-openai-key-v1";
const AI_BASE_KEY = "seed-openai-base-v1";
const DEFAULT_AI_BASE = "https://api.openai.com/v1";

const state = {
  seeds: [],
  map: { cols: 10, rows: 10, title: "知識地圖", note: "" },
  catalog: null,
  current: null,
  versions: [],
  panel: "list",
  dragId: null,
  touchDragging: false,
  suppressClick: false,
  originalText: "",
  workingText: "",
  editing: false,
  draftAccepted: false,
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(text) {
  statusEl.textContent = text;
}

function showPanel(name) {
  state.panel = name;
  for (const id of ["list", "read", "history", "diff"]) {
    $(`panel-${id}`).classList.toggle("hidden", id !== name);
  }
  document.querySelectorAll(".actions .btn[data-action]").forEach((btn) => {
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

/** Short map caption: prefer short, else first 2 of alias/title */
function shortLabel(seed) {
  const raw = (seed.short || seed.alias || seed.title || "").replace(/\s+/g, "");
  return Array.from(raw).slice(0, 2).join("") || "書";
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

      const seed = seedAt(col, row);
      if (seed) {
        cell.classList.remove("empty");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-seed icon" + (isStudio(seed) ? " studio" : "");
        btn.draggable = true;
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
          },
          { passive: true }
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
        btn.addEventListener("click", () => {
          if (state.suppressClick) {
            state.suppressClick = false;
            return;
          }
          selectSeed(seed).catch((err) => setStatus(err.message || String(err)));
        });
        cell.appendChild(btn);
      }

      root.appendChild(cell);
    }
  }
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
  setStatus(`已把「${seed.title}」放到 (${col + 1}, ${row + 1})；位置存在這個瀏覽器`);
}

async function loadCatalog() {
  // Bust CDN cache after writes
  const data = await fetchJson(`./seeds.json?ts=${Date.now()}`);
  state.catalog = data;
  state.map = {
    cols: data.map?.cols || 10,
    rows: data.map?.rows || 10,
    title: data.map?.title || "知識地圖",
    note: data.map?.note || "",
  };
  state.seeds = (data.seeds || []).map((s) => ({
    ...s,
    col: Number.isInteger(s.col) ? s.col : 0,
    row: Number.isInteger(s.row) ? s.row : 0,
  }));
  applySavedLayout();
  $("map-title").textContent = state.map.title;
  $("map-note").textContent = state.map.note;
  renderMap();
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

function stripAiFences(text) {
  let t = (text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t;
}

async function askAiToRevise(instruction) {
  const key = getAiKey();
  if (!key) throw new Error("還沒設定 AI 鑰匙，請先按「AI 鑰匙」");
  if (!state.current) throw new Error("請先在地圖上點一份筆記");
  if (!state.originalText) await loadSeedText();
  const source = state.editing ? $("edit-body").value : state.workingText || state.originalText;
  setStatus("AI 正在改稿，請稍候…");

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

async function saveLayoutToRepo() {
  setStatus("正在把地圖位置寫進 seeds.json…");
  const payload = buildSeedsPayload();
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const content = bytesToBase64(new TextEncoder().encode(text));

  const meta = await githubFetch(`${API}/contents/${SEEDS_PATH}?ref=${BRANCH}`);
  const result = await githubFetch(`${API}/contents/${SEEDS_PATH}`, {
    method: "PUT",
    body: JSON.stringify({
      message: "Update knowledge map seed positions",
      content,
      sha: meta.sha,
      branch: BRANCH,
    }),
  });

  state.catalog = payload;
  localStorage.removeItem(LAYOUT_KEY);
  setStatus(`已寫回倉庫：${SEEDS_PATH}（commit ${String(result.commit?.sha || "").slice(0, 7)}）`);
  return result;
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
  setStatus(`已存成一版「${label}」（${String(result.commit?.sha || "").slice(0, 7)}）`);
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

document.querySelector(".actions").addEventListener("click", async (e) => {
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
      if (!getAiKey()) {
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
  localStorage.removeItem(LAYOUT_KEY);
  try {
    await loadCatalog();
    setStatus("已重置為倉庫預設位置");
    showPanel("list");
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("token-setup").addEventListener("click", () => {
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
  $("ai-key-input").value = getAiKey() ? "••••••••（已儲存，要換就貼新的）" : "";
  $("ai-base-input").value = getAiBase();
  $("ai-key-dialog").showModal();
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

$("save-layout").addEventListener("click", async () => {
  try {
    if (!getToken()) {
      $("token-dialog").showModal();
      setStatus("請先設定鑰匙，再按「存到倉庫」");
      return;
    }
    await saveLayoutToRepo();
  } catch (err) {
    setStatus(err.message || String(err));
  }
});

$("run-diff").addEventListener("click", () => {
  runDiff().catch((err) => setStatus(err.message || String(err)));
});

loadCatalog()
  .then(() =>
    setStatus(
      getToken()
        ? "可拖曳改位置，再按「存到倉庫」寫進 seeds.json"
        : "可拖曳改位置；要正式寫回倉庫請先「設定鑰匙」"
    )
  )
  .catch((err) => setStatus(err.message || String(err)));
