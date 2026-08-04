---
date: 2026-08-04
time: 18:33 (UTC)
tags: [SEED, Approval, ALR5, runtime, 印章, 測試]
status: active
---

# ALR5 runtime PoC：印章按鈕＋角色／level 測試切換

## 摘要

在申請單畫面實作可測 runtime：印章下按鈕、時間年月日時分秒、灰色 comment；手動切角色與 level；切到 level 2 自動核准 level 1。

## 重點

- 儲存鍵 `approval.document.v3`
- Debug 列：角色／current_level
- 印章欄：核准／拒絕／退回／送出（依 level 與角色）
