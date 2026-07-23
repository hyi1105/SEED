#!/usr/bin/env node
/**
 * （可選）在「Windows 本機」打包前，把 Chromium 打進資源目錄，
 * 讓 exe 免第一次下載。在 Linux 上請勿用於 win 包（平台不符）。
 *
 * 一般推薦：npm run dist:win（不內建，首次啟動自動下載）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, "..", "build-resources", "ms-playwright");

if (process.platform !== "win32") {
  console.warn(
    "警告：目前不是 Windows。打進 win exe 的瀏覽器會是錯誤平台。\n" +
      "建議改跑：npm run dist:win（首次啟動再下載）。"
  );
  process.exit(0);
}

function playwrightCache() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    return process.env.PLAYWRIGHT_BROWSERS_PATH;
  }
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return path.join(home, "AppData", "Local", "ms-playwright");
}

function copyDir(src, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (name === ".links") continue;
    const from = path.join(src, name);
    const next = path.join(to, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDir(from, next);
    else fs.copyFileSync(from, next);
  }
}

const src = playwrightCache();
if (!fs.existsSync(src)) {
  console.error("找不到 Playwright 瀏覽器快取。請先：npm run install:browser");
  process.exit(1);
}

const names = fs.readdirSync(src).filter(
  (n) => n.includes("chromium") || n.startsWith("ffmpeg")
);
if (names.length === 0) {
  console.error("快取裡沒有 chromium。請先：npm run install:browser");
  process.exit(1);
}

console.log(`來源：${src}`);
console.log(`目標：${dest}`);
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const name of names) {
  console.log(`複製 ${name}…`);
  copyDir(path.join(src, name), path.join(dest, name));
}
console.log("完成。請在 package.json build.extraResources 加上 ms-playwright 後再打包。");
