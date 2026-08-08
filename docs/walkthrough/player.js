const TONE = {
  soft: "#5a6e65",
  user: "#1f6fbf",
  guide: "#0c5c4d",
  manager: "#b45309",
  hr: "#6d4a9e",
};

/** @type {any} */
let pack = null;

const els = {
  app: document.getElementById("app"),
  title: document.getElementById("title"),
  eyebrow: document.getElementById("eyebrow"),
  formTitle: document.getElementById("form-title"),
  formSub: document.getElementById("form-sub"),
  sections: document.getElementById("sections"),
  submitRow: document.getElementById("submit-row"),
  submitBtn: document.getElementById("submit-btn"),
  actionRow: document.getElementById("action-row"),
  statusPill: document.getElementById("status-pill"),
  summary: document.getElementById("summary"),
  toast: document.getElementById("toast"),
  roleTabs: document.getElementById("role-tabs"),
  chatLog: document.getElementById("chat-log"),
  chatBar: document.getElementById("chat-bar"),
  btnPrev: document.getElementById("btn-prev"),
  btnNext: document.getElementById("btn-next"),
  fileImport: document.getElementById("file-import"),
};

const state = {
  mode: "show",
  nodeId: null,
  values: {},
  unlocked: new Set(),
  openSections: new Set(),
  busy: false,
  typeToken: 0,
  roleId: null,
  history: [], // node ids visited for prev
  chat: [], // {id, speaker, line, side}
};

/** @type {Record<string, any>} */
let packLibrary = {};

function firstSectionId() {
  return pack?.form?.sections?.[0]?.id || "apply";
}

function storageKeyDoc() {
  return `seed-form:${pack.meta.id}`;
}
function storageKeyPack() {
  return `seed-pack:${pack.meta.id}`;
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function castOf(id) {
  return pack.show.cast.find((c) => c.id === id) || { id, label: id, tone: "guide" };
}

function roleOf(id) {
  return pack.roles.find((r) => r.id === id);
}

function allFields() {
  return pack.form.sections.flatMap((s) =>
    s.fields.map((f) => ({ ...f, sectionId: s.id }))
  );
}

function fieldById(id) {
  return allFields().find((f) => f.id === id);
}

function aclOf(field) {
  return (
    field.acl || {
      requiredFrom: field.required ? ["applicant"] : [],
      read: pack.roles.map((r) => r.id),
      write: field.write || [],
    }
  );
}

function canWrite(field, roleId) {
  return (aclOf(field).write || []).includes(roleId);
}

function canRead(field, roleId) {
  const read = aclOf(field).read;
  if (!read || !read.length) return true;
  return read.includes(roleId);
}

function isRequired(field, roleId) {
  return (aclOf(field).requiredFrom || []).includes(roleId);
}

function status() {
  return state.values[pack.form.statusField] || "草稿";
}

function demoValue(key) {
  return pack.demo?.values?.[key];
}

function nodeOf(id) {
  return pack.show.nodes[id];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function persistDoc() {
  localStorage.setItem(
    storageKeyDoc(),
    JSON.stringify({ values: state.values, updatedAt: new Date().toISOString() })
  );
}

function loadDoc() {
  try {
    const raw = localStorage.getItem(storageKeyDoc());
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { values: { [pack.form.statusField]: "草稿" } };
}

function persistPackEdits() {
  localStorage.setItem(storageKeyPack(), JSON.stringify(pack));
}

function loadPackEdits(base) {
  try {
    const raw = localStorage.getItem(`seed-pack:${base.meta.id}`);
    if (!raw) return base;
    const edited = JSON.parse(raw);
    // keep show/demo from base if missing; prefer edited form/actions/roles
    return {
      ...base,
      ...edited,
      show: edited.show || base.show,
      demo: edited.demo || base.demo,
      form: edited.form || base.form,
      actions: edited.actions || base.actions,
      roles: edited.roles || base.roles,
      tables: edited.tables || base.tables,
      meta: { ...base.meta, ...edited.meta },
    };
  } catch (_) {
    return base;
  }
}

function snapshotShow() {
  return {
    values: { ...state.values },
    unlocked: [...state.unlocked],
    openSections: [...state.openSections],
  };
}

function restoreShow(snap) {
  state.values = { ...snap.values };
  state.unlocked = new Set(snap.unlocked);
  state.openSections = new Set(snap.openSections);
}

function resolveFills(node) {
  const out = {};
  const map = node.mapFill || {};
  for (const demoKey of node.fillFromDemo || []) {
    const fieldId = map[demoKey] || demoKey;
    const val = demoValue(demoKey);
    if (val != null) out[fieldId] = String(val);
  }
  Object.assign(out, node.fill || {});
  return out;
}

function buildShowForm() {
  els.formTitle.textContent = pack.form.title;
  els.formSub.textContent = "Show · 上方表單隨對話填入";
  els.sections.innerHTML = pack.form.sections
    .map(
      (sec) => `<section class="section" data-section="${sec.id}" id="sec-${sec.id}">
        <p class="section-label">${escapeHtml(sec.label)}</p>
        <div class="fields">
          ${sec.fields
            .map(
              (f) => `<div class="field" data-field="${f.id}" id="field-${f.id}">
                <div class="field-label">${escapeHtml(f.label)}</div>
                <div class="field-value empty" data-value="${f.id}">尚空白</div>
              </div>`
            )
            .join("")}
        </div>
      </section>`
    )
    .join("");
}

function paintShowForm() {
  pack.form.sections.forEach((sec) => {
    const secEl = document.getElementById(`sec-${sec.id}`);
    const showSec =
      state.openSections.has(sec.id) ||
      sec.fields.some((f) => state.unlocked.has(f.id));
    secEl?.classList.toggle("open", showSec);
    sec.fields.forEach((f) => {
      const el = document.getElementById(`field-${f.id}`);
      if (!el) return;
      const valEl = el.querySelector("[data-value]");
      el.classList.toggle("open", state.unlocked.has(f.id));
      const val = state.values[f.id];
      if (val == null || val === "") {
        if (!valEl.classList.contains("typing")) {
          valEl.textContent = "尚空白";
          valEl.classList.add("empty");
        }
      } else if (!valEl.classList.contains("typing")) {
        valEl.textContent = val;
        valEl.classList.remove("empty");
      }
    });
  });
  els.statusPill.textContent = status();
}

function setFocus(fieldId) {
  document.querySelectorAll(".field").forEach((el) => el.classList.remove("focus"));
  if (!fieldId || fieldId === "btn_submit") {
    if (fieldId === "btn_submit") {
      els.submitRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return;
  }
  const el = document.getElementById(`field-${fieldId}`);
  if (el) {
    el.classList.add("focus");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

async function typeValue(fieldId, text) {
  const el = document.getElementById(`field-${fieldId}`);
  const valEl = el?.querySelector("[data-value]");
  if (!valEl) {
    state.values[fieldId] = text;
    return;
  }
  state.unlocked.add(fieldId);
  paintShowForm();
  setFocus(fieldId);
  const token = ++state.typeToken;
  valEl.classList.remove("empty");
  valEl.classList.add("typing");
  valEl.textContent = "";
  for (let i = 1; i <= text.length; i++) {
    if (token !== state.typeToken) return;
    valEl.textContent = text.slice(0, i);
    await sleep(text.length > 18 ? 24 : 36);
  }
  if (token !== state.typeToken) return;
  valEl.classList.remove("typing");
  state.values[fieldId] = text;
}

function prepareReveal(node) {
  if (node.unlockSection) state.openSections.add(node.unlockSection);
  (node.reveal || []).forEach((id) => state.unlocked.add(id));
  Object.keys(resolveFills(node)).forEach((id) => state.unlocked.add(id));
  if (node.showSubmit) els.submitRow.classList.add("open");
  paintShowForm();
  if (node.focus) setFocus(node.focus);
  if (node.flashSubmit) {
    els.submitBtn.classList.remove("flash");
    void els.submitBtn.offsetWidth;
    els.submitBtn.classList.add("flash");
  }
}

async function applyFills(node) {
  const fills = resolveFills(node);
  const keys = Object.keys(fills);
  if (!keys.length) return;
  if (node.typewriter) {
    for (const key of keys) {
      state.unlocked.add(key);
      paintShowForm();
      await typeValue(key, String(fills[key]));
      await sleep(80);
    }
  } else {
    for (const key of keys) {
      state.unlocked.add(key);
      state.values[key] = String(fills[key]);
    }
    paintShowForm();
  }
}

function renderSummary() {
  els.summary.classList.add("show");
  els.summary.innerHTML = `
    <h2>這個系統收成 ${(pack.tables || []).length} 張表</h2>
    <p>每一欄都能追回剛才對話裡說的那句話：</p>
    ${(pack.tables || [])
      .map(
        (t) => `<div class="table-card">
          <h3>${escapeHtml(t.label)}</h3>
          <ul>${t.fields
            .map(
              (f) =>
                `<li><strong>${escapeHtml(f.label)}</strong> <span class="origin">— ${escapeHtml(f.origin)}</span></li>`
            )
            .join("")}</ul>
        </div>`
      )
      .join("")}`;
}

function clearSummary() {
  els.summary.classList.remove("show");
  els.summary.innerHTML = "";
}

function appendChat(node, { replaceLast = false } = {}) {
  const cast = castOf(node.speaker);
  const side = cast.tone === "user" ? "me" : "them";
  const item = {
    id: `${state.nodeId}-${state.chat.length}`,
    speaker: cast.label,
    line: node.line,
    side,
    tone: cast.tone,
  };
  if (replaceLast && state.chat.length) state.chat.pop();
  state.chat.push(item);
  paintChat(item.id);
}

function paintChat(activeId) {
  els.chatLog.innerHTML = state.chat
    .map(
      (m) => `<div class="bubble-row ${m.side} ${m.id === activeId ? "active" : ""}" data-bubble="${m.id}">
        <div class="bubble-who">${escapeHtml(m.speaker)}</div>
        <div class="bubble">${escapeHtml(m.line)}</div>
      </div>`
    )
    .join("");
  const last = els.chatLog.lastElementChild;
  last?.scrollIntoView({ block: "end", behavior: "smooth" });
}

function paintChatBar(node) {
  const atStart = state.history.length === 0;
  els.btnPrev.disabled = atStart || state.busy;
  els.btnNext.disabled = state.busy || !!(node.choices?.length) || !!node.ending;

  let extra = "";
  if (node.choices?.length) {
    extra = `<div class="chat-choices">
      ${node.choices
        .map(
          (c) =>
            `<button type="button" class="choice-btn" data-next="${escapeHtml(c.next)}">${escapeHtml(c.label)}</button>`
        )
        .join("")}
    </div>`;
  } else if (node.ending && node.cta?.length) {
    els.btnNext.disabled = true;
    extra = `<div class="cta-row">
      ${node.cta
        .map((c) => {
          if (c.action === "open-form")
            return `<button type="button" class="cta-btn" data-action="open-form">${escapeHtml(c.label)}</button>`;
          if (c.action === "open-settings")
            return `<button type="button" class="cta-btn" data-action="open-settings">${escapeHtml(c.label)}</button>`;
          if (c.action === "restart")
            return `<button type="button" class="cta-btn ghost" data-action="restart">${escapeHtml(c.label)}</button>`;
          return "";
        })
        .join("")}
    </div>`;
  }

  const slot = document.getElementById("chat-extra");
  if (slot) {
    slot.innerHTML = extra;
    slot.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => goNext(btn.getAttribute("data-next")));
    });
    slot.querySelectorAll("[data-action=open-form]").forEach((b) =>
      b.addEventListener("click", () => setMode("form"))
    );
    slot.querySelectorAll("[data-action=open-settings]").forEach((b) =>
      b.addEventListener("click", () => setMode("settings"))
    );
    slot.querySelectorAll("[data-action=restart]").forEach((b) =>
      b.addEventListener("click", restartShow)
    );
  }
}

async function renderNode({ fromPrev = false } = {}) {
  const node = nodeOf(state.nodeId);
  if (!node) return;
  if (node.summary) renderSummary();
  else clearSummary();

  prepareReveal(node);
  if (!fromPrev) appendChat(node);
  else {
    // prev: keep chat history trimmed already
    paintChat(state.chat[state.chat.length - 1]?.id);
  }
  paintChatBar(node);

  state.busy = true;
  els.btnPrev.disabled = true;
  els.btnNext.disabled = true;
  if (!fromPrev) await applyFills(node);
  else paintShowForm();
  state.busy = false;
  paintChatBar(node);
}

function goNext(explicitNext) {
  if (state.busy) return;
  const node = nodeOf(state.nodeId);
  if (!node) return;
  if (node.choices?.length && !explicitNext) return;
  if (node.ending && !explicitNext) return;
  const nextId = explicitNext || node.next;
  if (!nextId || !nodeOf(nextId)) return;
  state.history.push({
    nodeId: state.nodeId,
    snap: snapshotShow(),
    chatLen: state.chat.length,
  });
  state.nodeId = nextId;
  renderNode();
}

function goPrev() {
  if (state.busy || !state.history.length) return;
  const prev = state.history.pop();
  state.typeToken += 1;
  state.nodeId = prev.nodeId;
  restoreShow(prev.snap);
  state.chat = state.chat.slice(0, prev.chatLen);
  els.submitRow.classList.toggle("open", state.unlocked.has("final_status") || !!nodeOf(state.nodeId)?.showSubmit);
  // re-open submit if current or past had it
  if (pack.show.nodes[state.nodeId]?.showSubmit) els.submitRow.classList.add("open");
  paintShowForm();
  renderNode({ fromPrev: true });
}

function restartShow() {
  state.typeToken += 1;
  state.nodeId = pack.show.start;
  state.values = {};
  state.unlocked = new Set();
  state.openSections = new Set([firstSectionId()]);
  state.history = [];
  state.chat = [];
  state.busy = false;
  els.submitRow.classList.remove("open");
  clearSummary();
  buildShowForm();
  document.getElementById("sec-apply")?.classList.add("open");
  paintShowForm();
  renderNode();
}

/* ——— Real form ——— */

function buildRealForm() {
  const doc = loadDoc();
  state.values = { ...doc.values };
  if (!state.values[pack.form.statusField]) state.values[pack.form.statusField] = "草稿";

  els.formTitle.textContent = pack.form.title;
  els.formSub.textContent = "真實表單 · 依角色 ACL 顯示／編輯";
  els.sections.innerHTML = pack.form.sections
    .map((sec) => {
      const visibleFields = sec.fields.filter((f) => canRead(f, state.roleId));
      if (!visibleFields.length) return "";
      return `<section class="section open" data-section="${sec.id}">
        <p class="section-label">${escapeHtml(sec.label)}</p>
        <div class="fields">
          ${visibleFields
            .map((f) => {
              const writable = canWrite(f, state.roleId);
              const req = isRequired(f, state.roleId);
              const val = state.values[f.id] ?? "";
              const meaning = f.meaning
                ? `<div class="field-hint">${escapeHtml(f.meaning)}${req ? " · 必填" : ""}</div>`
                : req
                  ? `<div class="field-hint">必填</div>`
                  : "";
              let control = "";
              if (f.type === "select") {
                const opts = (f.options || [])
                  .map(
                    (o) =>
                      `<option value="${escapeHtml(o)}" ${val === o ? "selected" : ""}>${escapeHtml(o)}</option>`
                  )
                  .join("");
                control = `<select class="field-input" data-input="${f.id}" ${writable ? "" : "disabled"}>
                  <option value="">—</option>${opts}</select>`;
              } else if (f.type === "textarea") {
                control = `<textarea class="field-input" data-input="${f.id}" ${writable ? "" : "readonly"} placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea>`;
              } else {
                control = `<input class="field-input" data-input="${f.id}" type="${escapeHtml(f.type || "text")}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" ${writable ? "" : "readonly"} />`;
              }
              return `<div class="field open" data-field="${f.id}">
                <div class="field-label">${escapeHtml(f.label)}${req ? " *" : ""}</div>
                ${control}
                ${meaning}
              </div>`;
            })
            .join("")}
        </div>
      </section>`;
    })
    .join("");

  els.sections.querySelectorAll("[data-input]").forEach((input) => {
    const sync = () => {
      state.values[input.getAttribute("data-input")] = input.value;
      persistDoc();
      els.statusPill.textContent = status();
    };
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
  });

  els.statusPill.textContent = status();
  renderRoleTabs();
  renderActions();
}

function renderRoleTabs() {
  els.roleTabs.innerHTML = pack.roles
    .map(
      (r) =>
        `<button type="button" class="role-tab ${r.id === state.roleId ? "active" : ""}" data-role="${r.id}">${escapeHtml(r.label)}</button>`
    )
    .join("");
  els.roleTabs.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.roleId = btn.getAttribute("data-role");
      if (state.mode === "form") buildRealForm();
      else if (state.mode === "settings") buildSettings();
    });
  });
}

function actionAvailable(action) {
  if (action.role !== state.roleId) return false;
  const st = status();
  const when = action.whenStatus || [];
  return when.includes(st) || (when.includes("") && (!st || st === "草稿"));
}

function renderActions() {
  const acts = (pack.actions || []).filter(actionAvailable);
  els.submitRow.classList.remove("open");
  els.actionRow.classList.add("open");
  if (!acts.length) {
    els.actionRow.innerHTML = `<span class="progress">目前角色在「${escapeHtml(status())}」沒有可做的動作</span>
      <button type="button" class="ghost-btn" id="btn-reset-doc">清空重填</button>`;
  } else {
    els.actionRow.innerHTML =
      acts
        .map(
          (a) =>
            `<button type="button" class="primary-btn" data-action-id="${a.id}">${escapeHtml(a.label)}</button>`
        )
        .join("") +
      `<button type="button" class="ghost-btn" id="btn-reset-doc">清空重填</button>`;
  }
  els.actionRow.querySelectorAll("[data-action-id]").forEach((btn) => {
    btn.addEventListener("click", () => runAction(btn.getAttribute("data-action-id")));
  });
  document.getElementById("btn-reset-doc")?.addEventListener("click", () => {
    if (!confirm("清空這張單，從頭開始？")) return;
    state.values = { [pack.form.statusField]: "草稿" };
    persistDoc();
    buildRealForm();
    toast("已清空");
  });
}

function runAction(actionId) {
  const action = pack.actions.find((a) => a.id === actionId);
  if (!action || !actionAvailable(action)) return;
  for (const req of action.require || []) {
    if (!String(state.values[req] || "").trim()) {
      const f = fieldById(req);
      toast(`請先填「${f?.label || req}」`);
      document.querySelector(`[data-input="${req}"]`)?.focus();
      return;
    }
  }
  // also enforce ACL requiredFrom for current role on require list already; extra check:
  for (const f of allFields()) {
    if (isRequired(f, state.roleId) && canWrite(f, state.roleId)) {
      if ((action.require || []).includes(f.id) && !String(state.values[f.id] || "").trim()) {
        toast(`「${f.label}」為必填`);
        return;
      }
    }
  }
  const persona = pack.demo?.persona?.[state.roleId] || roleOf(state.roleId)?.label || "";
  for (const id of action.autoPersona || []) state.values[id] = persona;
  for (const id of action.autoToday || []) state.values[id] = today();
  Object.assign(state.values, action.set || {});
  for (const [from, to] of Object.entries(action.copy || {})) {
    if (state.values[from] != null && state.values[from] !== "") {
      state.values[to] = state.values[from];
    }
  }
  persistDoc();
  buildRealForm();
  toast(action.message || "已完成");
}

/* ——— Settings ACL ——— */

function buildSettings() {
  els.formTitle.textContent = "欄位設定";
  els.formSub.textContent = "誰必填 · 誰可看 · 誰可編 · 改完可匯出 JSON";
  els.statusPill.textContent = pack.meta.title;
  els.submitRow.classList.remove("open");
  els.actionRow.classList.remove("open");
  els.actionRow.innerHTML = "";

  els.sections.innerHTML = `<div class="settings-list">
    ${allFields()
      .map((f) => {
        const acl = aclOf(f);
        const checks = (key) =>
          pack.roles
            .map(
              (r) => `<label><input type="checkbox" data-acl="${f.id}:${key}:${r.id}" ${(acl[key] || []).includes(r.id) ? "checked" : ""}/> ${escapeHtml(r.label)}</label>`
            )
            .join("");
        return `<article class="acl-card" data-field-acl="${f.id}">
          <h3>${escapeHtml(f.label)} <span class="progress">(${escapeHtml(f.id)})</span></h3>
          <p class="meaning">${escapeHtml(f.meaning || "")}</p>
          <div class="acl-grid">
            <div class="acl-row"><span>必填</span><div class="acl-checks">${checks("requiredFrom")}</div></div>
            <div class="acl-row"><span>可看</span><div class="acl-checks">${checks("read")}</div></div>
            <div class="acl-row"><span>可編</span><div class="acl-checks">${checks("write")}</div></div>
          </div>
        </article>`;
      })
      .join("")}
    <div class="settings-actions">
      <button type="button" class="ghost-btn" id="btn-export">匯出 JSON</button>
      <button type="button" class="primary-btn" id="btn-save-acl">儲存設定</button>
    </div>
  </div>`;

  els.sections.querySelectorAll("[data-acl]").forEach((input) => {
    input.addEventListener("change", () => {
      const [fieldId, key, roleId] = input.getAttribute("data-acl").split(":");
      const field = fieldById(fieldId);
      if (!field.acl) field.acl = { requiredFrom: [], read: [], write: [] };
      const set = new Set(field.acl[key] || []);
      if (input.checked) set.add(roleId);
      else set.delete(roleId);
      field.acl[key] = [...set];
    });
  });

  document.getElementById("btn-save-acl")?.addEventListener("click", () => {
    persistPackEdits();
    toast("已儲存設定（此瀏覽器）");
  });
  document.getElementById("btn-export")?.addEventListener("click", exportPack);
  renderRoleTabs();
}

function exportPack() {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${pack.meta.id || "system"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("已匯出 JSON");
}

function importPackFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      const normalized = normalizePack(json);
      pack = normalized;
      packLibrary[pack.meta.id] = structuredClone(normalized);
      syncPackSelect();
      localStorage.removeItem(storageKeyPack());
      persistPackEdits();
      bootPack();
      toast(`已載入：${pack.meta.title}`);
    } catch (err) {
      console.error(err);
      toast("JSON 格式不正確");
    }
  };
  reader.readAsText(file);
}

function syncPackSelect() {
  const sel = document.getElementById("pack-select");
  if (!sel) return;
  const ids = Object.keys(packLibrary);
  sel.innerHTML = ids
    .map((id) => {
      const p = packLibrary[id];
      const label = p?.meta?.title || id;
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  if (pack?.meta?.id) sel.value = pack.meta.id;
  sel.hidden = ids.length < 2;
}

function switchPack(id) {
  const base = packLibrary[id];
  if (!base) return;
  pack = normalizePack(structuredClone(base));
  const url = new URL(location.href);
  url.searchParams.set("system", id);
  history.replaceState(null, "", url);
  bootPack();
  toast(`切換：${pack.meta.title}`);
}

/** Accept new split format; light shim for older root-level cast/nodes */
function normalizePack(raw) {
  if (raw.meta && raw.form && raw.show) return raw;
  if (raw.form && raw.nodes) {
    return {
      meta: { id: raw.id || "system", title: raw.title || "未命名系統", subtitle: raw.subtitle || "" },
      roles: raw.roles || [],
      form: raw.form,
      actions: raw.actions || [],
      tables: raw.tables || [],
      show: {
        cast: raw.cast || [],
        start: raw.start,
        nodes: raw.nodes,
      },
      demo: raw.demo || { values: {}, persona: {} },
    };
  }
  throw new Error("缺少 meta/form/show");
}

function setMode(mode) {
  state.mode = mode;
  els.app.dataset.mode = mode;
  document.querySelectorAll(".mode-tab[data-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
  });
  clearSummary();
  els.actionRow.classList.remove("open");

  if (mode === "show") {
    els.eyebrow.textContent = "Show · LINE 對話";
    restartShow();
  } else if (mode === "form") {
    els.eyebrow.textContent = "真實表單";
    state.roleId = state.roleId || pack.roles[0].id;
    buildRealForm();
  } else if (mode === "settings") {
    els.eyebrow.textContent = "欄位設定";
    state.roleId = state.roleId || pack.roles[0].id;
    buildSettings();
  }

  const url = new URL(location.href);
  url.searchParams.set("mode", mode);
  history.replaceState(null, "", url);
}

function bindChrome() {
  document.querySelectorAll(".mode-tab[data-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      setMode(btn.getAttribute("data-mode"));
    });
  });
  els.btnPrev?.addEventListener("click", goPrev);
  els.btnNext?.addEventListener("click", () => goNext());
  document.getElementById("btn-restart")?.addEventListener("click", () => {
    if (state.mode === "show") restartShow();
    else if (state.mode === "form") {
      state.values = { [pack.form.statusField]: "草稿" };
      persistDoc();
      buildRealForm();
      toast("已重來");
    } else toast("設定請用儲存／匯出");
  });
  document.getElementById("btn-export-top")?.addEventListener("click", exportPack);
  els.fileImport?.addEventListener("change", () => {
    const file = els.fileImport.files?.[0];
    if (file) importPackFile(file);
    els.fileImport.value = "";
  });
  document.getElementById("pack-select")?.addEventListener("change", (e) => {
    switchPack(e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if (state.mode !== "show" || state.busy) return;
    if (e.key === "ArrowRight" || e.key === "Enter") {
      const node = nodeOf(state.nodeId);
      if (!node?.choices && !node?.ending) {
        e.preventDefault();
        goNext();
      }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  });
}

function bootPack() {
  pack = loadPackEdits(pack);
  els.title.textContent = pack.meta.title;
  state.roleId = pack.roles[0]?.id;
  const bootMode = new URLSearchParams(location.search).get("mode");
  const mode = ["show", "form", "settings"].includes(bootMode) ? bootMode : "show";
  setMode(mode);
}

function boot() {
  const libraryEl = document.getElementById("vn-library");
  const embedded = document.getElementById("vn-data");
  if (libraryEl?.textContent?.trim()) {
    const lib = JSON.parse(libraryEl.textContent);
    packLibrary = {};
    for (const [id, raw] of Object.entries(lib)) {
      packLibrary[id] = normalizePack(raw);
    }
  } else {
    const one = normalizePack(JSON.parse(embedded.textContent));
    packLibrary = { [one.meta.id]: one };
  }
  const want =
    new URLSearchParams(location.search).get("system") ||
    embedded?.dataset?.default ||
    Object.keys(packLibrary)[0];
  pack = normalizePack(structuredClone(packLibrary[want] || Object.values(packLibrary)[0]));
  bindChrome();
  syncPackSelect();
  bootPack();
}

boot();
