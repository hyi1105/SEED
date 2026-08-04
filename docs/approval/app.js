(() => {
  let visibility = "public";
  const opts = document.querySelectorAll(".vis-opt");
  opts.forEach((btn) => {
    btn.addEventListener("click", () => {
      visibility = btn.dataset.vis;
      opts.forEach((b) => b.classList.toggle("on", b === btn));
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

    const article = document.createElement("article");
    article.className =
      "say me" + (visibility === "private" ? " private" : "");
    article.innerHTML = `
      <div class="who"><strong>我</strong><time></time></div>
      <p></p>
    `;
    article.querySelector("time").textContent = time;
    article.querySelector("p").textContent = text;
    if (visibility === "private") {
      const mark = document.createElement("div");
      mark.className = "mark";
      mark.textContent = "僅自己看";
      article.appendChild(mark);
    }
    feed.appendChild(article);

    const sys = document.createElement("article");
    sys.className = "say sys";
    sys.innerHTML = `
      <div class="who"><strong>系統</strong><time></time></div>
      <p></p>
    `;
    sys.querySelector("time").textContent = time;
    sys.querySelector("p").textContent =
      visibility === "private"
        ? "上一則未進共用庫，只存在個人空間。"
        : "訊息已加入對話時間軸（公開）。";
    feed.appendChild(sys);

    feed.scrollTop = feed.scrollHeight;
    input.value = "";
  });
})();
