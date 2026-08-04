/**
 * Approval 純對話引擎
 * - 不要獨立表單／流水線畫面
 * - 欄位與簽核融入對話框；每框可輸入內容由 schema 白名單設定
 * - 雙層儲存 shared / personal(userId) 仍保留
 */

const STORAGE_PREFIX = "approval.v2";

const DIRECTORY = {
  u_ming: {
    user_id: "u_ming",
    name: "王小明",
    title: "工程師",
    dept: "資訊部",
    mail: "ming@example.com",
    phone: "0912-000-111",
    roles: ["applicant", "owner"],
  },
  u_mei: {
    user_id: "u_mei",
    name: "陳美玲",
    title: "工程師",
    dept: "資訊部",
    mail: "mei@example.com",
    phone: "0912-000-222",
    roles: ["agent"],
  },
  u_lin: {
    user_id: "u_lin",
    name: "林主管",
    title: "課長",
    dept: "資訊部",
    mail: "lin@example.com",
    phone: "0912-000-333",
    roles: ["approver"],
  },
  u_yen: {
    user_id: "u_yen",
    name: "嚴協理",
    title: "協理",
    dept: "資訊部",
    mail: "yen@example.com",
    phone: "0912-000-444",
    roles: ["approver"],
  },
  u_guest: {
    user_id: "u_guest",
    name: "訪客阿華",
    title: "外包",
    dept: "外部",
    mail: "guest@example.com",
    phone: "0912-000-999",
    roles: [],
  },
};

const Store = {
  sharedKey(formId) {
    return `${STORAGE_PREFIX}.shared.${formId}`;
  },
  personalKey(userId, formId) {
    return `${STORAGE_PREFIX}.personal.${userId}.${formId}`;
  },
  sessionKey() {
    return `${STORAGE_PREFIX}.session`;
  },
  loadShared(formId) {
    try {
      return JSON.parse(localStorage.getItem(this.sharedKey(formId)) || "null");
    } catch {
      return null;
    }
  },
  saveShared(formId, data) {
    localStorage.setItem(this.sharedKey(formId), JSON.stringify(data));
  },
  loadPersonal(userId, formId) {
    try {
      return JSON.parse(
        localStorage.getItem(this.personalKey(userId, formId)) || "{}"
      );
    } catch {
      return {};
    }
  },
  savePersonal(userId, formId, data) {
    localStorage.setItem(
      this.personalKey(userId, formId),
      JSON.stringify(data)
    );
  },
  loadSession() {
    try {
      return JSON.parse(localStorage.getItem(this.sessionKey()) || "null");
    } catch {
      return null;
    }
  },
  saveSession(session) {
    localStorage.setItem(this.sessionKey(), JSON.stringify(session));
  },
  resetAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },
};

function personName(id) {
  return DIRECTORY[id]?.name || id || "（未指定）";
}

function nowLabel() {
  const n = new Date();
  return `${n.getHours().toString().padStart(2, "0")}:${n
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2200);
}

function maybeTeamsNotify(enabled, title, body) {
  if (!enabled) return;
  console.info("[Teams stub]", title, body);
  showToast(`Teams 通知：${title}`);
}

function defaultShared(schema) {
  const bound = schema.conversation?.default_bound_fields || [
    "leave_type",
    "days",
  ];
  return {
    form_id: schema.form_id,
    status: "draft",
    values: {
      applicant: "u_ming",
      leave_type: "事假",
      days: 1,
      need_cover: "yes",
      agent: "u_mei",
    },
    signature: {
      applicant: "u_ming",
      agent: "u_mei",
      approvers: ["u_lin", "u_yen"],
      current_index: 0,
      done: [],
    },
    // 對話即主畫面：訊息框可帶 fields／approver 槽
    messages: [
      {
        id: "m1",
        kind: "form",
        author_id: "u_ming",
        text: "請幫我簽一下，明天上午請假。",
        at: "17:02",
        bound_fields: bound,
        field_values: {
          leave_type: "事假",
          days: 1,
        },
      },
      {
        id: "m2",
        kind: "approver",
        author_id: "system",
        text: "",
        at: "17:10",
        approver_slot: 0,
        person_id: "u_lin",
        label: "Approver1",
      },
      {
        id: "m3",
        kind: "approver",
        author_id: "system",
        text: "",
        at: "17:10",
        approver_slot: 1,
        person_id: "u_yen",
        label: "Approver2",
      },
      {
        id: "m4",
        kind: "chat",
        author_id: "u_ming",
        text: "有，陳美玲已同意代理。",
        at: "17:12",
        bound_fields: [],
      },
    ],
    notifications: [],
  };
}

function defaultPersonal() {
  return { private_note: "醫生回診（別人看不到）" };
}

function evalWhen(expr, values) {
  if (!expr) return true;
  const m = String(expr).match(
    /^(\w+)\s*(==|!=)\s*(null|yes|no|"[^"]*"|'[^']*'|\w+)$/
  );
  if (!m) return true;
  const [, field, op, raw] = m;
  let expect = raw;
  if (raw === "null") expect = null;
  else if (raw === "yes" || raw === "no") expect = raw;
  else if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    expect = raw.slice(1, -1);
  }
  const actual = values[field] ?? null;
  if (op === "==") return actual === expect;
  if (op === "!=") return actual !== expect;
  return true;
}

function fieldByName(schema, name) {
  return schema.fields.find((f) => f.name === name);
}

function displayValue(schema, name, val) {
  const f = fieldByName(schema, name);
  if (!f) return val ?? "";
  if (f.type === "yes_no") return val === "yes" ? "是" : val === "no" ? "否" : "";
  if (f.type === "person") return personName(val);
  return val ?? "";
}

async function boot() {
  const schema = await fetch("./schema.json").then((r) => {
    if (!r.ok) throw new Error("無法載入 schema.json");
    return r.json();
  });

  // 對話框預設可填欄：假別＋天數（對應附圖「假別／日期」感）
  // days 在 UI 顯示為「日期／天數」標籤可讀性
  const composeBoundDefault = [
    ...(schema.conversation?.default_bound_fields || ["leave_type", "days"]),
  ];

  let session = Store.loadSession() || {
    user_id: "u_ming",
    teams_notify: false,
    compose_bound: composeBoundDefault,
    draft_fields: {},
  };

  let shared = Store.loadShared(schema.form_id) || defaultShared(schema);
  // 相容舊資料：若沒有 approvers 陣列就補
  if (!shared.signature.approvers) {
    shared.signature.approvers = [
      shared.signature.approver || "u_lin",
      "u_yen",
    ];
    shared.signature.current_index = 0;
  }

  const personalCache = {};

  function currentUser() {
    return DIRECTORY[session.user_id] || DIRECTORY.u_guest;
  }

  function viewerRoles() {
    const u = currentUser();
    const roles = new Set(u.roles || []);
    if (shared.values.applicant === u.user_id) {
      roles.add("applicant");
      roles.add("owner");
    }
    if (shared.signature.agent === u.user_id) roles.add("agent");
    if (shared.signature.approvers?.includes(u.user_id)) roles.add("approver");
    return roles;
  }

  function loadPersonalFor(userId) {
    if (!personalCache[userId]) {
      const saved = Store.loadPersonal(userId, schema.form_id);
      personalCache[userId] =
        saved || (userId === "u_ming" ? defaultPersonal() : {});
    }
    return personalCache[userId];
  }

  function persist() {
    const sharedValues = {};
    schema.fields.forEach((f) => {
      if (f.storage === "shared" && shared.values[f.name] !== undefined) {
        sharedValues[f.name] = shared.values[f.name];
      }
    });
    Store.saveShared(schema.form_id, { ...shared, values: sharedValues });

    const mine = {};
    schema.fields.forEach((f) => {
      if (f.storage === "personal") {
        const p = loadPersonalFor(session.user_id);
        if (p[f.name] !== undefined) mine[f.name] = p[f.name];
      }
    });
    Store.savePersonal(session.user_id, schema.form_id, mine);
    Store.saveSession(session);
  }

  function approverStatus(slot) {
    const done = shared.signature.done || [];
    const key = `approver_${slot}`;
    if (shared.status === "approved") return "done";
    if (shared.status === "denied") return "denied";
    if (done.includes(key) || done.includes(`approver:${slot}`)) return "done";
    if (shared.status === "pending" && shared.signature.current_index === slot) {
      return "current";
    }
    if (shared.status === "draft" || shared.status === "returned") return "waiting_submit";
    if (shared.signature.current_index < slot) return "waiting_prev";
    return "waiting";
  }

  function statusLabel(st) {
    switch (st) {
      case "done":
        return "已簽核";
      case "current":
        return "待您簽核";
      case "waiting_submit":
        return "等待申請人送出";
      case "waiting_prev":
        return "等待前關簽完";
      case "denied":
        return "已駁回";
      default:
        return "等待中";
    }
  }

  // —— sheets ——
  const sheet = document.getElementById("sheet");
  const profile = document.getElementById("profile");
  const pickPerson = document.getElementById("pick-person");

  function openSheet(title, desc, actions) {
    document.getElementById("sheet-title").textContent = title;
    document.getElementById("sheet-desc").textContent = desc;
    const ul = document.getElementById("sheet-actions");
    ul.innerHTML = "";
    actions.forEach(({ label, run }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.onclick = () => {
        sheet.classList.add("hidden");
        run();
      };
      li.appendChild(btn);
      ul.appendChild(li);
    });
    sheet.classList.remove("hidden");
  }

  function openProfile(userId) {
    const p = DIRECTORY[userId];
    if (!p) return;
    document.getElementById("profile-title").textContent = p.name;
    document.getElementById("profile-body").innerHTML = `
      <dt>職稱</dt><dd>${p.title}</dd>
      <dt>單位</dt><dd>${p.dept}</dd>
      <dt>信箱</dt><dd>${p.mail}</dd>
      <dt>電話</dt><dd>${p.phone}</dd>
      <dt>user_id</dt><dd>${p.user_id}</dd>
    `;
    profile.classList.remove("hidden");
  }

  function openPickPerson(title, desc, onPick) {
    document.getElementById("pick-title").textContent = title;
    document.getElementById("pick-desc").textContent = desc;
    const list = document.getElementById("pick-list");
    list.innerHTML = "";
    Object.values(DIRECTORY).forEach((p) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${p.name}（${p.title}）`;
      btn.onclick = () => {
        pickPerson.classList.add("hidden");
        onPick(p.user_id);
      };
      li.appendChild(btn);
      list.appendChild(li);
    });
    pickPerson.classList.remove("hidden");
  }

  document.getElementById("sheet-close").onclick = () =>
    sheet.classList.add("hidden");
  document.getElementById("profile-close").onclick = () =>
    profile.classList.add("hidden");
  document.getElementById("pick-close").onclick = () =>
    pickPerson.classList.add("hidden");

  function canEditField(field) {
    const roles = viewerRoles();
    if (field.storage === "personal" && !roles.has("owner")) return false;
    if (!["draft", "returned"].includes(shared.status) && field.storage === "shared") {
      // 已送出後共用欄唯讀（簽核動作另開）
      return false;
    }
    const editors = field.editable_by || [];
    if (editors.includes("owner") && roles.has("owner")) return true;
    return editors.some((r) => roles.has(r));
  }

  function chipLabel(field) {
    if (field.name === "days") return "日期／天數：";
    return `${field.display_name}：`;
  }

  function renderFieldChip(field, value, { editable, onChange }) {
    const row = document.createElement("div");
    row.className =
      "field-chip" + (field.storage === "personal" ? " personal" : "");
    const lab = document.createElement("label");
    lab.textContent = chipLabel(field);
    row.appendChild(lab);

    if (!editable) {
      const span = document.createElement("span");
      span.className = "value";
      span.textContent = displayValue(schema, field.name, value);
      row.appendChild(span);
      return row;
    }

    let input;
    if (field.type === "dropdown" || field.type === "yes_no") {
      input = document.createElement("select");
      const opts =
        field.type === "yes_no" ? ["yes", "no"] : field.options || [];
      opts.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent =
          field.type === "yes_no" ? (o === "yes" ? "是" : "否") : o;
        if (String(value) === String(o)) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (field.type === "person") {
      input = document.createElement("select");
      Object.values(DIRECTORY).forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.user_id;
        opt.textContent = p.name;
        if (value === p.user_id) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (field.type === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.value = value ?? "";
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value ?? "";
    }
    input.addEventListener("change", () => {
      const next =
        field.type === "number" ? Number(input.value) : input.value;
      onChange(next);
    });
    row.appendChild(input);
    return row;
  }

  function openApproverMenu(msg) {
    const slot = msg.approver_slot;
    const personId = shared.signature.approvers[slot] || msg.person_id;
    const st = approverStatus(slot);
    const roles = viewerRoles();
    const actions = [
      {
        label: "查看個人資料",
        run: () => openProfile(personId),
      },
      {
        label: "更換簽核人",
        run: () =>
          openPickPerson("更換簽核人", `更換 ${msg.label}`, (id) => {
            shared.signature.approvers[slot] = id;
            msg.person_id = id;
            persist();
            render();
            showToast(`已改為 ${personName(id)}`);
            maybeTeamsNotify(
              session.teams_notify,
              "請簽通知",
              `請 ${personName(id)} 簽核`
            );
          }),
      },
    ];

    if (
      roles.has("approver") &&
      personId === session.user_id &&
      st === "current"
    ) {
      actions.unshift(
        {
          label: "核准",
          run: () => {
            const done = new Set(shared.signature.done || []);
            done.add(`approver_${slot}`);
            shared.signature.done = [...done];
            if (slot >= shared.signature.approvers.length - 1) {
              shared.status = "approved";
              shared.signature.current_index = slot;
            } else {
              shared.signature.current_index = slot + 1;
            }
            persist();
            render();
            showToast(shared.status === "approved" ? "全部核准完成" : "已核准，下一關");
            maybeTeamsNotify(session.teams_notify, "簽核進度", statusText());
          },
        },
        {
          label: "駁回",
          run: () => {
            shared.status = "denied";
            persist();
            render();
            showToast("已駁回");
            maybeTeamsNotify(session.teams_notify, "已駁回", schema.title);
          },
        },
        {
          label: "退回申請人",
          run: () => {
            shared.status = "returned";
            shared.signature.current_index = 0;
            shared.signature.done = [];
            persist();
            render();
            showToast("已退回");
            maybeTeamsNotify(session.teams_notify, "申請已退回", "請修改後再送");
          },
        }
      );
    }

    actions.push({
      label: "發通知請簽",
      run: () => {
        shared.notifications.push({
          at: new Date().toISOString(),
          to: personId,
          kind: "please_sign",
        });
        persist();
        maybeTeamsNotify(
          session.teams_notify,
          "請協助簽核",
          `${schema.title} 待您簽核`
        );
        showToast(`已通知 ${personName(personId)}`);
      },
    });

    openSheet(
      `${msg.label}：${personName(personId)}`,
      `狀態：${statusLabel(st)}（點框即可操作，無獨立流水線畫面）`,
      actions
    );
  }

  function statusText() {
    return `狀態 ${shared.status}`;
  }

  function renderLogin() {
    const sel = document.getElementById("login-select");
    sel.innerHTML = "";
    Object.values(DIRECTORY).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.user_id;
      opt.textContent = p.name;
      if (p.user_id === session.user_id) opt.selected = true;
      sel.appendChild(opt);
    });
    document.getElementById("teams-notify").checked = !!session.teams_notify;
    document.getElementById("status-chip").textContent = shared.status;
    document.getElementById("main-sub").textContent =
      `登入：${currentUser().name} · ${statusText()}`;
  }

  function renderMessages() {
    const boxes = document.getElementById("boxes");
    boxes.innerHTML = "";
    const me = session.user_id;
    const roles = viewerRoles();

    shared.messages.forEach((m) => {
      if (m.kind === "approver") {
        const article = document.createElement("article");
        article.className = "box approver";
        const personId =
          shared.signature.approvers[m.approver_slot] || m.person_id;
        const st = approverStatus(m.approver_slot);
        article.innerHTML = `<header><strong>簽核槽</strong><time>${m.at}</time></header>`;
        const wrap = document.createElement("div");
        wrap.className = "approver-row";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `approver-chip ${st}`;
        btn.innerHTML = `<span>${m.label}：${personName(personId)}</span><span class="wait">（${statusLabel(st)}）</span>`;
        btn.onclick = () => openApproverMenu(m);
        wrap.appendChild(btn);
        article.appendChild(wrap);
        boxes.appendChild(article);
        return;
      }

      const article = document.createElement("article");
      article.className = "box" + (m.author_id === me ? " me" : "");
      article.innerHTML = `<header><strong>${personName(m.author_id)}</strong><time>${m.at}</time></header>`;
      if (m.text) {
        const p = document.createElement("p");
        p.textContent = m.text;
        article.appendChild(p);
      }

      const bound = m.bound_fields || [];
      if (bound.length || m.kind === "form") {
        const chips = document.createElement("div");
        chips.className = "field-chips";
        const names = bound.length
          ? bound
          : schema.conversation?.default_bound_fields || [];
        names.forEach((name) => {
          const field = fieldByName(schema, name);
          if (!field) return;
          if (field.storage === "personal" && !roles.has("owner")) return;
          // visible_when
          const values = { ...shared.values, ...(m.field_values || {}) };
          if (field.visible_when && !evalWhen(field.visible_when, values)) return;

          let value;
          if (field.storage === "personal") {
            value = loadPersonalFor(session.user_id)[field.name];
          } else {
            value =
              m.field_values?.[field.name] ?? shared.values[field.name] ?? "";
          }

          const editable =
            m.author_id === me &&
            canEditField(field) &&
            ["draft", "returned"].includes(shared.status);

          chips.appendChild(
            renderFieldChip(field, value, {
              editable,
              onChange: (next) => {
                if (field.storage === "personal") {
                  loadPersonalFor(session.user_id)[field.name] = next;
                } else {
                  shared.values[field.name] = next;
                  m.field_values = m.field_values || {};
                  m.field_values[field.name] = next;
                  if (field.name === "agent") shared.signature.agent = next;
                }
                persist();
                render();
              },
            })
          );
        });

        // owner 的 form 框可多顯示 personal（仍在對話框內）
        if (
          m.kind === "form" &&
          m.author_id === shared.values.applicant &&
          roles.has("owner")
        ) {
          schema.fields
            .filter((f) => f.storage === "personal")
            .forEach((field) => {
              const value = loadPersonalFor(session.user_id)[field.name] ?? "";
              chips.appendChild(
                renderFieldChip(field, value, {
                  editable: canEditField(field),
                  onChange: (next) => {
                    loadPersonalFor(session.user_id)[field.name] = next;
                    persist();
                    render();
                  },
                })
              );
            });
        }

        if (chips.childNodes.length) article.appendChild(chips);
      }

      // 申請人送出按鈕掛在自己的 form 框
      if (
        m.kind === "form" &&
        roles.has("applicant") &&
        m.author_id === me &&
        ["draft", "returned"].includes(shared.status)
      ) {
        const actions = document.createElement("div");
        actions.className = "box-actions";
        const submit = document.createElement("button");
        submit.className = "primary";
        submit.type = "button";
        submit.textContent = "送出簽核";
        submit.onclick = () => {
          shared.status = "pending";
          shared.signature.current_index = 0;
          shared.signature.done = ["applicant"];
          persist();
          render();
          showToast("已送出，等待簽核");
          maybeTeamsNotify(
            session.teams_notify,
            "新申請待簽",
            `${personName(shared.values.applicant)} 送出 ${schema.title}`
          );
        };
        actions.appendChild(submit);
        article.appendChild(actions);
      }

      boxes.appendChild(article);
    });
    boxes.scrollTop = boxes.scrollHeight;
  }

  function renderComposeFields() {
    const wrap = document.getElementById("compose-fields");
    wrap.innerHTML = "";
    const roles = viewerRoles();
    // 只有申請人在 draft/returned 時，新訊息可帶受控欄位
    if (
      !(
        roles.has("applicant") &&
        ["draft", "returned"].includes(shared.status)
      )
    ) {
      return;
    }

    const hint = document.createElement("div");
    hint.className = "field-chip";
    hint.innerHTML =
      "<label>本則可填</label><span class='value'>（白名單欄位，非自由表單）</span>";
    wrap.appendChild(hint);

    (session.compose_bound || []).forEach((name) => {
      const field = fieldByName(schema, name);
      if (!field || field.storage === "personal") return;
      const value =
        session.draft_fields?.[name] ?? shared.values[name] ?? "";
      wrap.appendChild(
        renderFieldChip(field, value, {
          editable: true,
          onChange: (next) => {
            session.draft_fields = session.draft_fields || {};
            session.draft_fields[name] = next;
            shared.values[name] = next;
            Store.saveSession(session);
          },
        })
      );
    });
  }

  function render() {
    renderLogin();
    renderMessages();
    renderComposeFields();
  }

  document.getElementById("login-select").addEventListener("change", (e) => {
    session.user_id = e.target.value;
    loadPersonalFor(session.user_id);
    persist();
    render();
    showToast(`已切換為 ${personName(session.user_id)}`);
  });

  document.getElementById("teams-notify").addEventListener("change", (e) => {
    session.teams_notify = e.target.checked;
    Store.saveSession(session);
    showToast(session.teams_notify ? "已開 Teams 通知模擬" : "已關 Teams 通知模擬");
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    Store.resetAll();
    shared = defaultShared(schema);
    session = {
      user_id: "u_ming",
      teams_notify: false,
      compose_bound: [...composeBoundDefault],
      draft_fields: {},
    };
    personalCache.u_ming = defaultPersonal();
    Store.savePersonal("u_ming", schema.form_id, defaultPersonal());
    persist();
    render();
    showToast("已重設");
  });

  document.getElementById("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("msg");
    const text = input.value.trim();
    if (!text && !Object.keys(session.draft_fields || {}).length) return;

    const roles = viewerRoles();
    const canForm =
      roles.has("applicant") &&
      ["draft", "returned"].includes(shared.status) &&
      (session.compose_bound || []).length;

    const msg = {
      id: `m_${Date.now()}`,
      kind: canForm ? "form" : "chat",
      author_id: session.user_id,
      text,
      at: nowLabel(),
      bound_fields: canForm ? [...(session.compose_bound || [])] : [],
      field_values: canForm ? { ...(session.draft_fields || {}) } : {},
    };

    // 寫回 shared values
    if (canForm) {
      Object.assign(shared.values, session.draft_fields || {});
    }

    shared.messages.push(msg);
    session.draft_fields = {};
    persist();
    input.value = "";
    render();
  });

  if (!Store.loadPersonal("u_ming", schema.form_id)) {
    Store.savePersonal("u_ming", schema.form_id, defaultPersonal());
  }
  persist();
  render();
}

boot().catch((err) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#fff">載入失敗：${err.message}</pre>`;
});
