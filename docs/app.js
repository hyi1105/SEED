const REPO = "hyi1105/SEED";
const BRANCH = "main";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const API = `https://api.github.com/repos/${REPO}`;
const LAYOUT_KEY = "seed-map-layout-v1";

const state = {
  seeds: [],
  map: { cols: 10, rows: 10, title: "知識地圖", note: "" },
  current: null,
  versions: [],
  panel: "list",
  dragId: null,
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
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
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
        btn.addEventListener("dragstart", (e) => {
          state.dragId = seed.id;
          e.dataTransfer.setData("text/seed-id", seed.id);
          e.dataTransfer.effectAllowed = "move";
        });
        btn.addEventListener("dragend", () => {
          state.dragId = null;
        });
        btn.addEventListener("click", () => {
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
  const data = await fetchJson("./seeds.json");
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

$("run-diff").addEventListener("click", () => {
  runDiff().catch((err) => setStatus(err.message || String(err)));
});

loadCatalog()
  .then(() => setStatus("在地圖上點一格，或拖曳改位置"))
  .catch((err) => setStatus(err.message || String(err)));
