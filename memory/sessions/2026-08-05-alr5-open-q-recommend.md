---
date: 2026-08-05
time: 03:05 (UTC)
tags: [SEED, Approval, ALR5, 拍板, 未決, 風險, 建議]
status: active
---

# ALR5：未決／風險附建議與情境供選擇

## 摘要

針對「請你拍板」與「實作易錯」清單，補上建議選項與情境；standard 升 **0.3.1**；ALR5 頁可讀，並修 priority 顯示 `undefined`。

## 重點

- `open_questions[]`：`recommendation`／`recommendation_text`／`options[]`（id／label／scenario）
- `logic_risk_warnings[]`：`recommendation`／`scenarios`／`choose[]`
- 規格 §10b 對照表；尚未寫入 `decisions`（等使用者選）
- UI：`?v=design7`

## 建議一覽（待確認）

未決多數字母建議見 §10b；風險項建議多為 **A**（成對寫入、Change 優先、voided 等）。

## 待續

- 使用者回覆各題選項後，寫入 `decisions` 並勾掉 open_questions
