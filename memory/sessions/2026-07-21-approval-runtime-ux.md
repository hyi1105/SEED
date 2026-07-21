---
date: 2026-07-21
time: 12:05 (UTC)
tags: [SEED, 簽核, 申請單, UX]
status: active
---

# 簽核申請單執行期 UX

## 摘要

延續簽核兩層結構，強化申請單填寫時的角色視角、欄位鎖定、委派回簽流程圖，以及範本申請單列表管理。

## 重點

- 送出後 Requester／Filler 欄位唯讀；Draft／Submitted（退回）可編輯。
- 流程人頭與角色列可切換 Approver 視角，顯示對應動作按鈕。
- 「以人為主」流程圖下方顯示委派回簽（A → B → A）。
- 範本「申請單」頁籤：狀態徽章、送出／簽核日期、刪除單筆。
- Call 可編輯通知對象；Return 可指定退回對象。

## 決定／偏好

- 首次開啟申請單依狀態自動選視角（`roleViewInitialized`），之後尊重使用者切換。
- 快取版本 bump 至 `control11`。

## 待續

- 條件顯示欄位、CSV lookup 動態過濾。
- 後端寄信、Reminder、代理自動轉派。
