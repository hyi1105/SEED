---
date: 2026-08-05
time: 07:25 (UTC)
tags: [SEED, Approval, ALR5, 流程圖, 欄位儀表板, JSON, 跨平台]
status: active
---

# ALR5：流程圖欄位儀表板＋JSON 跨平台

## 摘要

記住背後只是 JSON、可跨平台。流程圖方塊要像下方申請人那種儀表板：呈現非必填／權限／default／type／label／field，點開可編。

## 重點

- 方塊上顯示 type、default、狀態燈號
- 點方塊 → 下方大儀表板（同內容欄位列：label／type／default／必填／權限板）
- 資料：`fields.<id>` 與 `mail_board.nodes[].field_id` 分離同一 form JSON

## 決定／偏好

- 只要流程圖直觀操作
- 全部物件化；JSON 可搬去別平台

## 待續

- （可）流程圖為主、收合內容欄位表
