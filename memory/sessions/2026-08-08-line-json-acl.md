---
date: 2026-08-08
time: 10:12 (UTC)
tags: [產品, walkthrough, LINE, JSON, ACL, Skill, 偏好]
status: active
---

# LINE 對話＋三層 JSON＋事後 ACL

## 摘要

使用者要：Show 改成底下 **LINE 式對話視窗**（上一步／下一步）；**畫面與資料分開**——用 Skill 產出人看得懂的 JSON 丟進播放器；JSON 裡人讀設定／教學腳本／範例值分開；匯入後還能改「誰必填／誰可看／誰可編」，讓系統繼續演進。

## 重點

| 面向 | 定案 |
|---|---|
| Show UX | 上方真表單，底下聊天泡泡＋上一步／下一步；分歧才出選項 |
| 資料 | 播放器只讀 JSON；不內建業務邏輯 |
| JSON 分層 | `form+roles+actions+acl`（人讀／可後設）／`show`（腳本）／`demo`（範例） |
| 後續設定 | 「設定」頁改 ACL → 匯出整包 JSON 再丟回來 |

## 決定／偏好

- 不要把假資料寫進 `form` 或 show nodes；用 `fillFromDemo` 引用 `demo.values`
- 轉進來之後還要能改權限，不是「一次產出就鎖死」

## 實作位置

- 播放器：`docs/walkthrough/index.html`（源：`player.js` / `player.css`）
- 契約：`docs/walkthrough/SKILL.md`
- 範例：`docs/walkthrough/vn/leave.json`
- PR：https://github.com/hyi1105/SEED/pull/56

## 待續

- [ ] 第二個系統包（非請假）驗證 Skill 可複用
- [ ] catalog 多系統切換 UI
