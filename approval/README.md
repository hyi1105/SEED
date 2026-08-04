# Approval（SEED 接手 · 本機真系統）

紙本／Teams 風簽核：JSON schema 引擎＋簽名流水線＋類 LINE 對話＋雙層儲存（共用／個人）。  
**執行 Agent：SEED**（見 [`給SEED的交接簡報.md`](./給SEED的交接簡報.md)）。  
進度：[`學習約定.md`](./學習約定.md) §4A。

> 本目錄在 **SEED 倉庫** `approval/` 維護（使用者帳號對 `hyi1105/Approval` 無法開 Pages；SEED 可推送）。  
> 上游參考：https://github.com/hyi1105/Approval

## 怎麼開（手機優先）

「本機 serve」是給 **雲端 Agent／你的電腦** 用的；**手機開不了 `127.0.0.1`**（那是對方機器自己）。

| 你在哪 | 怎麼開 |
|--------|--------|
| **手機／任何瀏覽器** | 合併進 `main` 後：https://hyi1105.github.io/SEED/approval/ （走 **SEED 的 Pages**，不是 Approval 的） |
| **還沒合併時** | https://raw.githack.com/hyi1105/SEED/cursor/approval-local-real-237c/docs/approval/index.html |
| **電腦本機開發** | `bash approval/scripts/serve.sh` → http://127.0.0.1:8765/ |

可執行檔同步放在 `docs/approval/`（SEED Pages 只發佈 `docs/`）。  
⚠️ 不要用 `file://` 或 GitHub Raw 直接開（會變純文字／fetch 失敗）。

## 已做成的關卡能力

| 關卡 | 內容 |
|------|------|
| UI | **純對話**：欄位＋Approver 嵌框；無獨立表單／流水線 |
| A1／A2 | schema 驅動；本機／SEED Pages 可開 |
| A3 | 點 Approver 框：換人／退回／通知／個人卡／核准駁回 |
| A4 | 每框 `bound_fields` 白名單 |
| A5 | shared／personal(userId) 雙層儲存 |
| A6 | 登入切換＋Teams stub |

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
