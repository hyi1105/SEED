---
date: 2026-08-05
time: 00:21 (UTC)
tags: [SEED, Approval, ALR5, 簽核階層, waterfall, UI]
status: active
---

# 簽核階層改水流＋英文欄位＋完整印名

## 摘要

設計表單簽核階層改上→下水流（step_0 最上）；表頭英文；label／role 分清用途；stamp_name 用完整姓名。

## 重點

- 順序：`step_0`（Submit）→ `step_1` → `step_2`…
- 表頭：`step_id`／`label`／`level`／`role`／`stamp_name`
- `label`＝畫面顯示名；`role`＝權限角色 id（非顯示）
- `stamp_name`＝印章完整姓名；申請畫面印章同步放大字距
- step_0 操作欄標 `fixed`（不可刪）

## 決定／偏好

- 簽核像水流從上往下，不要日式右→左關序在設計表
