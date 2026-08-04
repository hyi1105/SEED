---
date: 2026-08-04
time: 23:50 (UTC)
tags: [SEED, Approval, ALR5, 列表, 系統欄位, step, UI]
status: active
---

# ALR5 列表對比＋系統／內容欄位拆分

## 摘要

申請／設計表單列表改暗色對齊 tabs、欄位改「名稱／建立者／所屬位置（暫未）」；設計層拆系統內建欄位與可增刪內容欄位；簽核關改 `step_N` 且可刪。

## 重點

- 列表不強調 form_id／版本；使用者看**名稱、建立者**；**所屬位置**欄先顯示「（尚未設計）」
- 列表／設計表格改暗色（淺字＋深底），按鈕風格對齊上方 tabs
- **系統欄位**：Creator、Requester、Status、Approval_n_*、Notify_n_Mail、CC、FYI、current_level、current_approver
- **內容欄位**：申請人、假別、起始日、天數、代理人（`kind: content`，可增刪）
- 簽核關 id：`step_0`（申請）、`step_1`…（簽核人）；刪關後自動重編

## 決定／偏好

- 系統欄位名稱以常用英文為主（使用者草稿）
- 所屬位置之後再設計，先佔欄位

## 待續

- 所屬位置實際資料模型
- Approval_n_Comment_sys 寫入時機
