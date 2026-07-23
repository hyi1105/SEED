#!/usr/bin/env node
/**
 * 網頁精靈執行器（Playwright）
 * 步驟：開網頁 →（可選）丟檔 →（可選）輸入文字 → 截圖
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.join(__dirname, "output");

function parseArgs(argv) {
  const out = { recipe: null, headed: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--recipe") out.recipe = argv[++i];
    else if (a === "--headless") out.headed = false;
    else if (a === "--headed") out.headed = true;
  }
  return out;
}

async function loadRecipe(recipePath) {
  const abs = path.isAbsolute(recipePath)
    ? recipePath
    : path.join(process.cwd(), recipePath);
  const raw = await fs.readFile(abs, "utf8");
  return JSON.parse(raw);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function stampName(prefix, ext = "png") {
  const t = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${t}.${ext}`;
}

/**
 * @param {object} recipe
 * @param {{ headed?: boolean, outputDir?: string, onLog?: (msg: string) => void }} opts
 */
export async function runRecipe(recipe, opts = {}) {
  const log = opts.onLog || console.log;
  const headed = opts.headed !== false && recipe.headed !== false;
  const outputDir = opts.outputDir || recipe.outputDir || DEFAULT_OUTPUT;
  await ensureDir(outputDir);

  const url = recipe.url;
  if (!url) throw new Error("配方缺少 url");

  const screenshots = [];
  log(`開啟瀏覽器（${headed ? "可視" : "背景"}）…`);
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: recipe.viewport || { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    log(`前往：${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    if (recipe.screenshotBefore !== false) {
      const name = await stampName("before");
      const file = path.join(outputDir, name);
      await page.screenshot({ path: file, fullPage: !!recipe.fullPage });
      screenshots.push(file);
      log(`截圖（執行前）：${name}`);
    }

    // 丟檔：優先用 file input；否則對 drop 區模擬拖放
    if (recipe.file) {
      const filePath = path.isAbsolute(recipe.file)
        ? recipe.file
        : path.join(process.cwd(), recipe.file);
      await fs.access(filePath);

      if (recipe.fileInput) {
        log(`丟檔到 input：${recipe.fileInput}`);
        await page.locator(recipe.fileInput).first().setInputFiles(filePath);
      } else if (recipe.dropTarget) {
        log(`拖放到目標：${recipe.dropTarget}`);
        await dropFileOn(page, recipe.dropTarget, filePath);
      } else {
        // 嘗試常見 file input
        const inputs = page.locator('input[type="file"]');
        const count = await inputs.count();
        if (count === 0) {
          throw new Error(
            "找不到檔案上傳欄位。請在配方填 fileInput 或 dropTarget。"
          );
        }
        log(`丟檔到第一個 input[type=file]`);
        await inputs.first().setInputFiles(filePath);
      }
    }

    // 輸入文字
    if (recipe.text != null && recipe.text !== "") {
      const textTarget = recipe.textTarget || "textarea, input[type='text'], [contenteditable='true']";
      log(`輸入文字到：${textTarget}`);
      const loc = page.locator(textTarget).first();
      await loc.waitFor({ state: "visible", timeout: 15000 });
      const tag = await loc.evaluate((el) => el.tagName.toLowerCase());
      const editable = await loc.evaluate(
        (el) => el.getAttribute("contenteditable") === "true"
      );
      if (editable) {
        await loc.click();
        await page.keyboard.type(String(recipe.text), { delay: 20 });
      } else if (tag === "input" || tag === "textarea") {
        await loc.fill(String(recipe.text));
      } else {
        await loc.click();
        await page.keyboard.type(String(recipe.text), { delay: 20 });
      }
    }

    // 可選：按送出
    if (recipe.submit) {
      log(`點擊送出：${recipe.submit}`);
      await page.locator(recipe.submit).first().click();
      await page.waitForTimeout(recipe.waitAfterSubmitMs || 800);
    }

    // 自訂步驟（之後可擴：點擊、等待、截圖）
    for (const step of recipe.steps || []) {
      await runStep(page, step, outputDir, screenshots, log);
    }

    const afterName = await stampName("after");
    const afterFile = path.join(outputDir, afterName);
    await page.screenshot({ path: afterFile, fullPage: !!recipe.fullPage });
    screenshots.push(afterFile);
    log(`截圖（執行後）：${afterName}`);

    const result = {
      ok: true,
      url,
      screenshots,
      message: "完成：開網頁／丟檔／輸入／截圖",
    };
    log("完成。");
    return result;
  } finally {
    // 可視模式多留一下讓人看結果；背景模式立刻關
    if (headed && recipe.keepOpenMs) {
      await page.waitForTimeout(recipe.keepOpenMs);
    }
    await browser.close();
  }
}

async function dropFileOn(page, selector, filePath) {
  const buffer = await fs.readFile(filePath);
  const name = path.basename(filePath);
  const handle = await page.locator(selector).first().elementHandle();
  if (!handle) throw new Error(`找不到 dropTarget：${selector}`);

  await page.evaluate(
    async ({ el, bytes, fileName }) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(bytes)], fileName);
      dt.items.add(file);
      for (const type of ["dragenter", "dragover", "drop"]) {
        el.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
        );
      }
    },
    { el: handle, bytes: [...buffer], fileName: name }
  );
}

async function runStep(page, step, outputDir, screenshots, log) {
  const type = step.type || step.action;
  if (type === "click") {
    log(`步驟 click：${step.target}`);
    await page.locator(step.target).first().click();
  } else if (type === "wait") {
    log(`步驟 wait：${step.ms || 500}ms`);
    await page.waitForTimeout(step.ms || 500);
  } else if (type === "screenshot") {
    const name = await stampName(step.name || "step");
    const file = path.join(outputDir, name);
    await page.screenshot({ path: file, fullPage: !!step.fullPage });
    screenshots.push(file);
    log(`步驟截圖：${name}`);
  } else if (type === "type") {
    log(`步驟 type：${step.target}`);
    await page.locator(step.target).first().fill(String(step.text ?? ""));
  } else {
    throw new Error(`未知步驟：${type}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.recipe) {
    console.error("用法：node runner.js --recipe recipes/demo.json [--headless]");
    process.exit(1);
  }
  const recipe = await loadRecipe(args.recipe);
  if (!args.headed) recipe.headed = false;
  const result = await runRecipe(recipe, { headed: args.headed });
  console.log(JSON.stringify(result, null, 2));
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
