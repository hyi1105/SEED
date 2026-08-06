---
date: 2026-08-06
time: 06:20 (UTC)
tags: [SEED, Approval, ALR5, 還原, 流程圖]
status: active
---

# ALR5：還原「流程圖唯一入口」改版

## 摘要

使用者測試後決定還原。以 `git revert` 撤銷 `853f15e`，回到橢圓燈號節點＋內容欄位表＋簽核階層＋材料區的版本（等同 `9d05dc9`）。

## 重點

- 快取 bump：`design23`（避免仍卡在 design22）
- 內容欄位表、簽核階層、材料區恢復
