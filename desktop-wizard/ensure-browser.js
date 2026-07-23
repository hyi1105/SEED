/**
 * 確保 Playwright Chromium 可用。
 * 打包成 Windows exe 時不內建瀏覽器（避免在 Linux 打包打進錯誤平台），
 * 改於第一次執行時下載到使用者目錄。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function browsersDir(userDataPath) {
  return path.join(userDataPath, "ms-playwright");
}

function hasChromium(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((n) => n.startsWith("chromium-"));
}

export function applyBrowsersPath(userDataPath) {
  const dir = browsersDir(userDataPath);
  process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
  return dir;
}

/**
 * @param {string} userDataPath
 * @param {{ onLog?: (msg: string) => void }} [opts]
 */
export function ensureChromium(userDataPath, opts = {}) {
  const log = opts.onLog || console.log;
  const dir = applyBrowsersPath(userDataPath);

  if (hasChromium(dir)) {
    log(`瀏覽器已就緒：${dir}`);
    return { ok: true, dir, installed: false };
  }

  log("第一次使用：正在下載 Chromium（需網路，約數百 MB）…");
  fs.mkdirSync(dir, { recursive: true });

  const cli = require.resolve("playwright/cli.js");
  execFileSync(process.execPath, [cli, "install", "chromium"], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PLAYWRIGHT_BROWSERS_PATH: dir,
    },
    stdio: "inherit",
  });

  if (!hasChromium(dir)) {
    throw new Error("Chromium 下載後仍找不到，請檢查網路後重開網頁精靈");
  }

  log("Chromium 下載完成。");
  return { ok: true, dir, installed: true };
}
