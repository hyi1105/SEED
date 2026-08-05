# ALR5 標準互通規格（可貼給 AI）

> **機器可讀原文：** `docs/approval/alr5-standard.json`（**0.3.1**）  
> **人讀總規：** `approval/ALR5簽核系統.md`

## 給 AI 的開場

依 **ALR5/0.3.1** 實作。含 form 版本、環境試跑、發布 SOP／退回、schema_migration。`decisions` 不得違反。未決項見 `open_questions`（附建議選項，待拍板）。

## 版本／環境／發布（0.3.0）

| 概念 | 說明 |
|------|------|
| `form_version` | 每個 form 要跑哪一版 |
| 正式名義測試環境 | 新建 formal 環境但用途＝測試，試新版 |
| 漸進發布 | 試跑 → 幾個正式 → 複雜環境；可自動 SOP |
| 退回 | 改環境 binding 回舊 `form_version` |
| `schema_migration` | JSON 結構改版可升到最新（≠ form_version） |

## 平台願景（摘要）

全系統進 ALR5→JSON｜AB／匯入匯出｜跨單｜開單模式｜公證｜加密信封｜上表發布模型

## 0.3.1

未決／風險附 `recommendation`＋`options`／`scenarios`，供拍板；尚未自動寫入 `decisions`。

## 版本

**0.3.1**｜2026-08-05
