(() => {
  const KEY = "approval.a4.v4";
  const MIN_CH = 2;

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

  // 隱藏量尺：用與 .blank 相同字體量文字寬
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
    // 至少兩字寬；超過則依內容
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
})();
