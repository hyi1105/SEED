---
date: 2026-08-06
time: 18:34 (UTC)
tags: [產品, 願景, 系統顧問, 多模態, 簡報, 影片, JSON]
status: active
---

# 產品願景：系統理解工具箱 → 系統架構顧問

## 一句話

把任何系統（從程式、圖、規格書來的）收成**同一份可驗證的 JSON**，再用互動地圖／靜態簡報／操作演示三種方式教會人——進階還能指出漏情境與風險，像系統架構顧問。

## 工具箱（類比 NotebookLM）

不是單一頁面，而是一組產物：

1. **統一入口（定案）** — `docs/walkthrough/index.html`：**Show（邊講邊填）** + **真實表單（切角色辦單）**；同一份 `vn/*.json`
2. **互動地圖** — 可選，掛在 `map.html`
3. ~~設計導引 / 簡報 / 演示~~ — **已拿掉**（使用者定案：只要邊講邊填＋真表單）
4. **顧問輸出** — 待做（漏情境／風險）

示範系統包：請假（`vn/leave.json`）。舊離職／催收 JSON 仍可在地圖頁參考。詳見 [blank-origin-map.md](./blank-origin-map.md)。

## 為何需要靜態＋影片（不只高亮）

- 高亮欄位：省 Token，但要靠想像 → 阿嬤看不懂
- 紙本編號 1→2→3：交接、列印、全覽
- 真人式操作演示：實際做一次＝學會

## 資料原則

- 執行期仍是 **Walkthrough JSON**（Schema + Skill）
- 三種呈現只是不同 `render`，不另發明三套資料
- 來源多樣，輸出統一

## 相關筆記

- 場次（睡前原文整理）：[sessions/2026-08-06-consultant-vision-sleep.md](../sessions/2026-08-06-consultant-vision-sleep.md)
- 空白起源地圖：[blank-origin-map.md](./blank-origin-map.md) · [sessions/2026-08-08-blank-origin-map.md](../sessions/2026-08-08-blank-origin-map.md)
- 互動＋契約：[scenario-system-walkthrough.md](./scenario-system-walkthrough.md)
- Skill：[`docs/walkthrough/SKILL.md`](../../docs/walkthrough/SKILL.md)
