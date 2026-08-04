---
date: 2026-08-04
time: 15:45 (UTC)
tags: [SEED, Approval, JSON, API]
status: active
---

# 申請單全面 JSON 化（畫面純渲染）

## 摘要
為未來 API／整合各簽核系統：所有文案、欄位、下拉選項、印鑑、系統欄都放在 `document.json`；畫面只渲染，上方可切換「申請單畫面／JSON」。

## 重點
- 真相來源：`docs/approval/document.json`（本機亦可存整份 JSON 到 localStorage）
- HTML 殼不含申請單文字；`app.js` 依 JSON 組段落／dropdown／印鑑
- JSON 分頁可直接改；切回畫面或失焦時套用
- 假別改為 JSON `fields.leave_type.options` 驅動的下拉

## 決定／偏好
- 畫面不儲存文案；未來換成 API 只換讀寫同一份 document 結構

## 待續
- 接真實 API；多表單／多系統 schema 對應
