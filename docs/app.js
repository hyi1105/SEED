const REPO = "hyi1105/SEED";
const BRANCH = "main";
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const API = `https://api.github.com/repos/${REPO}`;

const state = {
  seeds: [],
  current: null,
  versions: [],
  panel: "list",
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
    const map = { list: "list", read: "read", history: "history", diff: "diff" };
    if (map[action]) {
      btn.setAttribute("aria-pressed", map[action] === name ? "true" : "false");
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

async function loadCatalog() {
  const data = await fetchJson("./seeds.json");
  state.seeds = data.seeds || [];
  const list = $("seed-list");
  list.innerHTML = "";
  for (const seed of state.seeds) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<strong>${escapeHtml(seed.title)}</strong><span>${escapeHtml(seed.blurb || seed.path)}</span>`;
    btn.addEventListener("click", () => selectSeed(seed));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function selectSeed(seed) {
  state.current = seed;
  setStatus(`已選：${seed.title}`);
  await Promise.all([readCurrent(), loadVersions()]);
  showPanel("read");
}

async function readCurrent() {
  if (!state.current) {
    setStatus("請先選一份筆記");
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

/** Simple line-based LCS diff for grandma-readable output */
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
    setStatus("請先選一份筆記");
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
        setStatus("請先選一份筆記");
        showPanel("list");
        return;
      }
      if (!state.versions.length) await loadVersions();
      showPanel("history");
    }
    if (action === "diff") {
      if (!state.current) {
        setStatus("請先選一份筆記");
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

$("run-diff").addEventListener("click", () => {
  runDiff().catch((err) => setStatus(err.message || String(err)));
});

loadCatalog()
  .then(() => setStatus("請選一份筆記開始"))
  .catch((err) => setStatus(err.message || String(err)));
