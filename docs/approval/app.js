(() => {
  const KEY = "approval.a4.v6";
  const MIN_CH = 2;
  /**
   * 報表統一欄位：
   * current_level: 0＝申請人階段；1＝等第1關；2＝等第2關…
   * submitted_at: 最後送出時間
   * completed_at: Approved／Denied 完成時間，其餘為 null
   * status: New | Draft | In Process | Completed | Denied
   */
  const STATUSES = [
    {
      id: "new",
      label: "New",
      tip: "新申請",
      level: 0,
      submitted: null,
      completed: null,
    },
    {
      id: "draft",
      label: "Draft",
      tip: "被暫存過了",
      level: 0,
      submitted: null,
      completed: null,
    },
    {
      id: "in_process",
      label: "In Process",
      tip: "已經送出等待簽核",
      level: 3,
      submitted: "2026-08-04 09:40:00",
      completed: null,
    },
    {
      id: "completed",
      label: "Completed",
      tip: "全部簽核過",
      level: 3,
      submitted: "2026-08-04 09:40:00",
      completed: "2026-08-04 11:05:00",
    },
    {
      id: "denied",
      label: "Denied",
      tip: "有人拒絕了",
      level: 2,
      submitted: "2026-08-04 09:40:00",
      completed: "2026-08-04 10:22:00",
    },
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
  if (state.current_level == null) state.current_level = 3;

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
    el.style.width = `${Math.ceil(mirror.getBoundingClientRect().width) + 4}px`;
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
  const sfLevel = document.getElementById("sf-level");
  const sfSubmitted = document.getElementById("sf-submitted");
  const sfCompleted = document.getElementById("sf-completed");
  const sfStatus = document.getElementById("sf-status");

  function applyStatusDefaults(s) {
    // 切狀態時帶入示範用 level／時間；之後接真資料再覆寫
    state.current_level = s.level;
    state.submitted_at = s.submitted;
    state.completed_at = s.completed;
  }

  function renderStatus() {
    const s = STATUSES.find((x) => x.id === state.status) || STATUSES[2];
    pill.dataset.status = s.id;
    pill.textContent = s.label;
    pill.title = s.tip;

    sfStatus.textContent = s.label;
    sfLevel.textContent = String(
      state.current_level != null ? state.current_level : s.level
    );
    sfSubmitted.textContent = state.submitted_at || "—";
    sfCompleted.textContent = state.completed_at || "—";
  }

  pill.addEventListener("click", () => {
    const i = STATUSES.findIndex((x) => x.id === state.status);
    const next = STATUSES[(i + 1) % STATUSES.length];
    state.status = next.id;
    applyStatusDefaults(next);
    save(state);
    renderStatus();
  });

  // 初次：若尚無時間欄，依狀態補齊
  const cur = STATUSES.find((x) => x.id === state.status) || STATUSES[2];
  if (state.submitted_at === undefined) state.submitted_at = cur.submitted;
  if (state.completed_at === undefined) state.completed_at = cur.completed;
  save(state);
  renderStatus();
})();
