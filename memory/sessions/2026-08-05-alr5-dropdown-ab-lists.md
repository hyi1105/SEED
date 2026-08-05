---
date: 2026-08-05
time: 05:58 (UTC)
tags: [SEED, Approval, ALR5, 下拉, 選項庫, AB連動, UI]
status: active
---

# ALR5：下拉選項庫（業務表單 ↔ B 清單）

## 摘要

喜歡樂高積木／燈號呈現。確認「可手填」＝申請人填單時可輸入清單外值，設計檔不另開文字欄。下拉 ⋯ 以類似 AB 連動：B＝帳號級共用選項庫；公司來源靠 B item 的 `readers`。

## 重點

- A＝業務表單設計；B＝下拉選項庫（`approval.option_lists.v1`）
- 欄位 `options_ref` 指向 `list_id`；執行期解析 B 的 `items[]`
- `allow_manual`：申請端 datalist 手填；設計列只有燈號＋B 來源＋⋯
- `readers`：`*` 或帳號名＝可讀；owner 可編
- 與 §1c「表頭／明細 AB」分開，規格寫在 §1c-2

## 決定／偏好

- 保留積木／燈號 UI
- 可手填不在設計檔多開文字欄
- 公司清單＝改 B item 的 readers，不是另建系統

## 待續

- （無）
