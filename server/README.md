# SEED API（付費代辦 AI）

阿嬤只付錢／拿**會員碼**；模型鑰匙只放伺服器。

## 本機跑

```bash
cd server
cp .env.example .env   # 填入 OPENAI_API_KEY、SEED_MEMBERS
npm install
npm start
```

健康檢查：http://localhost:8787/health

## 環境變數

| 變數 | 說明 |
|---|---|
| `OPENAI_API_KEY` | 你的模型 key（必填） |
| `SEED_MEMBERS` | `會員碼:每月次數`，逗號分隔，例 `demo:20,ama:30` |
| `CORS_ORIGIN` | 上線後建議鎖成 Pages 網址 |

## 前端怎接

在 `docs/config.json` 設 `"apiBase": "https://你的服務網址"`。  
使用者在畫面貼**會員碼**（不是 sk- key）。

## 部署（手機也可做）

用 Railway／Render／Fly：接 GitHub `SEED` repo，Root Directory = `server`，把上面環境變數貼進 Secrets。
