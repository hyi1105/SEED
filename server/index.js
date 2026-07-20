/**
 * SEED API — 付費代辦「AI 回答 / 改稿」
 * - 模型 key 只在伺服器環境變數，永不進前端
 * - 會員碼 + 假／檔案配額（之後接真金流）
 *
 * Env:
 *   OPENAI_API_KEY     必填（或相容服務的 key）
 *   OPENAI_BASE_URL    選填，預設 https://api.openai.com/v1
 *   OPENAI_MODEL       選填，預設 gpt-4o-mini
 *   SEED_MEMBERS       必填，格式 code:quota,code2:quota  例：demo:20,family:50
 *   PORT               選填，預設 8787
 *   CORS_ORIGIN        選填，預設 *（之後可鎖 hyi1105.github.io）
 */

import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SEED_DATA_DIR || path.join(__dirname, "data");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");

const PORT = Number(process.env.PORT || 8787);
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
  /\/$/,
  ""
);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

function parseMembers(raw) {
  const map = new Map();
  for (const part of String(raw || "").split(",")) {
    const t = part.trim();
    if (!t) continue;
    const [code, q] = t.split(":");
    if (!code) continue;
    const quota = Number(q);
    map.set(code.trim(), Number.isFinite(quota) ? quota : 10);
  }
  return map;
}

const MEMBERS = parseMembers(process.env.SEED_MEMBERS || "demo:20");

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify({ month: monthKey(), used: {} }, null, 2));
  }
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function readUsage() {
  ensureData();
  const data = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  const mk = monthKey();
  if (data.month !== mk) {
    return { month: mk, used: {} };
  }
  return data;
}

function writeUsage(data) {
  ensureData();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

function getBearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

function memberFromReq(req) {
  const code = getBearer(req) || String(req.headers["x-seed-member"] || "").trim();
  if (!code || !MEMBERS.has(code)) return null;
  return { code, quota: MEMBERS.get(code) };
}

function quotaStatus(code, quota) {
  const usage = readUsage();
  const used = Number(usage.used[code] || 0);
  return {
    member: code,
    month: usage.month,
    quota,
    used,
    remaining: Math.max(0, quota - used),
  };
}

function consume(code) {
  const usage = readUsage();
  usage.used[code] = Number(usage.used[code] || 0) + 1;
  writeUsage(usage);
  return usage.used[code];
}

function stripFences(text) {
  let t = (text || "").trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t;
}

const app = express();
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((s) => s.trim()),
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "seed-api",
    modelConfigured: Boolean(OPENAI_KEY),
    members: MEMBERS.size,
  });
});

app.get("/v1/quota", (req, res) => {
  const member = memberFromReq(req);
  if (!member) {
    return res.status(401).json({ error: "會員碼無效，請檢查後再試" });
  }
  res.json(quotaStatus(member.code, member.quota));
});

app.post("/v1/ai/revise", async (req, res) => {
  try {
    if (!OPENAI_KEY) {
      return res.status(503).json({ error: "服務尚未設定模型鑰匙，請稍後再試" });
    }
    const member = memberFromReq(req);
    if (!member) {
      return res.status(401).json({ error: "會員碼無效。付費後會拿到一組會員碼。" });
    }
    const status = quotaStatus(member.code, member.quota);
    if (status.remaining <= 0) {
      return res.status(402).json({
        error: "本月次數用完了。請升級方案或下個月再來。",
        quota: status,
      });
    }

    const { title, instruction, content } = req.body || {};
    if (!instruction || !content) {
      return res.status(400).json({ error: "請提供修改指示與正文" });
    }

    const upstream = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "你是知識筆記編輯助手。根據使用者指示改寫 Markdown 全文。" +
              "只輸出完整 Markdown 正文，不要加解釋、不要用 ``` 包起來。" +
              "保留原有標題結構；專有名詞旁可加一句白話。語氣清楚、給人掃一眼也看得懂。",
          },
          {
            role: "user",
            content:
              `檔名／主題：${title || "未命名"}\n\n` +
              `修改指示：\n${instruction}\n\n` +
              `目前正文：\n${content}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("upstream error", upstream.status, detail.slice(0, 500));
      return res.status(502).json({ error: "模型服務暫時失敗，請稍後再試" });
    }

    const data = await upstream.json();
    const revised = stripFences(data.choices?.[0]?.message?.content || "");
    if (!revised) {
      return res.status(502).json({ error: "模型沒有產出內容" });
    }

    consume(member.code);
    const after = quotaStatus(member.code, member.quota);
    res.json({ revised, quota: after });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "伺服器錯誤，請稍後再試" });
  }
});

app.post("/v1/ai/respond", async (req, res) => {
  try {
    if (!OPENAI_KEY) {
      return res.status(503).json({ error: "服務尚未設定模型鑰匙，請稍後再試" });
    }
    const member = memberFromReq(req);
    if (!member) {
      return res.status(401).json({ error: "會員碼無效。付費後會拿到一組會員碼。" });
    }
    const status = quotaStatus(member.code, member.quota);
    if (status.remaining <= 0) {
      return res.status(402).json({
        error: "本月次數用完了。請升級方案或下個月再來。",
        quota: status,
      });
    }

    const { title, systemPrompt, userResponse } = req.body || {};
    if (!systemPrompt || !userResponse) {
      return res.status(400).json({ error: "請提供 system 與 user 兩段內容" });
    }

    const upstream = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "你是問答助手。請先理解 system 給的情境或提問，再根據 user 的回答直接作答。" +
              "只輸出給使用者看的回答，不要加 JSON、不要用 ``` 包起來、不要另外描述流程。",
          },
          {
            role: "user",
            content:
              `目前主題：${title || "未命名"}\n\n` +
              `System：\n${systemPrompt}\n\n` +
              `User：\n${userResponse}`,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("upstream error", upstream.status, detail.slice(0, 500));
      return res.status(502).json({ error: "模型服務暫時失敗，請稍後再試" });
    }

    const data = await upstream.json();
    const answer = stripFences(data.choices?.[0]?.message?.content || "");
    if (!answer) {
      return res.status(502).json({ error: "模型沒有產出內容" });
    }

    consume(member.code);
    const after = quotaStatus(member.code, member.quota);
    res.json({ answer, quota: after });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "伺服器錯誤，請稍後再試" });
  }
});

ensureData();
app.listen(PORT, () => {
  console.log(`SEED API on :${PORT} members=${MEMBERS.size} model=${OPENAI_MODEL}`);
});
