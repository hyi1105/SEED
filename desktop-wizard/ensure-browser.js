/**
 * 確保 Playwright Chromium 可用。
 * 優先順序：1) 安裝包內建  2) 使用者目錄已下載  3) 第一次自動下載
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function browsersDir(userDataPath) {
  return path.join(userDataPath, "ms-playwright");
}

export function hasChromium(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((n) => n.startsWith("chromium-"));
  } catch {
    return false;
  }
}

export function applyBrowsersPath(dir) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
  return dir;
}

/**
 * @param {{ userDataPath: string, resourcesPath?: string, onLog?: (msg: string) => void }} opts
 */
export function ensureChromium(opts) {
  const log = opts.onLog || console.log;
  const bundled = opts.resourcesPath
    ? path.join(opts.resourcesPath, "ms-playwright")
    : null;

  if (bundled && hasChromium(bundled)) {
    applyBrowsersPath(bundled);
    log(`使用內建瀏覽器：${bundled}`);
    return { ok: true, dir: bundled, installed: false, source: "bundled" };
  }

  const dir = browsersDir(opts.userDataPath);
  if (hasChromium(dir)) {
    applyBrowsersPath(dir);
    log(`瀏覽器已就緒：${dir}`);
    return { ok: true, dir, installed: false, source: "userData" };
  }

  log("第一次使用：正在下載 Chromium（需網路，約數百 MB）…");
  fs.mkdirSync(dir, { recursive: true });
  applyBrowsersPath(dir);

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
    throw new Error("Chromium 下載後仍找不到，請檢查網路後再重開網頁精靈");
  }

  log("Chromium 下載完成。");
  return { ok: true, dir, installed: true, source: "downloaded" };
}
