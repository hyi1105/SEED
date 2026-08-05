---
date: 2026-08-05
time: 00:44 (UTC)
tags: [SEED, Approval, ALR5, 簽核階層, Mail, Rules, UI]
status: active
---

# 簽核階層：每關 Mail／Rules 展開

## 摘要

各狀況通知信改掛在簽核階層每一列的 Rules（Mail）按鈕，與內容欄位 Rules 相同展開方式；拿掉底部整段表單級通知信表。

## 重點

- 每關 `rules` 欄：Mail 按鈕 → 展開該關 event／subject／body／可改
- level 0：Submit／結案／取消／手動
- level ≥1：請簽／通過／同關／拒件／退回／手動／逾期
- 寫入 `columns[].mail[event_id]`
