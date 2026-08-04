(() => {
  const KEY = "approval.a4.v1";
  const login = document.getElementById("login");
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
  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  let state = load();
  if (!state.userId) state.userId = "u_ming";
  if (!state.binds) state.binds = {};
  if (!state.privateNotes) state.privateNotes = {}; // userId -> { blockId: text }
  if (!state.publicNotes) {
    state.publicNotes = [
      { id: "p0", author: "人資公告", text: "請假逾三日請附證明。", locked: true },
    ];
  }

  function currentPriv() {
    if (!state.privateNotes[state.userId]) {
      state.privateNotes[state.userId] = {};
    }
    return state.privateNotes[state.userId];
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

  function renderPrivate() {
    const mine = currentPriv();
    document.querySelectorAll(".priv").forEach((ta) => {
      const block = ta.dataset.block;
      ta.value = mine[block] || "";
      ta.oninput = () => {
        currentPriv()[block] = ta.value;
        save(state);
      };
    });
    // 每人都有自己的段末備註區（示範：切身分只看到自己的）
    document.querySelectorAll("[data-owner-only]").forEach((el) => {
      el.classList.remove("hidden");
    });
  }

  function renderPublic() {
    const list = document.getElementById("public-list");
    list.innerHTML = "";
    state.publicNotes.forEach((n) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong></strong><span></span><em>不可改</em>`;
      li.querySelector("strong").textContent = n.author;
      li.querySelector("span").textContent = n.text;
      list.appendChild(li);
    });
  }

  login.value = state.userId;
  login.addEventListener("change", () => {
    state.userId = login.value;
    save(state);
    renderPrivate();
  });

  document.getElementById("public-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("public-input");
    const text = input.value.trim();
    if (!text) return;
    state.publicNotes.push({
      id: "p_" + Date.now(),
      author: names[state.userId] || "我",
      text,
      locked: true,
    });
    save(state);
    input.value = "";
    renderPublic();
  });

  renderBinds();
  renderPrivate();
  renderPublic();
})();
