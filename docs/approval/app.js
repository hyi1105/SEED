(() => {
  /**
   * API 時代：document JSON 是唯一真相。
   * 畫面只渲染；按鈕會寫入 logs（時間／操作者／開啟時 vs 儲存後／GitHub 紅綠 diff）。
   */
  const STORAGE_KEY = "approval.document.v5";
  const FORMS_KEY = "approval.forms.catalog.v2";
  const NAV_KEY = "approval.nav.v1";
  const MIN_CH = 2;

  /**
   * 系統內建欄位（依 approval/ALR5簽核系統.md §2.1／system 模型）
   * Owner 不可當內容欄增刪。
   */
  const SYSTEM_FIELD_DEFS = [
    { id: "creator", label: "建立者", note: "填單人；可代填（§2.1）" },
    { id: "requester", label: "需求人", note: "真正有需求的人" },
    { id: "cc", label: "副本", note: "送出後通知；可編" },
    { id: "cc_system", label: "系統副本", note: "Admin 預設；不可編" },
    { id: "approvers[]", label: "簽核人", note: "或 approver_1…；對應 step_n" },
    { id: "stage_notifies[]", label: "關卡通過通知", note: "或 stage_notify_1…；該關同意往下時" },
    { id: "fyi", label: "結案知會", note: "整張完成後；可編" },
    { id: "fyi_system", label: "系統結案知會", note: "Admin 預設；不可編" },
    { id: "system.status", label: "狀態", note: "new／draft／in_process…" },
    { id: "system.current_level", label: "目前關卡", note: "空／0／1…／9999／-1／-2" },
    { id: "system.doc_no", label: "單號", note: "含 .N 版本後綴" },
    { id: "current_approver", label: "當階簽核者", note: "current_level 對應關上輪到的人" },
    { id: "system.archived", label: "封存", note: "軟刪除旗標；非 status" },
  ];
  /** 隨 step_n（n≥1）展開的扁平 id（規格允許 approver_n／stage_notify_n） */
  const SYSTEM_STEP_FIELD_TMPL = [
    { id: "approver_{n}", label: "簽核人（第 {n} 關）" },
    { id: "stage_notify_{n}", label: "關卡通過通知（第 {n} 關）" },
    { id: "approver_{n}.comment", label: "簽核意見（第 {n} 關）" },
    { id: "approver_{n}.proxy_original_note", label: "代簽備註（第 {n} 關）" },
  ];

  const EMBEDDED_DOC = {
    "schema_version": "1.2",
    "meta": {
      "system_name": "LEAVE",
      "form_id": "leave_request_v1",
      "form_version": "1.0.0",
      "title": "請假申請書",
      "creator": "王小明",
      "location": "",
      "lang": "zh-Hant",
      "note": "ALR5：設計表單淺色；系統欄位依規格 creator／requester／approver_n…；內容欄位可增刪；step_N 可刪。"
    },
    "actor": {
      "id": "u_wang",
      "name": "王小明",
      "role": "requester"
    },
    "roles": [
      {
        "id": "requester",
        "label": "申請人／需求人",
        "person": {
          "id": "u_wang",
          "name": "王小明"
        },
        "stamp_id": "step_0"
      },
      {
        "id": "approver_1",
        "label": "代理人（level 1）",
        "person": {
          "id": "u_chen",
          "name": "陳美玲"
        },
        "stamp_id": "step_1"
      },
      {
        "id": "approver_2",
        "label": "課長（level 2）",
        "person": {
          "id": "u_lin",
          "name": "林課長"
        },
        "stamp_id": "step_2"
      },
      {
        "id": "approver_3",
        "label": "協理（level 3）",
        "person": {
          "id": "u_yen",
          "name": "嚴協理"
        },
        "stamp_id": "step_3"
      },
      {
        "id": "admin",
        "label": "Admin",
        "person": {
          "id": "u_admin",
          "name": "系統管理員"
        },
        "stamp_id": null
      }
    ],
    "ui": {
      "views": [
        {
          "id": "apply",
          "label": "申請"
        },
        {
          "id": "design",
          "label": "設計表單"
        },
        {
          "id": "json",
          "label": "JSON"
        },
        {
          "id": "alr5",
          "label": "ALR5功能"
        }
      ],
      "sys_fields_aria": "系統欄位（報表用）",
      "sys_hint": "測試：上方可手動切角色與 current_level；切到 level 2 會自動核准 level 1。印章下方為動作按鈕；系統欄位依 ALR5（creator／requester／approver_n…）；狀態只顯示不可點。",
      "empty_mark": "—",
      "pending_stamp_label": "尚未蓋印",
      "actions_title": "操作",
      "log_title": "操作紀錄",
      "log_empty": "尚無操作紀錄",
      "log_opened_label": "開啟時",
      "log_saved_label": "儲存後",
      "log_no_change": "欄位值無變更",
      "actor_label": "目前操作者",
      "debug_title": "測試切換（角色／level）",
      "comment_placeholder": "（無意見）"
    },
    "actions": [
      {
        "id": "submit",
        "label": "送出",
        "kind": "submit"
      },
      {
        "id": "cycle_status",
        "label": "切換狀態",
        "kind": "cycle_status",
        "bound_to": "status_pill"
      }
    ],
    "statuses": [
      {
        "id": "new",
        "label": "New",
        "tip": "新申請",
        "level": null,
        "submitted_at": null,
        "completed_at": null
      },
      {
        "id": "draft",
        "label": "Draft",
        "tip": "被暫存過了",
        "level": 0,
        "submitted_at": null,
        "completed_at": null
      },
      {
        "id": "in_process",
        "label": "In Process",
        "tip": "已經送出等待簽核",
        "level": 1,
        "submitted_at": null,
        "completed_at": null
      },
      {
        "id": "completed",
        "label": "Completed",
        "tip": "全部簽核過",
        "level": 9999,
        "submitted_at": null,
        "completed_at": null
      },
      {
        "id": "denied",
        "label": "Denied",
        "tip": "有人拒絕了",
        "level": -2,
        "submitted_at": null,
        "completed_at": null
      },
      {
        "id": "cancelled",
        "label": "Cancelled",
        "tip": "已取消",
        "level": -1,
        "submitted_at": null,
        "completed_at": null
      }
    ],
    "fields": {
      "applicant": {
        "kind": "content",
        "type": "text",
        "label": "申請人",
        "value": "王小明"
      },
      "leave_type": {
        "kind": "content",
        "type": "dropdown",
        "label": "假別",
        "value": "事假",
        "options": [
          {
            "value": "特休",
            "label": "特休"
          },
          {
            "value": "事假",
            "label": "事假"
          },
          {
            "value": "病假",
            "label": "病假"
          },
          {
            "value": "其他",
            "label": "其他"
          }
        ]
      },
      "leave_date": {
        "kind": "content",
        "type": "text",
        "label": "起始日",
        "value": "明天"
      },
      "days": {
        "kind": "content",
        "type": "number",
        "label": "天數",
        "value": "1"
      },
      "agent": {
        "kind": "content",
        "type": "text",
        "label": "代理人",
        "value": "陳美玲"
      }
    },
    "body": {
      "paragraphs": [
        {
          "parts": [
            {
              "t": "text",
              "v": "申請人"
            },
            {
              "t": "field",
              "name": "applicant"
            },
            {
              "t": "text",
              "v": "因"
            },
            {
              "t": "field",
              "name": "leave_type"
            },
            {
              "t": "text",
              "v": "，自"
            },
            {
              "t": "field",
              "name": "leave_date"
            },
            {
              "t": "text",
              "v": "起請假"
            },
            {
              "t": "field",
              "name": "days"
            },
            {
              "t": "text",
              "v": "天，代理人為"
            },
            {
              "t": "field",
              "name": "agent"
            },
            {
              "t": "text",
              "v": "。"
            }
          ]
        }
      ]
    },
    "approval": {
      "title": "簽核",
      "columns": [
        {
          "id": "step_3",
          "label": "協理",
          "level": 3,
          "role": "approver_3",
          "person": {
            "id": "u_yen",
            "name": "嚴協理"
          },
          "stamp": {
            "name": "嚴",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          }
        },
        {
          "id": "step_2",
          "label": "課長",
          "level": 2,
          "role": "approver_2",
          "person": {
            "id": "u_lin",
            "name": "林課長"
          },
          "stamp": {
            "name": "林",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          }
        },
        {
          "id": "step_1",
          "label": "代理人",
          "level": 1,
          "role": "approver_1",
          "person": {
            "id": "u_chen",
            "name": "陳美玲"
          },
          "stamp": {
            "name": "陳",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          }
        },
        {
          "id": "step_0",
          "label": "申請",
          "level": 0,
          "role": "requester",
          "person": {
            "id": "u_wang",
            "name": "王小明"
          },
          "stamp": {
            "name": "王",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          }
        }
      ]
    },
    "system": {
      "doc_no": "LEAVE王小明20260804183000A1B.1",
      "doc_version": 1,
      "current_level": 0,
      "submitted_at": null,
      "completed_at": null,
      "status": "draft",
      "archived": false
    },
    "logs": []
  };

  let doc = null;
  let view = "form";
  let jsonDirty = false;
  /** 本次開啟／上次按鈕後的快照（對應 log.opened） */
  let openedSnapshot = null;
  let openLogId = null;
  let alr5Standard = null;
  let alr5Markdown = "";
  let formsCatalog = [];
  let appNav = {
    tab: "apply",
    applyLayer: "list",
    designLayer: "list",
    editingFormId: null,
  };
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
      const fid = doc?.meta?.form_id;
      if (fid) localStorage.setItem(docStorageKey(fid), JSON.stringify(doc));
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


  function maxApprovalLevel() {
    const cols = doc.approval?.columns || [];
    let m = 0;
    cols.forEach((c) => {
      const lv = Number(c.level);
      if (!Number.isNaN(lv) && lv > m) m = lv;
    });
    return m;
  }

  function columnByLevel(level) {
    return (doc.approval?.columns || []).find((c) => Number(c.level) === Number(level));
  }

  function roleDef(roleId) {
    return (doc.roles || []).find((r) => r.id === roleId);
  }

  function setActorFromRole(roleId) {
    const r = roleDef(roleId);
    if (!r) return;
    doc.actor = {
      id: r.person?.id || roleId,
      name: r.person?.name || r.label || roleId,
      role: r.id,
    };
  }

  function stampColumn(col, mark, comment) {
    if (!col.stamp) col.stamp = {};
    col.stamp.pending = false;
    col.stamp.mark = mark;
    col.stamp.time = nowStamp();
    if (comment != null) col.stamp.comment = comment;
    if (!col.stamp.name && col.person?.name) {
      col.stamp.name = String(col.person.name).slice(0, 1);
    }
  }

  function clearColumn(col) {
    if (!col.stamp) col.stamp = {};
    col.stamp.pending = true;
    col.stamp.mark = null;
    col.stamp.time = null;
    col.stamp.comment = col.stamp.comment || "";
  }

  /** 核准某 level 的印章（自動補齊用） */
  function approveLevel(level, mark = "APPROVE", comment = "（自動核准）") {
    const col = columnByLevel(level);
    if (!col) return false;
    if (col.stamp && !col.stamp.pending && col.stamp.mark) return false;
    stampColumn(col, mark, comment);
    return true;
  }

  /** 切到 targetLevel 時：自動核准所有 < targetLevel 的簽核關（含 0 申請印） */
  function autoApproveBelow(targetLevel) {
    const t = Number(targetLevel);
    if (Number.isNaN(t) || t < 0) return;
    const cols = doc.approval?.columns || [];
    cols.forEach((col) => {
      const lv = Number(col.level);
      if (Number.isNaN(lv) || lv < 0) return;
      if (lv < t) {
        if (!col.stamp || col.stamp.pending || !col.stamp.mark) {
          const mark = lv === 0 ? "申請" : "APPROVE";
          stampColumn(col, mark, lv === 0 ? "（已送出）" : "（切 level 自動核准）");
        }
      } else if (lv >= t) {
        // 當前與之後：保持／清空待簽
        if (lv === t) {
          // 目前關：待簽
          if (!col.stamp?.mark || col.stamp.pending) clearColumn(col);
        } else {
          clearColumn(col);
        }
      }
    });
  }

  function syncStatusForLevel(level) {
    if (!doc.system) doc.system = {};
    const lv = level === "" || level === null || level === undefined ? null : Number(level);
    doc.system.current_level = lv;
    if (lv === null || Number.isNaN(lv)) {
      doc.system.status = "new";
      doc.system.completed_at = null;
    } else if (lv === 0) {
      doc.system.status = doc.system.submitted_at ? "draft" : "draft";
      doc.system.completed_at = null;
    } else if (lv === 9999) {
      doc.system.status = "completed";
      doc.system.completed_at = doc.system.completed_at || nowStamp();
    } else if (lv === -1) {
      doc.system.status = "cancelled";
      doc.system.completed_at = null;
    } else if (lv === -2) {
      doc.system.status = "denied";
      doc.system.completed_at = doc.system.completed_at || nowStamp();
    } else if (lv > 0) {
      doc.system.status = "in_process";
      doc.system.completed_at = null;
      if (!doc.system.submitted_at) doc.system.submitted_at = nowStamp();
    }
  }

  function applyManualLevel(raw) {
    const opened = snapshotState();
    openedSnapshot = opened;
    let lv = raw === "" || raw === "null" || raw === "empty" ? null : Number(raw);
    if (raw !== "" && raw !== "null" && raw !== "empty" && Number.isNaN(lv)) return;

    // 使用者指定：切到 2 → 自動 approve 1（以及更低）
    if (lv != null && lv > 0) autoApproveBelow(lv);
    if (lv === 0) {
      // 退回申請人：清 1+ 印章，保留或清 0
      (doc.approval?.columns || []).forEach((col) => {
        if (Number(col.level) > 0) clearColumn(col);
      });
    }
    if (lv === 9999) autoApproveBelow(maxApprovalLevel() + 1);
    if (lv === -2 || lv === -1) {
      // 拒件／取消不強制改印章內容
    }

    syncStatusForLevel(lv);
    if (lv != null && lv >= 1 && lv !== 9999) {
      const col = columnByLevel(lv);
      const role = col?.role;
      if (role) setActorFromRole(role);
    } else if (lv === 0 || lv == null) {
      setActorFromRole("requester");
    }

    appendLog({
      id: "set_level",
      label: `切換 level → ${lv == null ? "空" : lv}`,
      kind: "debug_level",
    });
    persist();
    renderForm();
    syncJsonEditorIfVisible();
  }

  function applyManualRole(roleId) {
    const opened = snapshotState();
    openedSnapshot = opened;
    setActorFromRole(roleId);
    appendLog({
      id: "set_role",
      label: `切換角色 → ${roleDef(roleId)?.label || roleId}`,
      kind: "debug_role",
    });
    persist();
    renderForm();
    syncJsonEditorIfVisible();
  }

  function canActOnColumn(col) {
    const lv = doc.system?.current_level;
    const role = doc.actor?.role;
    if (role === "admin") return true;
    if (lv == null) return Number(col.level) === 0 && role === "requester";
    if (Number(lv) === 0) return Number(col.level) === 0 && (role === "requester" || role === col.role);
    return Number(col.level) === Number(lv) && (role === col.role || role === "admin");
  }

  function readCommentInput(colId) {
    const el = document.querySelector(`[data-comment-for="${colId}"]`);
    return el ? el.value.trim() : "";
  }

  function runStampAction(col, kind) {
    const comment = readCommentInput(col.id);
    const opened = snapshotState();
    openedSnapshot = opened;
    if (!doc.system) doc.system = {};

    if (kind === "submit") {
      stampColumn(col, "申請", comment || "送出申請");
      doc.system.status = "in_process";
      doc.system.current_level = 1;
      doc.system.submitted_at = nowStamp();
      doc.system.completed_at = null;
      if (!doc.system.doc_no) {
        doc.system.doc_version = doc.system.doc_version || 1;
        doc.system.doc_no = makeDocNo(fieldValue("applicant"), new Date(), doc.system.doc_version);
      }
      // 進 level 1：申請關已蓋；level1 待簽
      const next = columnByLevel(1);
      if (next) clearColumn(next);
      setActorFromRole(next?.role || "approver_1");
      appendLog({ id: "submit", label: "送出", kind: "submit" });
    } else if (kind === "approve") {
      stampColumn(col, "APPROVE", comment);
      const maxLv = maxApprovalLevel();
      const cur = Number(col.level);
      if (cur >= maxLv) {
        doc.system.current_level = 9999;
        doc.system.status = "completed";
        doc.system.completed_at = nowStamp();
      } else {
        const nextLv = cur + 1;
        doc.system.current_level = nextLv;
        doc.system.status = "in_process";
        const next = columnByLevel(nextLv);
        if (next) clearColumn(next);
        if (next?.role) setActorFromRole(next.role);
      }
      appendLog({ id: "approve", label: `核准 ${col.label || col.id}`, kind: "approve" });
    } else if (kind === "reject") {
      stampColumn(col, "REJECT", comment || "拒件");
      doc.system.current_level = -2;
      doc.system.status = "denied";
      doc.system.completed_at = nowStamp();
      appendLog({ id: "reject", label: `拒絕 ${col.label || col.id}`, kind: "reject" });
    } else if (kind === "return") {
      stampColumn(col, "RETURN", comment || "退回");
      doc.system.current_level = 0;
      doc.system.status = "draft";
      doc.system.completed_at = null;
      (doc.approval?.columns || []).forEach((c) => {
        if (Number(c.level) > 0) clearColumn(c);
      });
      setActorFromRole("requester");
      appendLog({ id: "return", label: `退回 ${col.label || col.id}`, kind: "return" });
    }

    persist();
    renderForm();
    syncJsonEditorIfVisible();
  }

  function renderDebugBar() {
    const wrap = document.createElement("div");
    wrap.className = "debug-bar";
    const title = document.createElement("div");
    title.className = "debug-title";
    title.textContent = doc.ui?.debug_title || "測試切換（角色／level）";
    wrap.appendChild(title);

    const row = document.createElement("div");
    row.className = "debug-row";

    const roleLab = document.createElement("label");
    roleLab.textContent = "角色";
    const roleSel = document.createElement("select");
    roleSel.className = "debug-select";
    (doc.roles || []).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.label || r.id;
      if (doc.actor?.role === r.id) opt.selected = true;
      roleSel.appendChild(opt);
    });
    roleSel.addEventListener("change", () => applyManualRole(roleSel.value));
    roleLab.appendChild(roleSel);
    row.appendChild(roleLab);

    const lvLab = document.createElement("label");
    lvLab.textContent = "current_level";
    const lvSel = document.createElement("select");
    lvSel.className = "debug-select";
    const levels = [
      ["empty", "空（未 SAVE）"],
      ["0", "0 申請人"],
      ["1", "1"],
      ["2", "2（自動核准 1）"],
      ["3", "3"],
      ["9999", "9999 完成"],
      ["-1", "-1 取消"],
      ["-2", "-2 Denied"],
    ];
    const cur = doc.system?.current_level;
    levels.forEach(([v, lab]) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = lab;
      const match =
        (v === "empty" && (cur === null || cur === undefined)) ||
        String(cur) === v;
      if (match) opt.selected = true;
      lvSel.appendChild(opt);
    });
    lvSel.addEventListener("change", () => {
      const v = lvSel.value === "empty" ? "empty" : lvSel.value;
      applyManualLevel(v === "empty" ? "empty" : v);
    });
    lvLab.appendChild(lvSel);
    row.appendChild(lvLab);

    const hint = document.createElement("span");
    hint.className = "debug-hint";
    hint.textContent = "切到 2 → 自動 APPROVE level 1";
    row.appendChild(hint);

    wrap.appendChild(row);
    return wrap;
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

      const comment = document.createElement("div");
      comment.className = "inkan-comment";
      if (pending) {
        const inp = document.createElement("textarea");
        inp.className = "inkan-comment-input";
        inp.rows = 2;
        inp.placeholder = "comment";
        inp.dataset.commentFor = col.id;
        inp.value = stamp.comment || "";
        comment.appendChild(inp);
      } else {
        comment.textContent =
          stamp.comment || doc.ui?.comment_placeholder || "（無意見）";
      }
      td.appendChild(comment);

      const btns = document.createElement("div");
      btns.className = "inkan-actions";
      const allow = canActOnColumn(col);
      const lv = Number(col.level);
      const cur = doc.system?.current_level;

      const addBtn = (label, kind, cls) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `inkan-btn ${cls || ""}`;
        b.textContent = label;
        b.disabled = !allow;
        b.addEventListener("click", () => runStampAction(col, kind));
        btns.appendChild(b);
      };

      if (lv === 0 && (cur === 0 || cur == null || cur === "")) {
        addBtn("送出", "submit", "primary");
      } else if (lv > 0 && Number(cur) === lv) {
        addBtn("核准", "approve", "primary");
        addBtn("拒絕", "reject", "danger");
        addBtn("退回", "return", "");
      } else if (allow && roleDef(doc.actor?.role)?.id === "admin" && Number(cur) === lv && lv > 0) {
        addBtn("核准", "approve", "primary");
        addBtn("拒絕", "reject", "danger");
        addBtn("退回", "return", "");
      }

      td.appendChild(btns);
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
    const actorName = doc.actor?.name || "";
    const rows = [
      ["creator", doc.meta?.creator || ""],
      ["requester", fieldValue("applicant") || actorName],
      ["system.status", st?.label || doc.system?.status],
      ["system.current_level", doc.system?.current_level],
      ["current_approver", actorName],
      ["system.doc_no", doc.system?.doc_no],
      ["system.archived", doc.system?.archived ? "true" : "false"],
      ["submitted_at", doc.system?.submitted_at],
      ["completed_at", doc.system?.completed_at],
    ];
    const steps = (doc.approval?.columns || []).filter((c) => Number(c.level) > 0);
    steps
      .slice()
      .sort((a, b) => Number(a.level) - Number(b.level))
      .forEach((col) => {
        const n = Number(col.level);
        rows.push([`approver_${n}`, col.person?.name || ""]);
        rows.push([
          `approver_${n}.comment`,
          col.stamp?.comment || "",
        ]);
        rows.push([
          `approver_${n}.mark`,
          col.stamp?.pending ? "pending" : col.stamp?.mark || "",
        ]);
        rows.push([`approver_${n}.time`, col.stamp?.time || ""]);
      });
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

  function findAction(predicate) {
    return (doc.actions || []).find(predicate);
  }

  function renderForm() {
    ensureFieldOptions(doc.fields, EMBEDDED_DOC.fields);
    const stage = els.form;
    stage.replaceChildren();

    const article = document.createElement("article");
    article.className = "a4";

    article.appendChild(
      renderBackBar("選擇表單", () => {
        appNav.applyLayer = "list";
        persistNav();
        renderApp();
      })
    );

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

    article.appendChild(renderDebugBar());

    const signSec = document.createElement("section");
    signSec.className = "block hanko-block";

    const head = document.createElement("div");
    head.className = "sign-head";
    const h3 = document.createElement("h3");
    h3.className = "sign-title";
    h3.textContent = doc.approval?.title || "";
    const pill = document.createElement("span");
    pill.className = "status-pill status-pill-static";
    const st = statusOf(doc.system?.status);
    pill.dataset.status = st?.id || "";
    pill.textContent = st?.label || "";
    pill.title = st?.tip || "";
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
    const views = ensureViews();
    els.tabs.replaceChildren();
    views.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-tab" + (appNav.tab === v.id ? " active" : "");
      btn.textContent = v.label;
      btn.dataset.view = v.id;
      btn.addEventListener("click", () => switchView(v.id));
      els.tabs.appendChild(btn);
    });
  }

  function ensureViews(views) {
    return [
      { id: "apply", label: "申請" },
      { id: "design", label: "設計表單" },
      { id: "json", label: "JSON" },
      { id: "alr5", label: "ALR5功能" },
    ];
  }

  function defaultCatalogFromDoc(d) {
    const id = d?.meta?.form_id || "leave_request_v1";
    return [
      {
        form_id: id,
        title: d?.meta?.title || "請假申請書",
        creator: d?.meta?.creator || d?.actor?.name || "王小明",
        location: d?.meta?.location || "",
        form_version: d?.meta?.form_version || "1.0.0",
        system_name: d?.meta?.system_name || "LEAVE",
        updated_at: nowStamp(),
      },
      {
        form_id: "expense_claim_v1",
        title: "費用報銷單",
        creator: "系統範本",
        location: "",
        form_version: "0.1.0",
        system_name: "EXPENSE",
        updated_at: nowStamp(),
      },
    ];
  }

  function normalizeCatalogRow(f) {
    return {
      form_id: f.form_id,
      title: f.title || f.form_id,
      creator: f.creator || "—",
      location: f.location || "",
      form_version: f.form_version || "",
      system_name: f.system_name || "",
      updated_at: f.updated_at || "",
    };
  }

  function loadFormsCatalog() {
    try {
      const raw = localStorage.getItem(FORMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map(normalizeCatalogRow);
        }
      }
    } catch {}
    return null;
  }

  function persistFormsCatalog() {
    try {
      localStorage.setItem(FORMS_KEY, JSON.stringify(formsCatalog));
    } catch {}
  }

  function persistNav() {
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(appNav));
    } catch {}
  }

  function loadNav() {
    try {
      const raw = localStorage.getItem(NAV_KEY);
      if (raw) {
        const n = JSON.parse(raw);
        if (n && typeof n === "object") appNav = { ...appNav, ...n };
      }
    } catch {}
  }

  function upsertCatalogEntry(d) {
    const id = d?.meta?.form_id;
    if (!id) return;
    const row = normalizeCatalogRow({
      form_id: id,
      title: d?.meta?.title || id,
      creator: d?.meta?.creator || d?.actor?.name || "—",
      location: d?.meta?.location || "",
      form_version: d?.meta?.form_version || "1.0.0",
      system_name: d?.meta?.system_name || "",
      updated_at: nowStamp(),
    });
    const i = formsCatalog.findIndex((x) => x.form_id === id);
    if (i >= 0) formsCatalog[i] = { ...formsCatalog[i], ...row };
    else formsCatalog.push(row);
    persistFormsCatalog();
  }

  function migrateStepIds(d) {
    const legacy = {
      director: "step_3",
      manager: "step_2",
      agent: "step_1",
      applicant: "step_0",
    };
    (d.approval?.columns || []).forEach((c) => {
      if (legacy[c.id]) c.id = legacy[c.id];
    });
    (d.roles || []).forEach((r) => {
      if (legacy[r.stamp_id]) r.stamp_id = legacy[r.stamp_id];
    });
    Object.keys(d.fields || {}).forEach((fid) => {
      const f = d.fields[fid];
      if (f && !f.kind) f.kind = "content";
    });
    if (!d.meta) d.meta = {};
    if (!d.meta.creator) d.meta.creator = d.actor?.name || "";
    if (d.meta.location == null) d.meta.location = "";
    return d;
  }

  function renumberApprovalSteps(d) {
    const cols = d.approval?.columns || [];
    const applyCol = cols.find((c) => Number(c.level) === 0);
    const steps = cols
      .filter((c) => Number(c.level) > 0)
      .sort((a, b) => Number(a.level) - Number(b.level));
    steps.forEach((c, i) => {
      c.level = i + 1;
      c.id = `step_${i + 1}`;
    });
    if (applyCol) {
      applyCol.level = 0;
      applyCol.id = "step_0";
    }
    const ordered = [...steps].sort((a, b) => Number(b.level) - Number(a.level));
    if (applyCol) ordered.push(applyCol);
    d.approval.columns = ordered;
    (d.roles || []).forEach((r) => {
      if (!r.stamp_id) return;
      const hit = ordered.find((c) => c.role === r.id);
      if (hit) r.stamp_id = hit.id;
    });
    return d;
  }

  function docStorageKey(formId) {
    return STORAGE_KEY + ":" + (formId || "default");
  }

  function loadDocForForm(formId) {
    try {
      const raw = localStorage.getItem(docStorageKey(formId));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function persistDocForForm(formId, d) {
    try {
      localStorage.setItem(docStorageKey(formId), JSON.stringify(d));
      // also keep legacy key for JSON tab convenience
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }

  function makeBlankForm(formId, title, creator) {
    const d = clone(EMBEDDED_DOC);
    d.meta = {
      ...d.meta,
      form_id: formId,
      title: title || formId,
      creator: creator || d.meta.creator || "—",
      location: "",
      form_version: "0.1.0",
      system_name: (formId.split("_")[0] || "FORM").toUpperCase(),
      note: "新建表單（設計中）",
    };
    d.system = {
      doc_no: null,
      doc_version: 1,
      current_level: 0,
      submitted_at: null,
      completed_at: null,
      status: "draft",
      archived: false,
    };
    d.logs = [];
    (d.approval?.columns || []).forEach((c) => {
      if (!c.stamp) c.stamp = {};
      c.stamp.pending = true;
      c.stamp.mark = null;
      c.stamp.time = null;
      c.stamp.comment = "";
    });
    return ensureDocShape(d);
  }

  function openApplyForm(formId) {
    let d = loadDocForForm(formId);
    if (!d) {
      if (formId === (EMBEDDED_DOC.meta?.form_id || "leave_request_v1")) {
        d = clone(EMBEDDED_DOC);
      } else {
        const meta = formsCatalog.find((x) => x.form_id === formId);
        d = makeBlankForm(formId, meta?.title);
      }
    }
    doc = ensureDocShape(d);
    if (!doc.meta.form_version) doc.meta.form_version = "1.0.0";
    upsertCatalogEntry(doc);
    persistDocForForm(formId, doc);
    resetOpenedSnapshot();
    appNav.tab = "apply";
    appNav.applyLayer = "doc";
    persistNav();
    renderApp();
  }

  function openDesignForm(formId) {
    let d = loadDocForForm(formId);
    if (!d) {
      const meta = formsCatalog.find((x) => x.form_id === formId);
      d = makeBlankForm(formId, meta?.title);
    }
    doc = ensureDocShape(d);
    upsertCatalogEntry(doc);
    appNav.tab = "design";
    appNav.designLayer = "edit";
    appNav.editingFormId = formId;
    persistNav();
    renderApp();
  }

  function renderBackBar(label, onBack) {
    const bar = document.createElement("div");
    bar.className = "layer-back";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "layer-back-btn";
    b.textContent = "← " + (label || "返回");
    b.addEventListener("click", onBack);
    bar.appendChild(b);
    return bar;
  }

  function appendListCols(tr, f) {
    const loc =
      f.location && String(f.location).trim()
        ? f.location
        : "（尚未設計）";
    [
      [f.title || "", ""],
      [f.creator || "—", ""],
      [loc, "muted-cell"],
    ].forEach(([text, cls]) => {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
    });
  }

  function renderApplyList() {
    const stage = els.form;
    stage.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "list-stage";
    const h = document.createElement("h2");
    h.className = "list-title";
    h.textContent = "選擇要申請的表單";
    wrap.appendChild(h);
    const table = document.createElement("table");
    table.className = "mgmt-table";
    table.innerHTML =
      "<thead><tr><th>名稱</th><th>建立者</th><th>所屬位置</th><th></th></tr></thead>";
    const tb = document.createElement("tbody");
    formsCatalog.forEach((f) => {
      const tr = document.createElement("tr");
      appendListCols(tr, f);
      const td = document.createElement("td");
      const go = document.createElement("button");
      go.type = "button";
      go.className = "table-btn primary";
      go.textContent = "申請";
      go.addEventListener("click", () => openApplyForm(f.form_id));
      td.appendChild(go);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    stage.appendChild(wrap);
  }

  function renderDesignList() {
    const stage = els.form;
    stage.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "list-stage list-stage-light";
    const head = document.createElement("div");
    head.className = "list-head";
    const h = document.createElement("h2");
    h.className = "list-title";
    h.textContent = "表單管理（Owner）";
    head.appendChild(h);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "table-btn primary";
    add.textContent = "＋ 新增表單";
    add.addEventListener("click", () => {
      const title = prompt("表單名稱", "新表單");
      if (!title) return;
      const id =
        "form_" +
        String(title)
          .replace(/\s+/g, "_")
          .replace(/[^\w\u4e00-\u9fff\-]/g, "")
          .slice(0, 24) +
        "_" +
        Date.now().toString(36).slice(-4);
      if (formsCatalog.some((x) => x.form_id === id)) {
        alert("form_id 已存在，請再試一次");
        return;
      }
      const creator = prompt("建立者", "王小明") || "王小明";
      const d = makeBlankForm(id, title, creator);
      persistDocForForm(id, d);
      formsCatalog.push(
        normalizeCatalogRow({
          form_id: id,
          title,
          creator,
          location: "",
          form_version: "0.1.0",
          system_name: d.meta.system_name,
          updated_at: nowStamp(),
        })
      );
      persistFormsCatalog();
      openDesignForm(id);
    });
    head.appendChild(add);
    wrap.appendChild(head);

    const table = document.createElement("table");
    table.className = "mgmt-table";
    table.innerHTML =
      "<thead><tr><th>名稱</th><th>建立者</th><th>所屬位置</th><th></th></tr></thead>";
    const tb = document.createElement("tbody");
    formsCatalog.forEach((f) => {
      const tr = document.createElement("tr");
      appendListCols(tr, f);
      const td = document.createElement("td");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "table-btn";
      edit.textContent = "編輯設定";
      edit.addEventListener("click", () => openDesignForm(f.form_id));
      td.appendChild(edit);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    const tip = document.createElement("p");
    tip.className = "list-tip";
    tip.textContent =
      "列表以名稱、建立者為主；所屬位置之後再設計。點進去用表格調整系統欄位／內容欄位／簽核關。";
    wrap.appendChild(tip);
    stage.appendChild(wrap);
  }

  function renderDesignEdit() {
    migrateStepIds(doc);
    renumberApprovalSteps(doc);
    const stage = els.form;
    stage.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "list-stage list-stage-light design-edit";
    wrap.appendChild(
      renderBackBar("表單列表", () => {
        appNav.designLayer = "list";
        persistNav();
        renderApp();
      })
    );
    const h = document.createElement("h2");
    h.className = "list-title";
    h.textContent = "編輯設定：" + (doc.meta?.title || doc.meta?.form_id || "");
    wrap.appendChild(h);

    // meta：使用者在意名稱／建立者
    const metaTable = document.createElement("table");
    metaTable.className = "mgmt-table edit-table";
    metaTable.innerHTML =
      "<thead><tr><th>設定</th><th>值</th></tr></thead>";
    const mtb = document.createElement("tbody");
    const metaFields = [
      ["title", "名稱", false],
      ["creator", "建立者", false],
      ["location", "所屬位置（暫未）", true],
    ];
    metaFields.forEach(([key, label, ro]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = label;
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.className = "cell-input";
      inp.value =
        key === "location"
          ? doc.meta?.location || "（尚未設計）"
          : doc.meta?.[key] ?? "";
      inp.disabled = !!ro;
      inp.addEventListener("change", () => {
        if (!doc.meta) doc.meta = {};
        doc.meta[key] = inp.value;
        upsertCatalogEntry(doc);
        persistDocForForm(doc.meta.form_id, doc);
      });
      td.appendChild(inp);
      tr.appendChild(th);
      tr.appendChild(td);
      mtb.appendChild(tr);
    });
    metaTable.appendChild(mtb);
    wrap.appendChild(sectionBlock("基本", metaTable));

    // 系統內建欄位
    const sysTable = document.createElement("table");
    sysTable.className = "mgmt-table";
    sysTable.innerHTML =
      "<thead><tr><th>欄位 id</th><th>名稱</th><th>說明</th></tr></thead>";
    const stb = document.createElement("tbody");
    SYSTEM_FIELD_DEFS.forEach((def) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${def.id}</td><td>${def.label}</td><td class="muted-cell">${def.note || ""}</td>`;
      stb.appendChild(tr);
    });
    const stepLevels = (doc.approval?.columns || [])
      .filter((c) => Number(c.level) > 0)
      .map((c) => Number(c.level))
      .sort((a, b) => a - b);
    stepLevels.forEach((n) => {
      SYSTEM_STEP_FIELD_TMPL.forEach((t) => {
        const fieldId = t.id.replaceAll("{n}", String(n));
        const label = t.label.replaceAll("{n}", String(n));
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${fieldId}</td><td>${label}</td><td class="muted-cell">對應 step_${n}（ALR5 §2.1）</td>`;
        stb.appendChild(tr);
      });
    });
    sysTable.appendChild(stb);
    const sysSec = sectionBlock("系統欄位（ALR5 規格）", sysTable);
    const sysNote = document.createElement("p");
    sysNote.className = "sec-note";
    sysNote.textContent =
      "依 ALR5簽核系統.md：creator／requester／cc／cc_system／approvers[]／stage_notifies[]／fyi／fyi_system 與 system.*；Owner 不可當內容欄增刪。扁平寫法可用 approver_n／stage_notify_n。";
    sysSec.insertBefore(sysNote, sysTable);
    const badge = document.createElement("span");
    badge.className = "badge-sys";
    badge.textContent = "系統";
    sysSec.querySelector("h3")?.appendChild(badge);
    wrap.appendChild(sysSec);

    // 簽核內容欄位（可增刪）
    const fTable = document.createElement("table");
    fTable.className = "mgmt-table";
    fTable.innerHTML =
      "<thead><tr><th>欄位 id</th><th>顯示名稱</th><th>型別</th><th>預設值</th><th></th></tr></thead>";
    const ftb = document.createElement("tbody");
    Object.keys(doc.fields || {}).forEach((fid) => {
      const f = doc.fields[fid];
      if (f.kind && f.kind !== "content") return;
      const tr = document.createElement("tr");
      const cells = [
        [fid, true],
        [f.label || "", false, "label"],
        [f.type || "text", false, "type"],
        [f.value ?? "", false, "value"],
      ];
      cells.forEach(([val, ro, prop], idx) => {
        const td = document.createElement("td");
        if (idx === 0 || ro) {
          td.textContent = String(val);
        } else {
          const inp = document.createElement("input");
          inp.className = "cell-input";
          inp.value = String(val);
          inp.addEventListener("change", () => {
            f[prop] = inp.value;
            f.kind = "content";
            persistDocForForm(doc.meta.form_id, doc);
          });
          td.appendChild(inp);
        }
        tr.appendChild(td);
      });
      const tdDel = document.createElement("td");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "table-btn danger";
      del.textContent = "刪除";
      del.addEventListener("click", () => {
        if (!confirm(`刪除內容欄位「${fid}」？`)) return;
        delete doc.fields[fid];
        (doc.body?.paragraphs || []).forEach((para) => {
          para.parts = (para.parts || []).filter(
            (p) => !(p.t === "field" && p.name === fid)
          );
        });
        persistDocForForm(doc.meta.form_id, doc);
        renderDesignEdit();
      });
      tdDel.appendChild(del);
      tr.appendChild(tdDel);
      ftb.appendChild(tr);
    });
    fTable.appendChild(ftb);
    const fSec = sectionBlock("簽核內容欄位（可新增／刪除）", fTable);
    const fNote = document.createElement("p");
    fNote.className = "sec-note";
    fNote.textContent =
      "申請人、假別、起始日、天數、代理人等畫面填寫欄；與系統簽核欄位分開。";
    fSec.insertBefore(fNote, fTable);
    const addField = document.createElement("button");
    addField.type = "button";
    addField.className = "table-btn";
    addField.textContent = "＋ 新增內容欄位";
    addField.addEventListener("click", () => {
      const id = prompt(
        "新欄位 id（英文／底線）",
        "field_" + (Object.keys(doc.fields || {}).length + 1)
      );
      if (!id || (doc.fields && doc.fields[id])) {
        if (id) alert("欄位 id 已存在或無效");
        return;
      }
      if (!doc.fields) doc.fields = {};
      doc.fields[id] = { kind: "content", type: "text", label: id, value: "" };
      persistDocForForm(doc.meta.form_id, doc);
      renderDesignEdit();
    });
    const fActions = document.createElement("div");
    fActions.className = "table-actions";
    fActions.appendChild(addField);
    fSec.appendChild(fActions);
    wrap.appendChild(fSec);

    // 簽核階層 step_N
    const aTable = document.createElement("table");
    aTable.className = "mgmt-table";
    aTable.innerHTML =
      "<thead><tr><th>關 id</th><th>顯示</th><th>level</th><th>角色</th><th>印名</th><th></th></tr></thead>";
    const atb = document.createElement("tbody");
    (doc.approval?.columns || []).forEach((col) => {
      const tr = document.createElement("tr");
      const specs = [
        [col.id, true, null],
        [col.label || "", false, "label"],
        [col.level ?? "", true, "level"],
        [col.role || "", false, "role"],
        [col.stamp?.name || "", false, "stamp.name"],
      ];
      specs.forEach(([val, ro, prop]) => {
        const td = document.createElement("td");
        if (ro) td.textContent = String(val);
        else {
          const inp = document.createElement("input");
          inp.className = "cell-input";
          inp.value = String(val);
          inp.addEventListener("change", () => {
            if (prop === "stamp.name") {
              if (!col.stamp) col.stamp = {};
              col.stamp.name = inp.value;
            } else {
              col[prop] = inp.value;
            }
            persistDocForForm(doc.meta.form_id, doc);
          });
          td.appendChild(inp);
        }
        tr.appendChild(td);
      });
      const tdDel = document.createElement("td");
      if (Number(col.level) > 0) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "table-btn danger";
        del.textContent = "刪除";
        del.addEventListener("click", () => {
          if (!confirm(`刪除簽核關 ${col.id}（${col.label || ""}）？`)) return;
          doc.approval.columns = (doc.approval.columns || []).filter(
            (c) => c.id !== col.id
          );
          renumberApprovalSteps(doc);
          persistDocForForm(doc.meta.form_id, doc);
          renderDesignEdit();
        });
        tdDel.appendChild(del);
      } else {
        tdDel.className = "muted-cell";
        tdDel.textContent = "申請關";
      }
      tr.appendChild(tdDel);
      atb.appendChild(tr);
    });
    aTable.appendChild(atb);
    const aSec = sectionBlock("簽核階層（step_1…可刪）", aTable);
    const aNote = document.createElement("p");
    aNote.className = "sec-note";
    aNote.textContent =
      "簽核人 id 固定為 step_1、step_2…；刪除後自動重編。step_0 為申請關。";
    aSec.insertBefore(aNote, aTable);
    const addCol = document.createElement("button");
    addCol.type = "button";
    addCol.className = "table-btn";
    addCol.textContent = "＋ 新增簽核關";
    addCol.addEventListener("click", () => {
      if (!doc.approval) doc.approval = { title: "簽核", columns: [] };
      if (!doc.approval.columns) doc.approval.columns = [];
      const nextLv =
        Math.max(
          0,
          ...doc.approval.columns.map((c) => Number(c.level) || 0)
        ) + 1;
      const label = prompt("關顯示名稱", `簽核 ${nextLv}`) || `簽核 ${nextLv}`;
      doc.approval.columns.unshift({
        id: `step_${nextLv}`,
        label,
        level: nextLv,
        role: `approver_${nextLv}`,
        person: { id: "", name: "" },
        stamp: { name: "印", mark: null, time: null, comment: "", pending: true },
      });
      renumberApprovalSteps(doc);
      persistDocForForm(doc.meta.form_id, doc);
      renderDesignEdit();
    });
    const aActions = document.createElement("div");
    aActions.className = "table-actions";
    aActions.appendChild(addCol);
    aSec.appendChild(aActions);
    wrap.appendChild(aSec);

    const saveNote = document.createElement("p");
    saveNote.className = "list-tip";
    saveNote.textContent =
      "變更即寫入本機（設計 PoC）。form_id／版本在 JSON 分頁可見，列表不強調。";
    wrap.appendChild(saveNote);
    stage.appendChild(wrap);
  }

  function sectionBlock(title, node) {
    const sec = document.createElement("section");
    sec.className = "design-section";
    const h = document.createElement("h3");
    h.textContent = title;
    sec.appendChild(h);
    sec.appendChild(node);
    return sec;
  }

  function renderApp() {
    const tab = appNav.tab || "apply";
    view = tab === "apply" || tab === "design" ? "form" : tab;
    els.form.hidden = !(tab === "apply" || tab === "design");
    els.json.hidden = tab !== "json";
    if (els.alr5) els.alr5.hidden = tab !== "alr5";
    renderTabs();
    if (tab === "apply") {
      if (appNav.applyLayer === "doc") renderForm();
      else renderApplyList();
    } else if (tab === "design") {
      if (appNav.designLayer === "edit") renderDesignEdit();
      else renderDesignList();
    } else if (tab === "json") {
      jsonDirty = false;
      els.editor.value = prettyJson();
      showJsonMsg("");
    } else if (tab === "alr5") {
      renderAlr5Guide();
    }
  }

  function switchView(next) {
    if ((view === "json" || appNav.tab === "json") && next !== "json" && jsonDirty) {
      if (!applyJsonFromEditor()) return;
    }
    if (next === "apply") {
      appNav.tab = "apply";
      appNav.applyLayer = "list";
    } else if (next === "design") {
      appNav.tab = "design";
      appNav.designLayer = "list";
    } else if (next === "form") {
      appNav.tab = "apply";
      appNav.applyLayer = "list";
    } else {
      appNav.tab = next;
    }
    persistNav();
    renderApp();
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
    d.ui.views = ensureViews();
    if (!d.actor) d.actor = base.actor;
    if (!d.actions) d.actions = base.actions;
    if (!d.statuses) d.statuses = base.statuses;
    if (!d.fields) d.fields = base.fields;
    if (!d.body) d.body = base.body;
    if (!d.approval) d.approval = base.approval;
    if (!d.roles) d.roles = base.roles;
    if (!d.system) d.system = base.system;
    if (!Array.isArray(d.logs)) d.logs = [];
    migrateStepIds(d);
    // 升級舊快取：補 comment 欄
    (d.approval?.columns || []).forEach((c) => {
      if (!c.stamp) c.stamp = {};
      if (c.stamp.comment == null) c.stamp.comment = "";
      if (!c.role) {
        const hit = (base.approval?.columns || []).find(
          (x) => x.id === c.id || Number(x.level) === Number(c.level)
        );
        if (hit?.role) c.role = hit.role;
      }
      if (!c.person) {
        const hit = (base.approval?.columns || []).find(
          (x) => x.id === c.id || Number(x.level) === Number(c.level)
        );
        if (hit?.person) c.person = hit.person;
      }
    });
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
        const res = await fetch("./document.json?v=design1", {
          cache: "no-store",
        });
        if (res.ok) base = await res.json();
      } catch {
        /* offline */
      }
    }
    try {
      const sr = await fetch("./alr5-standard.json?v=design1", {
        cache: "no-store",
      });
      if (sr.ok) alr5Standard = await sr.json();
    } catch {
      /* offline */
    }
    try {
      const mr = await fetch("./ALR5標準互通.md?v=design1", {
        cache: "no-store",
      });
      if (mr.ok) alr5Markdown = await mr.text();
    } catch {
      alr5Markdown = "";
    }

    loadNav();
    formsCatalog = loadFormsCatalog() || defaultCatalogFromDoc(base || EMBEDDED_DOC);
    persistFormsCatalog();

    doc = ensureDocShape(base ? clone(base) : clone(EMBEDDED_DOC));
    if (!doc.meta.form_version) doc.meta.form_version = "1.0.0";
    upsertCatalogEntry(doc);
    persist();
    resetOpenedSnapshot();
    document.documentElement.lang = doc.meta?.lang || "zh-Hant";
    document.title = `Approval｜${doc.meta?.title || ""}`;
    if (!appNav.tab || appNav.tab === "form") appNav.tab = "apply";
    if (appNav.tab === "apply") appNav.applyLayer = appNav.applyLayer || "list";
    if (appNav.tab === "design" && appNav.designLayer === "edit" && appNav.editingFormId) {
      const d = loadDocForForm(appNav.editingFormId);
      if (d) {
        doc = ensureDocShape(d);
        resetOpenedSnapshot();
      } else {
        appNav.designLayer = "list";
      }
    }
    if (appNav.tab === "apply" && appNav.applyLayer === "doc") {
      const fid = doc?.meta?.form_id;
      const d = fid ? loadDocForForm(fid) : null;
      if (d) {
        doc = ensureDocShape(d);
        resetOpenedSnapshot();
      }
    }
    persistNav();
    renderApp();
  }

  boot();
})();
