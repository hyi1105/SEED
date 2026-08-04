# Approval（SEED 接手 · 本機真系統）

紙本／Teams 風簽核：JSON schema 引擎＋簽名流水線＋類 LINE 對話＋雙層儲存（共用／個人）。  
**執行 Agent：SEED**（見 [`給SEED的交接簡報.md`](./給SEED的交接簡報.md)）。  
進度：[`學習約定.md`](./學習約定.md) §4A。

> 本目錄在 **SEED 倉庫** `approval/` 維護（使用者帳號對 `hyi1105/Approval` 無法開 Pages；SEED 可推送）。  
> 上游參考：https://github.com/hyi1105/Approval

## 本機開啟（不依賴 GitHub Pages）

```bash
# 在 SEED 倉庫根目錄
bash approval/scripts/serve.sh
# 瀏覽器開 http://127.0.0.1:8765/
```

或：

```bash
cd approval/docs && python3 -m http.server 8765
```

⚠️ 請用本機 HTTP 開啟（`schema.json` 需 fetch）。不要用 `file://`。

## 已做成的關卡能力

| 關卡 | 內容 |
|------|------|
| A1／A2 | 讀 `docs/schema.json` 渲染欄位；本機可開 |
| A3 | 流水線：換代理／換簽核／退回／通知／個人卡（寫入狀態） |
| A4 | 對話室＋訊息綁定欄位白名單 |
| A5 | 雙層儲存 PoC：`localStorage` 分 shared／personal(userId)；切簽核人看不到個人欄 |
| A6 | 登入身分切換（之後接 Entra）；可選 Teams 通知 stub |

## 檔案

| 路徑 | 說明 |
|------|------|
| `docs/` | 可執行前端 |
| `schema/form-schema.example.json` | schema 範例（與 docs 同步） |
| `scripts/serve.sh` | 一鍵本機伺服器 |
| `學習約定.md` | 規則＋進度 |

## 下一步（真雲端）

1. shared → Microsoft Graph／SharePoint 清單  
2. personal → OneDrive 或個人清單（依 user_id）  
3. 登入 → Entra ID（MSAL）  
4. Teams 通知 → Graph Activity／chat message（可選）
