(() => {
  /**
   * API 時代：document JSON 是唯一真相。
   * 畫面只渲染、不內建文案；編輯寫回同一份 JSON。
   */
  const STORAGE_KEY = "approval.document.v1";
  const MIN_CH = 2;

  /** 預設文件（document.json 的內嵌副本；fetch 失敗時使用） */
  const DEFAULT_DOC = {
    schema_version: "1.0",
    meta: {
      system_name: "LEAVE",
      form_id: "leave_request_v1",
      title: "請假申請書",
      lang: "zh-Hant",
      note: "未來 API 時代：此 JSON 即申請單完整狀態；畫面只負責渲染，不內建任何文案。",
    },
    ui: {
      views: [
        { id: "form", label: "申請單畫面" },
        { id: "json", label: "JSON" },
      ],
      sys_fields_aria: "系統欄位（報表用）",
      sys_hint:
        "doc_no＝系統名＋申請人＋年月日時分秒＋3隨機碼＋.版本（如 .2＝第二版）　current_level：0＝申請人；1＋＝等待各關　completed_at 僅 Completed／Denied",
      empty_mark: "—",
      pending_stamp_label: "尚未蓋印",
    },
    statuses: [
      {
        id: "new",
        label: "New",
        tip: "新申請",
        level: 0,
        submitted_at: null,
        completed_at: null,
      },
      {
        id: "draft",
        label: "Draft",
        tip: "被暫存過了",
        level: 0,
        submitted_at: null,
        completed_at: null,
      },
      {
        id: "in_process",
        label: "In Process",
        tip: "已經送出等待簽核",
        level: 3,
        submitted_at: "2026-08-04 09:40:00",
        completed_at: null,
      },
      {
        id: "completed",
        label: "Completed",
        tip: "全部簽核過",
        level: 3,
        submitted_at: "2026-08-04 09:40:00",
        completed_at: "2026-08-04 11:05:00",
      },
      {
        id: "denied",
        label: "Denied",
        tip: "有人拒絕了",
        level: 2,
        submitted_at: "2026-08-04 09:40:00",
        completed_at: "2026-08-04 10:22:00",
      },
    ],
    fields: {
      applicant: { type: "text", label: "申請人", value: "王小明" },
      leave_type: {
        type: "dropdown",
        label: "假別",
        value: "事假",
        options: ["特休", "事假", "病假", "其他"],
      },
      leave_date: { type: "text", label: "起始日", value: "明天" },
      days: { type: "number", label: "天數", value: "1" },
      agent: { type: "text", label: "代理人", value: "陳美玲" },
    },
    body: {
      paragraphs: [
        {
          parts: [
            { t: "text", v: "申請人" },
            { t: "field", name: "applicant" },
            { t: "text", v: "因" },
            { t: "field", name: "leave_type" },
            { t: "text", v: "，自" },
            { t: "field", name: "leave_date" },
            { t: "text", v: "起請假" },
            { t: "field", name: "days" },
            { t: "text", v: "天，代理人為" },
            { t: "field", name: "agent" },
            { t: "text", v: "。" },
          ],
        },
      ],
    },
    approval: {
      title: "簽核",
      columns: [
        {
          id: "director",
          label: "協理",
          level: 3,
          stamp: { name: "嚴", mark: null, time: null, pending: true },
        },
        {
          id: "manager",
          label: "課長",
          level: 2,
          stamp: {
            name: "林",
            mark: "APPROVE",
            time: "08-04 10:18",
            pending: false,
          },
        },
        {
          id: "agent",
          label: "代理人",
          level: 1,
          stamp: {
            name: "陳",
            mark: "確認",
            time: "08-04 09:55",
            pending: false,
          },
        },
        {
          id: "applicant",
          label: "申請",
          level: 0,
          stamp: {
            name: "王",
            mark: "申請",
            time: "08-04 09:40",
            pending: false,
          },
        },
      ],
    },
    system: {
      doc_no: "LEAVE王小明20260804094000K7M.1",
      doc_version: 1,
      current_level: 3,
      submitted_at: "2026-08-04 09:40:00",
      completed_at: null,
      status: "in_process",
    },
  };

  let doc = null;
  let view = "form";
  let jsonDirty = false;

  const els = {
    tabs: document.getElementById("view-tabs"),
    form: document.getElementById("view-form"),
    json: document.getElementById("view-json"),
    editor: document.getElementById("json-editor"),
    msg: document.getElementById("json-msg"),
  };

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

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      /* ignore quota */
    }
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
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

  function makeDocNo(applicant, when = new Date(), version = 1, systemName) {
    const sys = systemName || doc?.meta?.system_name || "LEAVE";
    const name = String(applicant || "未命名").replace(/\s+/g, "");
    const ver = Math.max(1, Number(version) || 1);
    return `${sys}${name}${stampNow(when)}${random3()}.${ver}`;
  }

  function statusOf(id) {
    return (doc.statuses || []).find((s) => s.id === id) || doc.statuses?.[0];
  }

  function fieldValue(name) {
    return doc.fields?.[name]?.value ?? "";
  }

  function fitBlank(el) {
    const cs = getComputedStyle(el);
    mirror.style.font = cs.font;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.padding = cs.padding;
    const text = el.value || el.options?.[el.selectedIndex]?.text || "";
    const sample = String(text).length >= MIN_CH ? text : "字".repeat(MIN_CH);
    mirror.textContent = sample;
    el.style.width = `${Math.ceil(mirror.getBoundingClientRect().width) + 8}px`;
  }

  function setFieldValue(name, value) {
    if (!doc.fields[name]) {
      doc.fields[name] = { type: "text", value };
    } else {
      doc.fields[name].value = value;
    }
    persist();
  }

  function createFieldControl(name) {
    const def = doc.fields[name] || { type: "text", value: "" };
    const type = def.type || "text";
    let el;

    if (type === "dropdown") {
      el = document.createElement("select");
      el.className = "blank blank-select";
      const opts = Array.isArray(def.options) ? def.options : [];
      opts.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (String(def.value) === String(opt)) o.selected = true;
      });
      if (def.value != null && !opts.map(String).includes(String(def.value))) {
        const o = document.createElement("option");
        o.value = def.value;
        o.textContent = def.value;
        o.selected = true;
        el.appendChild(o);
      }
    } else {
      el = document.createElement("input");
      el.className = "blank";
      el.type = type === "number" ? "text" : "text";
      el.inputMode = type === "number" ? "decimal" : "text";
      el.value = def.value != null ? String(def.value) : "";
      el.size = MIN_CH;
    }

    el.dataset.field = name;
    if (def.label) el.setAttribute("aria-label", def.label);

    const onChange = () => {
      setFieldValue(name, el.value);
      fitBlank(el);
      syncJsonEditorIfVisible();
    };
    el.addEventListener("input", onChange);
    el.addEventListener("change", onChange);
    return el;
  }

  function renderParagraph(parts) {
    const p = document.createElement("p");
    p.className = "para";
    (parts || []).forEach((part) => {
      if (part.t === "field") {
        const ctrl = createFieldControl(part.name);
        p.appendChild(ctrl);
        requestAnimationFrame(() => fitBlank(ctrl));
      } else {
        p.appendChild(document.createTextNode(part.v ?? ""));
      }
    });
    return p;
  }

  function renderInkanTable() {
    const table = document.createElement("table");
    table.className = "inkan-table";
    const columns = doc.approval?.columns || [];
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = col.label || "";
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const tr = document.createElement("tr");
    const pendingLabel = doc.ui?.pending_stamp_label || "";
    columns.forEach((col, idx) => {
      const td = document.createElement("td");
      const stamp = col.stamp || {};
      const pending = !!stamp.pending;
      td.className = pending ? "pending" : "done";

      const circle = document.createElement("div");
      circle.className = `inkan-stamp tilt-${Math.min(idx, 3)}${
        pending ? " empty" : ""
      }`;
      const name = document.createElement("span");
      name.className = "inkan-name";
      name.textContent = stamp.name || "";
      circle.appendChild(name);
      td.appendChild(circle);

      if (!pending && stamp.mark) {
        const mark = document.createElement("div");
        mark.className = "inkan-approve";
        mark.textContent = stamp.mark;
        td.appendChild(mark);
      }

      const time = document.createElement("div");
      time.className = `inkan-time${pending ? " wait" : ""}`;
      time.textContent = pending ? pendingLabel : stamp.time || "";
      td.appendChild(time);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    table.appendChild(tbody);
    return table;
  }

  function renderSysFields() {
    const wrap = document.createElement("dl");
    wrap.className = "sys-fields";
    wrap.setAttribute("aria-label", doc.ui?.sys_fields_aria || "");
    const empty = doc.ui?.empty_mark || "—";
    const st = statusOf(doc.system?.status);
    const rows = [
      ["doc_no", doc.system?.doc_no],
      ["current_level", doc.system?.current_level],
      ["submitted_at", doc.system?.submitted_at],
      ["completed_at", doc.system?.completed_at],
      ["status", st?.label || doc.system?.status],
    ];
    rows.forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "sys-row";
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v == null || v === "" ? empty : String(v);
      row.appendChild(dt);
      row.appendChild(dd);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function applyStatusDefaults(st) {
    if (!doc.system) doc.system = {};
    doc.system.current_level = st.level;
    doc.system.submitted_at = st.submitted_at;
    doc.system.completed_at = st.completed_at;
  }

  function cycleStatus() {
    const list = doc.statuses || [];
    if (!list.length) return;
    const prev = doc.system?.status;
    const i = list.findIndex((s) => s.id === prev);
    const next = list[(i + 1 + list.length) % list.length];
    if (!doc.system) doc.system = {};
    doc.system.status = next.id;
    applyStatusDefaults(next);

    if (next.id === "new") {
      doc.system.doc_version = 1;
      doc.system.doc_no = makeDocNo(
        fieldValue("applicant"),
        new Date(),
        doc.system.doc_version
      );
    } else if (
      next.id === "in_process" &&
      (prev === "denied" || prev === "completed")
    ) {
      doc.system.doc_version = (Number(doc.system.doc_version) || 1) + 1;
      doc.system.doc_no = makeDocNo(
        fieldValue("applicant"),
        new Date(),
        doc.system.doc_version
      );
    }

    persist();
    renderForm();
    syncJsonEditorIfVisible();
  }

  function renderForm() {
    const stage = els.form;
    stage.replaceChildren();

    const article = document.createElement("article");
    article.className = "a4";

    const title = document.createElement("h2");
    title.className = "doc-title";
    title.textContent = doc.meta?.title || "";
    article.appendChild(title);

    const bodySec = document.createElement("section");
    bodySec.className = "block";
    (doc.body?.paragraphs || []).forEach((para) => {
      bodySec.appendChild(renderParagraph(para.parts));
    });
    article.appendChild(bodySec);

    const signSec = document.createElement("section");
    signSec.className = "block hanko-block";

    const head = document.createElement("div");
    head.className = "sign-head";
    const h3 = document.createElement("h3");
    h3.className = "sign-title";
    h3.textContent = doc.approval?.title || "";
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "status-pill";
    const st = statusOf(doc.system?.status);
    pill.dataset.status = st?.id || "";
    pill.textContent = st?.label || "";
    pill.title = st?.tip || "";
    pill.addEventListener("click", cycleStatus);
    head.appendChild(h3);
    head.appendChild(pill);
    signSec.appendChild(head);

    signSec.appendChild(renderInkanTable());
    signSec.appendChild(renderSysFields());

    if (doc.ui?.sys_hint) {
      const hint = document.createElement("p");
      hint.className = "sys-hint";
      hint.textContent = doc.ui.sys_hint;
      signSec.appendChild(hint);
    }

    article.appendChild(signSec);
    stage.appendChild(article);
  }

  function prettyJson() {
    return JSON.stringify(doc, null, 2);
  }

  function syncJsonEditorIfVisible() {
    if (view !== "json" || jsonDirty) return;
    els.editor.value = prettyJson();
  }

  function showJsonMsg(text, isErr) {
    if (!text) {
      els.msg.hidden = true;
      els.msg.textContent = "";
      return;
    }
    els.msg.hidden = false;
    els.msg.textContent = text;
    els.msg.classList.toggle("err", !!isErr);
  }

  function applyJsonFromEditor() {
    try {
      const parsed = JSON.parse(els.editor.value);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("根節點必須是物件");
      }
      doc = parsed;
      if (!doc.system) doc.system = {};
      if (!doc.fields) doc.fields = {};
      jsonDirty = false;
      persist();
      renderForm();
      els.editor.value = prettyJson();
      showJsonMsg("已套用到畫面", false);
      setTimeout(() => showJsonMsg(""), 1600);
      return true;
    } catch (e) {
      showJsonMsg(`JSON 無法解析：${e.message}`, true);
      return false;
    }
  }

  function renderTabs() {
    const views = doc.ui?.views || [
      { id: "form", label: "申請單畫面" },
      { id: "json", label: "JSON" },
    ];
    els.tabs.replaceChildren();
    views.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-tab" + (view === v.id ? " active" : "");
      btn.textContent = v.label;
      btn.dataset.view = v.id;
      btn.addEventListener("click", () => switchView(v.id));
      els.tabs.appendChild(btn);
    });
  }

  function switchView(next) {
    if (view === "json" && next === "form" && jsonDirty) {
      if (!applyJsonFromEditor()) return;
    }
    view = next;
    const showForm = view === "form";
    els.form.hidden = !showForm;
    els.json.hidden = showForm;
    renderTabs();
    if (!showForm) {
      jsonDirty = false;
      els.editor.value = prettyJson();
      showJsonMsg("");
    } else {
      renderForm();
    }
  }

  els.editor.addEventListener("input", () => {
    jsonDirty = true;
    showJsonMsg("已修改（切回申請單畫面時會套用）", false);
  });

  els.editor.addEventListener("blur", () => {
    if (jsonDirty) applyJsonFromEditor();
  });

  function ensureDocShape(d) {
    if (!d.meta) d.meta = clone(DEFAULT_DOC.meta);
    if (!d.ui) d.ui = clone(DEFAULT_DOC.ui);
    if (!d.statuses) d.statuses = clone(DEFAULT_DOC.statuses);
    if (!d.fields) d.fields = clone(DEFAULT_DOC.fields);
    if (!d.body) d.body = clone(DEFAULT_DOC.body);
    if (!d.approval) d.approval = clone(DEFAULT_DOC.approval);
    if (!d.system) d.system = clone(DEFAULT_DOC.system);
    if (!d.system.doc_no || !/\.\d+$/.test(d.system.doc_no)) {
      d.system.doc_version = d.system.doc_version || 1;
      d.system.doc_no = makeDocNo(
        d.fields?.applicant?.value,
        new Date("2026-08-04T09:40:00"),
        d.system.doc_version,
        d.meta?.system_name
      );
    }
    return d;
  }

  async function boot() {
    let base = loadStored();
    if (!base) {
      try {
        const res = await fetch("./document.json?v=json1", { cache: "no-store" });
        if (res.ok) base = await res.json();
      } catch {
        /* file:// 或離線時用內嵌預設 */
      }
    }
    doc = ensureDocShape(base ? clone(base) : clone(DEFAULT_DOC));
    // makeDocNo 需要 doc.meta；ensure 後再補一次單號若剛 clone
    if (!doc.system.doc_no || !/\.\d+$/.test(doc.system.doc_no)) {
      doc.system.doc_no = makeDocNo(
        fieldValue("applicant"),
        new Date("2026-08-04T09:40:00"),
        doc.system.doc_version || 1
      );
    }
    persist();
    document.documentElement.lang = doc.meta?.lang || "zh-Hant";
    document.title = `Approval｜${doc.meta?.title || ""}`;
    renderTabs();
    switchView("form");
  }

  boot();
})();
