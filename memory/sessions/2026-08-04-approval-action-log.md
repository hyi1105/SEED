---
date: 2026-08-04
time: 15:55 (UTC)
tags: [SEED, Approval, JSON, log, dropdown]
status: active
---

# 下拉修復＋操作 log（GitHub 紅綠 diff）

## 摘要
修好假別下拉無值；按鈕（儲存／送出／切換狀態）寫入 JSON `logs`：時間、操作者、開啟時與儲存後欄位，點開以紅前綠後顯示變更。

## 重點
- dropdown options 支援字串或 `{value,label}`；儲存鍵改 `approval.document.v2`
- `actor`／`actions`／`logs` 全在 document.json
- log 點開：舊值紅色刪除線在前、新值綠色在後（GitHub 風格）

## 決定／偏好
- 每次按按鈕以「本次開啟／上次按鈕後」為 opened，按完當下為 saved

## 待續
- 多操作者切換 UI；接真實 API 寫 log
