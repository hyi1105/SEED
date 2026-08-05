---
date: 2026-08-05
time: 07:45 (UTC)
tags: [SEED, Approval, ALR5, 下拉, 可空白, 可手填, 流程圖, 欄位儀表板]
status: active
---

# ALR5：修復流程圖欄位儀表板 type／可空白／可手填

## 摘要

流程圖點欄位方塊後，改 type 為下拉時不出現可空白／可手填；切換燈號也不更新。根因是 `createFlowFieldDashboard` 的 onChange 只 `paintCanvas()`，未重建儀表板 UI。

## 重點

- `openFieldEditor` 改 `mountFieldDash()`：任何變更後整段重建儀表板
- `createTypeSelect` 切到 dropdown 時初始化 `allow_blank`／`allow_manual`
- 流程圖方塊加「可空白／可手填」小燈號（dropdown 專用）
- 快取 bump：`design20`

## 待續

- 使用者訊息截斷：「我希望欄位就…」— 可能意指流程圖為主、收合內容欄位表，待補完
