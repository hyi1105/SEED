(() => {
  const KEY = "approval.a4.v5";
  const MIN_CH = 2;
  const STATUSES = [
    { id: "new", label: "New", tip: "新申請" },
    { id: "draft", label: "Draft", tip: "被暫存過了" },
    { id: "in_process", label: "In Process", tip: "已經送出等待簽核" },
    { id: "completed", label: "Completed", tip: "全部簽核過" },
    { id: "denied", label: "Denied", tip: "有人拒絕了" },
  ];

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

  const state = load();
  if (!state.binds) state.binds = {};
  if (!state.status) state.status = "in_process";

  const mirror = document.createElement("span");
  mirror.setAttribute("aria-hidden", "true");
  Object.assign(mirror.style, {
    position: "absolute",
    top: "-9999px",
    left: "0",
    whiteSpace: "pre",
    visibility: "hidden",
  });
  document.body.appendChild(mirror);

  function fitBlank(el) {
    const cs = getComputedStyle(el);
    mirror.style.font = cs.font;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.padding = cs.padding;
    const text = el.value || "";
    const sample = text.length >= MIN_CH ? text : "字".repeat(MIN_CH);
    mirror.textContent = sample;
    const w = Math.ceil(mirror.getBoundingClientRect().width) + 4;
    el.style.width = `${w}px`;
  }

  document.querySelectorAll(".blank").forEach((el) => {
    const key = el.dataset.bind;
    if (state.binds[key] != null) el.value = state.binds[key];
    fitBlank(el);
    el.addEventListener("input", () => {
      fitBlank(el);
      state.binds[key] = el.value;
      save(state);
    });
    el.addEventListener("change", () => {
      state.binds[key] = el.value;
      save(state);
    });
  });

  const pill = document.getElementById("status-pill");
  function renderStatus() {
    const s = STATUSES.find((x) => x.id === state.status) || STATUSES[2];
    pill.dataset.status = s.id;
    pill.textContent = s.label;
    pill.title = s.tip;
  }
  // 點一下可切換狀態（畫面草稿用）
  pill.addEventListener("click", () => {
    const i = STATUSES.findIndex((x) => x.id === state.status);
    state.status = STATUSES[(i + 1) % STATUSES.length].id;
    save(state);
    renderStatus();
  });
  renderStatus();
})();
