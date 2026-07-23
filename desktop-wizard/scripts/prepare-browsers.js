#!/usr/bin/env node
/**
 * 在 Windows 打包前，把本機 Playwright Chromium 複製到 build-resources/，
 * 讓 exe 內建瀏覽器、第一次不必下載。
 *
 * CI（windows-latest）或 Windows 本機：npm run dist:win:bundle
 * Linux 交叉編譯請勿 bundle（平台不符）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(__dirname, "..", "build-resources", "ms-playwright");

if (process.platform !== "win32") {
  console.warn(
    "略過：非 Windows，不複製瀏覽器（避免打進錯誤平台）。\n" +
      "一般請用：npm run dist:win（首次啟動再下載）。"
  );
  process.exit(0);
}

function playwrightCache() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    return process.env.PLAYWRIGHT_BROWSERS_PATH;
  }
  const local = process.env.LOCALAPPDATA || "";
  if (local) return path.join(local, "ms-playwright");
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
console.log("完成。");
