# ALR5：AB 表單、可設定匯出、JSON 完全轉移

> 主題筆記。對應 standard **0.2.6** 的 `form_composition`／`export_profiles`／`json_completeness`。

## AB 表單

| 部分 | 意義 | JSON |
|------|------|------|
| **A** | 表頭（一筆主檔） | `header`＋`form_schema.header_fields[]` |
| **B** | 明細（多列） | `lines[]`＋`form_schema.line_fields[]` |

- `form_schema.composition = "AB"`
- 由 **owner 設定**完成，不靠改程式
- 與 `creator`／`stages`／`system` 並存

## 固定格式匯出

- `export_profiles[]`：格式、編碼、欄位對應、觸發時機
- 同一 form 可多 profile（不同公司／系統）
- **設定本身也是 JSON**，可隨表單轉移
- 與「完整遷移包」（form＋歷史 items＋附件）分開

## JSON 規範自動補齊

- 缺選用欄 → 標準預設
- 未知欄 → **保留**
- 缺必填且無法推導 → `incomplete`，擋流程動作
- 目標：他系統遵守規範即可自動補齊缺功能／缺欄

## 原則

**一切可完全轉移的 JSON**；互通驗收看 M＋C；V 自訂。
