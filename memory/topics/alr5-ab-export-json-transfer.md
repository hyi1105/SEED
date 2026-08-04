# ALR5：AB 表單、可設定匯出、JSON 完全轉移

> 主題筆記。對應 standard **0.2.6+**；平台願景與大量匯入見 **0.2.8**。

## 平台願景（0.2.8）

未來**所有系統交付進 ALR5**，在內處理並轉成可轉移 JSON。

## 大量匯入 header＋detail

- 退貨發票等明細超多
- `import_profiles[]`（對應設定，可轉移）
- 結果：`header`＋`lines[]` → 先 draft 再檢核

## AB 表單

| 部分 | 意義 | JSON |
|------|------|------|
| **A** | 表頭 | `header`＋`header_fields[]` |
| **B** | 明細 | `lines[]`＋`line_fields[]` |

## 匯出／自動補齊

- `export_profiles[]` 與 import 對稱
- 缺欄依規範補齊；未知欄保留

## 原則

一切可完全轉移的 JSON；設定優先；互通看 M＋C。
