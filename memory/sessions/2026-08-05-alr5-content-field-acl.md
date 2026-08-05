---
date: 2026-08-05
time: 00:27 (UTC)
tags: [SEED, Approval, ALR5, 內容欄位, ACL, type, UI]
status: active
---

# 內容欄位：中文說明、型別下拉、ACL／必填面板

## 摘要

設計表單 Owner 畫面簡化：隱藏系統欄位；區塊說明改中文（表頭仍英文）；type 下拉；default 隨型別；可設定可見／可編／階段必填。

## 重點

- 表頭英文：`field_id`／`label`／`type`／`default`／`rules`
- type：文字／數字／日期／下拉／人員／多行
- default：日期行事曆、數字禁非數字、人員選擇器、下拉可編選項
- rules 展開：`required`、`required_from_level`、`required_when`、`visible_to`／`editable_by`／`hidden_from`（角色）
- System fields 整段對 Owner 隱藏

## 決定／偏好

- 英文範圍僅 table 表頭；其餘中文，未來可再切語系
- 畫面越簡單越好
