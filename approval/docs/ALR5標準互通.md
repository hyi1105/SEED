# ALR5 標準互通規格（可貼給 AI）

> **用途：** 整份複製貼給新的 AI／Agent，要求依此實作簽核 JSON 互傳。  
> **機器可讀原文：** `docs/approval/alr5-standard.json`（standard_version **0.2.5**）  
> **人讀總規：** `approval/ALR5簽核系統.md`  
> **檢查原則：** `interop_checklist` 裡所有 `required: true` 通過 → 視為可與 ALR5 互通。

---

## 給 AI 的開場（請一併貼上）

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.5** 與 `json_contract`／`interop_checklist`／`decisions` 實作。狀態、`current_level`、動作 id 不得自創別名。`decisions` 已定案不得違反。產出必須通過全部 `required: true` 檢查。

---

## 互通架構（MVC 語意）

| 層 | 對應 | 說明 |
|----|------|------|
| **M** | JSON 資料 | 結構認證後可傳給其他平台 |
| **C** | 功能是否符合 ALR5 | checklist／decisions（動作、level、權限、檢核） |
| **V** | 畫面 | 各端／AI 自訂；**不綁死 UI** |

互通驗收看 **M＋C**。

---

## 已定案（必遵守）

| 題 | 定案 |
|----|------|
| Denied 的 level | **`-2`** |
| any／all 一人 Reject | **整單 Denied** |
| Return 到中間關 | **後面已簽關作廢並重簽** |
| 第一次 SAVE | **level → 0** |
| Cancel 後重送 | **同 doc_no，升 .N** |
| Denied Copy | 全新單；owner 定欄；**admin** 定誰／哪幾張 |
| Archive | **`system.archived=true` 軟刪除**；**與 status 無關**；原 status／level **不變**；**admin unarchive** 復原 |
| Cancel | `cancelled`／`-1`（與 Archive 分開） |
| 已簽核格 | admin 不行；owner／it_admin 可改＋紀錄 |
| 多 owner | 可以 |
| it_admin | 可補派 owner；完整 export；form 封存→進行中 Cancel |
| export | 定義＋歷史 items＋附件 |
| 簽核後異動 | `post_approval_amended`＋小紅點 |
| `required_from_level` | ＝0 Submit 擋；≥1 Approve 前擋 |
| 每關 comment | 固定；代簽備註＝`proxy_original_note` |

---

## 狀態（不含 archived）

`new`／`draft`／`in_process`／`completed`／`denied`／`cancelled`  
另：`system.archived` 旗標控制軟刪除列表可見性。

---

## 仍待決

（目前無。）

---

## 版本

- standard_version: **0.2.5**  
- 更新日期: 2026-08-04  
