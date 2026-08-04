# ALR5 標準互通規格（可貼給 AI）

> **用途：** 整份複製貼給新的 AI／Agent，要求依此實作簽核 JSON 互傳。  
> **機器可讀原文：** `docs/approval/alr5-standard.json`（standard_version **0.2.6**）  
> **人讀總規：** `approval/ALR5簽核系統.md`  
> **檢查原則：** `interop_checklist` 裡所有 `required: true` 通過 → 視為可與 ALR5 互通。

---

## 給 AI 的開場（請一併貼上）

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.6** 與 `json_contract`／`interop_checklist`／`decisions`／`form_composition`／`export_profiles`／`json_completeness` 實作。狀態、`current_level`、動作 id 不得自創別名。`decisions` 已定案不得違反。產出必須通過全部 `required: true` 檢查；缺欄／缺功能依 `json_completeness` 用標準預設自動補齊。

---

## 互通架構（MVC 語意）

| 層 | 對應 | 說明 |
|----|------|------|
| **M** | **可完全轉移的 JSON** | form／申請單／匯出設定／權限／流程皆可序列化；結構認證後可傳給其他平台 |
| **C** | 功能是否符合 ALR5 | checklist／decisions；缺功能依規範補預設 |
| **V** | 畫面 | 各端／AI 自訂；**不綁死 UI** |

---

## AB 表單／匯出／自動補齊（0.2.6）

| 項目 | 定案 |
|------|------|
| AB | **A＝`header`**（表頭一筆）、**B＝`lines[]`**（明細多列）；使用者設定 |
| 固定格式匯出 | **`export_profiles[]`**（格式＋欄位對應；可多 profile）；設定也是 JSON |
| 完整遷移包 | form 定義＋歷史 items＋附件（另案 `d_export_full`） |
| 自動補齊 | 缺選用欄→預設；未知欄→保留；缺必填無法推導→incomplete |
| 設定優先 | 不靠改程式 |

機器原文：`form_composition`、`export_profiles`、`json_completeness`。

---

## 已定案（必遵守，摘要）

Denied=-2；一人 Reject 整單 Denied；Return 作廢後續；SAVE→0；Cancel 同單升版；Denied Copy；Archive＝`system.archived`（不改 status，admin 復原）；ACL item 優先；required_from_level；多 owner；it_admin 補 owner；每關 comment；MVC；**AB／export_profiles／json_completeness**。

完整表見 `alr5-standard.json` → `decisions`。

---

## 仍待決

1. 明細是否列級簽核／ACL？  
2. 匯出檔存放與重送策略？  

---

## 版本

- standard_version: **0.2.6**  
- 更新日期: 2026-08-04  
