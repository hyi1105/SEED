(() => {
  /**
   * 設計檔與申請單為兩套獨立 JSON。
   * 申請＝複製當下表單設計 → 新申請單再填寫；畫面只渲染。
   */
  const LEGACY_DOC_KEY = "approval.document.v5";
  const DESIGN_PREFIX = "approval.form.design.v1:";
  const DOC_PREFIX = "approval.doc.v1:";
  const DOCS_INDEX_KEY = "approval.docs.index.v1";
  const FORMS_KEY = "approval.forms.catalog.v2";
  const OPTION_LISTS_KEY = "approval.option_lists.v1";
  const ACCOUNT_KEY = "approval.account.v1";
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

  const CONTENT_FIELD_TYPES = [
    { id: "text", label: "文字" },
    { id: "number", label: "數字" },
    { id: "date", label: "日期" },
    { id: "dropdown", label: "下拉" },
    { id: "person", label: "人員" },
    { id: "multiline", label: "多行文字" },
  ];

  const ACL_ROLE_BASE = [
    { id: "creator", label: "建立者" },
    { id: "requester", label: "需求人" },
    { id: "current_approver", label: "當階簽核者" },
    { id: "admin", label: "單據管理員" },
    { id: "super_user", label: "進階經辦" },
    { id: "audit", label: "稽核" },
    { id: "owner", label: "表單擁有者" },
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
      "kind": "form_design",
      "note": "ALR5：表單設計檔（與申請單 JSON 獨立）；申請時複製當下設計再填寫。"
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
        "value": "特休",
        "options_ref": "list_leave_types",
        "allow_blank": false,
        "allow_manual": false,
        "options": [
          { "value": "事假", "label": "事假" },
          { "value": "病假", "label": "病假" },
          { "value": "特休", "label": "特休" }
        ]
      },
      "leave_date": {
        "kind": "content",
        "type": "date",
        "label": "起始日",
        "value": "2026-08-05"
      },
      "days": {
        "kind": "content",
        "type": "number",
        "label": "天數",
        "value": "1"
      },
      "agent": {
        "kind": "content",
        "type": "person",
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
          "id": "step_0",
          "label": "Submit",
          "level": 0,
          "role": "requester",
          "editable": false,
          "person": {
            "id": "u_wang",
            "name": "王小明"
          },
          "stamp": {
            "name": "王小明",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          },
          "stage_notify": { "people": [], "groups": [], "emails": [] },
          "pass_rule": "all"
        },
        {
          "id": "step_1",
          "label": "代理人",
          "level": 1,
          "role": "approver_1",
          "editable": true,
          "person": {
            "id": "u_chen",
            "name": "陳美玲"
          },
          "stamp": {
            "name": "陳美玲",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          },
          "stage_notify": { "people": [], "groups": [], "emails": [] },
          "pass_rule": "all"
        },
        {
          "id": "step_2",
          "label": "課長",
          "level": 2,
          "role": "approver_2",
          "editable": true,
          "person": {
            "id": "u_lin",
            "name": "林課長"
          },
          "stamp": {
            "name": "林課長",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          },
          "stage_notify": { "people": [], "groups": [], "emails": [] },
          "pass_rule": "all"
        },
        {
          "id": "step_3",
          "label": "協理",
          "level": 3,
          "role": "approver_3",
          "editable": false,
          "person": {
            "id": "u_yen",
            "name": "嚴協理"
          },
          "stamp": {
            "name": "嚴協理",
            "mark": null,
            "time": null,
            "comment": "",
            "pending": true
          },
          "stage_notify": { "people": [], "groups": [], "emails": [] },
          "pass_rule": "all"
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
    "logs": [],
    "mail_templates": []
  };

  let doc = null;
  let view = "form";
  /** 本次開啟／上次按鈕後的快照（對應 log.opened） */
  let openedSnapshot = null;
  let openLogId = null;
  let alr5Standard = null;
  let alr5Markdown = "";
  let formsCatalog = [];
  let docsIndex = [];
  let optionLists = [];
  let appNav = {
    tab: "apply",
    applyLayer: "list",
    designLayer: "list",
    editingFormId: null,
    editingDocId: null,
  };
  const CHECK_KEY = "alr5.interop.checks.v1";

  const els = {
    tabs: document.getElementById("view-tabs"),
    form: document.getElementById("view-form"),
    alr5: document.getElementById("view-alr5"),
    guideBody: document.getElementById("guide-body"),
    interopBadge: document.getElementById("interop-badge"),
    btnCopyAi: document.getElementById("btn-copy-ai"),
    btnCopyJson: document.getElementById("btn-copy-json"),
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

  function designStorageKey(formId) {
    return DESIGN_PREFIX + (formId || "default");
  }

  function applicationStorageKey(docId) {
    return DOC_PREFIX + (docId || "default");
  }

  function persistDesign(formId, d) {
    if (!d) return;
    try {
      if (!d.meta) d.meta = {};
      d.meta.kind = "form_design";
      const id = formId || d.meta.form_id;
      if (!id) return;
      d.meta.form_id = id;
      localStorage.setItem(designStorageKey(id), JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }

  /** 舊設計：假別尚無 options_ref → 連示範 B 清單；回傳是否有改 */
  function softMigrateDropdownRefs(d) {
    if (!d?.fields?.leave_type) return false;
    const f = d.fields.leave_type;
    if (f.type === "dropdown" && !f.options_ref) {
      f.options_ref = "list_leave_types";
      const list = getOptionList("list_leave_types");
      if (list) f.options = normalizeOptions(list.items);
      return true;
    }
    return false;
  }

  function loadDesign(formId) {
    if (!formId) return null;
    try {
      let raw = localStorage.getItem(designStorageKey(formId));
      if (raw) {
        const d = JSON.parse(raw);
        if (softMigrateDropdownRefs(d)) persistDesign(formId, d);
        return d;
      }
      // 遷移：舊版共用 key 當設計檔
      raw = localStorage.getItem(LEGACY_DOC_KEY + ":" + formId);
      if (raw) {
        const d = JSON.parse(raw);
        softMigrateDropdownRefs(d);
        if (!d.meta) d.meta = {};
        d.meta.kind = "form_design";
        d.meta.form_id = formId;
        persistDesign(formId, d);
        return d;
      }
      raw = localStorage.getItem(LEGACY_DOC_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.meta?.form_id === formId) {
          softMigrateDropdownRefs(d);
          if (!d.meta) d.meta = {};
          d.meta.kind = "form_design";
          persistDesign(formId, d);
          return d;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function loadDocsIndex() {
    try {
      const raw = localStorage.getItem(DOCS_INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  function persistDocsIndex() {
    try {
      localStorage.setItem(DOCS_INDEX_KEY, JSON.stringify(docsIndex));
    } catch {
      /* ignore */
    }
  }

  function upsertDocsIndex(d) {
    const docId = d?.meta?.doc_id;
    if (!docId) return;
    const row = {
      doc_id: docId,
      form_id: d.meta.form_id || "",
      title: d.meta.title || "",
      status: d.system?.status || "draft",
      doc_no: d.system?.doc_no || "",
      updated_at: nowStamp(),
    };
    const i = docsIndex.findIndex((x) => x.doc_id === docId);
    if (i >= 0) docsIndex[i] = { ...docsIndex[i], ...row };
    else docsIndex.unshift(row);
    persistDocsIndex();
  }

  function persistApplication(d) {
    if (!d?.meta?.doc_id) return;
    try {
      d.meta.kind = "application";
      localStorage.setItem(applicationStorageKey(d.meta.doc_id), JSON.stringify(d));
      upsertDocsIndex(d);
    } catch {
      /* ignore */
    }
  }

  function loadApplication(docId) {
    if (!docId) return null;
    try {
      const raw = localStorage.getItem(applicationStorageKey(docId));
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return null;
  }

  function persist() {
    if (!doc) return;
    const kind = doc.meta?.kind;
    if (
      kind === "application" ||
      (appNav.tab === "apply" && appNav.applyLayer === "doc")
    ) {
      if (!doc.meta.doc_id) {
        doc.meta.doc_id =
          "doc_" +
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
            : Date.now().toString(36));
      }
      persistApplication(doc);
      return;
    }
    if (kind === "form_design" || appNav.tab === "design") {
      persistDesign(doc.meta?.form_id, doc);
    }
  }

  function newDocId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return "doc_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    }
    return "doc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** 申請時：深拷貝當下表單設計 → 獨立申請單 */
  function cloneDesignToApplication(design) {
    const d = clone(design);
    const now = new Date();
    const docId = newDocId();
    const formId = design.meta?.form_id || "";
    d.meta = {
      ...d.meta,
      kind: "application",
      doc_id: docId,
      form_id: formId,
      source_form_id: formId,
      source_form_version: design.meta?.form_version || "",
      copied_at: now.toISOString(),
      note: "自表單設計複製的申請單",
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
    (d.approval?.columns || []).forEach((c) => {
      if (!c.stamp) c.stamp = {};
      c.stamp.pending = true;
      c.stamp.mark = null;
      c.stamp.time = null;
      c.stamp.comment = "";
    });
    d.logs = [
      {
        id: "log_create_" + Date.now(),
        at: nowStamp(now),
        actor: d.actor?.name || "demo.user",
        action: "create",
        detail: "從表單設計複製申請單：" + (d.meta.title || formId),
        opened: null,
        changes: [],
      },
    ];
    d.system.doc_no = makeDocNo(
      d.fields?.applicant?.value,
      now,
      1,
      d.meta?.system_name
    );
    return ensureDocShape(d);
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

  function currentAccount() {
    try {
      const a = localStorage.getItem(ACCOUNT_KEY);
      if (a && a.trim()) return a.trim();
    } catch {
      /* ignore */
    }
    return "王小明";
  }

  function setCurrentAccount(name) {
    try {
      localStorage.setItem(ACCOUNT_KEY, String(name || "王小明"));
    } catch {
      /* ignore */
    }
  }

  function loadOptionLists() {
    try {
      const raw = localStorage.getItem(OPTION_LISTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function persistOptionLists() {
    try {
      localStorage.setItem(OPTION_LISTS_KEY, JSON.stringify(optionLists));
    } catch {
      /* ignore */
    }
  }

  function defaultOptionLists() {
    return [
      {
        list_id: "list_leave_types",
        title: "假別清單",
        owner: "王小明",
        readers: [],
        items: [
          { value: "事假", label: "事假" },
          { value: "病假", label: "病假" },
          { value: "特休", label: "特休" },
        ],
        updated_at: nowStamp(),
        note: "B Form：共用下拉選項（帳號可讀）",
      },
    ];
  }

  function canReadOptionList(list, account) {
    if (!list) return false;
    const acc = account || currentAccount();
    if (list.owner === acc) return true;
    const readers = list.readers || [];
    return readers.includes("*") || readers.includes(acc);
  }

  function canEditOptionList(list, account) {
    if (!list) return false;
    return list.owner === (account || currentAccount());
  }

  function getOptionList(listId) {
    return optionLists.find((l) => l.list_id === listId) || null;
  }

  function resolveFieldOptions(f) {
    if (f?.options_ref) {
      const list = getOptionList(f.options_ref);
      if (list && canReadOptionList(list)) {
        return normalizeOptions(list.items);
      }
    }
    return normalizeOptions(f?.options);
  }

  function syncFieldOptionsFromRef(f) {
    if (!f || f.type !== "dropdown") return;
    if (f.options_ref) {
      const list = getOptionList(f.options_ref);
      if (list && canReadOptionList(list)) {
        f.options = normalizeOptions(list.items);
      }
    }
  }

  function ensureFieldOptions(fields, fallbackFields) {
    Object.keys(fields || {}).forEach((key) => {
      const f = fields[key];
      if (!f || f.type !== "dropdown") return;
      syncFieldOptionsFromRef(f);
      let opts = resolveFieldOptions(f);
      if (!opts.length && fallbackFields?.[key]) {
        opts = normalizeOptions(fallbackFields[key].options);
        if (!f.options_ref) f.options = opts;
      }
      if (!f.options_ref) f.options = opts;
      if (f.allow_blank) {
        if (f.value == null) f.value = "";
      } else if (f.value == null || f.value === "") {
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
      syncFieldOptionsFromRef(def);
      const opts = resolveFieldOptions(def);
      const cur = def.value != null ? String(def.value) : "";
      const allowBlank = !!def.allow_blank;
      const allowManual = !!def.allow_manual;

      if (allowManual) {
        const wrap = document.createElement("span");
        wrap.className = "blank-combo";
        const listId = "dl_" + name + "_" + Math.random().toString(36).slice(2, 7);
        const input = document.createElement("input");
        input.className = "blank";
        input.type = "text";
        input.setAttribute("list", listId);
        input.placeholder = allowBlank ? "選或手填（可空白）" : "選或手填";
        input.value = cur;
        input.size = MIN_CH;
        input.dataset.field = name;
        if (def.label) input.setAttribute("aria-label", def.label);
        const dl = document.createElement("datalist");
        dl.id = listId;
        opts.forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt.value;
          o.label = opt.label;
          dl.appendChild(o);
        });
        const onChange = () => {
          setFieldValue(name, input.value);
          fitBlank(input);
        };
        input.addEventListener("input", onChange);
        input.addEventListener("change", onChange);
        wrap.appendChild(input);
        wrap.appendChild(dl);
        requestAnimationFrame(() => fitBlank(input));
        return wrap;
      }

      el = document.createElement("select");
      el.className = "blank blank-select";
      if (allowBlank) {
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "—";
        el.appendChild(blank);
      }
      opts.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        el.appendChild(o);
      });
      if (cur && !opts.some((o) => o.value === cur) && cur !== "") {
        const o = document.createElement("option");
        o.value = cur;
        o.textContent = cur;
        el.appendChild(o);
      }
      el.value = cur || (allowBlank ? "" : opts[0]?.value || "");
      if (def.value !== el.value) def.value = el.value;
    } else if (type === "person") {
      el = document.createElement("select");
      el.className = "blank blank-select";
      let opts = knownPeopleOptions();
      if (!opts.length) {
        const fallback = def.value != null ? String(def.value) : "";
        if (fallback) opts.push({ value: fallback, label: fallback });
      }
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "—";
      el.appendChild(blank);
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
      el.value = cur || "";
      if (def.value !== el.value) def.value = el.value;
    } else if (type === "multiline") {
      el = document.createElement("textarea");
      el.className = "blank blank-multiline";
      el.rows = 2;
      el.value = def.value != null ? String(def.value) : "";
    } else {
      el = document.createElement("input");
      el.className = "blank";
      if (type === "date") {
        el.type = "date";
      } else if (type === "number") {
        el.type = "number";
        el.inputMode = "decimal";
        el.step = "any";
      } else {
        el.type = "text";
      }
      el.value = def.value != null ? String(def.value) : "";
      el.size = MIN_CH;
    }

    el.dataset.field = name;
    if (def.label) el.setAttribute("aria-label", def.label);

    const onChange = () => {
      setFieldValue(name, el.value);
      fitBlank(el);
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
      col.stamp.name = String(col.person.name);
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
        appNav.editingDocId = null;
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
    qSec.innerHTML =
      "<h2>請你拍板（欄位／邏輯未決）</h2><p class=\"guide-note\">每題附建議與情境；回覆「題號選 B」即可定案。尚未寫入 decisions。</p>";
    const ql = document.createElement("ol");
    ql.className = "q-list";
    (s.open_questions || []).forEach((q) => {
      const li = document.createElement("li");
      const pri = q.priority || "medium";
      const head = document.createElement("div");
      head.className = "q-head";
      head.innerHTML =
        '<span class="sev sev-' +
        pri +
        '">' +
        pri +
        '</span> <code class="q-id">' +
        (q.id || "") +
        "</code> " +
        (q.question || "");
      li.appendChild(head);
      if (q.recommendation_text || q.recommendation) {
        const rec = document.createElement("p");
        rec.className = "q-rec";
        rec.textContent =
          "建議 " +
          (q.recommendation || "") +
          (q.recommendation_text ? "：" + q.recommendation_text : "");
        li.appendChild(rec);
      }
      if (Array.isArray(q.options) && q.options.length) {
        const ul = document.createElement("ul");
        ul.className = "q-opts";
        q.options.forEach((opt) => {
          const o = document.createElement("li");
          const mark = opt.id === q.recommendation ? " ← 建議" : "";
          o.innerHTML =
            "<strong>" +
            (opt.id || "") +
            "</strong> " +
            (opt.label || "") +
            mark;
          if (opt.scenario) {
            const sc = document.createElement("div");
            sc.className = "q-scenario";
            sc.textContent = "情境：" + opt.scenario;
            o.appendChild(sc);
          }
          ul.appendChild(o);
        });
        li.appendChild(ul);
      }
      ql.appendChild(li);
    });
    qSec.appendChild(ql);
    root.appendChild(qSec);

    const riskSec = document.createElement("section");
    riskSec.className = "guide-sec";
    riskSec.innerHTML =
      "<h2>實作易錯／邏輯風險</h2><p class=\"guide-note\">建議規則可選；與定案衝突時以 decisions 為準。</p>";
    const rl = document.createElement("ul");
    rl.className = "risk-list";
    (s.logic_risk_warnings || []).forEach((w) => {
      const li = document.createElement("li");
      const head = document.createElement("div");
      head.className = "q-head";
      head.innerHTML =
        '<code class="q-id">' + (w.id || "") + "</code> " + (w.warning || "");
      li.appendChild(head);
      if (w.recommendation) {
        const rec = document.createElement("p");
        rec.className = "q-rec";
        rec.textContent = "建議規則：" + w.recommendation;
        li.appendChild(rec);
      }
      if (Array.isArray(w.scenarios) && w.scenarios.length) {
        const ul = document.createElement("ul");
        ul.className = "q-opts";
        w.scenarios.forEach((sc) => {
          const o = document.createElement("li");
          o.className = "q-scenario-only";
          o.textContent = "情境：" + sc;
          ul.appendChild(o);
        });
        li.appendChild(ul);
      }
      if (Array.isArray(w.choose) && w.choose.length) {
        const ul = document.createElement("ul");
        ul.className = "q-opts";
        w.choose.forEach((opt) => {
          const o = document.createElement("li");
          o.innerHTML =
            "<strong>" + (opt.id || "") + "</strong> " + (opt.label || "");
          ul.appendChild(o);
        });
        li.appendChild(ul);
      }
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

  function ensureStageNotify(raw) {
    const n = raw && typeof raw === "object" ? raw : {};
    return {
      people: Array.isArray(n.people) ? n.people.slice() : [],
      groups: Array.isArray(n.groups) ? n.groups.slice() : [],
      emails: Array.isArray(n.emails) ? n.emails.slice() : [],
    };
  }

  function ensureApprovalColumn(col) {
    if (!col || typeof col !== "object") return col;
    if (!col.person) col.person = { id: "", name: "" };
    if (!col.stamp) col.stamp = {};
    if (col.editable == null) col.editable = true;
    col.stage_notify = ensureStageNotify(col.stage_notify);
    if (!col.pass_rule) col.pass_rule = "all";
    if (!col.mail || typeof col.mail !== "object") col.mail = {};
    ensureStageMail(col);
    const name = col.person.name || col.stamp.name || "";
    if (name) {
      col.person.name = name;
      if (!col.stamp.name || String(col.stamp.name).length <= 1) {
        col.stamp.name = name;
      }
    }
    return col;
  }

  function formatNotifyList(sn) {
    const parts = [];
    (sn.people || []).forEach((p) => parts.push(p));
    (sn.emails || []).forEach((e) => parts.push(e));
    (sn.groups || []).forEach((g) => parts.push("@" + g));
    return parts.join(", ");
  }

  function parseNotifyList(text) {
    const people = [];
    const emails = [];
    const groups = [];
    String(text || "")
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((tok) => {
        if (tok.startsWith("@")) groups.push(tok.slice(1));
        else if (tok.includes("@")) emails.push(tok);
        else people.push(tok);
      });
    return { people, emails, groups };
  }

  /** 整單級／Submit 關（level 0）相關通知 */
  const MAIL_EVENTS_SUBMIT = [
    {
      id: "notify_on_submit",
      label: "送出申請（Submit → cc）",
      short: "送出通知",
      flow_role: "on_submit",
    },
    {
      id: "notify_on_completed",
      label: "結案（FYI）",
      short: "結案 FYI",
      flow_role: "on_complete",
    },
    {
      id: "notify_on_cancel",
      label: "取消（Cancel）",
      short: "取消",
      flow_role: "on_cancel",
    },
    {
      id: "notify_manual",
      label: "手動通知（Notify）",
      short: "手動",
      flow_role: "side",
    },
  ];
  /** 簽核關（level ≥ 1）相關通知 */
  const MAIL_EVENTS_APPROVE = [
    {
      id: "notify_need_approve",
      label: "輪到本關簽核（請簽）",
      short: "請簽",
      flow_role: "on_enter",
    },
    {
      id: "notify_on_stage_pass",
      label: "本關通過 → stage_notify",
      short: "通過→知會",
      flow_role: "on_pass",
    },
    {
      id: "notify_stage_peers",
      label: "本關通過／被拒（同關簽核人）",
      short: "同關知會",
      flow_role: "on_pass_peer",
    },
    {
      id: "notify_on_reject",
      label: "本關拒件（Reject）",
      short: "拒件",
      flow_role: "on_reject",
    },
    {
      id: "notify_on_return",
      label: "本關退回（Return）",
      short: "退回",
      flow_role: "on_return",
    },
    {
      id: "notify_manual",
      label: "手動通知（Notify）",
      short: "手動",
      flow_role: "side",
    },
    {
      id: "notify_overdue",
      label: "本關逾期",
      short: "逾期",
      flow_role: "side",
    },
  ];

  function mailEventsForLevel(level) {
    return Number(level) === 0 ? MAIL_EVENTS_SUBMIT : MAIL_EVENTS_APPROVE;
  }

  function ensureStageMail(col) {
    if (!col.mail || typeof col.mail !== "object") col.mail = {};
    mailEventsForLevel(col.level).forEach((ev) => {
      if (!col.mail[ev.id] || typeof col.mail[ev.id] !== "object") {
        col.mail[ev.id] = {
          to: "",
          cc: "",
          subject: "",
          body: "",
          editable: true,
          locked: false,
        };
      } else {
        const t = col.mail[ev.id];
        if (t.editable == null) t.editable = true;
        if (t.locked == null) t.locked = false;
        if (t.to == null) t.to = "";
        if (t.cc == null) t.cc = "";
        if (t.subject == null) t.subject = "";
        if (t.body == null) t.body = "";
      }
    });
    return col.mail;
  }

  function ensureMailTemplates(d) {
    // 保留表單級陣列相容；實際編輯改在各簽核關 Rules
    if (!Array.isArray(d.mail_templates)) d.mail_templates = [];
    return d.mail_templates;
  }

  function mailTemplateConfigured(t) {
    return !!(t && ((t.subject && t.subject.trim()) || (t.body && t.body.trim())));
  }

  function summarizeStageMail(col) {
    ensureStageMail(col);
    const evs = mailEventsForLevel(col.level);
    let n = 0;
    evs.forEach((ev) => {
      if (mailTemplateConfigured(col.mail[ev.id])) n += 1;
    });
    return n ? `Mail ${n}` : "Mail";
  }

  function createMailEditor(col, ev, onChange) {
    const t = col.mail[ev.id];
    if (!t.to) t.to = "";
    if (!t.cc) t.cc = "";
    const box = document.createElement("div");
    box.className = "mail-editor";
    const head = document.createElement("div");
    head.className = "mail-editor-head";
    head.innerHTML = `<strong>${ev.short || ev.label}</strong><span class="muted-cell">${ev.id}</span>`;
    box.appendChild(head);

    const toInp = document.createElement("input");
    toInp.className = "cell-input";
    toInp.placeholder = "To（人名、mail@、@群組；逗號分隔）";
    toInp.value = t.to || "";
    toInp.disabled = !!t.locked;
    toInp.addEventListener("change", () => {
      t.to = toInp.value;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(toInp);

    const ccInp = document.createElement("input");
    ccInp.className = "cell-input";
    ccInp.placeholder = "CC（可空白）";
    ccInp.value = t.cc || "";
    ccInp.disabled = !!t.locked;
    ccInp.addEventListener("change", () => {
      t.cc = ccInp.value;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(ccInp);

    const sub = document.createElement("input");
    sub.className = "cell-input";
    sub.placeholder = "Subject（可含 {{doc_no}}）";
    sub.value = t.subject || "";
    sub.disabled = !!t.locked;
    sub.addEventListener("change", () => {
      t.subject = sub.value;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(sub);

    const body = document.createElement("textarea");
    body.className = "cell-input";
    body.rows = 4;
    body.placeholder = "Body";
    body.value = t.body || "";
    body.disabled = !!t.locked;
    body.addEventListener("change", () => {
      t.body = body.value;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(body);

    const lab = document.createElement("label");
    lab.className = "acl-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!t.editable && !t.locked;
    cb.addEventListener("change", () => {
      t.editable = cb.checked;
      t.locked = !cb.checked;
      toInp.disabled = !!t.locked;
      ccInp.disabled = !!t.locked;
      sub.disabled = !!t.locked;
      body.disabled = !!t.locked;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" 申請人／關卡可改此信範本"));
    box.appendChild(lab);
    return box;
  }

  function createMailFlowNode(ev, col, opts) {
    // 相容：流程圖改畫在 canvas；此函式僅供寄信標籤按鈕
    const t = col.mail?.[ev.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "flow-edge-label kind-mail" +
      (mailTemplateConfigured(t) ? " configured" : "") +
      (opts?.active ? " active" : "") +
      (opts?.selected ? " selected" : "");
    btn.textContent =
      (ev.short || ev.label || "寄信") +
      (mailTemplateConfigured(t) ? "" : "（未設定）");
    btn.title = (ev.label || ev.id) + " — 點兩次編輯信件";
    if (opts?.onClick) btn.addEventListener("click", opts.onClick);
    return btn;
  }

  function contentFieldList() {
    const out = [];
    Object.keys(doc.fields || {}).forEach((id) => {
      const f = doc.fields[id];
      if (!f || typeof f !== "object") return;
      if (f.kind && f.kind !== "content") return;
      out.push({
        id,
        label: f.label || id,
        type: f.type || "text",
        required: !!f.required,
      });
    });
    return out;
  }

  function mailToneForEvent(ev) {
    if (!ev) return "go";
    if (ev.flow_role === "on_reject" || ev.flow_role === "on_cancel") return "bad";
    if (ev.flow_role === "on_complete" || ev.flow_role === "on_pass") return "ok";
    if (ev.flow_role === "side") return "side";
    if (ev.flow_role === "on_return") return "warn";
    return "go";
  }

  function newFlowId(prefix) {
    return (
      (prefix || "n") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 5)
    );
  }

  function flowBoardStorage(col) {
    if (!col.mail_board || col.mail_board.schema !== 3) {
      col.mail_board = defaultFlowBoard(col);
    } else {
      if (!Array.isArray(col.mail_board.nodes)) col.mail_board.nodes = [];
      if (!Array.isArray(col.mail_board.edges)) col.mail_board.edges = [];
    }
    return col.mail_board;
  }

  function defaultFlowBoard(col) {
    const lv = Number(col.level);
    const fields = contentFieldList();

    if (lv === 0) {
      const scopeId = "n_scope_fill";
      const scopeH = Math.max(140, 48 + fields.slice(0, 6).length * 48);
      const nodes = [
        {
          id: scopeId,
          kind: "scope",
          label: "申請填寫",
          x: 20,
          y: 20,
          w: 196,
          h: scopeH,
        },
        {
          id: "n_req",
          kind: "person",
          role_id: "requester",
          label: "申請人",
          x: 300,
          y: 120,
        },
        {
          id: "n_cc",
          kind: "person",
          role_id: "cc",
          label: "副本 CC",
          x: 520,
          y: 56,
        },
        {
          id: "n_appr",
          kind: "person",
          role_id: "approver",
          label: "簽核人",
          x: 520,
          y: 200,
        },
        {
          id: "n_save",
          kind: "action",
          action_key: "save",
          label: "SAVE",
          x: 280,
          y: 300,
        },
      ];
      const fieldNodes = fields.slice(0, 6).map((f, i) => ({
        id: "n_f_" + f.id,
        kind: "field",
        field_id: f.id,
        label: f.label,
        scope_id: scopeId,
        x: 44,
        y: 48 + i * 48,
      }));
      nodes.push(...fieldNodes);

      const edges = [];
      if (fieldNodes.length) {
        edges.push({
          id: "ef_req_0",
          from: "n_req",
          to: fieldNodes[0].id,
          kind: "action",
          label: "填寫",
        });
        for (let i = 0; i < fieldNodes.length - 1; i++) {
          edges.push({
            id: "ef_chain_" + i,
            from: fieldNodes[i].id,
            to: fieldNodes[i + 1].id,
            kind: "action",
            label: "填寫",
          });
        }
        edges.push({
          id: "ef_to_save",
          from: fieldNodes[fieldNodes.length - 1].id,
          to: "n_save",
          kind: "action",
          label: "填寫",
        });
      } else {
        edges.push({
          id: "ef_req_save",
          from: "n_req",
          to: "n_save",
          kind: "action",
          label: "填寫",
        });
      }
      edges.push(
        {
          id: "ef_save_back",
          from: "n_save",
          to: "n_req",
          kind: "action",
          label: "完成",
        },
        {
          id: "e_notify_cc",
          from: "n_save",
          to: "n_cc",
          kind: "mail",
          event_id: "notify_on_submit",
          label: "通知",
        },
        {
          id: "e_notify_appr",
          from: "n_cc",
          to: "n_appr",
          kind: "mail",
          event_id: "notify_need_approve",
          label: "通知",
        },
        {
          id: "e_submit",
          from: "n_appr",
          to: "n_save",
          kind: "action",
          label: "Submit 送出",
        }
      );
      return { schema: 3, nodes, edges, custom_mail_events: [] };
    }

    const label = col.label || `L${lv}`;
    const scopeId = "n_scope_stage";
    const scopeH = Math.max(120, 48 + fields.slice(0, 4).length * 48);
    const nodes = [
      {
        id: scopeId,
        kind: "scope",
        label: "本關填寫",
        x: 20,
        y: 20,
        w: 196,
        h: scopeH,
      },
      {
        id: "n_appr",
        kind: "person",
        role_id: "approver",
        label: "簽核人・" + label,
        x: 300,
        y: 140,
      },
      {
        id: "n_req",
        kind: "person",
        role_id: "requester",
        label: "申請人",
        x: 80,
        y: 300,
      },
      {
        id: "n_notify",
        kind: "person",
        role_id: "stage_notify",
        label: "關卡知會",
        x: 520,
        y: 60,
      },
      {
        id: "n_next",
        kind: "person",
        role_id: "next",
        label: "下一關／完成",
        x: 520,
        y: 240,
      },
      {
        id: "n_approve",
        kind: "action",
        action_key: "approve",
        label: "Approve 同意",
        x: 420,
        y: 160,
      },
    ];
    fields.slice(0, 4).forEach((f, i) => {
      nodes.push({
        id: "n_f_" + f.id,
        kind: "field",
        field_id: f.id,
        label: f.label,
        scope_id: scopeId,
        x: 44,
        y: 48 + i * 48,
      });
    });
    const fieldNodes = nodes.filter((n) => n.kind === "field");
    const edges = [
      {
        id: "e_need",
        from: "n_notify",
        to: "n_appr",
        kind: "mail",
        event_id: "notify_need_approve",
        label: "通知",
      },
      {
        id: "e_appr",
        from: "n_appr",
        to: "n_approve",
        kind: "action",
        label: "簽核",
      },
      {
        id: "e_ok",
        from: "n_approve",
        to: "n_next",
        kind: "action",
        label: "Approve 同意",
      },
      {
        id: "e_pass",
        from: "n_approve",
        to: "n_notify",
        kind: "mail",
        event_id: "notify_on_stage_pass",
        label: "通知",
      },
      {
        id: "e_rej",
        from: "n_appr",
        to: "n_req",
        kind: "action",
        label: "Reject 拒件",
      },
      {
        id: "e_ret",
        from: "n_appr",
        to: "n_req",
        kind: "action",
        label: "Return 退回",
      },
    ];
    if (fieldNodes.length) {
      edges.push({
        id: "ef_appr_0",
        from: "n_appr",
        to: fieldNodes[0].id,
        kind: "action",
        label: "填寫",
      });
      for (let i = 0; i < fieldNodes.length - 1; i++) {
        edges.push({
          id: "ef_st_" + i,
          from: fieldNodes[i].id,
          to: fieldNodes[i + 1].id,
          kind: "action",
          label: "填寫",
        });
      }
    }
    return { schema: 3, nodes, edges, custom_mail_events: [] };
  }

  function flowActionImpact(label) {
    const key = String(label || "").trim();
    const map = {
      SAVE: ["updated_at", "草稿狀態"],
      "Submit 送出": ["status → submitted", "current_level → 1"],
      "Approve 同意": ["current_level +1", "簽章欄位"],
      "Reject 拒件": ["status → rejected"],
      "Return 退回": ["status → returned", "current_level → 0"],
      "Cancel 取消": ["status → cancelled"],
      填寫: ["對應欄位 value"],
      完成: ["本階段填寫完成"],
      簽核: ["進入簽核動作"],
    };
    return map[key] || ["（依流程引擎定義）"];
  }

  function flowNodeHighlighted(n, previewRole) {
    if (!previewRole || previewRole === "design") return true;
    if (n.kind === "scope") return true;
    if (n.kind === "person") {
      if (previewRole === "requester") return n.role_id === "requester";
      if (previewRole === "approver")
        return n.role_id === "approver" || n.role_id === "next";
      if (previewRole === "cc")
        return n.role_id === "cc" || n.role_id === "stage_notify" || n.role_id === "fyi";
    }
    if (n.kind === "field") return previewRole === "requester" || previewRole === "approver";
    if (n.kind === "action") return previewRole !== "cc";
    if (n.kind === "doc") return false;
    return true;
  }

  function createActionEditor(node, onChange) {
    const box = document.createElement("div");
    box.className = "flow-action-editor";
    const head = document.createElement("div");
    head.className = "mail-editor-head";
    head.innerHTML =
      `<strong>${node.label || "動作"}</strong><span class="muted-cell">${node.action_key || "action"}</span>`;
    box.appendChild(head);
    const labInp = document.createElement("input");
    labInp.className = "cell-input";
    labInp.value = node.label || "";
    labInp.addEventListener("change", () => {
      node.label = labInp.value;
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(labInp);
    const impact = document.createElement("div");
    impact.className = "flow-action-impact";
    const title = document.createElement("div");
    title.className = "dash-detail-title";
    title.textContent = "會變更的欄位／狀態";
    impact.appendChild(title);
    const ul = document.createElement("ul");
    ul.className = "flow-impact-list";
    flowActionImpact(node.label).forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    impact.appendChild(ul);
    box.appendChild(impact);
    return box;
  }

  function createPersonEditor(node, onChange) {
    const box = document.createElement("div");
    box.className = "flow-person-editor";
    const head = document.createElement("div");
    head.className = "mail-editor-head";
    head.innerHTML = `<strong>人員</strong><span class="muted-cell">${node.role_id || ""}</span>`;
    box.appendChild(head);
    const labInp = document.createElement("input");
    labInp.className = "cell-input";
    labInp.placeholder = "顯示名稱";
    labInp.value = node.label || "";
    labInp.addEventListener("change", () => {
      node.label = labInp.value.trim();
      persistDesign(doc.meta.form_id, doc);
      if (onChange) onChange();
    });
    box.appendChild(labInp);
    return box;
  }

  function addFieldNodeFromPerson(b, person, persistFn, paintFn) {
    const label = prompt("欄位顯示名稱", "新欄位");
    if (!label) return;
    const fid =
      "field_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 4);
    if (!doc.fields) doc.fields = {};
    doc.fields[fid] = ensureContentField({
      kind: "content",
      type: "text",
      label: label.trim(),
      value: "",
    });
    const nid = newFlowId("n");
    const fn = {
      id: nid,
      kind: "field",
      field_id: fid,
      label: label.trim(),
      x: Math.max(8, person.x - 100),
      y: person.y,
      scope_id: person.scope_id || null,
    };
    if (fn.scope_id) {
      const scope = b.nodes.find((x) => x.id === fn.scope_id);
      if (scope) {
        const kids = b.nodes.filter((x) => x.scope_id === scope.id);
        fn.x = scope.x + 24;
        fn.y = scope.y + 40 + kids.length * 48;
        scope.h = Math.max(scope.h || 120, fn.y - scope.y + 56);
      }
    }
    b.nodes.push(fn);
    b.edges.push({
      id: newFlowId("e"),
      from: person.id,
      to: nid,
      kind: "action",
      label: "填寫",
    });
    persistFn();
    paintFn();
    return fid;
  }

  function addPersonNodeNear(b, ref, label, roleId, persistFn, paintFn) {
    const nid = newFlowId("n");
    b.nodes.push({
      id: nid,
      kind: "person",
      role_id: roleId || "custom_" + Date.now().toString(36),
      label: label.trim(),
      x: ref.x + 120,
      y: ref.y,
      scope_id: ref.scope_id || null,
    });
    persistFn();
    paintFn();
    return nid;
  }

  function addActionNodeNear(b, ref, label, actionKey, persistFn, paintFn) {
    const nid = newFlowId("n");
    b.nodes.push({
      id: nid,
      kind: "action",
      action_key: actionKey || "custom",
      label: label.trim(),
      x: ref.x,
      y: ref.y + 80,
      scope_id: ref.scope_id || null,
    });
    persistFn();
    paintFn();
    return nid;
  }

  function addScopeBlock(b, ref, label, persistFn, paintFn) {
    const sid = newFlowId("n");
    b.nodes.push({
      id: sid,
      kind: "scope",
      label: label.trim(),
      x: Math.max(8, ref.x - 40),
      y: Math.max(8, ref.y - 40),
      w: 200,
      h: 160,
    });
    persistFn();
    paintFn();
    return sid;
  }

  function boardPersonMaterials() {
    return [
      { attr: "person", kind: "person", role_id: "requester", label: "申請人" },
      { attr: "person", kind: "person", role_id: "approver", label: "簽核人" },
      { attr: "person", kind: "person", role_id: "cc", label: "副本 CC" },
      { attr: "person", kind: "person", role_id: "fyi", label: "結案知會 FYI" },
      { attr: "person", kind: "person", role_id: "creator", label: "建立者" },
      { attr: "person", kind: "person", role_id: "admin", label: "管理員" },
    ];
  }

  function boardActionMaterials() {
    return [
      { attr: "action", kind: "action", label: "Submit 送出" },
      { attr: "action", kind: "action", label: "Approve 同意" },
      { attr: "action", kind: "action", label: "Reject 拒件" },
      { attr: "action", kind: "action", label: "Return 退回" },
      { attr: "action", kind: "action", label: "Cancel 取消" },
      { attr: "action", kind: "action", label: "Change 換人" },
      { attr: "action", kind: "action", label: "Notify 通知" },
      { attr: "action", kind: "action", label: "填寫" },
      { attr: "action", kind: "action", label: "分文／交辦" },
      { attr: "action", kind: "action", label: "會辦" },
      { attr: "action", kind: "action", label: "送歸檔" },
    ];
  }

  function boardMailMaterials(col) {
    return mailEventsForLevel(col.level).map((ev) => ({
      attr: "action",
      kind: "mail",
      event_id: ev.id,
      label: ev.short || ev.label,
    }));
  }

  function boardFieldMaterials() {
    return contentFieldList().map((f) => ({
      attr: "field",
      kind: "field",
      field_id: f.id,
      label: f.label,
      meta: f.type + (f.required ? "・必填" : ""),
    }));
  }

  function createStageMailPanel(col, opts = {}) {
    ensureApprovalColumn(col);
    ensureStageMail(col);
    flowBoardStorage(col);
    const previewRole = opts.previewRole || "design";
    const fieldEditorHost =
      opts.fieldEditorHost ||
      (() => {
        const h = document.createElement("div");
        h.className = "flow-field-editor-host";
        return h;
      })();
    const mailEditorHost =
      opts.mailEditorHost ||
      (() => {
        const h = document.createElement("div");
        h.className = "mail-flow-editor-host";
        return h;
      })();
    const editorBus = opts.editorBus;
    const panel = document.createElement("div");
    panel.className =
      "field-rules stage-mail-panel mail-flow-panel flow-diagram-panel";
    const lv = Number(col.level);
    const evById = Object.fromEntries(
      mailEventsForLevel(lv).map((e) => [e.id, e])
    );

    const pickHint = document.createElement("div");
    pickHint.className = "mail-board-pick-hint";
    pickHint.hidden = true;
    panel.appendChild(pickHint);

    let selectedMat = null;
    let linkFromId = null;
    let selectedId = null;
    let repointEdgeId = null;
    let activeEventId = null;
    let dragging = null;
    let openFieldId = null;

    const closeAllEditors = () => {
      openFieldId = null;
      activeEventId = null;
      fieldEditorHost.hidden = true;
      fieldEditorHost.replaceChildren();
      mailEditorHost.hidden = true;
      mailEditorHost.replaceChildren();
      if (editorBus) editorBus.active = null;
    };

    const updateHint = () => {
      if (repointEdgeId) {
        pickHint.hidden = false;
        pickHint.classList.add("on");
        pickHint.textContent = "重指箭頭 → 請點新的終點節點";
        return;
      }
      if (selectedMat && (selectedMat.kind === "action" || selectedMat.kind === "mail")) {
        pickHint.hidden = false;
        pickHint.classList.add("on");
        pickHint.textContent = linkFromId
          ? "已選起點 → 請再點終點完成「" + selectedMat.label + "」"
          : "已選「" + selectedMat.label + "」→ 請先點起點，再點終點";
      } else if (selectedId) {
        pickHint.hidden = false;
        pickHint.classList.add("on");
        pickHint.textContent = openFieldId
          ? "欄位儀表板已開啟"
          : "已選物件 → 丟棄刪除；箭頭可重指終點；人員圓圈內可新增";
      } else {
        pickHint.hidden = true;
        pickHint.classList.remove("on");
        pickHint.textContent = "";
      }
    };

    const clearSel = () => {
      selectedMat = null;
      linkFromId = null;
      selectedId = null;
      repointEdgeId = null;
      closeAllEditors();
      updateHint();
    };

    const persist = () => persistDesign(doc.meta.form_id, doc);

    const resolveEvent = (eventId) => {
      if (evById[eventId]) return evById[eventId];
      const customs = flowBoardStorage(col).custom_mail_events || [];
      const c = customs.find((x) => x.id === eventId);
      if (c) return c;
      return { id: eventId, label: eventId, short: eventId, flow_role: "side" };
    };

    const mountFieldDash = (fid) => {
      const f = ensureContentField(doc.fields[fid]);
      fieldEditorHost.replaceChildren();
      fieldEditorHost.appendChild(
        createFlowFieldDashboard(fid, f, () => {
          const node = flowBoardStorage(col).nodes.find(
            (x) => x.field_id === fid
          );
          if (node) node.label = f.label || fid;
          persist();
          mountFieldDash(fid);
          paintCanvas();
        })
      );
    };

    const openFieldEditor = (fid) => {
      if (!fid || !doc.fields?.[fid]) return;
      if (editorBus) {
        editorBus.closeAll();
        editorBus.active = col.id;
      }
      if (openFieldId === fid) {
        closeAllEditors();
        paintCanvas();
        return;
      }
      openFieldId = fid;
      activeEventId = null;
      mailEditorHost.hidden = true;
      mailEditorHost.replaceChildren();
      fieldEditorHost.hidden = false;
      mountFieldDash(fid);
      paintCanvas();
    };

    const openMailEditor = (ev) => {
      if (editorBus) {
        editorBus.closeAll();
        editorBus.active = col.id;
      }
      if (activeEventId === ev.id) {
        closeAllEditors();
        paintCanvas();
        return;
      }
      closeAllEditors();
      activeEventId = ev.id;
      ensureStageMail(col);
      if (!col.mail[ev.id]) {
        col.mail[ev.id] = {
          to: "",
          cc: "",
          subject: "",
          body: "",
          editable: true,
          locked: false,
        };
      }
      mailEditorHost.hidden = false;
      mailEditorHost.appendChild(
        createMailEditor(col, ev, () => paintCanvas())
      );
      paintCanvas();
    };

    const openPersonEditor = (node) => {
      if (editorBus) {
        editorBus.closeAll();
        editorBus.active = col.id;
      }
      closeAllEditors();
      mailEditorHost.hidden = false;
      mailEditorHost.appendChild(
        createPersonEditor(node, () => paintCanvas())
      );
      paintCanvas();
    };

    const openActionNodeEditor = (node) => {
      if (editorBus) {
        editorBus.closeAll();
        editorBus.active = col.id;
      }
      closeAllEditors();
      mailEditorHost.hidden = false;
      mailEditorHost.appendChild(
        createActionEditor(node, () => paintCanvas())
      );
      paintCanvas();
    };

    const toolbar = document.createElement("div");
    toolbar.className = "flow-canvas-toolbar";
    const trash = document.createElement("button");
    trash.type = "button";
    trash.className = "table-btn danger-ish";
    trash.textContent = "丟棄選取";
    trash.addEventListener("click", () => {
      if (!selectedId) return;
      const b = flowBoardStorage(col);
      if (selectedId.startsWith("n:")) {
        const nid = selectedId.slice(2);
        b.nodes = b.nodes.filter((n) => n.id !== nid);
        b.edges = b.edges.filter((e) => e.from !== nid && e.to !== nid);
      } else if (selectedId.startsWith("e:")) {
        const eid = selectedId.slice(2);
        b.edges = b.edges.filter((e) => e.id !== eid);
      }
      persist();
      clearSel();
      paintAll();
    });
    toolbar.appendChild(trash);
    const repointBtn = document.createElement("button");
    repointBtn.type = "button";
    repointBtn.className = "table-btn";
    repointBtn.textContent = "重指箭頭終點";
    repointBtn.addEventListener("click", () => {
      if (!selectedId || !selectedId.startsWith("e:")) return;
      repointEdgeId = selectedId.slice(2);
      updateHint();
    });
    toolbar.appendChild(repointBtn);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "table-btn";
    reset.textContent = "重設預設流程";
    reset.addEventListener("click", () => {
      if (!confirm("重設此 Scope 的流程圖？")) return;
      col.mail_board = defaultFlowBoard(col);
      persist();
      clearSel();
      paintAll();
    });
    toolbar.appendChild(reset);
    panel.appendChild(toolbar);

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "flow-canvas-wrap";
    const canvas = document.createElement("div");
    canvas.className = "flow-canvas";
    canvasWrap.appendChild(canvas);

    const nodeEl = (id) => canvas.querySelector('[data-node-id="' + id + '"]');

    const startMailLinkFromPerson = (person, eventId, label) => {
      selectedMat = {
        attr: "action",
        kind: "mail",
        event_id: eventId,
        label: label,
      };
      linkFromId = person.id;
      selectedId = null;
      updateHint();
      paintCanvas();
    };

    const appendPersonTools = (el, person, b) => {
      if (selectedId !== "n:" + person.id) return;
      const tools = document.createElement("div");
      tools.className = "flow-person-tools";
      const addBtn = (text, title, fn) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "flow-person-tool";
        btn.textContent = text;
        btn.title = title;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          fn();
        });
        tools.appendChild(btn);
      };
      addBtn("+欄", "新增欄位並連填寫箭頭", () => {
        const fid = addFieldNodeFromPerson(b, person, persist, paintAll);
        if (fid) openFieldEditor(fid);
      });
      addBtn("+人", "新增人員節點", () => {
        const name = prompt("人員名稱", "新角色");
        if (!name) return;
        addPersonNodeNear(b, person, name, null, persist, paintAll);
      });
      addBtn("+動作", "新增動作節點", () => {
        const label = prompt("動作名稱", lv === 0 ? "SAVE" : "Approve 同意");
        if (!label) return;
        const nid = addActionNodeNear(
          b,
          person,
          label,
          label.toLowerCase().replace(/\s+/g, "_"),
          persist,
          paintAll
        );
        b.edges.push({
          id: newFlowId("e"),
          from: person.id,
          to: nid,
          kind: "action",
          label: label,
        });
        persist();
        paintAll();
      });
      addBtn("+信", "從此人畫通知箭頭", () => {
        const events = [
          ...mailEventsForLevel(lv),
          ...(flowBoardStorage(col).custom_mail_events || []),
        ];
        const names = events
          .map((ev, i) => `${i + 1}. ${ev.short || ev.label}`)
          .join("\n");
        const ans = prompt("選擇通知（編號）：\n" + names, "1");
        if (!ans) return;
        const ev = events[Number(ans) - 1];
        if (!ev) return;
        ensureStageMail(col);
        if (!col.mail[ev.id]) {
          col.mail[ev.id] = {
            to: "",
            cc: "",
            subject: "",
            body: "",
            editable: true,
            locked: false,
          };
        }
        startMailLinkFromPerson(person, ev.id, ev.short || ev.label);
      });
      addBtn("+Scope", "新增群組區塊", () => {
        const name = prompt("Scope 名稱", "填寫區");
        if (!name) return;
        addScopeBlock(b, person, name, persist, paintAll);
      });
      el.appendChild(tools);
    };

    const anchorPoint = (node, other) => {
      const el = nodeEl(node.id);
      let w = el ? el.offsetWidth : 110;
      let h = el ? el.offsetHeight : 44;
      if (node.kind === "person") {
        w = el ? el.offsetWidth : 92;
        h = el ? el.offsetHeight : 92;
      } else if (node.kind === "action") {
        w = el ? el.offsetWidth : 88;
        h = el ? el.offsetHeight : 36;
      }
      const cx = node.x + w / 2;
      const cy = node.y + h / 2;
      if (!other) return { x: cx, y: cy, w, h };
      const ox = other.x + (nodeEl(other.id)?.offsetWidth || 88) / 2;
      const oy = other.y + (nodeEl(other.id)?.offsetHeight || 44) / 2;
      const dx = ox - cx;
      const dy = oy - cy;
      if (node.kind === "person") {
        const r = Math.min(w, h) / 2;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        return { x: cx + (dx / len) * r, y: cy + (dy / len) * r, w, h };
      }
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx / (w / 2) > absDy / (h / 2)) {
        return {
          x: cx + Math.sign(dx) * (w / 2),
          y: cy + (dy * (w / 2)) / (absDx || 1),
          w,
          h,
        };
      }
      return {
        x: cx + (dx * (h / 2)) / (absDy || 1),
        y: cy + Math.sign(dy) * (h / 2),
        w,
        h,
      };
    };

    const paintCanvas = () => {
      const b = flowBoardStorage(col);
      canvas.replaceChildren();
      canvas.style.minHeight = "420px";

      let maxX = 640;
      let maxY = 380;
      b.nodes.forEach((n) => {
        if (n.kind === "scope") {
          maxX = Math.max(maxX, n.x + (n.w || 200) + 20);
          maxY = Math.max(maxY, n.y + (n.h || 160) + 20);
        } else {
          maxX = Math.max(maxX, n.x + 160);
          maxY = Math.max(maxY, n.y + 120);
        }
      });
      canvas.style.width = maxX + "px";
      canvas.style.height = maxY + "px";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "flow-edges");
      svg.setAttribute("width", String(maxX));
      svg.setAttribute("height", String(maxY));
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const marker = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "marker"
      );
      marker.setAttribute("id", "flow-arrow-" + col.id);
      marker.setAttribute("viewBox", "0 0 10 10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "5");
      marker.setAttribute("markerWidth", "7");
      marker.setAttribute("markerHeight", "7");
      marker.setAttribute("orient", "auto-start-reverse");
      const tipPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      tipPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      tipPath.setAttribute("fill", "#3a342c");
      marker.appendChild(tipPath);
      defs.appendChild(marker);
      svg.appendChild(defs);
      canvas.appendChild(svg);

      const moveScopeChildren = (scope, dx, dy) => {
        b.nodes.forEach((child) => {
          if (child.scope_id === scope.id) {
            child.x += dx;
            child.y += dy;
          }
        });
      };

      b.nodes
        .filter((n) => n.kind === "scope")
        .forEach((scope) => {
          const el = document.createElement("div");
          el.className =
            "flow-scope" +
            (selectedId === "n:" + scope.id ? " selected" : "") +
            (!flowNodeHighlighted(scope, previewRole) ? " flow-dimmed" : "");
          el.dataset.nodeId = scope.id;
          el.style.left = scope.x + "px";
          el.style.top = scope.y + "px";
          el.style.width = (scope.w || 200) + "px";
          el.style.height = (scope.h || 160) + "px";
          const lab = document.createElement("span");
          lab.className = "flow-scope-label";
          lab.textContent = scope.label || "Scope";
          el.appendChild(lab);
          el.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            dragging = {
              id: scope.id,
              ox: e.clientX,
              oy: e.clientY,
              sx: scope.x,
              sy: scope.y,
              moved: false,
              isScope: true,
            };
            el.setPointerCapture(e.pointerId);
          });
          el.addEventListener("pointermove", (e) => {
            if (!dragging || dragging.id !== scope.id) return;
            const dx = e.clientX - dragging.ox;
            const dy = e.clientY - dragging.oy;
            if (Math.abs(dx) + Math.abs(dy) > 4) dragging.moved = true;
            const ndx = Math.max(8, dragging.sx + dx) - scope.x;
            const ndy = Math.max(8, dragging.sy + dy) - scope.y;
            if (dragging.moved) moveScopeChildren(scope, ndx, ndy);
            scope.x = Math.max(8, dragging.sx + dx);
            scope.y = Math.max(8, dragging.sy + dy);
            el.style.left = scope.x + "px";
            el.style.top = scope.y + "px";
            dragging.sx = scope.x;
            dragging.sy = scope.y;
            dragging.ox = e.clientX;
            dragging.oy = e.clientY;
            canvas.querySelectorAll("[data-node-id]").forEach((nodeEl) => {
              const nid = nodeEl.dataset.nodeId;
              const nn = b.nodes.find((x) => x.id === nid);
              if (nn && nn.kind !== "scope") {
                nodeEl.style.left = nn.x + "px";
                nodeEl.style.top = nn.y + "px";
              }
            });
            drawEdges();
          });
          el.addEventListener("pointerup", () => {
            if (dragging && dragging.id === scope.id && dragging.moved) {
              persist();
            }
            dragging = null;
          });
          el.addEventListener("click", () => {
            selectedId = "n:" + scope.id;
            const name = prompt("Scope 名稱", scope.label || "");
            if (name != null) {
              scope.label = name.trim() || scope.label;
              persist();
              paintCanvas();
            }
          });
          canvas.appendChild(el);
        });

      b.nodes
        .filter((n) => n.kind !== "scope")
        .forEach((n) => {
        const hi = flowNodeHighlighted(n, previewRole);
        const el = document.createElement("button");
        el.type = "button";
        el.className =
          "flow-node kind-" +
          n.kind +
          (selectedId === "n:" + n.id ? " selected" : "") +
          (linkFromId === n.id ? " link-from" : "") +
          (!hi ? " flow-dimmed" : "");
        el.dataset.nodeId = n.id;
        el.style.left = n.x + "px";
        el.style.top = n.y + "px";
        const badge = document.createElement("span");
        badge.className = "flow-node-badge";
        badge.textContent =
          n.kind === "person"
            ? "人"
            : n.kind === "field"
              ? "欄位"
              : n.kind === "action"
                ? "動作"
                : "文件";
        const lab = document.createElement("span");
        lab.className = "flow-node-label";
        lab.textContent = n.label;
        if (n.kind === "field" && n.field_id) {
          const f = doc.fields?.[n.field_id];
          if (f) {
            el.classList.add("flow-field-card");
            if (openFieldId === n.field_id) el.classList.add("dash-open");
            el.appendChild(lab);
            appendFlowFieldMetaChips(el, f);
          } else {
            el.appendChild(badge);
            el.appendChild(lab);
          }
        } else if (n.kind === "action") {
          el.appendChild(lab);
        } else if (n.kind === "person") {
          el.appendChild(lab);
          appendPersonTools(el, n, b);
        } else {
          el.appendChild(badge);
          el.appendChild(lab);
        }

        el.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          if (
            e.target.closest &&
            e.target.closest(".flow-person-tools")
          )
            return;
          if (selectedMat && (selectedMat.kind === "action" || selectedMat.kind === "mail")) {
            return;
          }
          dragging = {
            id: n.id,
            ox: e.clientX,
            oy: e.clientY,
            sx: n.x,
            sy: n.y,
            moved: false,
          };
          el.setPointerCapture(e.pointerId);
        });
        el.addEventListener("pointermove", (e) => {
          if (!dragging || dragging.id !== n.id) return;
          const dx = e.clientX - dragging.ox;
          const dy = e.clientY - dragging.oy;
          if (Math.abs(dx) + Math.abs(dy) > 4) dragging.moved = true;
          n.x = Math.max(8, dragging.sx + dx);
          n.y = Math.max(8, dragging.sy + dy);
          el.style.left = n.x + "px";
          el.style.top = n.y + "px";
          drawEdges();
        });
        el.addEventListener("pointerup", (e) => {
          if (dragging && dragging.id === n.id) {
            if (dragging.moved) {
              persist();
              dragging = null;
              paintCanvas();
              return;
            }
            dragging = null;
          }
          if (repointEdgeId) {
            const edge = b.edges.find((x) => x.id === repointEdgeId);
            if (edge) {
              edge.to = n.id;
              persist();
            }
            repointEdgeId = null;
            updateHint();
            paintAll();
            return;
          }
          if (selectedMat && (selectedMat.kind === "action" || selectedMat.kind === "mail")) {
            if (!linkFromId) {
              linkFromId = n.id;
              updateHint();
              paintCanvas();
              return;
            }
            if (linkFromId === n.id) {
              linkFromId = null;
              updateHint();
              paintCanvas();
              return;
            }
            const edge = {
              id: newFlowId("e"),
              from: linkFromId,
              to: n.id,
              kind: selectedMat.kind,
              label: selectedMat.label,
              event_id: selectedMat.event_id || null,
            };
            b.edges.push(edge);
            persist();
            selectedMat = null;
            linkFromId = null;
            selectedId = "e:" + edge.id;
            updateHint();
            paintAll();
            return;
          }
          if (n.kind === "field" && n.field_id) {
            selectedId = "n:" + n.id;
            openFieldEditor(n.field_id);
            updateHint();
            return;
          }
          if (n.kind === "person") {
            selectedId = "n:" + n.id;
            openPersonEditor(n);
            updateHint();
            paintCanvas();
            return;
          }
          if (n.kind === "action") {
            selectedId = "n:" + n.id;
            openActionNodeEditor(n);
            updateHint();
            paintCanvas();
            return;
          }
          selectedId = selectedId === "n:" + n.id ? null : "n:" + n.id;
          closeAllEditors();
          updateHint();
          paintCanvas();
        });

        canvas.appendChild(el);
      });

      const drawEdges = () => {
        while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
        canvas.querySelectorAll(".flow-edge-label-wrap").forEach((x) => x.remove());

        const byId = Object.fromEntries(b.nodes.map((n) => [n.id, n]));
        const pairCount = {};
        b.edges.forEach((e) => {
          const key = e.from + "->" + e.to;
          pairCount[key] = (pairCount[key] || 0) + 1;
        });
        const pairSeen = {};
        const markerUrl = "url(#flow-arrow-" + col.id + ")";

        b.edges.forEach((e) => {
          const a = byId[e.from];
          const c = byId[e.to];
          if (!a || !c) return;
          const edgeHi =
            previewRole === "design" ||
            (flowNodeHighlighted(a, previewRole) &&
              flowNodeHighlighted(c, previewRole));
          const key = e.from + "->" + e.to;
          const idx = pairSeen[key] || 0;
          pairSeen[key] = idx + 1;
          const total = pairCount[key] || 1;
          const bend =
            total === 1 ? (e.from === e.to ? 40 : 0) : (idx - (total - 1) / 2) * 28;

          if (e.from === e.to) {
            const cx = a.x + 44;
            const cy = a.y + 44;
            const p1 = { x: cx + 30, y: cy - 20 };
            const p2 = { x: cx + 30, y: cy + 20 };
            const path = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "path"
            );
            path.setAttribute(
              "d",
              `M ${p1.x} ${p1.y} C ${cx + 90} ${cy - 70}, ${cx + 90} ${cy + 70}, ${p2.x} ${p2.y}`
            );
            path.setAttribute("class", "flow-edge-line kind-" + e.kind + (edgeHi ? "" : " flow-dimmed"));
            path.setAttribute("marker-end", markerUrl);
            svg.appendChild(path);
            placeEdgeLabel(e, cx + 78, cy, edgeHi);
            return;
          }

          const p1 = anchorPoint(a, c);
          const p2 = anchorPoint(c, a);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ox = (-dy / len) * bend;
          const oy = (dx / len) * bend;
          const cx = mx + ox;
          const cy = my + oy;
          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          path.setAttribute(
            "d",
            `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`
          );
          path.setAttribute("class", "flow-edge-line kind-" + e.kind + (edgeHi ? "" : " flow-dimmed"));
          path.setAttribute("marker-end", markerUrl);
          if (selectedId === "e:" + e.id) path.classList.add("selected");
          svg.appendChild(path);
          placeEdgeLabel(e, cx, cy, edgeHi);
        });
      };

      const placeEdgeLabel = (e, x, y, edgeHi) => {
        const wrap = document.createElement("div");
        wrap.className =
          "flow-edge-label-wrap" +
          (selectedId === "e:" + e.id ? " selected" : "") +
          (edgeHi ? "" : " flow-dimmed");
        wrap.style.left = x + "px";
        wrap.style.top = y + "px";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "flow-edge-label kind-" +
          e.kind +
          (e.kind === "mail" &&
          mailTemplateConfigured(col.mail?.[e.event_id])
            ? " configured"
            : "");
        if (e.kind === "mail") {
          const ev = resolveEvent(e.event_id);
          const configured = mailTemplateConfigured(col.mail?.[e.event_id]);
          btn.textContent =
            (e.label || ev.short || "通知") + (configured ? "" : "（未設定）");
        } else {
          btn.textContent = e.label || "動作";
        }
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (selectedId === "e:" + e.id) {
            if (e.kind === "mail" && e.event_id) {
              openMailEditor(resolveEvent(e.event_id));
            } else if (e.kind === "action") {
              const fake = { label: e.label, action_key: e.label };
              openActionNodeEditor(fake);
            }
            return;
          }
          selectedId = "e:" + e.id;
          selectedMat = null;
          linkFromId = null;
          updateHint();
          paintCanvas();
        });
        wrap.appendChild(btn);
        canvas.appendChild(wrap);
      };

      drawEdges();
    };

    canvas.addEventListener("pointerdown", (e) => {
      const isBlank =
        e.target === canvas ||
        (e.target.classList && e.target.classList.contains("flow-edges")) ||
        e.target.tagName === "svg" ||
        e.target.tagName === "path";
      if (!isBlank) return;
      if (selectedId && !repointEdgeId) {
        closeAllEditors();
        selectedId = null;
        updateHint();
        paintCanvas();
      }
    });

    const paintAll = () => {
      paintCanvas();
      updateHint();
    };

    paintAll();
    panel.appendChild(canvasWrap);
    if (!opts.fieldEditorHost) panel.appendChild(fieldEditorHost);
    if (!opts.mailEditorHost) panel.appendChild(mailEditorHost);
    return panel;
  }

  function renumberApprovalSteps(d) {
    const cols = (d.approval?.columns || []).map(ensureApprovalColumn);
    const applyCol = cols.find((c) => Number(c.level) === 0);
    const steps = cols
      .filter((c) => Number(c.level) > 0)
      .sort((a, b) => Number(a.level) - Number(b.level));
    steps.forEach((c, i) => {
      c.level = i + 1;
      c.id = `step_${i + 1}`;
      if (c.role && /^approver_\d+$/.test(c.role)) {
        c.role = `approver_${i + 1}`;
      }
      if (c.person?.name) {
        if (!c.stamp) c.stamp = {};
        const sn = c.stamp.name || "";
        if (!sn || sn.length <= 1) c.stamp.name = c.person.name;
      }
    });
    if (applyCol) {
      applyCol.level = 0;
      applyCol.id = "step_0";
      if (!applyCol.label || applyCol.label === "申請") applyCol.label = "Submit";
      applyCol.role = applyCol.role || "requester";
      if (applyCol.person?.name) {
        if (!applyCol.stamp) applyCol.stamp = {};
        const sn = applyCol.stamp.name || "";
        if (!sn || sn.length <= 1) applyCol.stamp.name = applyCol.person.name;
      }
    }
    // 水流順序：step_0 → step_1 → …
    const ordered = [];
    if (applyCol) ordered.push(applyCol);
    ordered.push(...steps);
    d.approval.columns = ordered;
    (d.roles || []).forEach((r) => {
      if (!r.stamp_id) return;
      const hit = ordered.find((c) => c.role === r.id);
      if (hit) r.stamp_id = hit.id;
    });
    return d;
  }

  function makeBlankForm(formId, title, creator) {
    const d = clone(EMBEDDED_DOC);
    d.meta = {
      ...d.meta,
      kind: "form_design",
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

  function ensureDesignForForm(formId) {
    let d = loadDesign(formId);
    if (d) return ensureDocShape(d);
    if (formId === (EMBEDDED_DOC.meta?.form_id || "leave_request_v1")) {
      d = clone(EMBEDDED_DOC);
      d.meta = { ...d.meta, kind: "form_design", form_id: formId };
    } else {
      const meta = formsCatalog.find((x) => x.form_id === formId);
      d = makeBlankForm(formId, meta?.title, meta?.creator);
    }
    d = ensureDocShape(d);
    persistDesign(formId, d);
    return d;
  }

  function openApplyForm(formId) {
    const design = ensureDesignForForm(formId);
    upsertCatalogEntry(design);
    doc = cloneDesignToApplication(design);
    persistApplication(doc);
    resetOpenedSnapshot();
    appNav.tab = "apply";
    appNav.applyLayer = "doc";
    appNav.editingDocId = doc.meta.doc_id;
    persistNav();
    renderApp();
  }

  function openDesignForm(formId) {
    const d = ensureDesignForForm(formId);
    doc = d;
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

  function knownPeopleOptions() {
    const map = new Map();
    (doc.roles || []).forEach((r) => {
      const name = r.person?.name;
      if (name) map.set(name, { value: name, label: name });
    });
    (doc.approval?.columns || []).forEach((c) => {
      const name = c.person?.name || c.stamp?.name;
      if (name && String(name).length > 1) map.set(name, { value: name, label: name });
    });
    return Array.from(map.values());
  }

  function aclRoleOptions() {
    const list = ACL_ROLE_BASE.slice();
    (doc.approval?.columns || []).forEach((c) => {
      const lv = Number(c.level);
      if (lv > 0) {
        const id = `approver_${lv}`;
        if (!list.some((x) => x.id === id)) {
          list.push({ id, label: `簽核人 level ${lv}` });
        }
      }
    });
    return list;
  }

  function ensureContentField(f) {
    if (!f || typeof f !== "object") return f;
    f.kind = "content";
    if (f.required == null) f.required = false;
    if (f.required_from_level === undefined) f.required_from_level = null;
    if (f.required_when === undefined) f.required_when = null;
    if (!f.acl || typeof f.acl !== "object") f.acl = {};
    ["visible_to", "editable_by", "hidden_from"].forEach((k) => {
      if (!f.acl[k] || typeof f.acl[k] !== "object") f.acl[k] = {};
      if (!Array.isArray(f.acl[k].roles)) f.acl[k].roles = [];
    });
    return f;
  }

  function persistContentField() {
    persistDesign(doc.meta.form_id, doc);
  }

  function createTypeSelect(f, onTypeChange) {
    const sel = document.createElement("select");
    sel.className = "cell-input";
    CONTENT_FIELD_TYPES.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.label;
      if ((f.type || "text") === t.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      f.type = sel.value;
      f.kind = "content";
      if (f.type === "number" && f.value != null && f.value !== "" && Number.isNaN(Number(f.value))) {
        f.value = "";
      }
      if (f.type === "dropdown") {
        if (f.allow_blank == null) f.allow_blank = true;
        if (f.allow_manual == null) f.allow_manual = false;
      }
      if (f.type === "person" && !normalizeOptions(f.options).length) {
        /* options optional; picker uses known people */
      }
      persistContentField();
      onTypeChange();
    });
    return sel;
  }

  function createMiniToggleChip(label, on, title, onToggle) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dash-chip mini" + (on ? " on" : "");
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onToggle();
    });
    return btn;
  }

  /** B Form：共用下拉選項庫選擇／管理（帳號可讀） */
  function openOptionListPicker(field, onDone) {
    const account = currentAccount();
    const overlay = document.createElement("div");
    overlay.className = "opt-overlay";
    const card = document.createElement("div");
    card.className = "opt-card list-stage-light";

    const close = () => overlay.remove();

    const head = document.createElement("div");
    head.className = "opt-card-head";
    const h = document.createElement("h3");
    h.textContent = "B Form｜下拉選項庫";
    head.appendChild(h);
    const x = document.createElement("button");
    x.type = "button";
    x.className = "icon-btn";
    x.textContent = "×";
    x.addEventListener("click", close);
    head.appendChild(x);
    card.appendChild(head);

    const tip = document.createElement("p");
    tip.className = "sec-note";
    tip.textContent =
      `帳號：${account}。選共用清單連到 A 欄位；公司清單請把 readers 設成可讀帳號或 *。`;
    card.appendChild(tip);

    const body = document.createElement("div");
    body.className = "opt-card-body";

    const paint = () => {
      body.replaceChildren();
      const readable = optionLists.filter((l) => canReadOptionList(l, account));

      const useLocal = document.createElement("button");
      useLocal.type = "button";
      useLocal.className =
        "table-btn" + (!field.options_ref ? " primary" : "");
      useLocal.textContent = "用本機選項（不連 B）";
      useLocal.addEventListener("click", () => {
        delete field.options_ref;
        if (!normalizeOptions(field.options).length) {
          field.options = [
            { value: "選項A", label: "選項A" },
            { value: "選項B", label: "選項B" },
          ];
        }
        if (onDone) onDone();
        close();
      });
      body.appendChild(useLocal);

      readable.forEach((list) => {
        const row = document.createElement("div");
        row.className = "opt-list-row";
        const main = document.createElement("button");
        main.type = "button";
        main.className =
          "table-btn" +
          (field.options_ref === list.list_id ? " primary" : "");
        main.textContent = `${list.title}（${(list.items || []).length}）· ${list.owner}`;
        main.addEventListener("click", () => {
          field.options_ref = list.list_id;
          field.options = normalizeOptions(list.items);
          if (
            !field.allow_blank &&
            field.value &&
            !field.options.some((o) => o.value === field.value)
          ) {
            field.value = field.options[0]?.value || "";
          }
          if (onDone) onDone();
          close();
        });
        row.appendChild(main);

        if (canEditOptionList(list, account)) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "icon-btn";
          edit.textContent = "✎";
          edit.title = "編輯此 B 清單";
          edit.addEventListener("click", () => {
            editOptionListItem(list, () => {
              persistOptionLists();
              if (field.options_ref === list.list_id) {
                field.options = normalizeOptions(list.items);
              }
              paint();
              if (onDone) onDone();
            });
          });
          row.appendChild(edit);
        }
        body.appendChild(row);
      });

      const add = document.createElement("button");
      add.type = "button";
      add.className = "table-btn";
      add.textContent = "＋ 新建 B 清單（我是 owner）";
      add.addEventListener("click", () => {
        const title = prompt("清單名稱", "新下拉清單");
        if (!title) return;
        const id =
          "list_" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 5);
        const list = {
          list_id: id,
          title,
          owner: account,
          readers: [],
          items: [
            { value: "選項1", label: "選項1" },
            { value: "選項2", label: "選項2" },
          ],
          updated_at: nowStamp(),
        };
        optionLists.unshift(list);
        persistOptionLists();
        editOptionListItem(list, () => {
          persistOptionLists();
          paint();
        });
        paint();
      });
      body.appendChild(add);
    };

    paint();
    card.appendChild(body);
    overlay.appendChild(card);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
  }

  function editOptionListItem(list, onSaved) {
    const itemsText = normalizeOptions(list.items)
      .map((o) => o.label)
      .join("\n");
    const next = prompt(
      `編輯「${list.title}」選項（每行一項）`,
      itemsText
    );
    if (next == null) return;
    list.items = next
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ value: s, label: s }));
    const readers = prompt(
      "可讀帳號（逗號分隔；*＝全公司；空白＝僅 owner）",
      (list.readers || []).join(",")
    );
    if (readers != null) {
      list.readers = readers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    list.updated_at = nowStamp();
    persistOptionLists();
    if (onSaved) onSaved();
  }

  function createDefaultControl(f, onRebuild) {
    const type = f.type || "text";
    const wrap = document.createElement("div");
    wrap.className = "default-cell";

    const bind = (el) => {
      const save = () => {
        f.value = el.value;
        f.kind = "content";
        persistContentField();
      };
      el.addEventListener("change", save);
      el.addEventListener("input", () => {
        if (type === "number") {
          const cleaned = el.value.replace(/[^\d.\-]/g, "");
          if (cleaned !== el.value) el.value = cleaned;
        }
        f.value = el.value;
      });
    };

    if (type === "dropdown") {
      if (f.allow_blank == null) f.allow_blank = true;
      if (f.allow_manual == null) f.allow_manual = false;
      syncFieldOptionsFromRef(f);

      const toggles = document.createElement("div");
      toggles.className = "dash-chips mini-row";
      toggles.appendChild(
        createMiniToggleChip(
          "可空白",
          !!f.allow_blank,
          "申請人填單時可否空白",
          () => {
            f.allow_blank = !f.allow_blank;
            if (!f.allow_blank && (f.value == null || f.value === "")) {
              const opts = resolveFieldOptions(f);
              f.value = opts[0]?.value || "";
            }
            persistContentField();
            onRebuild();
          }
        )
      );
      toggles.appendChild(
        createMiniToggleChip(
          "可手填",
          !!f.allow_manual,
          "申請人填單時可手填（設計檔不另開文字欄）",
          () => {
            f.allow_manual = !f.allow_manual;
            persistContentField();
            onRebuild();
          }
        )
      );
      wrap.appendChild(toggles);

      let opts = resolveFieldOptions(f);
      if (!opts.length && !f.options_ref) {
        ["選項A", "選項B"].forEach((v) => opts.push({ value: v, label: v }));
        f.options = opts;
      }

      const src = document.createElement("div");
      src.className = "option-src-row";
      const srcLab = document.createElement("span");
      srcLab.className = "option-src-label";
      if (f.options_ref) {
        const list = getOptionList(f.options_ref);
        srcLab.textContent = list
          ? `B：${list.title}`
          : `B：${f.options_ref}（無法讀）`;
      } else {
        srcLab.textContent = "本機選項";
      }
      src.appendChild(srcLab);

      const sel = document.createElement("select");
      sel.className = "cell-input";
      if (f.allow_blank) {
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "（空白）";
        sel.appendChild(blank);
      }
      opts.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        sel.appendChild(o);
      });
      const cur = f.value != null ? String(f.value) : "";
      if (cur && !Array.from(sel.options).some((o) => o.value === cur)) {
        const o = document.createElement("option");
        o.value = cur;
        o.textContent = cur;
        sel.appendChild(o);
      }
      sel.value = cur;
      bind(sel);
      wrap.appendChild(sel);

      const editOpts = document.createElement("button");
      editOpts.type = "button";
      editOpts.className = "icon-btn";
      editOpts.title = "選擇／管理 B Form 下拉選項庫";
      editOpts.setAttribute("aria-label", "下拉選項庫");
      editOpts.textContent = "⋯";
      editOpts.addEventListener("click", () => {
        openOptionListPicker(f, () => {
          persistContentField();
          onRebuild();
        });
      });
      src.appendChild(editOpts);
      wrap.appendChild(src);
    } else if (type === "person") {
      const sel = document.createElement("select");
      sel.className = "cell-input";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "（空白）";
      sel.appendChild(blank);
      knownPeopleOptions().forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        sel.appendChild(o);
      });
      const cur = f.value != null ? String(f.value) : "";
      if (cur && !Array.from(sel.options).some((o) => o.value === cur)) {
        const o = document.createElement("option");
        o.value = cur;
        o.textContent = cur;
        sel.appendChild(o);
      }
      sel.value = cur;
      bind(sel);
      wrap.appendChild(sel);
    } else if (type === "date") {
      const inp = document.createElement("input");
      inp.className = "cell-input";
      inp.type = "date";
      inp.value = /^\d{4}-\d{2}-\d{2}$/.test(String(f.value || ""))
        ? String(f.value)
        : "";
      bind(inp);
      wrap.appendChild(inp);
    } else if (type === "number") {
      const inp = document.createElement("input");
      inp.className = "cell-input";
      inp.type = "number";
      inp.step = "any";
      inp.inputMode = "decimal";
      inp.value = f.value != null ? String(f.value) : "";
      bind(inp);
      wrap.appendChild(inp);
    } else if (type === "multiline") {
      const ta = document.createElement("textarea");
      ta.className = "cell-input";
      ta.rows = 2;
      ta.value = f.value != null ? String(f.value) : "";
      bind(ta);
      wrap.appendChild(ta);
    } else {
      const inp = document.createElement("input");
      inp.className = "cell-input";
      inp.type = "text";
      inp.value = f.value != null ? String(f.value) : "";
      bind(inp);
      wrap.appendChild(inp);
    }
    return wrap;
  }

  /** 單一權限光譜：default／hidden／read／write（互斥）→ 寫回 ALR5 三陣列 */
  function readRoleAccessMap(f) {
    ensureContentField(f);
    const map = {};
    const hide = new Set(f.acl.hidden_from.roles || []);
    const edit = new Set(f.acl.editable_by.roles || []);
    const view = new Set(f.acl.visible_to.roles || []);
    aclRoleOptions().forEach((r) => {
      if (hide.has(r.id)) map[r.id] = "hidden";
      else if (edit.has(r.id)) map[r.id] = "write";
      else if (view.has(r.id)) map[r.id] = "read";
      else map[r.id] = "default";
    });
    return map;
  }

  function writeRoleAccessMap(f, map) {
    ensureContentField(f);
    const hidden = [];
    const read = [];
    const write = [];
    Object.keys(map).forEach((id) => {
      const lv = map[id];
      if (lv === "hidden") hidden.push(id);
      else if (lv === "read") read.push(id);
      else if (lv === "write") write.push(id);
    });
    f.acl.hidden_from.roles = hidden;
    f.acl.visible_to.roles = read;
    f.acl.editable_by.roles = write;
    persistContentField();
  }

  function aclAccessSummary(f) {
    const map = readRoleAccessMap(f);
    let h = 0;
    let r = 0;
    let w = 0;
    Object.values(map).forEach((lv) => {
      if (lv === "hidden") h += 1;
      else if (lv === "read") r += 1;
      else if (lv === "write") w += 1;
    });
    if (!h && !r && !w) return "權限 預設";
    const bits = [];
    if (w) bits.push(`編${w}`);
    if (r) bits.push(`看${r}`);
    if (h) bits.push(`藏${h}`);
    return "權限 " + bits.join("·");
  }

  function createAclAccessBoard(f, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "acl-board";
    const tip = document.createElement("p");
    tip.className = "acl-tip";
    tip.textContent =
      "同一件事：不能看／只能看／可編輯。拖拉角色到區塊；手機可點角色再選區塊。未指定＝沿用表單預設。";
    wrap.appendChild(tip);

    const zones = [
      { id: "default", title: "未指定（預設）", hint: "不額外限制" },
      { id: "hidden", title: "不能看", hint: "hidden_from" },
      { id: "read", title: "只能看", hint: "可見唯讀" },
      { id: "write", title: "可編輯", hint: "可見且可改" },
    ];

    let map = readRoleAccessMap(f);
    let selectedRole = null;
    const board = document.createElement("div");
    board.className = "acl-board-grid";

    const paint = () => {
      board.replaceChildren();
      zones.forEach((z) => {
        const col = document.createElement("div");
        col.className = "acl-zone" + (z.id !== "default" ? ` acl-zone-${z.id}` : "");
        col.dataset.zone = z.id;

        const head = document.createElement("div");
        head.className = "acl-zone-head";
        const ht = document.createElement("div");
        ht.className = "acl-zone-title";
        ht.textContent = z.title;
        const hh = document.createElement("div");
        hh.className = "acl-zone-hint";
        hh.textContent = z.hint;
        head.appendChild(ht);
        head.appendChild(hh);
        col.appendChild(head);

        const list = document.createElement("div");
        list.className = "acl-zone-list";
        list.dataset.zone = z.id;

        aclRoleOptions()
          .filter((r) => map[r.id] === z.id)
          .forEach((r) => {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className =
              "acl-role-pill" + (selectedRole === r.id ? " selected" : "");
            pill.draggable = true;
            pill.textContent = r.label;
            pill.dataset.role = r.id;
            pill.addEventListener("dragstart", (ev) => {
              ev.dataTransfer.setData("text/plain", r.id);
              ev.dataTransfer.effectAllowed = "move";
              pill.classList.add("dragging");
            });
            pill.addEventListener("dragend", () => {
              pill.classList.remove("dragging");
            });
            pill.addEventListener("click", (ev) => {
              ev.preventDefault();
              if (selectedRole === r.id) {
                selectedRole = null;
              } else {
                selectedRole = r.id;
              }
              paint();
            });
            list.appendChild(pill);
          });

        if (!list.childElementCount) {
          const empty = document.createElement("div");
          empty.className = "acl-zone-empty";
          empty.textContent = "（空）";
          list.appendChild(empty);
        }

        const allowDrop = (ev) => {
          ev.preventDefault();
          col.classList.add("drag-over");
        };
        col.addEventListener("dragover", allowDrop);
        col.addEventListener("dragenter", allowDrop);
        col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
        col.addEventListener("drop", (ev) => {
          ev.preventDefault();
          col.classList.remove("drag-over");
          const roleId = ev.dataTransfer.getData("text/plain");
          if (!roleId) return;
          map[roleId] = z.id;
          selectedRole = null;
          writeRoleAccessMap(f, map);
          map = readRoleAccessMap(f);
          if (onChange) onChange();
          paint();
        });

        // 手機：已選角色時，點區塊即移入
        col.addEventListener("click", (ev) => {
          if (!selectedRole) return;
          if (ev.target.closest(".acl-role-pill")) return;
          map[selectedRole] = z.id;
          selectedRole = null;
          writeRoleAccessMap(f, map);
          map = readRoleAccessMap(f);
          if (onChange) onChange();
          paint();
        });

        col.appendChild(list);
        board.appendChild(col);
      });
    };

    paint();
    wrap.appendChild(board);

    const moveBar = document.createElement("div");
    moveBar.className = "acl-move-bar";
    moveBar.textContent = "手機：先點角色，再點目標區塊即可移動。";
    wrap.appendChild(moveBar);
    return wrap;
  }

  function buildRequiredEditor(f, onChange) {
    const grid = document.createElement("div");
    grid.className = "field-rules-grid";

    const reqLab = document.createElement("label");
    reqLab.className = "field-rule-item";
    const reqCb = document.createElement("input");
    reqCb.type = "checkbox";
    reqCb.checked = !!f.required;
    reqCb.addEventListener("change", () => {
      f.required = reqCb.checked;
      persistContentField();
      onChange();
    });
    reqLab.appendChild(reqCb);
    reqLab.appendChild(document.createTextNode(" 送出前必填（required）"));
    grid.appendChild(reqLab);

    const rflWrap = document.createElement("label");
    rflWrap.className = "field-rule-item";
    rflWrap.appendChild(document.createTextNode("自第幾關起必填 "));
    const rfl = document.createElement("select");
    rfl.className = "cell-input cell-input-sm";
    const maxLv = Math.max(
      0,
      ...(doc.approval?.columns || []).map((c) => Number(c.level) || 0)
    );
    const rflOpts = [
      ["", "— 不依關卡"],
      ["0", "0（申請／Submit 起）"],
    ];
    for (let i = 1; i <= Math.max(maxLv, 3); i++) {
      rflOpts.push([String(i), `${i}（該關 Approve 前起）`]);
    }
    rflOpts.forEach(([v, lab]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = lab;
      rfl.appendChild(o);
    });
    rfl.value =
      f.required_from_level == null || f.required_from_level === ""
        ? ""
        : String(f.required_from_level);
    rfl.addEventListener("change", () => {
      f.required_from_level = rfl.value === "" ? null : Number(rfl.value);
      persistContentField();
      onChange();
    });
    rflWrap.appendChild(rfl);
    grid.appendChild(rflWrap);

    const rwWrap = document.createElement("label");
    rwWrap.className = "field-rule-item field-rule-wide";
    rwWrap.appendChild(document.createTextNode("條件必填 "));
    const rw = document.createElement("input");
    rw.className = "cell-input";
    rw.placeholder = "例：leave_type=病假";
    rw.value = f.required_when != null ? String(f.required_when) : "";
    rw.addEventListener("change", () => {
      f.required_when = rw.value.trim() || null;
      persistContentField();
      onChange();
    });
    rwWrap.appendChild(rw);
    grid.appendChild(rwWrap);
    return grid;
  }

  function getFieldRuleChipDefs(f) {
    return [
      {
        key: "required",
        title: "必填",
        label: () => {
          const bits = [];
          if (f.required) bits.push("必填");
          else bits.push("非必填");
          if (f.required_from_level != null && f.required_from_level !== "")
            bits.push(`L≥${f.required_from_level}`);
          if (f.required_when) bits.push("條件");
          return bits.join("·");
        },
        on: () =>
          !!(
            f.required ||
            (f.required_from_level != null && f.required_from_level !== "") ||
            f.required_when
          ),
        build: (onChange) => buildRequiredEditor(f, onChange),
      },
      {
        key: "access",
        title: "權限",
        label: () => aclAccessSummary(f),
        on: () => aclAccessSummary(f) !== "權限 預設",
        build: (onChange) => createAclAccessBoard(f, onChange),
      },
    ];
  }

  function createTrashIconBtn(onClick) {
    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn danger";
    del.title = "刪除欄位";
    del.setAttribute("aria-label", "刪除欄位");
    del.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    del.addEventListener("click", onClick);
    return del;
  }

  /** 列上燈號；回傳 { el, setActive, refresh } */
  function createFieldRuleChips(f, opts) {
    const chips = document.createElement("div");
    chips.className = "dash-chips row-chips";
    let activeKey = opts?.activeKey || null;
    const defs = getFieldRuleChipDefs(f);

    const refresh = () => {
      chips.replaceChildren();
      defs.forEach((def) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "dash-chip" +
          (def.on() ? " on" : "") +
          (activeKey === def.key ? " active" : "");
        btn.textContent = def.label();
        btn.title = def.title;
        btn.addEventListener("click", () => {
          if (opts?.onSelect) opts.onSelect(def.key, activeKey === def.key);
        });
        chips.appendChild(btn);
      });
    };

    refresh();
    return {
      el: chips,
      refresh,
      setActive: (key) => {
        activeKey = key;
        refresh();
      },
      openDetail: (key, host, onChange) => {
        const def = defs.find((d) => d.key === key);
        if (!def) return;
        host.replaceChildren();
        const title = document.createElement("div");
        title.className = "dash-detail-title";
        title.textContent = def.title;
        host.appendChild(title);
        host.appendChild(
          def.build(() => {
            refresh();
            if (onChange) onChange();
          })
        );
      },
    };
  }

  function fieldTypeLabel(type) {
    const hit = CONTENT_FIELD_TYPES.find((t) => t.id === type);
    return hit ? hit.label : type || "文字";
  }

  function fieldDefaultPreview(f) {
    if (!f) return "—";
    const v = f.value;
    if (v == null || v === "") return "—";
    const s = String(v);
    return s.length > 14 ? s.slice(0, 13) + "…" : s;
  }

  /** 流程圖上點欄位方塊 → 儀表板（與內容欄位列同款；資料在 fields JSON） */
  function createFlowFieldDashboard(fid, f, onChange) {
    ensureContentField(f);
    const card = document.createElement("div");
    card.className = "flow-field-dash";

    const note = document.createElement("p");
    note.className = "flow-json-note";
    note.textContent =
      "跨平台：欄位定義在 form JSON 的 fields." +
      fid +
      "；流程圖 node 只存 field_id 與位置（mail_board.nodes）。";
    card.appendChild(note);

    const head = document.createElement("div");
    head.className = "flow-field-dash-head";
    const title = document.createElement("h4");
    title.textContent = f.label || fid;
    head.appendChild(title);
    const id = document.createElement("span");
    id.className = "flow-field-dash-id";
    id.textContent = "field · " + fid;
    head.appendChild(id);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "flow-field-dash-grid";

    const mkCell = (lab, el) => {
      const box = document.createElement("div");
      box.className = "flow-field-dash-cell";
      const l = document.createElement("div");
      l.className = "flow-field-dash-lab";
      l.textContent = lab;
      box.appendChild(l);
      box.appendChild(el);
      return box;
    };

    const labInp = document.createElement("input");
    labInp.className = "cell-input";
    labInp.value = f.label || "";
    labInp.addEventListener("change", () => {
      f.label = labInp.value;
      persistContentField();
      if (onChange) onChange();
    });
    grid.appendChild(mkCell("label", labInp));

    const typeWrap = document.createElement("div");
    typeWrap.appendChild(
      createTypeSelect(f, () => {
        if (onChange) onChange();
      })
    );
    grid.appendChild(mkCell("type", typeWrap));

    const defWrap = document.createElement("div");
    defWrap.className = "flow-field-dash-default";
    defWrap.appendChild(
      createDefaultControl(f, () => {
        if (onChange) onChange();
      })
    );
    grid.appendChild(mkCell("default", defWrap));

    card.appendChild(grid);

    const statusRow = document.createElement("div");
    statusRow.className = "flow-field-dash-status";
    const statusLab = document.createElement("div");
    statusLab.className = "flow-field-dash-lab";
    statusLab.textContent = "狀態";
    statusRow.appendChild(statusLab);

    const detailHost = document.createElement("div");
    detailHost.className = "flow-field-dash-detail";
    let openKey = null;
    const chipsApi = createFieldRuleChips(f, {
      activeKey: null,
      onSelect: (key, wasActive) => {
        if (wasActive || openKey === key) {
          openKey = null;
          detailHost.replaceChildren();
          detailHost.hidden = true;
          chipsApi.setActive(null);
          return;
        }
        openKey = key;
        detailHost.hidden = false;
        chipsApi.setActive(key);
        chipsApi.openDetail(key, detailHost, () => {
          if (onChange) onChange();
        });
      },
    });
    statusRow.appendChild(chipsApi.el);
    card.appendChild(statusRow);
    card.appendChild(detailHost);

    return card;
  }

  function appendFlowFieldMetaChip(chips, text, on) {
    const c = document.createElement("span");
    c.className = "flow-node-chip" + (on ? " on" : "");
    c.textContent = text;
    chips.appendChild(c);
  }

  /** 流程圖欄位節點：除顯示名稱外，type／default／規則皆為橢圓燈號 */
  function appendFlowFieldMetaChips(host, f) {
    const chips = document.createElement("div");
    chips.className = "flow-node-chips";
    appendFlowFieldMetaChip(chips, fieldTypeLabel(f.type), true);
    const defPrev = fieldDefaultPreview(f);
    appendFlowFieldMetaChip(
      chips,
      "default：" + defPrev,
      defPrev !== "—"
    );
    getFieldRuleChipDefs(f).forEach((def) => {
      appendFlowFieldMetaChip(chips, def.label(), def.on());
    });
    if ((f.type || "text") === "dropdown") {
      appendFlowFieldMetaChip(chips, "可空白", !!f.allow_blank);
      appendFlowFieldMetaChip(chips, "可手填", !!f.allow_manual);
    }
    host.appendChild(chips);
  }

  function createFieldRulesPanel(fid, f, opts = {}) {
    ensureContentField(f);
    const panel = document.createElement("div");
    panel.className = "field-rules field-rules-dash compact-panel";
    const detail = document.createElement("div");
    detail.className = "dash-detail";
    const key = opts.initialKey || "required";
    const defs = getFieldRuleChipDefs(f);
    const def = defs.find((d) => d.key === key) || defs[0];
    const title = document.createElement("div");
    title.className = "dash-detail-title";
    title.textContent = def.title;
    detail.appendChild(title);
    detail.appendChild(
      def.build(() => {
        if (opts.onChange) opts.onChange();
      })
    );
    panel.appendChild(detail);
    return panel;
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
    const tipTop = document.createElement("p");
    tipTop.className = "list-tip";
    tipTop.textContent =
      "點「申請」會複製當下表單設計成獨立申請單再填寫；之後改設計不會改到已開出的單。";
    wrap.appendChild(tipTop);
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
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.appendChild(table);
    wrap.appendChild(scroll);
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
      persistDesign(id, d);
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
    const bLib = document.createElement("button");
    bLib.type = "button";
    bLib.className = "table-btn";
    bLib.textContent = "B 下拉選項庫";
    bLib.title = "管理共用下拉清單（AB 連動）";
    bLib.addEventListener("click", () => {
      appNav.designLayer = "lists";
      persistNav();
      renderApp();
    });
    head.appendChild(bLib);
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
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.appendChild(table);
    wrap.appendChild(scroll);
    const tip = document.createElement("p");
    tip.className = "list-tip";
    tip.textContent =
      "A＝表單設計；B＝下拉選項庫（帳號可讀）。欄位⋯可選共用清單；公司來源請在 B item 設 readers。";
    wrap.appendChild(tip);
    stage.appendChild(wrap);
  }

  function renderOptionListsPage() {
    const stage = els.form;
    stage.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "list-stage list-stage-light";
    wrap.appendChild(
      renderBackBar("表單列表", () => {
        appNav.designLayer = "list";
        persistNav();
        renderApp();
      })
    );
    const head = document.createElement("div");
    head.className = "list-head";
    const h = document.createElement("h2");
    h.className = "list-title";
    h.textContent = "B Form｜下拉選項庫";
    head.appendChild(h);
    const acc = document.createElement("button");
    acc.type = "button";
    acc.className = "table-btn";
    acc.textContent = "帳號：" + currentAccount();
    acc.addEventListener("click", () => {
      const next = prompt("目前帳號（決定可讀／可管的 B 清單）", currentAccount());
      if (!next) return;
      setCurrentAccount(next.trim());
      renderOptionListsPage();
    });
    head.appendChild(acc);
    wrap.appendChild(head);

    const tip = document.createElement("p");
    tip.className = "list-tip";
    tip.textContent =
      "每個清單是一個 B item：owner 可編；readers 可讀。A 表單下拉欄位用 options_ref 連過來。";
    wrap.appendChild(tip);

    const table = document.createElement("table");
    table.className = "mgmt-table";
    table.innerHTML =
      "<thead><tr><th>名稱</th><th>owner</th><th>readers</th><th>項數</th><th></th></tr></thead>";
    const tb = document.createElement("tbody");
    const account = currentAccount();
    optionLists
      .filter((l) => canReadOptionList(l, account))
      .forEach((list) => {
        const tr = document.createElement("tr");
        [
          list.title,
          list.owner,
          (list.readers || []).join(", ") || "—",
          String((list.items || []).length),
        ].forEach((t) => {
          const td = document.createElement("td");
          td.textContent = t;
          tr.appendChild(td);
        });
        const td = document.createElement("td");
        if (canEditOptionList(list, account)) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "table-btn";
          edit.textContent = "編輯";
          edit.addEventListener("click", () => {
            editOptionListItem(list, () => {
              persistOptionLists();
              renderOptionListsPage();
            });
          });
          td.appendChild(edit);
        } else {
          td.textContent = "唯讀";
          td.className = "muted-cell";
        }
        tr.appendChild(td);
        tb.appendChild(tr);
      });
    table.appendChild(tb);
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.appendChild(table);
    wrap.appendChild(scroll);

    const add = document.createElement("button");
    add.type = "button";
    add.className = "table-btn primary";
    add.textContent = "＋ 新建清單";
    add.addEventListener("click", () => {
      const title = prompt("清單名稱", "新下拉清單");
      if (!title) return;
      const list = {
        list_id: "list_" + Date.now().toString(36),
        title,
        owner: account,
        readers: [],
        items: [
          { value: "選項1", label: "選項1" },
          { value: "選項2", label: "選項2" },
        ],
        updated_at: nowStamp(),
      };
      optionLists.unshift(list);
      persistOptionLists();
      editOptionListItem(list, () => {
        persistOptionLists();
        renderOptionListsPage();
      });
      renderOptionListsPage();
    });
    const actions = document.createElement("div");
    actions.className = "table-actions";
    actions.appendChild(add);
    wrap.appendChild(actions);
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

    // 基本（表頭英文；說明中文）
    const metaTable = document.createElement("table");
    metaTable.className = "mgmt-table edit-table";
    metaTable.innerHTML =
      "<thead><tr><th>field</th><th>value</th></tr></thead>";
    const mtb = document.createElement("tbody");
    const metaFields = [
      ["title", "title", false],
      ["creator", "creator", false],
      ["location", "location", true],
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
        persistDesign(doc.meta.form_id, doc);
      });
      td.appendChild(inp);
      tr.appendChild(th);
      tr.appendChild(td);
      mtb.appendChild(tr);
    });
    metaTable.appendChild(mtb);
    wrap.appendChild(sectionBlock("基本資料", metaTable));

    // 流程設計（唯一入口：Scope 流程圖）
    let previewRole = appNav.designPreviewRole || "design";
    const roleBar = document.createElement("div");
    roleBar.className = "flow-role-bar";
    const roleLab = document.createElement("span");
    roleLab.className = "flow-role-bar-lab";
    roleLab.textContent = "預覽角色：";
    roleBar.appendChild(roleLab);
    [
      ["design", "設計"],
      ["requester", "申請人"],
      ["approver", "簽核人"],
      ["cc", "副本／知會"],
    ].forEach(([id, label]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "table-btn flow-role-btn" + (previewRole === id ? " primary" : "");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        appNav.designPreviewRole = id;
        persistNav();
        renderDesignEdit();
      });
      roleBar.appendChild(btn);
    });
    wrap.appendChild(roleBar);

    const flowNote = document.createElement("p");
    flowNote.className = "sec-note";
    flowNote.textContent =
      "綠色＝人員（點圓圈內 +欄/+人/+動作/+信/+Scope）；藍色＝動作／通知箭頭。欄位點方塊 → 下方儀表板。不能操作的在預覽角色下會變灰。";
    wrap.appendChild(flowNote);

    const fieldEditorHost = document.createElement("div");
    fieldEditorHost.className = "flow-field-editor-host design-flow-editor";
    fieldEditorHost.hidden = true;
    const mailEditorHost = document.createElement("div");
    mailEditorHost.className = "mail-flow-editor-host design-flow-editor";
    mailEditorHost.hidden = true;

    const editorBus = {
      active: null,
      closeAll() {
        fieldEditorHost.hidden = true;
        fieldEditorHost.replaceChildren();
        mailEditorHost.hidden = true;
        mailEditorHost.replaceChildren();
        editorBus.active = null;
      },
    };

    const scopesWrap = document.createElement("div");
    scopesWrap.className = "design-scopes";

    (doc.approval?.columns || []).forEach((col) => {
      ensureApprovalColumn(col);
      const block = document.createElement("section");
      block.className = "design-scope-block";
      const head = document.createElement("div");
      head.className = "design-scope-head";
      const title = document.createElement("h3");
      const lv = Number(col.level);
      title.textContent =
        (lv === 0 ? "Submit" : "L" + lv) +
        " · " +
        (col.label || col.id || "Scope");
      head.appendChild(title);
      if (lv > 0) {
        const appr = document.createElement("input");
        appr.className = "cell-input scope-appr-input";
        appr.placeholder = "預設 Approver";
        appr.value = col.person?.name || col.stamp?.name || "";
        appr.addEventListener("change", () => {
          if (!col.person) col.person = { id: "", name: "" };
          col.person.name = appr.value;
          if (!col.stamp) col.stamp = {};
          col.stamp.name = appr.value;
          persistDesign(doc.meta.form_id, doc);
        });
        head.appendChild(appr);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "table-btn danger";
        del.textContent = "刪除 Scope";
        del.addEventListener("click", () => {
          if (!confirm(`刪除 ${col.label || col.id}？`)) return;
          doc.approval.columns = (doc.approval.columns || []).filter(
            (c) => c.id !== col.id
          );
          renumberApprovalSteps(doc);
          persistDesign(doc.meta.form_id, doc);
          renderDesignEdit();
        });
        head.appendChild(del);
      }
      block.appendChild(head);
      block.appendChild(
        createStageMailPanel(col, {
          previewRole,
          fieldEditorHost,
          mailEditorHost,
          editorBus,
        })
      );
      scopesWrap.appendChild(block);
    });

    wrap.appendChild(scopesWrap);

    const editorDock = document.createElement("section");
    editorDock.className = "design-flow-editor-dock";
    const dockTitle = document.createElement("h3");
    dockTitle.textContent = "編輯面板（欄位儀表板／人員／動作／通知信）";
    editorDock.appendChild(dockTitle);
    editorDock.appendChild(fieldEditorHost);
    editorDock.appendChild(mailEditorHost);
    wrap.appendChild(editorDock);

    const scopeActions = document.createElement("div");
    scopeActions.className = "table-actions";
    const addScope = document.createElement("button");
    addScope.type = "button";
    addScope.className = "table-btn";
    addScope.textContent = "＋ 新增簽核 Scope";
    addScope.addEventListener("click", () => {
      if (!doc.approval) doc.approval = { title: "簽核", columns: [] };
      if (!doc.approval.columns) doc.approval.columns = [];
      const nextLv =
        Math.max(
          0,
          ...doc.approval.columns.map((c) => Number(c.level) || 0)
        ) + 1;
      const label =
        prompt("Scope 名稱（Display name）", `簽核 ${nextLv}`) ||
        `簽核 ${nextLv}`;
      const fullName = prompt("預設 Approver（完整姓名）", "") || "";
      doc.approval.columns.push(
        ensureApprovalColumn({
          id: `step_${nextLv}`,
          label,
          level: nextLv,
          role: `approver_${nextLv}`,
          editable: true,
          person: { id: "", name: fullName },
          stamp: {
            name: fullName,
            mark: null,
            time: null,
            comment: "",
            pending: true,
          },
          stage_notify: { people: [], groups: [], emails: [] },
          pass_rule: "all",
        })
      );
      renumberApprovalSteps(doc);
      persistDesign(doc.meta.form_id, doc);
      renderDesignEdit();
    });
    scopeActions.appendChild(addScope);
    wrap.appendChild(scopeActions);

    const saveNote = document.createElement("p");
    saveNote.className = "list-tip";
    saveNote.textContent =
      "變更即寫入本機設計檔。欄位定義在 fields JSON；流程在 approval.columns[].mail_board。";
    wrap.appendChild(saveNote);
    stage.appendChild(wrap);
  }

  function sectionBlock(title, node) {
    const sec = document.createElement("section");
    sec.className = "design-section";
    const h = document.createElement("h3");
    h.textContent = title;
    sec.appendChild(h);
    if (node && node.tagName === "TABLE") {
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      wrap.appendChild(node);
      sec.appendChild(wrap);
    } else {
      sec.appendChild(node);
    }
    return sec;
  }

  function renderApp() {
    const tab = appNav.tab || "apply";
    view = tab === "apply" || tab === "design" ? "form" : tab;
    els.form.hidden = !(tab === "apply" || tab === "design");
    if (els.alr5) els.alr5.hidden = tab !== "alr5";
    renderTabs();
    if (tab === "apply") {
      if (appNav.applyLayer === "doc") renderForm();
      else renderApplyList();
    } else if (tab === "design") {
      if (appNav.designLayer === "edit") renderDesignEdit();
      else if (appNav.designLayer === "lists") renderOptionListsPage();
      else renderDesignList();
    } else if (tab === "alr5") {
      renderAlr5Guide();
    }
  }

  function switchView(next) {
    if (next === "apply") {
      appNav.tab = "apply";
      appNav.applyLayer = "list";
      appNav.editingDocId = null;
    } else if (next === "design") {
      appNav.tab = "design";
      appNav.designLayer = "list";
    } else if (next === "form") {
      appNav.tab = "apply";
      appNav.applyLayer = "list";
      appNav.editingDocId = null;
    } else if (next === "json") {
      // 舊導覽：JSON 分頁已移除
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

  function ensureDocShape(d) {
    const base = clone(EMBEDDED_DOC);
    if (!d.meta) d.meta = base.meta;
    if (!d.meta.kind) {
      d.meta.kind = d.meta.doc_id ? "application" : "form_design";
    }
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
    ensureMailTemplates(d);
    migrateStepIds(d);
    (d.approval?.columns || []).forEach(ensureApprovalColumn);
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
    Object.keys(d.fields || {}).forEach((fid) => {
      if (!d.fields[fid].kind || d.fields[fid].kind === "content") {
        ensureContentField(d.fields[fid]);
      }
    });
    if (d.meta.kind === "application") {
      if (!d.system.doc_no || !/\.\d+$/.test(d.system.doc_no)) {
        d.system.doc_version = d.system.doc_version || 1;
        d.system.doc_no = makeDocNo(
          d.fields?.applicant?.value,
          new Date(),
          d.system.doc_version,
          d.meta?.system_name
        );
      }
    }
    return d;
  }

  async function boot() {
    let seedDesign = null;
    try {
      const res = await fetch("./document.json?v=design22", {
        cache: "no-store",
      });
      if (res.ok) seedDesign = await res.json();
    } catch {
      /* offline */
    }
    try {
      const sr = await fetch("./alr5-standard.json?v=design22", {
        cache: "no-store",
      });
      if (sr.ok) alr5Standard = await sr.json();
    } catch {
      /* offline */
    }
    try {
      const mr = await fetch("./ALR5標準互通.md?v=design22", {
        cache: "no-store",
      });
      if (mr.ok) alr5Markdown = await mr.text();
    } catch {
      alr5Markdown = "";
    }

    loadNav();
    docsIndex = loadDocsIndex();
    optionLists = loadOptionLists() || defaultOptionLists();
    persistOptionLists();
    const catalogSeed = seedDesign || EMBEDDED_DOC;
    formsCatalog = loadFormsCatalog() || defaultCatalogFromDoc(catalogSeed);
    persistFormsCatalog();

    // 為目錄內每個 form 確保有設計檔（不與申請單共用）
    formsCatalog.forEach((f) => {
      if (!loadDesign(f.form_id)) {
        let d;
        if (f.form_id === (catalogSeed.meta?.form_id || "leave_request_v1") && seedDesign) {
          d = clone(seedDesign);
          d.meta = { ...d.meta, kind: "form_design", form_id: f.form_id };
        } else if (f.form_id === (EMBEDDED_DOC.meta?.form_id || "leave_request_v1")) {
          d = clone(EMBEDDED_DOC);
          d.meta = { ...d.meta, kind: "form_design", form_id: f.form_id };
        } else {
          d = makeBlankForm(f.form_id, f.title, f.creator);
        }
        // 示範：假別連到 B 清單
        if (d.fields?.leave_type && getOptionList("list_leave_types")) {
          d.fields.leave_type.options_ref = "list_leave_types";
          d.fields.leave_type.options = normalizeOptions(
            getOptionList("list_leave_types").items
          );
        }
        persistDesign(f.form_id, ensureDocShape(d));
      }
    });

    document.documentElement.lang = "zh-Hant";
    document.title = "Approval｜ALR5";
    if (!appNav.tab || appNav.tab === "form" || appNav.tab === "json") {
      appNav.tab = "apply";
    }
    if (appNav.tab === "apply") appNav.applyLayer = appNav.applyLayer || "list";

    if (appNav.tab === "design" && appNav.designLayer === "edit" && appNav.editingFormId) {
      const d = loadDesign(appNav.editingFormId);
      if (d) {
        doc = ensureDocShape(d);
        resetOpenedSnapshot();
      } else {
        appNav.designLayer = "list";
        doc = ensureDocShape(clone(EMBEDDED_DOC));
      }
    } else if (appNav.tab === "apply" && appNav.applyLayer === "doc" && appNav.editingDocId) {
      const d = loadApplication(appNav.editingDocId);
      if (d) {
        doc = ensureDocShape(d);
        resetOpenedSnapshot();
      } else {
        appNav.applyLayer = "list";
        appNav.editingDocId = null;
        doc = ensureDocShape(clone(EMBEDDED_DOC));
      }
    } else {
      // 列表層：記憶體中先放一份設計（不當申請單寫入）
      const firstId = formsCatalog[0]?.form_id;
      doc = ensureDocShape(
        firstId ? ensureDesignForForm(firstId) : clone(EMBEDDED_DOC)
      );
    }

    persistNav();
    renderApp();
  }

  boot();
})();
