#!/usr/bin/env node
/**
 * 桌面面板 HTTP 服務（npm start 與 Electron 共用）
 */
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRecipe } from "./runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolvePaths(options = {}) {
  const rootDir = options.rootDir || __dirname;
  const outputDir = options.outputDir || path.join(rootDir, "output");
  return {
    rootDir,
    outputDir,
    uploadDir: path.join(outputDir, "uploads"),
    recipesDir: options.recipesDir || path.join(rootDir, "recipes"),
    publicDir: options.publicDir || path.join(rootDir, "public"),
  };
}

export async function createApp(options = {}) {
  const paths = resolvePaths(options);
  await fs.mkdir(paths.uploadDir, { recursive: true });
  await fs.mkdir(paths.outputDir, { recursive: true });

  const upload = multer({ dest: paths.uploadDir });
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(paths.publicDir));
  app.use("/demo", express.static(paths.recipesDir));
  app.use("/output", express.static(paths.outputDir));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "網頁精靈",
      port: options.port ?? null,
      mode: options.mode || "server",
    });
  });

  app.get("/api/recipes", async (_req, res) => {
    try {
      const names = (await fs.readdir(paths.recipesDir)).filter((n) =>
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
      const raw = await fs.readFile(path.join(paths.recipesDir, safe), "utf8");
      res.type("json").send(raw);
    } catch {
      res.status(404).json({ error: "找不到配方" });
    }
  });

  app.get("/api/screenshots", async (_req, res) => {
    const files = (await fs.readdir(paths.outputDir))
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
        const dest = path.join(paths.uploadDir, `${Date.now()}-${original}`);
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
        outputDir: paths.outputDir,
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

  return { app, paths };
}

export async function startServer(options = {}) {
  const wantPort = Number(options.port ?? process.env.PORT ?? 3847);
  const { app, paths } = await createApp({
    ...options,
    port: wantPort,
    mode: options.mode || "server",
  });

  const server = await new Promise((resolve, reject) => {
    const s = app.listen(wantPort, "127.0.0.1", (err) => {
      if (err) reject(err);
      else resolve(s);
    });
  });

  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : wantPort;

  console.log(`網頁精靈面板：http://127.0.0.1:${port}`);
  console.log(`配方目錄：${paths.recipesDir}`);
  console.log(`截圖輸出：${paths.outputDir}`);
  return { port, paths, server };
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
