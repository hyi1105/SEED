const form = document.getElementById("form");
const logEl = document.getElementById("log");
const shots = document.getElementById("shots");
const runBtn = document.getElementById("run");
const loadDemo = document.getElementById("loadDemo");

function setLog(text, isError = false) {
  logEl.textContent = text;
  logEl.classList.toggle("error", isError);
}

function showShots(list = []) {
  shots.innerHTML = "";
  for (const file of list) {
    const name = String(file).split(/[\\/]/).pop();
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = `/output/${encodeURIComponent(name)}?t=${Date.now()}`;
    img.alt = name;
    const cap = document.createElement("figcaption");
    cap.textContent = name;
    fig.append(img, cap);
    shots.append(fig);
  }
}

loadDemo.addEventListener("click", () => {
  // 本機練習頁由 server 靜態提供 recipes/upload-demo.html 的副本
  document.getElementById("url").value =
    `${location.origin}/demo/upload-demo.html`;
  document.getElementById("text").value = "網頁精靈練習：自動填入的文字";
  document.getElementById("textTarget").value = "#note";
  document.getElementById("fileInput").value = "#file";
  setLog("已載入本機練習頁設定。選一個檔案後按「開始執行」。");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  runBtn.disabled = true;
  setLog("執行中…");
  showShots([]);

  const fd = new FormData();
  fd.set("url", document.getElementById("url").value.trim());
  fd.set("text", document.getElementById("text").value);
  fd.set("textTarget", document.getElementById("textTarget").value.trim());
  fd.set("fileInput", document.getElementById("fileInput").value.trim());
  fd.set("headed", document.getElementById("headed").checked ? "true" : "false");
  fd.set("fullPage", document.getElementById("fullPage").checked ? "true" : "false");

  const file = document.getElementById("file").files?.[0];
  if (file) fd.set("file", file);

  try {
    const res = await fetch("/api/run", { method: "POST", body: fd });
    const data = await res.json();
    const lines = [
      ...(data.logs || []),
      data.ok === false ? `失敗：${data.error || "未知錯誤"}` : "狀態：成功",
    ];
    setLog(lines.join("\n"), !res.ok || data.ok === false);
    if (data.screenshots?.length) showShots(data.screenshots);
  } catch (err) {
    setLog(`連線失敗：${err.message || err}`, true);
  } finally {
    runBtn.disabled = false;
  }
});
