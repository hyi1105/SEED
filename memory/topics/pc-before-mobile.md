---
date: 2026-07-20
time: 11:07 (UTC+8)
tags: [ops, mobile, checklist, paid]
status: active
---

# 關機改用手機前：電腦上必做／可之後做

## 這台公司電腦的現況（2026-07-20）

- 已 push 程式到 GitHub；**本機沒有安裝 Node／npm**（不影響用 Railway／Render 雲端建置）  
- 因此「本機跑 server」可略過；優先雲端部署

## 手機也能做（不必開公司電腦）

1. 開 [Railway](https://railway.app) 或 [Render](https://render.com) → 用 GitHub 登入 → New Project → 選 `hyi1105/SEED`  
2. Root Directory 設 `server`  
3. 環境變數：
   - `OPENAI_API_KEY`＝你的模型 key  
   - `SEED_MEMBERS`＝`demo:20`（之後改成真會員碼）  
   - `CORS_ORIGIN`＝`*`（之後可鎖 Pages 網址）  
4. Deploy 成功後複製公開網址  
5. 改 `docs/config.json` 的 `apiBase` 為該網址 → commit／push（可用手機 GitHub 網頁編輯，或跟 Cursor Cloud Agent 說）  
6. 預覽頁輸入會員碼 `demo` 測「請 AI 改」

## 一定不要在手機／聊天做的

- 把 `OPENAI_API_KEY`、GitHub PAT 貼到聊天或 Public issue  
- 把 `.env` 推進 GitHub  

## 公司電腦關機後仍可用

| 管道 | 用途 |
|---|---|
| GitHub + raw.githack / Pages | 看 SEED 畫面 |
| Cursor iOS / cursor.com/agents | 改 repo（需 Cloud Agent／付費） |
| OneDrive App | 讀已同步的 `.md`（唯讀較穩） |

## 回公司電腦時

在 `Cursor_KB` 執行 `git pull`，與 GitHub 對齊。
