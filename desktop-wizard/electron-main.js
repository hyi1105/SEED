/**
 * Electron 主程式：雙擊 .exe → 開桌面板視窗
 */
import { app, BrowserWindow, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { startServer } from "./server.js";
import { ensureChromium } from "./ensure-browser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 開發時用專案目錄；打包後用解包目錄（含 public／recipes） */
function staticRoot() {
  if (!app.isPackaged) return __dirname;
  const unpacked = path.join(process.resourcesPath, "app.asar.unpacked");
  if (fs.existsSync(path.join(unpacked, "public"))) return unpacked;
  return __dirname;
}

async function createWindow(port) {
  const win = new BrowserWindow({
    width: 780,
    height: 920,
    minWidth: 520,
    minHeight: 640,
    title: "網頁精靈",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await win.loadURL(`http://127.0.0.1:${port}`);
}

async function main() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  await app.whenReady();

  const userData = app.getPath("userData");

  if (app.isPackaged) {
    try {
      ensureChromium({
        userDataPath: userData,
        resourcesPath: process.resourcesPath,
      });
    } catch (err) {
      dialog.showErrorBox(
        "網頁精靈",
        `無法準備瀏覽器引擎：\n${err.message || err}\n\n請確認有網路後再重開。\n若 Windows 擋下來，請對 exe 右鍵→內容→解除封鎖。`
      );
      app.quit();
      return;
    }
  }

  const root = staticRoot();
  const outputDir = path.join(userData, "output");

  const { port } = await startServer({
    port: 0,
    mode: "electron",
    rootDir: root,
    publicDir: path.join(root, "public"),
    recipesDir: path.join(root, "recipes"),
    outputDir,
  });

  await createWindow(port);

  app.on("second-instance", () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins[0]) {
      if (wins[0].isMinimized()) wins[0].restore();
      wins[0].focus();
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(port);
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

main().catch((err) => {
  console.error(err);
  app.quit();
});
