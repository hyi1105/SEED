(() => {
  /**
   * API 時代：document JSON 是唯一真相。
   * 畫面只渲染；按鈕會寫入 logs（時間／操作者／開啟時 vs 儲存後／GitHub 紅綠 diff）。
   */
  const STORAGE_KEY = "approval.document.v2";
  const MIN_CH = 2;

  const EMBEDDED_DOC = {
    schema_version: "1.1",
    meta: {
      system_name: "LEAVE",
      form_id: "leave_request_v1",
      title: "請假申請書",
      lang: "zh-Hant",
      note: "未來 API 時代：此 JSON 即申請單完整狀態；畫面只負責渲染。含 actor／actions／logs。",
    },
    actor: { id: "u_wang", name: "王小明" },
    ui: {
      views: [
        { id: "form", label: "申請單畫面" },
        { id: "json", label: "JSON" },
        { id: "alr5", label: "ALR5功能" },
      ],
      sys_fields_aria: "系統欄位（報表用）",
      sys_hint:
        "doc_no＝系統名＋申請人＋年月日時分秒＋3隨機碼＋.版本（如 .2＝第二版）　current_level：0＝申請人；1＋＝等待各關　completed_at 僅 Completed／Denied",
      empty_mark: "—",
      pending_stamp_label: "尚未蓋印",
      actions_title: "操作",
      log_title: "操作紀錄",
      log_empty: "尚無操作紀錄",
      log_opened_label: "開啟時",
      log_saved_label: "儲存後",
      log_no_change: "欄位值無變更",
      actor_label: "目前操作者",
    },
    actions: [
      { id: "save", label: "儲存", kind: "save" },
      { id: "submit", label: "送出", kind: "submit" },
      {
        id: "cycle_status",
        label: "切換狀態",
        kind: "cycle_status",
        bound_to: "status_pill",
      },
    ],
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
        options: [
          { value: "特休", label: "特休" },
          { value: "事假", label: "事假" },
          { value: "病假", label: "病假" },
          { value: "其他", label: "其他" },
        ],
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
    logs: [],
  };

  let doc = null;
  let view = "form";
  let jsonDirty = false;
  /** 本次開啟／上次按鈕後的快照（對應 log.opened） */
  let openedSnapshot = null;
  let openLogId = null;
  let alr5Standard = null;
  let alr5Markdown = "";
  const CHECK_KEY = "alr5.interop.checks.v1";

  const els = {
    tabs: document.getElementById("view-tabs"),
    form: document.getElementById("view-form"),
    json: document.getElementById("view-json"),
    alr5: document.getElementById("view-alr5"),
    guideBody: document.getElementById("guide-body"),
    interopBadge: document.getElementById("interop-badge"),
    btnCopyAi: document.getElementById("btn-copy-ai"),
    btnCopyJson: document.getElementById("btn-copy-json"),
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
      /* ignore */
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

  function nowStamp(d = new Date()) {
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }

  function stampCompact(d = new Date()) {
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
    return `${sys}${name}${stampCompact(when)}${random3()}.${ver}`;
  }

  function statusOf(id) {
    return (doc.statuses || []).find((s) => s.id === id) || doc.statuses?.[0];
  }

  function fieldValue(name) {
    return doc.fields?.[name]?.value ?? "";
  }

  /** 正規化 options：字串或 {value,label} → {value,label}[] */
  function normalizeOptions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((opt) => {
        if (opt == null) return null;
        if (typeof opt === "string" || typeof opt === "number") {
          const v = String(opt);
          return { value: v, label: v };
        }
        if (typeof opt === "object") {
          const value =
            opt.value != null
              ? String(opt.value)
              : opt.label != null
                ? String(opt.label)
                : "";
          const label = opt.label != null ? String(opt.label) : value;
          return value ? { value, label } : null;
        }
        return null;
      })
      .filter(Boolean);
  }

  function ensureFieldOptions(fields, fallbackFields) {
    Object.keys(fields || {}).forEach((key) => {
      const f = fields[key];
      if (!f || f.type !== "dropdown") return;
      let opts = normalizeOptions(f.options);
      if (!opts.length && fallbackFields?.[key]) {
        opts = normalizeOptions(fallbackFields[key].options);
      }
      f.options = opts;
      if (f.value == null || f.value === "") {
        f.value = opts[0]?.value ?? "";
      }
    });
  }

  function snapshotState() {
    const fields = {};
    Object.keys(doc.fields || {}).forEach((k) => {
      fields[k] =
        doc.fields[k]?.value == null ? null : String(doc.fields[k].value);
    });
    const sys = doc.system || {};
    return {
      fields,
      system: {
        status: sys.status ?? null,
        current_level: sys.current_level ?? null,
        doc_no: sys.doc_no ?? null,
        doc_version: sys.doc_version ?? null,
        submitted_at: sys.submitted_at ?? null,
        completed_at: sys.completed_at ?? null,
      },
    };
  }

  function displayVal(v) {
    if (v == null || v === "") return doc.ui?.empty_mark || "—";
    return String(v);
  }

  function sameVal(a, b) {
    const na = a == null || a === "" ? null : String(a);
    const nb = b == null || b === "" ? null : String(b);
    return na === nb;
  }

  function diffSnapshots(opened, saved) {
    const changes = [];
    const fieldKeys = new Set([
      ...Object.keys(opened.fields || {}),
      ...Object.keys(saved.fields || {}),
    ]);
    fieldKeys.forEach((k) => {
      const before = opened.fields?.[k] ?? null;
      const after = saved.fields?.[k] ?? null;
      if (sameVal(before, after)) return;
      changes.push({
        path: `fields.${k}`,
        label: doc.fields?.[k]?.label || k,
        before,
        after,
      });
    });
    const sysKeys = [
      "status",
      "current_level",
      "doc_no",
      "doc_version",
      "submitted_at",
      "completed_at",
    ];
    sysKeys.forEach((k) => {
      const before = opened.system?.[k] ?? null;
      const after = saved.system?.[k] ?? null;
      if (sameVal(before, after)) return;
      changes.push({
        path: `system.${k}`,
        label: k,
        before: before == null ? null : String(before),
        after: after == null ? null : String(after),
      });
    });
    return changes;
  }

  function resetOpenedSnapshot() {
    openedSnapshot = snapshotState();
  }

  function fitBlank(el) {
    const cs = getComputedStyle(el);
    mirror.style.font = cs.font;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.style.padding = cs.padding;
    let text = "";
    if (el.tagName === "SELECT") {
      const opt = el.options[el.selectedIndex];
      text = opt ? opt.text : el.value || "";
      // 用最長選項估寬，避免下拉顯示被裁成空白
      let longest = text;
      Array.from(el.options).forEach((o) => {
        if (String(o.text).length > String(longest).length) longest = o.text;
      });
      text = longest || text;
    } else {
      text = el.value || "";
    }
    const sample = String(text).length >= MIN_CH ? text : "字".repeat(MIN_CH);
    mirror.textContent = sample;
    const w = Math.ceil(mirror.getBoundingClientRect().width) + (el.tagName === "SELECT" ? 22 : 8);
    el.style.width = `${Math.max(w, 48)}px`;
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
      const opts = normalizeOptions(def.options);
      if (!opts.length) {
        // 防呆：仍無選項時至少顯示目前值
        const fallback = def.value != null ? String(def.value) : "";
        if (fallback) opts.push({ value: fallback, label: fallback });
      }
      def.options = opts;
      opts.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        el.appendChild(o);
      });
      const cur = def.value != null ? String(def.value) : "";
      if (cur && !opts.some((o) => o.value === cur)) {
        const o = document.createElement("option");
        o.value = cur;
        o.textContent = cur;
        el.appendChild(o);
      }
      el.value = cur || opts[0]?.value || "";
      if (def.value !== el.value) def.value = el.value;
    } else {
      el = document.createElement("input");
      el.className = "blank";
      el.type = "text";
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

  function runCycleStatus() {
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
    } else if (next.id === "in_process" && !doc.system.submitted_at) {
      doc.system.submitted_at = nowStamp();
    }
  }

  function runSubmit() {
    const cur = statusOf(doc.system?.status);
    if (!doc.system) doc.system = {};
    if (doc.system.status === "new" || doc.system.status === "draft") {
      doc.system.status = "in_process";
      const st = statusOf("in_process");
      if (st) applyStatusDefaults(st);
      if (!doc.system.doc_no || !/\.\d+$/.test(doc.system.doc_no)) {
        doc.system.doc_version = doc.system.doc_version || 1;
        doc.system.doc_no = makeDocNo(
          fieldValue("applicant"),
          new Date(),
          doc.system.doc_version
        );
      }
      doc.system.submitted_at = nowStamp();
      doc.system.completed_at = null;
    } else if (cur) {
      // 已在流程中：送出視為再存一次狀態時間
      doc.system.submitted_at = doc.system.submitted_at || nowStamp();
    }
  }

  function appendLog(actionDef) {
    const opened = openedSnapshot || snapshotState();
    const saved = snapshotState();
    const changes = diffSnapshots(opened, saved);
    const entry = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      at: nowStamp(),
      actor: clone(doc.actor || { id: "unknown", name: "未知" }),
      action: {
        id: actionDef.id,
        label: actionDef.label,
        kind: actionDef.kind || actionDef.id,
      },
      opened,
      saved,
      changes,
    };
    if (!Array.isArray(doc.logs)) doc.logs = [];
    doc.logs.unshift(entry);
    openLogId = entry.id;
    resetOpenedSnapshot();
    return entry;
  }

  function performAction(actionDef) {
    const kind = actionDef.kind || actionDef.id;
    // 先保留 opened；執行動作改 doc；再寫 log
    if (kind === "cycle_status") runCycleStatus();
    else if (kind === "submit") runSubmit();
    // save：只寫 log，欄位已在編輯時寫入 doc
    appendLog(actionDef);
    persist();
    renderForm();
    syncJsonEditorIfVisible();
  }

  function renderDiffLine(change) {
    const row = document.createElement("div");
    row.className = "diff-row";

    const label = document.createElement("div");
    label.className = "diff-label";
    label.textContent = change.label || change.path;
    row.appendChild(label);

    const vals = document.createElement("div");
    vals.className = "diff-vals";

    const before = document.createElement("span");
    before.className = "diff-del";
    before.textContent = displayVal(change.before);
    before.title = doc.ui?.log_opened_label || "開啟時";

    const after = document.createElement("span");
    after.className = "diff-add";
    after.textContent = displayVal(change.after);
    after.title = doc.ui?.log_saved_label || "儲存後";

    // GitHub 風格：紅（刪／舊）在前，綠（增／新）在後
    vals.appendChild(before);
    vals.appendChild(after);
    row.appendChild(vals);
    return row;
  }

  function renderLogDetail(entry) {
    const box = document.createElement("div");
    box.className = "log-detail";

    const meta = document.createElement("div");
    meta.className = "log-detail-meta";
    meta.textContent = `${doc.ui?.log_opened_label || "開啟時"} → ${
      doc.ui?.log_saved_label || "儲存後"
    }`;
    box.appendChild(meta);

    const changes = entry.changes || [];
    if (!changes.length) {
      const empty = document.createElement("p");
      empty.className = "log-no-change";
      empty.textContent = doc.ui?.log_no_change || "欄位值無變更";
      box.appendChild(empty);
      return box;
    }
    changes.forEach((c) => box.appendChild(renderDiffLine(c)));
    return box;
  }

  function renderLogs() {
    const sec = document.createElement("section");
    sec.className = "log-block";
    const h = document.createElement("h3");
    h.className = "log-title";
    h.textContent = doc.ui?.log_title || "操作紀錄";
    sec.appendChild(h);

    const list = Array.isArray(doc.logs) ? doc.logs : [];
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = doc.ui?.log_empty || "尚無操作紀錄";
      sec.appendChild(empty);
      return sec;
    }

    const ul = document.createElement("ul");
    ul.className = "log-list";
    list.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "log-item" + (openLogId === entry.id ? " open" : "");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "log-summary";
      const n = (entry.changes || []).length;
      btn.innerHTML = "";
      const t = document.createElement("span");
      t.className = "log-time";
      t.textContent = entry.at || "";
      const who = document.createElement("span");
      who.className = "log-actor";
      who.textContent = entry.actor?.name || "";
      const act = document.createElement("span");
      act.className = "log-action";
      act.textContent = entry.action?.label || entry.action?.id || "";
      const ch = document.createElement("span");
      ch.className = "log-change-count";
      ch.textContent = n ? `${n} 欄位` : "無變更";
      btn.appendChild(t);
      btn.appendChild(who);
      btn.appendChild(act);
      btn.appendChild(ch);
      btn.addEventListener("click", () => {
        openLogId = openLogId === entry.id ? null : entry.id;
        renderForm();
      });
      li.appendChild(btn);

      if (openLogId === entry.id) {
        li.appendChild(renderLogDetail(entry));
      }
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    return sec;
  }

  function renderActions() {
    const wrap = document.createElement("div");
    wrap.className = "action-bar";

    const actorLine = document.createElement("div");
    actorLine.className = "actor-line";
    const actorLabel = document.createElement("span");
    actorLabel.textContent = (doc.ui?.actor_label || "目前操作者") + "：";
    const actorName = document.createElement("strong");
    actorName.textContent = doc.actor?.name || "";
    actorLine.appendChild(actorLabel);
    actorLine.appendChild(actorName);
    wrap.appendChild(actorLine);

    const btns = document.createElement("div");
    btns.className = "action-buttons";
    const title = document.createElement("span");
    title.className = "action-title";
    title.textContent = doc.ui?.actions_title || "操作";
    btns.appendChild(title);

    (doc.actions || [])
      .filter((a) => a.bound_to !== "status_pill")
      .forEach((a) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "action-btn";
        b.textContent = a.label || a.id;
        b.addEventListener("click", () => performAction(a));
        btns.appendChild(b);
      });
    wrap.appendChild(btns);
    return wrap;
  }

  function findAction(predicate) {
    return (doc.actions || []).find(predicate);
  }

  function renderForm() {
    ensureFieldOptions(doc.fields, EMBEDDED_DOC.fields);
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

    article.appendChild(renderActions());

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
    pill.addEventListener("click", () => {
      const a =
        findAction((x) => x.bound_to === "status_pill") ||
        findAction((x) => x.kind === "cycle_status") || {
          id: "cycle_status",
          label: "切換狀態",
          kind: "cycle_status",
        };
      performAction(a);
    });
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
    article.appendChild(renderLogs());
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
      doc = ensureDocShape(parsed);
      jsonDirty = false;
      resetOpenedSnapshot();
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

  function loadChecks() {
    try {
      return JSON.parse(localStorage.getItem(CHECK_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveChecks(map) {
    localStorage.setItem(CHECK_KEY, JSON.stringify(map));
  }

  function updateInteropBadge() {
    if (!alr5Standard || !els.interopBadge) return;
    const map = loadChecks();
    const req = (alr5Standard.interop_checklist || []).filter((c) => c.required);
    const pass = req.filter((c) => map[c.id]).length;
    const ok = req.length > 0 && pass === req.length;
    els.interopBadge.textContent = ok
      ? `互通檢查通過（${pass}/${req.length}）— JSON 可互通`
      : `互通檢查 ${pass}/${req.length}（必填項未全過）`;
    els.interopBadge.classList.toggle("ok", ok);
  }

  function renderAlr5Guide() {
    const root = els.guideBody;
    if (!root || !alr5Standard) return;
    root.replaceChildren();
    const s = alr5Standard;
    const checks = loadChecks();

    const hero = document.createElement("header");
    hero.className = "guide-hero";
    hero.innerHTML = `<h1>${s.title || "ALR5"}</h1>
      <p class="guide-ver">standard_version ${s.standard_version} · 目標：檢查全過即可 JSON 互通</p>
      <p class="guide-lead">${s.purpose || ""}</p>`;
    root.appendChild(hero);

    const featSec = document.createElement("section");
    featSec.className = "guide-sec";
    featSec.innerHTML = "<h2>功能 → 實際情境</h2>";
    const grid = document.createElement("div");
    grid.className = "feat-grid";
    (s.features || []).forEach((f) => {
      const card = document.createElement("article");
      card.className = "feat-card";
      const h = document.createElement("h3");
      h.textContent = f.title;
      const sc = document.createElement("p");
      sc.className = "feat-scenario";
      sc.textContent = f.scenario;
      const ul = document.createElement("ul");
      (f.rules || []).forEach((r) => {
        const li = document.createElement("li");
        li.textContent = r;
        ul.appendChild(li);
      });
      const js = document.createElement("p");
      js.className = "feat-json";
      js.textContent = "JSON：" + (f.json || []).join(" · ");
      card.appendChild(h);
      card.appendChild(sc);
      card.appendChild(ul);
      card.appendChild(js);
      grid.appendChild(card);
    });
    featSec.appendChild(grid);
    root.appendChild(featSec);

    const levelSec = document.createElement("section");
    levelSec.className = "guide-sec";
    levelSec.innerHTML = "<h2>current_level × 誰能按</h2>";
    const lt = document.createElement("table");
    lt.className = "guide-table";
    lt.innerHTML =
      "<thead><tr><th>level</th><th>意義</th><th>誰</th><th>動作</th></tr></thead>";
    const tb = document.createElement("tbody");
    (s.current_level_model?.values || []).forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><code>${row.level === null ? "空" : row.level}</code></td>
        <td>${row.meaning}</td>
        <td>${(row.holders || []).join("／") || "—"}</td>
        <td>${(row.actions || []).join(", ")}</td>`;
      tb.appendChild(tr);
    });
    lt.appendChild(tb);
    levelSec.appendChild(lt);
    root.appendChild(levelSec);

    const chkSec = document.createElement("section");
    chkSec.className = "guide-sec";
    chkSec.innerHTML =
      "<h2>互通檢查清單</h2><p class=\"guide-note\">全部「必填」勾選通過後，視為可與 ALR5 JSON 互通。</p>";
    const list = document.createElement("ul");
    list.className = "check-list";
    (s.interop_checklist || []).forEach((c) => {
      const li = document.createElement("li");
      const id = `chk_${c.id}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = id;
      cb.checked = !!checks[c.id];
      cb.addEventListener("change", () => {
        const m = loadChecks();
        m[c.id] = cb.checked;
        saveChecks(m);
        updateInteropBadge();
      });
      const span = document.createElement("span");
      span.innerHTML = `${c.required ? "<strong>必填</strong> " : "<em>可選</em> "}${c.label}`;
      label.appendChild(cb);
      label.appendChild(span);
      li.appendChild(label);
      list.appendChild(li);
    });
    chkSec.appendChild(list);
    root.appendChild(chkSec);

    const qSec = document.createElement("section");
    qSec.className = "guide-sec";
    qSec.innerHTML = "<h2>請你拍板（欄位／邏輯未決）</h2>";
    const ql = document.createElement("ol");
    ql.className = "q-list";
    (s.open_questions || []).forEach((q) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="sev sev-${q.severity}">${q.severity}</span> ${q.question}`;
      ql.appendChild(li);
    });
    qSec.appendChild(ql);
    root.appendChild(qSec);

    const riskSec = document.createElement("section");
    riskSec.className = "guide-sec";
    riskSec.innerHTML = "<h2>實作易錯／邏輯風險</h2>";
    const rl = document.createElement("ul");
    (s.logic_risk_warnings || []).forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w.warning;
      rl.appendChild(li);
    });
    riskSec.appendChild(rl);
    root.appendChild(riskSec);

    updateInteropBadge();
  }

  async function copyText(text, btn, okLabel) {
    try {
      await navigator.clipboard.writeText(text);
      const old = btn.textContent;
      btn.textContent = okLabel || "已複製";
      setTimeout(() => {
        btn.textContent = old;
      }, 1600);
    } catch {
      btn.textContent = "複製失敗（請手動選取檔案）";
    }
  }

  function renderTabs() {
    const views = ensureViews(doc.ui?.views);
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

  function ensureViews(views) {
    const base = [
      { id: "form", label: "申請單畫面" },
      { id: "json", label: "JSON" },
      { id: "alr5", label: "ALR5功能" },
    ];
    const list = Array.isArray(views) ? views.slice() : [];
    base.forEach((b) => {
      if (!list.some((x) => x.id === b.id)) list.push(b);
    });
    return list;
  }

  function switchView(next) {
    if (view === "json" && next !== "json" && jsonDirty) {
      if (!applyJsonFromEditor()) return;
    }
    view = next;
    els.form.hidden = view !== "form";
    els.json.hidden = view !== "json";
    if (els.alr5) els.alr5.hidden = view !== "alr5";
    renderTabs();
    if (view === "json") {
      jsonDirty = false;
      els.editor.value = prettyJson();
      showJsonMsg("");
    } else if (view === "form") {
      renderForm();
    } else if (view === "alr5") {
      renderAlr5Guide();
    }
  }

  if (els.btnCopyAi) {
    els.btnCopyAi.addEventListener("click", () => {
      const text =
        (alr5Standard?.ai_prompt_prefix || "") +
        "\n\n" +
        (alr5Markdown || JSON.stringify(alr5Standard, null, 2));
      copyText(text, els.btnCopyAi, "已複製給 AI");
    });
  }
  if (els.btnCopyJson) {
    els.btnCopyJson.addEventListener("click", () => {
      copyText(
        JSON.stringify(alr5Standard || {}, null, 2),
        els.btnCopyJson,
        "已複製 JSON"
      );
    });
  }

  els.editor.addEventListener("input", () => {
    jsonDirty = true;
    showJsonMsg("已修改（切回申請單畫面時會套用）", false);
  });

  els.editor.addEventListener("blur", () => {
    if (jsonDirty) applyJsonFromEditor();
  });

  function ensureDocShape(d) {
    const base = clone(EMBEDDED_DOC);
    if (!d.meta) d.meta = base.meta;
    if (!d.ui) d.ui = base.ui;
    else d.ui = { ...base.ui, ...d.ui };
    d.ui.views = ensureViews(d.ui.views);
    if (!d.actor) d.actor = base.actor;
    if (!d.actions) d.actions = base.actions;
    if (!d.statuses) d.statuses = base.statuses;
    if (!d.fields) d.fields = base.fields;
    if (!d.body) d.body = base.body;
    if (!d.approval) d.approval = base.approval;
    if (!d.system) d.system = base.system;
    if (!Array.isArray(d.logs)) d.logs = [];
    ensureFieldOptions(d.fields, base.fields);
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
        const res = await fetch("./document.json?v=alr5guide1", {
          cache: "no-store",
        });
        if (res.ok) base = await res.json();
      } catch {
        /* offline */
      }
    }
    try {
      const sr = await fetch("./alr5-standard.json?v=alr5guide024", {
        cache: "no-store",
      });
      if (sr.ok) alr5Standard = await sr.json();
    } catch {
      /* offline */
    }
    try {
      const mr = await fetch("./ALR5標準互通.md?v=alr5guide1", {
        cache: "no-store",
      });
      if (mr.ok) alr5Markdown = await mr.text();
    } catch {
      alr5Markdown = "";
    }

    doc = ensureDocShape(base ? clone(base) : clone(EMBEDDED_DOC));
    persist();
    resetOpenedSnapshot();
    document.documentElement.lang = doc.meta?.lang || "zh-Hant";
    document.title = `Approval｜${doc.meta?.title || ""}`;
    renderTabs();
    switchView("form");
  }

  boot();
})();
