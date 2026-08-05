---
date: 2026-08-05
time: 03:34 (UTC)
tags: [SEED, Approval, ALR5, 設計表單, 手機, UI, 響應式]
status: active
---

# ALR5：設計表單手機版改卡片布局

## 摘要

手機上「內容欄位」寬表被擠成直排單字。窄螢幕改每列一張卡（標籤＋控制項），輸入可滿寬。

## 重點

- `≤720px`：`.content-field-row`／`.stage-row` 卡片化；`data-label` 當列標
- 基本資料 edit-table 改直向卡片
- 列表表可橫滑（`table-scroll`＋min-width）
- cache `?v=design8`

## 圖片

- 問題畫面（使用者手機）：內容欄位 field_id／label 被壓成直排字元；default／rules 錯位

## 修正（第二次）
- 原因：列表用的 `min-width: 28rem` 也套到設計編輯表，撐破螢幕→內容偏左、右側大片黑
- 改為 `:not(.design-edit)` 才套 28rem；設計表 `display:block`＋`max-width:100%`；`?v=design9`

## 待續

- 申請 A4 在極窄螢幕再調
