---
date: 2026-08-05
time: 08:15 (UTC)
tags: [SEED, Approval, ALR5, 流程圖, Scope, 設計表單, UI]
status: active
---

# ALR5：設計表單改流程圖為唯一入口

## 摘要

移除內容欄位表、簽核階層表、材料區；每個 approval column 一個 Scope 流程圖。人員圓圈內 +欄/+人/+動作/+信/+Scope；欄位儀表板拉到下方共用面板。

## 重點

- 預設流程：申請人→欄位鏈→SAVE→申請人→通知 CC→簽核人
- 綠色＝人員、藍色＝動作節點／通知箭頭
- 角色預覽（設計／申請人／簽核人／副本）灰階不可操作項
- 寄信編輯：To、CC、Subject、Body
- Scope 區塊可拖、內部欄位跟著移；箭頭可重指終點
- 快取 bump：design22

## 待續

- 動作欄位影響與 runtime 引擎對齊
- Scope 內欄位自動歸屬 scope_id（拖入框內）
