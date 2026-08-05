---
date: 2026-08-05
time: 05:20 (UTC)
tags: [SEED, Approval, ALR5, 內容欄位, Rules, ACL, 儀表板, UI]
status: active
---

# ALR5：欄位規則改儀表板（點開才細部）

## 摘要

內容欄位 Rules／ACL 一次攤開太長。改成儀表板：上方 chips 摘要＋可收合區塊（必填／可見／可編／隱藏），預設收合。

## 重點

- `createFieldRulesPanel` → `field-rules-dash`＋`details.dash-section`
- 列上按鈕改顯示「規則」摘要（含藏 n）
- cache `?v=design10`

## 待續

- 簽核關 Mail 面板可同樣儀表板化

## 再整合（燈號 only）
- 拿掉下方四條 accordion；只留橢圓燈號（必填／可見／可編／隱藏）
- 點燈號才開細部面板；再點關閉；`?v=design11`
