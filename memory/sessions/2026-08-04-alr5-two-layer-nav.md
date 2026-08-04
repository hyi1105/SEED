---
date: 2026-08-04
time: 18:51 (UTC)
tags: [SEED, Approval, ALR5, 兩層導覽, 設計表單, UI]
status: active
---

# ALR5 兩層導覽＋申請畫面三處修正

## 摘要

申請與 Owner「設計表單」皆改為兩層：先列表選 Form，再進申請／表格編輯設定。申請畫面拿掉重複操作列、操作者進系統欄、狀態不可點、測試下拉變窄。

## 重點

- **申請**：層一選表單 → 層二該 Form 申請畫面（← 返回列表）
- **設計表單（Owner）**：層一新增／管理表單 → 層二表格編輯 meta／欄位／簽核關
- **拿掉**「目前操作者＋送出」操作列（與印章下按鈕重複）
- **目前操作者**改放系統欄位，在 `doc_no` 上方
- **狀態 pill** 改靜態顯示（`status-pill-static`，不可點）
- **測試下拉**：文字靠左、欄位變窄（`max-width`／`text-align-last: left`）
- Tabs：`申請`／`設計表單`／`JSON`／`ALR5功能`
- Storage：`approval.document.v4`＋每 form 分 key；catalog／nav 本機記住

## 決定／偏好

- 設計設定用 **table 一目了然** 大量調整，少重複區塊
- 操作按鈕只留印章下方，不另開操作列
- 狀態只顯示、不當按鈕

## 圖片

- （使用者截圖示意：大紅框＝操作列、小紅框＝狀態、上方下拉過寬）

## 待續

- Pages 發佈後清本機舊 `approval.document.v3`／舊 nav 若行為異常
- 設計層可再加強：刪欄／重排關、body 段落編輯
