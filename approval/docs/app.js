(() => {
  // 畫面為主：對話框保留；系統區塊示範穿插；下方只打字＋自己看／公開
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

  function appendSys(kicker, title, body) {
    const sec = document.createElement("section");
    sec.className = "sys";
    sec.innerHTML = `
      <div class="sys-kicker"></div>
      <p class="sys-title"></p>
      <p class="sys-body"></p>
    `;
    sec.querySelector(".sys-kicker").textContent = kicker;
    sec.querySelector(".sys-title").textContent = title;
    sec.querySelector(".sys-body").textContent = body;
    feed.appendChild(sec);
  }

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
      "bubble me" + (visibility === "private" ? " private" : "");
    article.innerHTML = `
      <div class="meta"><strong>我</strong><time></time></div>
      <p></p>
      <div class="vis ${visibility}"></div>
    `;
    article.querySelector("time").textContent = time;
    article.querySelector("p").textContent = text;
    article.querySelector(".vis").textContent =
      visibility === "private" ? "僅自己看" : "公開";
    feed.appendChild(article);

    if (visibility === "private") {
      appendSys("隱私", "此則未進共用庫", "僅個人空間 · 簽核畫面不渲染");
    } else {
      appendSys("系統", "訊息已寫入對話時間軸", "可見範圍：公開");
    }

    feed.scrollTop = feed.scrollHeight;
    input.value = "";
  });
})();
