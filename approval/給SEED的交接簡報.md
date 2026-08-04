# 給 SEED Agent 的交接簡報（請整份遵守）

> **交接時間：** 2026-08-04  
> **交接原因：** 使用者帳號／隱私權限看不到 GitHub Pages 設定；改由 **SEED** 接手，把假畫面做成真系統。  
> **倉庫：** https://github.com/hyi1105/Approval  
> **進行中 PR／分支：** https://github.com/hyi1105/Approval/pull/3　`cursor/approval-architecture-map-e312`  
> **完整約定：** 同倉庫 `學習約定.md`（以 GitHub 版為準）  
> **學習法精簡版：** `給其他Agent的學習法簡報.md`

---

## 0. 給使用者可貼給 SEED 的最短開場（複製下面整段）

```text
你是 SEED。請先讀 GitHub 倉庫 https://github.com/hyi1105/Approval 裡的：
1) 給SEED的交接簡報.md（本交接）
2) 學習約定.md
3) 給其他Agent的學習法簡報.md
4) docs/（Teams 假畫面）、schema/form-schema.example.json

【你必須遵守】
- 一律台灣繁體中文；關卡制＋完成百分比；一關≤3題；禁止無限追問。
- 使用者說都可以／沒想法時，由你選路徑並執行。
- 新約定寫回 學習約定.md 並推 GitHub。

【你的任務＝做成真的】
假畫面已在 docs/。GitHub Pages 使用者開不了（權限／隱私），不要卡在 Pages。
改走：本機可開 → 再接真實登入與雙層儲存（SharePoint 共用＋個人空間隱私欄）→ Teams 通知可選。
從關卡 A2 收尾（繞過 Pages）開始，接著 A3→A6。先複述學習法 5 行＋關卡表＋你選的下一步。
```

---

## 1. 使用者是誰、怎麼教

- 真實需要才認真；啟動成本高就容易放棄。
- 喜歡關卡、百分比、過關結算；不要長篇灌輸、不要無限追問。
- 先架構地圖，再細節，再實作；操作一次一步。
- 記憶：12345 同一畫面，**3 為主錨**。
- 語言：台灣繁體；語音誤識要猜對（例：PMP→PnP）。

---

## 2. 產品要做成什麼（真系統，不是 Demo 故事）

紙本風簽核網站（畫面可長得很像公司 Teams）：

| 區塊 | 行為 |
|------|------|
| 紙本表單 | 純文字像紙；欄位數可設；內部名＋顯示名 |
| 欄位型態 | 文字／數字／下拉／是非／人員 |
| 規則 | 必填、條件填、顯示、唯讀、設計預覽 |
| 按鈕 | 送出、核准、駁回、退回、通知請簽 |
| 簽名流水線 | 水位線；點人：換代理／換簽核／退回／通知／看個人資料 |
| 對話室 | 像 LINE，一人一句一格；格子可限定只能填某些欄 |
| 隱私 | `shared` 進共用庫；`personal` 只在個人空間；別人畫面**沒有那格**；用登入／手機對應 ID 組裝 |

**不要做：** 依賴付費 Power Apps／Power Automate 進階；一開始就接內網 SQL。

---

## 3. 已選定技術路徑（未指定時照此走）

```
1 登入 ID（Entra；手機同一人）
2 JSON 表單引擎＋紙本／Teams 風 UI
3 雙層資料（主錨）
   ├─ shared → SharePoint 清單
   └─ personal → 個人空間（OneDrive／個人清單）；應用只存 ID
4 簽名流水線
5 對話室＋可選 Teams 通知（Graph）
```

腳本側可用 Python + Microsoft Graph（必要再補 PnP PowerShell）。

---

## 4. 倉庫現況（SEED 接手後）

| 路徑 | 內容 |
|------|------|
| **SEED** `approval/docs/` | **可執行**前端（schema 引擎＋流水線＋對話＋雙層儲存＋登入模擬） |
| **SEED** `approval/scripts/serve.sh` | 本機一鍵開啟 |
| 上游 `hyi1105/Approval` | 約定／假畫面來源；SEED **無 push 權限**時以 SEED `approval/` 為準 |
| `.github/workflows/pages.yml` | Pages（使用者開不了，忽略） |

**本機已驗證：** HTTP 200（index／schema／app.js）。  
**阻塞已排除：** 不再要求開 GitHub Pages。

---

## 5. 關卡儀表板（接手後由 SEED 更新）

| 關卡 | 內容 | 狀態 | 進度 |
|------|------|------|------|
| A0 | 架構＋願景 | ✅ | 100% |
| A1 | schema 驅動渲染 | ✅ | 100% |
| A2 | 本機可開（繞過 Pages） | ✅ | 100% |
| A3 | 流水線點擊做實 | ✅ | 100% |
| A4 | 對話室＋限定欄位 | ✅ | 100% |
| A5 | 雙層儲存 PoC（本機） | ✅ | 100% |
| A6 | 登入模擬＋Teams stub | ✅ 模擬 | 80% |

**總進度約 85%。** 可執行碼在 **SEED `approval/`**（因 cursor[bot] 無法 push 上游 Approval）。  
開啟：`bash approval/scripts/serve.sh` → http://127.0.0.1:8765/

### SEED 已執行順序

1. ✅ 結算 A2：不依賴 Pages；本機 serve 腳本  
2. ✅ A1：docs 讀 schema JSON 渲染  
3. ✅ A3／A4：流水線與對話綁欄寫入狀態（localStorage）  
4. ✅ A5：shared／personal 分庫；切身分隱藏個人欄  
5. ✅ A6：登入切換＋Teams 通知 stub（真 Entra／Graph 待公司憑證）

---

## 6. 已知決策與語音澄清

- Power 加價方案已放棄；改自建。  
- 「PMP」＝**PnP** PowerShell。  
- 要的是網站（可像 Teams），不是只做 Teams 卡片。  
- 隱私欄：「資料不在應用共用區，在個人空間；應用有 ID 才能顯示對應欄。」

---

## 7. SEED 開場檢查清單

- [x] 繁中、關卡％、≤3 題  
- [x] 已讀本檔＋`學習約定.md`  
- [x] 不要求使用者開 GitHub Pages  
- [x] 選一條「做成真的」路徑並開工（本機＋雙層儲存 PoC）  
- [x] 進度寫回 `學習約定.md` 並 commit／push（推 SEED） 

---

## 8. 交接聲明

自此 **現行執行 Agent＝SEED**。本檔與 `學習約定.md` §0／§4A 同步後，以 SEED 更新的 GitHub 版本為準。
