---
date: 2026-08-05
time: 01:45 (UTC)
tags: [SEED, Approval, ALR5, 表單設計, 申請單, JSON, UI]
status: active
---

# ALR5：表單設計與申請單拆成獨立 JSON

## 摘要

上方共用「JSON」分頁拿掉。資料改為兩套獨立 JSON：**表單設計**與**申請單**。按申請時複製當下設計再填寫。

## 重點

- 移除 nav／畫面的 JSON 編輯分頁（`view-json`）
- 設計檔：`approval.form.design.v1:<form_id>`，`meta.kind = form_design`
- 申請單：`approval.doc.v1:<doc_id>`，`meta.kind = application`；索引 `approval.docs.index.v1`
- 開單：`openApplyForm` → `cloneDesignToApplication`（新 doc_id／單號／draft／清印章）
- 之後改設計不覆蓋已開申請單；舊 `approval.document.v5*` 遷移為設計檔
- 規格：`approval/ALR5簽核系統.md` §1b-2；PoC cache `?v=design6`

## 決定／偏好

- 設計與申請不是同一份 JSON 來回改
- 申請＝複製當下表單，再填內容

## 待續

- 申請列表是否改列「已開申請單」而非只選表單開新單
- 正式 API／DB 對應 form design vs item
