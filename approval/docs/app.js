/**
 * Approval 本機真引擎（SEED A2–A6）
 * - A1/A2：讀 schema.json 渲染欄位；本機 http.server 開啟
 * - A3：簽名流水線狀態（換人／退回／通知／個人卡）
 * - A4：對話室＋限定欄位白名單
 * - A5：雙層儲存（shared 共用庫 vs personal 依 userId）
 * - A6：登入身分模擬＋可選 Teams 通知 stub
 */

const STORAGE_PREFIX = "approval.v1";
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

/** 雙層儲存：共用庫 vs 個人空間（A5） */
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
    // 刻意不寫入 personal 欄——模擬「別人那邊根本沒有」
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

function defaultShared(schema) {
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
      approver: "u_lin",
      current: "approver",
      done: ["applicant"],
    },
    messages: [
      {
        id: "m1",
        author_id: "u_ming",
        text: "請幫我簽一下，明天上午請假。",
        at: "昨天 17:02",
        bound_fields: ["leave_type", "days"],
      },
      {
        id: "m2",
        author_id: "u_lin",
        text: "代理人確認過了嗎？",
        at: "昨天 17:10",
        bound_fields: ["agent"],
      },
      {
        id: "m3",
        author_id: "u_ming",
        text: "有，陳美玲已同意代理。",
        at: "昨天 17:12",
        bound_fields: [],
      },
    ],
    notifications: [],
  };
}

function defaultPersonal() {
  return { private_note: "醫生回診（別人看不到這格）" };
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

function personName(id) {
  return DIRECTORY[id]?.name || id || "（未指定）";
}

function initial(id) {
  const n = personName(id);
  return n.slice(0, 1);
}

/** Teams 通知 stub（A6 可選） */
function maybeTeamsNotify(enabled, title, body) {
  if (!enabled) return;
  // 之後接 Microsoft Graph：POST /chats/.../messages 或 Activity feed
  console.info("[Teams stub]", title, body);
  const banner = document.getElementById("toast");
  banner.textContent = `Teams 通知：${title} — ${body}`;
  banner.classList.remove("hidden");
  clearTimeout(maybeTeamsNotify._t);
  maybeTeamsNotify._t = setTimeout(() => banner.classList.add("hidden"), 2800);
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2200);
}

async function boot() {
  const schema = await fetch("./schema.json").then((r) => {
    if (!r.ok) throw new Error("無法載入 schema.json，請用本機伺服器開啟（勿用 file://）");
    return r.json();
  });

  let session = Store.loadSession() || {
    user_id: "u_ming",
    teams_notify: false,
    bound_fields: [...(schema.conversation?.default_bound_fields || [])],
  };

  let shared = Store.loadShared(schema.form_id) || defaultShared(schema);
  let personalCache = {}; // userId -> personal values；不混進 shared

  function currentUser() {
    return DIRECTORY[session.user_id] || DIRECTORY.u_guest;
  }

  function viewerRoles() {
    const u = currentUser();
    const roles = new Set(u.roles || []);
    if (shared.values.applicant === u.user_id) roles.add("applicant");
    if (shared.signature.agent === u.user_id) roles.add("agent");
    if (shared.signature.approver === u.user_id) roles.add("approver");
    if (shared.values.applicant === u.user_id) roles.add("owner");
    return roles;
  }

  function loadPersonalFor(userId) {
    if (!personalCache[userId]) {
      personalCache[userId] =
        Store.loadPersonal(userId, schema.form_id) || defaultPersonal();
      // 僅申請人預設有個人備註；別人個人空間預設空
      if (userId !== "u_ming" && !Store.loadPersonal(userId, schema.form_id)) {
        personalCache[userId] = {};
      }
    }
    return personalCache[userId];
  }

  function persist() {
    // shared 只存共用欄
    const sharedValues = {};
    schema.fields.forEach((f) => {
      if (f.storage === "shared" && shared.values[f.name] !== undefined) {
        sharedValues[f.name] = shared.values[f.name];
      }
    });
    const toSave = {
      ...shared,
      values: sharedValues,
    };
    Store.saveShared(schema.form_id, toSave);

    // personal：只寫目前登入者自己的空間
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

  function mergedValues() {
    const base = { ...shared.values, status: shared.status };
    // 只有「自己的」個人欄併入畫面；別人的 personal 根本不讀進 DOM
    const roles = viewerRoles();
    schema.fields.forEach((f) => {
      if (f.storage !== "personal") return;
      const canSee =
        (f.visible_to || []).some((r) => roles.has(r)) ||
        f.visible_to?.includes("owner") && roles.has("owner");
      if (canSee) {
        const p = loadPersonalFor(session.user_id);
        if (p[f.name] !== undefined) base[f.name] = p[f.name];
      }
    });
    return base;
  }

  function fieldVisible(field, values, roles) {
    if (field.visible_when && !evalWhen(field.visible_when, values)) return false;
    const vis = field.visible_to || [];
    if (vis.includes("owner") && roles.has("owner") && field.storage === "personal") {
      return true;
    }
    return vis.some((r) => roles.has(r));
  }

  function fieldEditable(field, values, roles) {
    if (shared.status !== "draft" && field.readonly_when?.includes("status != draft")) {
      return false;
    }
    if (shared.status !== "draft" && ["approve", "deny"].includes(shared.status)) {
      return false;
    }
    const editors = field.editable_by || [];
    if (editors.includes("owner") && roles.has("owner")) return true;
    return editors.some((r) => roles.has(r));
  }

  // —— UI refs ——
  const fieldGrid = document.getElementById("field-grid");
  const signNodes = document.getElementById("sign-nodes");
  const actionRow = document.getElementById("action-row");
  const boxes = document.getElementById("boxes");
  const boundPicker = document.getElementById("bound-picker");
  const loginSelect = document.getElementById("login-select");
  const teamsNotify = document.getElementById("teams-notify");
  const sheet = document.getElementById("sheet");
  const sheetTitle = document.getElementById("sheet-title");
  const sheetDesc = document.getElementById("sheet-desc");
  const sheetActions = document.getElementById("sheet-actions");
  const profile = document.getElementById("profile");
  const pickPerson = document.getElementById("pick-person");

  function openSheet(title, desc, actions) {
    sheetTitle.textContent = title;
    sheetDesc.textContent = desc;
    sheetActions.innerHTML = "";
    actions.forEach(({ label, run }) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        sheet.classList.add("hidden");
        run();
      });
      li.appendChild(btn);
      sheetActions.appendChild(li);
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
      btn.addEventListener("click", () => {
        pickPerson.classList.add("hidden");
        onPick(p.user_id);
      });
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

  function renderLogin() {
    loginSelect.innerHTML = "";
    Object.values(DIRECTORY).forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.user_id;
      opt.textContent = `${p.name}（${p.user_id}）`;
      if (p.user_id === session.user_id) opt.selected = true;
      loginSelect.appendChild(opt);
    });
    teamsNotify.checked = !!session.teams_notify;
    document.getElementById("me-rail").textContent = initial(session.user_id);
  }

  function renderMeta() {
    const u = currentUser();
    const roles = [...viewerRoles()].join("、") || "無角色";
    document.getElementById("form-id-label").textContent = `表單：${schema.form_id}`;
    document.getElementById("paper-title").textContent = schema.title;
    document.getElementById("viewer-role").textContent =
      `登入：${u.name} · 角色：${roles}`;
    document.getElementById("status-label").textContent = shared.status;
    document.getElementById("main-sub").textContent =
      `本機 · 雙層儲存 · 狀態 ${shared.status}`;
    const last = shared.messages[shared.messages.length - 1];
    document.getElementById("sidebar-preview").textContent = last
      ? `${personName(last.author_id)}：${last.text.slice(0, 18)}…`
      : "尚無訊息";
  }

  function renderFields() {
    const values = mergedValues();
    const roles = viewerRoles();
    fieldGrid.innerHTML = "";
    schema.fields.forEach((field) => {
      // personal：只有 owner（申請人本人）畫面才建 DOM——別人那邊沒有這格
      if (field.storage === "personal" && !roles.has("owner")) return;
      if (!fieldVisible(field, values, roles)) return;

      const editable = fieldEditable(field, values, roles);
      const label = document.createElement("label");
      label.className = "field" + (field.storage === "personal" ? " personal" : "");
      label.dataset.name = field.name;

      const span = document.createElement("span");
      span.className = "label";
      span.innerHTML =
        field.display_name +
        (field.storage === "personal" ? " <em>personal</em>" : "");
      label.appendChild(span);

      let input;
      const val =
        field.storage === "personal"
          ? loadPersonalFor(session.user_id)[field.name] ?? ""
          : values[field.name] ?? "";

      if (field.type === "dropdown" || field.type === "yes_no") {
        input = document.createElement("select");
        const opts =
          field.type === "yes_no" ? ["yes", "no"] : field.options || [];
        opts.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o;
          opt.textContent =
            field.type === "yes_no" ? (o === "yes" ? "是" : "否") : o;
          if (String(val) === String(o)) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (field.type === "person") {
        input = document.createElement("select");
        Object.values(DIRECTORY).forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.user_id;
          opt.textContent = p.name;
          if (val === p.user_id) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (field.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = val;
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = val;
      }

      input.disabled = !editable;
      input.addEventListener("change", () => {
        const next =
          field.type === "number" ? Number(input.value) : input.value;
        if (field.storage === "personal") {
          const p = loadPersonalFor(session.user_id);
          p[field.name] = next;
        } else {
          shared.values[field.name] = next;
          if (field.name === "agent") shared.signature.agent = next;
          if (field.name === "applicant") shared.signature.applicant = next;
        }
        persist();
        render();
      });
      label.appendChild(input);
      fieldGrid.appendChild(label);
    });
  }

  function renderSignature() {
    signNodes.innerHTML = "";
    const nodes = schema.signature_line?.nodes || [];
    nodes.forEach((node, idx) => {
      if (idx > 0) {
        const pipe = document.createElement("li");
        pipe.className = "pipe";
        signNodes.appendChild(pipe);
      }
      const userId = shared.signature[node.role];
      const li = document.createElement("li");
      li.className = "node";
      if (shared.signature.done?.includes(node.role)) li.classList.add("done");
      if (shared.signature.current === node.role) li.classList.add("current");
      li.dataset.role = node.role;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "node-btn";
      btn.innerHTML = `
        <span class="avatar-sm">${initial(userId)}</span>
        <span class="name">${personName(userId)}</span>
        <span class="role">${node.label}</span>
      `;
      btn.addEventListener("click", () => openNodeMenu(node, userId));
      li.appendChild(btn);
      signNodes.appendChild(li);
    });
  }

  function openNodeMenu(node, userId) {
    const clicks = node.click || [];
    const actions = [];
    if (clicks.includes("view_profile")) {
      actions.push({
        label: "查看個人資料",
        run: () => openProfile(userId),
      });
    }
    if (clicks.includes("change_agent") || node.role === "agent") {
      actions.push({
        label: "更換代理人",
        run: () =>
          openPickPerson("更換代理人", "選新的代理人", (id) => {
            shared.signature.agent = id;
            shared.values.agent = id;
            shared.values.need_cover = "yes";
            persist();
            render();
            showToast(`代理人改為 ${personName(id)}`);
            maybeTeamsNotify(
              session.teams_notify,
              "代理人已更換",
              `${personName(id)} 成為新代理人`
            );
          }),
      });
    }
    if (clicks.includes("change_approver") || node.role === "approver") {
      actions.push({
        label: "更換簽核人",
        run: () =>
          openPickPerson("更換簽核人", "選新的簽核人", (id) => {
            shared.signature.approver = id;
            shared.signature.current = "approver";
            persist();
            render();
            showToast(`簽核人改為 ${personName(id)}`);
            maybeTeamsNotify(
              session.teams_notify,
              "請簽通知",
              `請 ${personName(id)} 簽核`
            );
          }),
      });
    }
    if (clicks.includes("return")) {
      actions.push({
        label: "退回申請",
        run: () => {
          shared.status = "returned";
          shared.signature.current = "applicant";
          shared.signature.done = [];
          persist();
          render();
          showToast("已退回申請人");
          maybeTeamsNotify(
            session.teams_notify,
            "申請已退回",
            "請申請人修改後再送"
          );
        },
      });
    }
    if (clicks.includes("notify_request")) {
      actions.push({
        label: "發通知請簽",
        run: () => {
          const target = shared.signature.approver;
          shared.notifications.push({
            at: new Date().toISOString(),
            to: target,
            kind: "please_sign",
          });
          persist();
          showToast(`已通知 ${personName(target)} 請簽`);
          maybeTeamsNotify(
            session.teams_notify,
            "請協助簽核",
            `${schema.title} 待您簽核`
          );
        },
      });
    }
    if (!actions.length) {
      actions.push({ label: "查看個人資料", run: () => openProfile(userId) });
    }
    openSheet(
      `${node.label}：${personName(userId)}`,
      "簽名流水線操作（狀態會寫入本機共用庫）",
      actions
    );
  }

  function renderActions() {
    actionRow.innerHTML = "";
    const roles = viewerRoles();
    const mk = (cls, text, id, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.id = id;
      b.textContent = text;
      b.addEventListener("click", onClick);
      actionRow.appendChild(b);
    };

    if (roles.has("applicant") && ["draft", "returned"].includes(shared.status)) {
      mk("primary", "送出", "btn-submit", () => {
        shared.status = "pending";
        shared.signature.done = ["applicant"];
        if (shared.values.need_cover === "yes") {
          shared.signature.done.push("agent");
        }
        shared.signature.current = "approver";
        persist();
        render();
        showToast("已送出，等待簽核");
        maybeTeamsNotify(
          session.teams_notify,
          "新申請待簽",
          `${personName(shared.signature.applicant)} 送出 ${schema.title}`
        );
      });
    }
    if (roles.has("approver") && shared.status === "pending") {
      mk("ok", "核准", "btn-approve", () => {
        shared.status = "approved";
        shared.signature.done = ["applicant", "agent", "approver"];
        shared.signature.current = null;
        persist();
        render();
        showToast("已核准");
        maybeTeamsNotify(session.teams_notify, "已核准", schema.title);
      });
      mk("danger", "駁回", "btn-deny", () => {
        shared.status = "denied";
        shared.signature.current = null;
        persist();
        render();
        showToast("已駁回");
        maybeTeamsNotify(session.teams_notify, "已駁回", schema.title);
      });
      mk("ghost", "退回", "btn-return", () => {
        shared.status = "returned";
        shared.signature.current = "applicant";
        shared.signature.done = [];
        persist();
        render();
        showToast("已退回");
      });
    }
    mk("ghost", "通知請簽", "btn-notify", () => {
      maybeTeamsNotify(
        session.teams_notify,
        "請簽提醒",
        `請 ${personName(shared.signature.approver)} 簽核`
      );
      showToast(
        session.teams_notify
          ? "已模擬 Teams 通知"
          : "未勾選 Teams 通知（仍記錄於本機）"
      );
      shared.notifications.push({
        at: new Date().toISOString(),
        to: shared.signature.approver,
        kind: "please_sign",
      });
      persist();
    });
  }

  function renderBoundPicker() {
    boundPicker.innerHTML = "";
    const title = document.createElement("p");
    title.className = "bound-title";
    title.textContent = "本則訊息可綁定欄位（白名單）：";
    boundPicker.appendChild(title);
    const wrap = document.createElement("div");
    wrap.className = "bound-chips";
    schema.fields
      .filter((f) => f.storage === "shared")
      .forEach((f) => {
        const lab = document.createElement("label");
        lab.className = "chip";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = session.bound_fields.includes(f.name);
        cb.addEventListener("change", () => {
          if (cb.checked) session.bound_fields.push(f.name);
          else
            session.bound_fields = session.bound_fields.filter(
              (n) => n !== f.name
            );
          Store.saveSession(session);
        });
        lab.appendChild(cb);
        lab.append(` ${f.display_name}`);
        wrap.appendChild(lab);
      });
    boundPicker.appendChild(wrap);
  }

  function renderMessages() {
    boxes.innerHTML = "";
    const me = session.user_id;
    shared.messages.forEach((m) => {
      const article = document.createElement("article");
      article.className = "box" + (m.author_id === me ? " me" : "");
      const boundNames = (m.bound_fields || [])
        .map((n) => schema.fields.find((f) => f.name === n)?.display_name || n)
        .join("、");
      article.innerHTML = `
        <header><strong>${personName(m.author_id)}</strong><time>${m.at}</time></header>
        <p></p>
        ${
          boundNames
            ? `<footer class="bound">綁定欄：${boundNames}</footer>`
            : ""
        }
      `;
      article.querySelector("p").textContent = m.text;
      boxes.appendChild(article);
    });
    boxes.scrollTop = boxes.scrollHeight;
  }

  function render() {
    renderLogin();
    renderMeta();
    renderFields();
    renderSignature();
    renderActions();
    renderBoundPicker();
    renderMessages();
  }

  // —— events ——
  loginSelect.addEventListener("change", () => {
    session.user_id = loginSelect.value;
    // 切身分時重新載入「自己的」個人空間；不偷看別人 personal
    loadPersonalFor(session.user_id);
    persist();
    render();
    showToast(`已登入為 ${personName(session.user_id)}`);
  });

  teamsNotify.addEventListener("change", () => {
    session.teams_notify = teamsNotify.checked;
    Store.saveSession(session);
    showToast(
      session.teams_notify
        ? "已開啟 Teams 通知模擬"
        : "已關閉 Teams 通知模擬"
    );
  });

  document.getElementById("me-rail").addEventListener("click", () => {
    loginSelect.focus();
    showToast("左側可切換登入身分");
  });

  document.getElementById("btn-design").addEventListener("click", () => {
    const summary = schema.fields
      .map(
        (f) =>
          `${f.display_name}（${f.type}/${f.storage}${
            f.required ? "/必填" : ""
          }）`
      )
      .join("\n");
    openSheet("設計預覽（schema）", summary, [
      { label: "知道了", run: () => {} },
    ]);
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    Store.resetAll();
    shared = defaultShared(schema);
    personalCache = { u_ming: defaultPersonal() };
    session = {
      user_id: "u_ming",
      teams_notify: false,
      bound_fields: [...(schema.conversation?.default_bound_fields || [])],
    };
    persist();
    Store.savePersonal("u_ming", schema.form_id, defaultPersonal());
    render();
    showToast("已重設本機資料");
  });

  document.getElementById("composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("msg");
    const text = input.value.trim();
    if (!text) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    shared.messages.push({
      id: `m_${Date.now()}`,
      author_id: session.user_id,
      text,
      at: time,
      bound_fields: [...session.bound_fields],
    });
    // 若訊息綁定欄位，示範：把綁定欄目前值寫進訊息附註（狀態已在 shared）
    persist();
    input.value = "";
    render();
  });

  // 初次寫入預設個人備註（僅申請人空間）
  if (!Store.loadPersonal("u_ming", schema.form_id)) {
    Store.savePersonal("u_ming", schema.form_id, defaultPersonal());
  }
  if (!Store.loadShared(schema.form_id)) {
    Store.saveShared(schema.form_id, shared);
  }
  persist();
  render();
}

boot().catch((err) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#fff;background:#300">載入失敗：${err.message}\n\n請執行：\n  bash approval/scripts/serve.sh\n然後開啟 http://127.0.0.1:8765/</pre>`;
});
