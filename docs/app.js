const REPO = "hyi1105/SEED";
const BRANCH = "main";
const SEEDS_PATH = "docs/seeds.json";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const API = `https://api.github.com/repos/${REPO}`;
const LAYOUT_KEY = "seed-map-layout-v1";
const TOKEN_KEY = "seed-github-token-v1";

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
    const mapActions = { list: "list", read: "read", history: "history", diff: "diff" };
    if (mapActions[action]) {
      btn.setAttribute("aria-pressed", mapActions[action] === name ? "true" : "false");
    }
  });
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
        btn.className = "map-seed" + (isStudio(seed) ? " studio" : "");
        btn.draggable = true;
        btn.textContent = seed.title;
        btn.title = `${seed.title}\n${seed.blurb || ""}\n拖曳可改位置，點一下打開`;
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
  setStatus(`已選：${seed.title}`);
  await Promise.all([readCurrent(), loadVersions()]);
  showPanel("read");
}

async function readCurrent() {
  if (!state.current) {
    setStatus("請先在地圖上點一份筆記");
    showPanel("list");
    return;
  }
  setStatus("正在讀現在的內容…");
  const text = await fetchText(RAW + state.current.path);
  $("read-title").textContent = state.current.title;
  $("read-body").textContent = text;
  setStatus(`正在看：${state.current.title}`);
  showPanel("read");
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
      $("read-title").textContent = `${state.current.title}（舊版 ${formatWhen(v.when)}）`;
      $("read-body").textContent = text;
      showPanel("read");
    });
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
  if (!state.versions.length) await loadVersions();
  const oldSha = $("diff-old").value;
  const newSha = $("diff-new").value;
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
      if (!state.versions.length) await loadVersions();
      fillDiffSelects();
      showPanel("diff");
    }
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
