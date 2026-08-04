(() => {
  const KEY = "approval.a4.v3";
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

  document.querySelectorAll(".blank").forEach((el) => {
    const key = el.dataset.bind;
    if (state.binds[key] != null) el.value = state.binds[key];
    el.addEventListener("change", () => {
      state.binds[key] = el.value;
      save(state);
    });
  });
})();
