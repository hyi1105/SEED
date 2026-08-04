# ALR5 標準互通規格（可貼給 AI）

> **機器可讀原文：** `docs/approval/alr5-standard.json`（**0.2.8**）  
> **人讀總規：** `approval/ALR5簽核系統.md`

## 給 AI 的開場

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.8** 與相關區塊（含 `platform_scope`／`bulk_import`／`cross_links`／`form_composition` 等）實作。`decisions` 不得違反；缺欄依 `json_completeness` 補齊。

## 平台願景

**所有系統交付進 ALR5** → 在內處理 → **轉成／維持可轉移 JSON**（M＋C 共用規範；V 可分系統自訂）。

## 大量匯入（header＋detail）

- 場景：退貨發票等**明細超多**
- `import_profiles[]` 設定對應（匯出的反向）
- 對到 AB：`header`＋`lines[]`
- 一單多明細或檔內多單；先 **draft** 再檢核／Submit；寫 import_logs

## 其他能力（摘要）

AB 表單｜export_profiles｜跨單 prerequisites／links／effects｜on_demand／preallocated｜Archive 旗標｜Denied Copy｜自動補齊… → 見 `decisions`。

## 仍待決

明細儲存上限／分片；匯入非同步；跨單 UI；回寫衝突；預建逾時；列級簽核；匯出檔存放。

## 版本

**0.2.8**｜2026-08-04
