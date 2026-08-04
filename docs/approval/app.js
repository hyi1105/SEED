(() => {
  const KEY = "approval.a4.v8";
  const MIN_CH = 2;
  const SYSTEM_NAME = "LEAVE";
  /**
   * 報表統一欄位：
   * doc_no: 系統名＋申請人＋年月日時分秒＋3隨機碼＋.版本號（.1 第一版、.2 第二版…）
   * current_level: 0＝申請人階段；1＝等第1關；2＝等第2關…
   * submitted_at / completed_at / status
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

  function pad(n, len = 2) {
    return String(n).padStart(len, "0");
  }

  function stampNow(d = new Date()) {
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }

  function random3() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 3; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function makeDocNo(applicant, when = new Date(), version = 1) {
    const name = (applicant || "未命名").replace(/\s+/g, "");
    const ver = Math.max(1, Number(version) || 1);
    return `${SYSTEM_NAME}${name}${stampNow(when)}${random3()}.${ver}`;
  }

  const state = load();
  if (!state.binds) state.binds = {};
  if (!state.binds.applicant) state.binds.applicant = "王小明";
  if (!state.status) state.status = "in_process";
  if (state.current_level == null) state.current_level = 3;
  if (state.doc_version == null) state.doc_version = 1;
  if (!state.doc_no || !/\.\d+$/.test(state.doc_no)) {
    // 無版本後綴則重產／補上（示範用固定時間，避免每次刷新亂跳）
    state.doc_no = makeDocNo(
      state.binds.applicant,
      new Date("2026-08-04T09:40:00"),
      state.doc_version
    );
  }

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
  const sfDocno = document.getElementById("sf-docno");
  const sfLevel = document.getElementById("sf-level");
  const sfSubmitted = document.getElementById("sf-submitted");
  const sfCompleted = document.getElementById("sf-completed");
  const sfStatus = document.getElementById("sf-status");

  function applyStatusDefaults(s) {
    state.current_level = s.level;
    state.submitted_at = s.submitted;
    state.completed_at = s.completed;
  }

  function renderStatus() {
    const s = STATUSES.find((x) => x.id === state.status) || STATUSES[2];
    pill.dataset.status = s.id;
    pill.textContent = s.label;
    pill.title = s.tip;

    sfDocno.textContent = state.doc_no || "—";
    sfStatus.textContent = s.label;
    sfLevel.textContent = String(
      state.current_level != null ? state.current_level : s.level
    );
    sfSubmitted.textContent = state.submitted_at || "—";
    sfCompleted.textContent = state.completed_at || "—";
  }

  function applicantName() {
    return (
      state.binds.applicant ||
      document.querySelector('[data-bind="applicant"]')?.value ||
      "未命名"
    );
  }

  pill.addEventListener("click", () => {
    const i = STATUSES.findIndex((x) => x.id === state.status);
    const next = STATUSES[(i + 1) % STATUSES.length];
    const prevStatus = state.status;

    state.status = next.id;
    applyStatusDefaults(next);

    if (next.id === "new") {
      // 新開單：版本從 .1，重產單號
      state.doc_version = 1;
      state.doc_no = makeDocNo(applicantName(), new Date(), state.doc_version);
    } else if (
      next.id === "in_process" &&
      (prevStatus === "denied" || prevStatus === "completed")
    ) {
      // 拒件／結案後再送：視為同一申請的下一版（.2、.3…）
      state.doc_version = (Number(state.doc_version) || 1) + 1;
      state.doc_no = makeDocNo(applicantName(), new Date(), state.doc_version);
    }
    // 其餘狀態切換：保留現有 doc_no 與版本

    save(state);
    renderStatus();
  });

  const cur = STATUSES.find((x) => x.id === state.status) || STATUSES[2];
  if (state.submitted_at === undefined) state.submitted_at = cur.submitted;
  if (state.completed_at === undefined) state.completed_at = cur.completed;
  save(state);
  renderStatus();
})();
