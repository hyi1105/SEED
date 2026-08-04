(() => {
  // 畫面為主：可改預設欄位、可打字、可標自己看／公開。其餘功能先不做。
  let visibility = "public";

  const opts = document.querySelectorAll(".vis-opt");
  opts.forEach((btn) => {
    btn.addEventListener("click", () => {
      visibility = btn.dataset.vis;
      opts.forEach((b) => b.classList.toggle("on", b === btn));
    });
  });

  const chat = document.getElementById("chat");
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
      "bubble me" + (visibility === "private" ? " private" : "");
    article.innerHTML = `
      <div class="meta"><strong>我</strong><time></time></div>
      <p></p>
      <div class="vis ${visibility}">${
        visibility === "private" ? "僅自己看" : "公開"
      }</div>
    `;
    article.querySelector("time").textContent = time;
    article.querySelector("p").textContent = text;
    chat.appendChild(article);
    chat.scrollTop = chat.scrollHeight;
    input.value = "";
  });
})();
