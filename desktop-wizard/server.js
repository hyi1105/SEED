#!/usr/bin/env node
/**
 * 桌面面板：本機開啟控制台，一鍵跑「開網頁／丟檔／輸入／截圖」
 */
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRecipe } from "./runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3847);
const UPLOAD_DIR = path.join(__dirname, "output", "uploads");
const OUTPUT_DIR = path.join(__dirname, "output");
const RECIPES_DIR = path.join(__dirname, "recipes");

await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/demo", express.static(path.join(__dirname, "recipes")));
app.use("/output", express.static(OUTPUT_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "網頁精靈", port: PORT });
});

app.get("/api/recipes", async (_req, res) => {
  try {
    const names = (await fs.readdir(RECIPES_DIR)).filter((n) =>
      n.endsWith(".json")
    );
    res.json({ recipes: names });
  } catch {
    res.json({ recipes: [] });
  }
});

app.get("/api/recipes/:name", async (req, res) => {
  const safe = path.basename(req.params.name);
  try {
    const raw = await fs.readFile(path.join(RECIPES_DIR, safe), "utf8");
    res.type("json").send(raw);
  } catch {
    res.status(404).json({ error: "找不到配方" });
  }
});

app.get("/api/screenshots", async (_req, res) => {
  const files = (await fs.readdir(OUTPUT_DIR))
    .filter((n) => n.endsWith(".png"))
    .sort()
    .reverse()
    .slice(0, 20)
    .map((n) => ({ name: n, url: `/output/${encodeURIComponent(n)}` }));
  res.json({ screenshots: files });
});

let running = false;

app.post("/api/run", upload.single("file"), async (req, res) => {
  if (running) {
    return res.status(409).json({ error: "已有任務在跑，請稍候" });
  }
  running = true;
  const logs = [];
  const onLog = (msg) => logs.push(String(msg));

  try {
    const body = req.body || {};
    let recipe = {};

    if (body.recipeJson) {
      recipe = JSON.parse(body.recipeJson);
    } else {
      recipe = {
        url: body.url,
        text: body.text || "",
        textTarget: body.textTarget || undefined,
        fileInput: body.fileInput || undefined,
        dropTarget: body.dropTarget || undefined,
        submit: body.submit || undefined,
        headed: body.headed !== "false" && body.headed !== false,
        fullPage: body.fullPage === "true" || body.fullPage === true,
        keepOpenMs: Number(body.keepOpenMs || 0) || 0,
      };
    }

    if (req.file) {
      const original = req.file.originalname || "upload.bin";
      const dest = path.join(UPLOAD_DIR, `${Date.now()}-${original}`);
      await fs.rename(req.file.path, dest);
      recipe.file = dest;
    } else if (body.filePath) {
      recipe.file = body.filePath;
    }

    if (!recipe.url) {
      return res.status(400).json({ error: "請填目標網址" });
    }

    const result = await runRecipe(recipe, {
      headed: recipe.headed !== false,
      outputDir: OUTPUT_DIR,
      onLog,
    });

    res.json({ ...result, logs });
  } catch (err) {
    onLog(`錯誤：${err.message || err}`);
    res.status(500).json({
      ok: false,
      error: err.message || String(err),
      logs,
    });
  } finally {
    running = false;
  }
});

app.listen(PORT, () => {
  console.log(`網頁精靈面板：http://127.0.0.1:${PORT}`);
  console.log(`配方目錄：${RECIPES_DIR}`);
  console.log(`截圖輸出：${OUTPUT_DIR}`);
});
