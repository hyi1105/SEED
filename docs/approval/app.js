(() => {
  let visibility = "public";
  document.querySelectorAll(".vis-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      visibility = btn.dataset.vis;
      document
        .querySelectorAll(".vis-opt")
        .forEach((b) => b.classList.toggle("on", b === btn));
    });
  });

  const feed = document.getElementById("feed");
  const form = document.getElementById("composer");
  const input = document.getElementById("msg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const me = document.createElement("article");
    me.className = "bubble me" + (visibility === "private" ? " private" : "");
    me.innerHTML = `
      <div class="meta"><strong>我</strong><time></time></div>
      <p></p>
      <div class="vis"></div>
    `;
    me.querySelector("time").textContent = time;
    me.querySelector("p").textContent = text;
    const vis = me.querySelector(".vis");
    vis.textContent = visibility === "private" ? "僅自己看" : "公開";
    if (visibility === "private") vis.classList.add("private");
    feed.appendChild(me);

    const sys = document.createElement("article");
    sys.className = "bubble";
    sys.innerHTML = `
      <div class="meta"><strong>系統</strong><time></time></div>
      <p></p>
    `;
    sys.querySelector("time").textContent = time;
    sys.querySelector("p").textContent =
      visibility === "private"
        ? "上一則未進共用庫，只存在申請人個人空間。"
        : "訊息已加入對話時間軸（公開）。";
    feed.appendChild(sys);

    feed.scrollTop = feed.scrollHeight;
    input.value = "";
  });
})();
