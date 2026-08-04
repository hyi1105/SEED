(() => {
  const KEY = "approval.a4.v2";
  const names = {
    u_ming: "王小明",
    u_lin: "林主管",
    u_yen: "嚴協理",
  };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  }
  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  let state = load();
  if (!state.userId) state.userId = "u_ming";
  if (!state.binds) state.binds = {};
  // 段末：給未來自己（每人每段一串留言）
  if (!state.selfNotes) state.selfNotes = {}; // userId -> { blockId: [{id,text,at}] }
  // 文末：公開討論
  if (!state.publicNotes) {
    state.publicNotes = [
      {
        id: "p0",
        author: "人資公告",
        text: "請假逾三日請附證明。",
        at: "預設",
      },
    ];
  }

  const login = document.getElementById("login");
  const sheet = document.getElementById("sheet");
  const sheetTitle = document.getElementById("sheet-title");
  const sheetDesc = document.getElementById("sheet-desc");
  const sheetThread = document.getElementById("sheet-thread");
  const sheetForm = document.getElementById("sheet-form");
  const sheetInput = document.getElementById("sheet-input");

  let openKind = null; // self | public
  let openBlock = null;

  function selfList(blockId) {
    if (!state.selfNotes[state.userId]) state.selfNotes[state.userId] = {};
    if (!state.selfNotes[state.userId][blockId]) {
      state.selfNotes[state.userId][blockId] = [];
    }
    return state.selfNotes[state.userId][blockId];
  }

  function countFor(btn) {
    const kind = btn.dataset.kind;
    const block = btn.dataset.block;
    if (kind === "public") return state.publicNotes.length;
    return selfList(block).length;
  }

  function refreshCounts() {
    document.querySelectorAll(".note-ico").forEach((btn) => {
      const n = countFor(btn);
      btn.querySelector(".count").textContent = String(n);
      btn.classList.toggle("has", n > 0);
    });
  }

  function renderBinds() {
    document.querySelectorAll(".blank").forEach((el) => {
      const key = el.dataset.bind;
      if (state.binds[key] != null) el.value = state.binds[key];
      el.addEventListener("change", () => {
        state.binds[key] = el.value;
        save(state);
      });
    });
  }

  function renderThread() {
    sheetThread.innerHTML = "";
    const list =
      openKind === "public" ? state.publicNotes : selfList(openBlock);
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent =
        openKind === "public"
          ? "還沒有公開討論，當第一個留言的人吧。"
          : "還沒有留言。寫一句給未來的自己。";
      sheetThread.appendChild(empty);
      return;
    }
    list.forEach((m) => {
      const div = document.createElement("div");
      const mine =
        openKind === "self" ||
        m.author === names[state.userId] ||
        m.author === "我";
      div.className = "msg" + (mine && openKind === "public" ? " mine" : "");
      const who =
        openKind === "public" ? m.author : "未來會看到的自己";
      div.innerHTML = `<span class="when"></span>`;
      div.querySelector(".when").textContent = `${who} · ${m.at || ""}`;
      const p = document.createElement("div");
      p.textContent = m.text;
      div.appendChild(p);
      sheetThread.appendChild(div);
    });
    sheetThread.scrollTop = sheetThread.scrollHeight;
  }

  function openSheet(kind, block) {
    openKind = kind;
    openBlock = block;
    if (kind === "public") {
      sheetTitle.textContent = "公開討論";
      sheetDesc.textContent = "文件最下方的公開討論，大家看得到。";
      sheetInput.placeholder = "寫一則公開討論…";
    } else {
      sheetTitle.textContent = "給未來的自己";
      sheetDesc.textContent =
        "只有你看得到。像留給以後的自己的書籤／提醒。";
      sheetInput.placeholder = "寫一句給未來的自己…";
    }
    renderThread();
    sheet.classList.remove("hidden");
    sheetInput.focus();
  }

  function closeSheet() {
    sheet.classList.add("hidden");
    openKind = null;
    openBlock = null;
  }

  document.querySelectorAll(".note-ico").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSheet(btn.dataset.kind, btn.dataset.block);
    });
  });

  document.getElementById("sheet-close").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });

  sheetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = sheetInput.value.trim();
    if (!text || !openKind) return;
    const now = new Date();
    const at = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    if (openKind === "public") {
      state.publicNotes.push({
        id: "p_" + Date.now(),
        author: names[state.userId] || "我",
        text,
        at,
      });
    } else {
      selfList(openBlock).push({
        id: "s_" + Date.now(),
        text,
        at,
      });
    }
    save(state);
    sheetInput.value = "";
    renderThread();
    refreshCounts();
  });

  login.value = state.userId;
  login.addEventListener("change", () => {
    state.userId = login.value;
    save(state);
    refreshCounts();
    if (!sheet.classList.contains("hidden") && openKind === "self") {
      renderThread();
    }
  });

  renderBinds();
  refreshCounts();
})();
