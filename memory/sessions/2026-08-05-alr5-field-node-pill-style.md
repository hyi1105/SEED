---
date: 2026-08-05
time: 07:50 (UTC)
tags: [SEED, Approval, ALR5, 流程圖, 欄位, UI, 橢圓燈號]
status: active
---

# ALR5：流程圖欄位節點改橢圓燈號風格

## 摘要

欄位節點不再用大白方框＋純文字 type/default；改為上方③輸入欄位／文件同款暖黃底，僅顯示名稱為文字，其餘（type、default、必填、權限、可空白、可手填）皆橢圓燈號。

## 重點

- `appendFlowFieldMetaChips` 統一節點上所有狀態燈號
- CSS：`.flow-node.kind-field.flow-field-card` 對齊 `flow-mat-btn` 暖黃底＋圓角
- 快取 bump：`design21`
