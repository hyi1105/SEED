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

1. **設計導引** — 已有（模式「導引」＝問答學習：先想再選再揭曉；路徑仍是需求 → 欄位 → 權限 → 成檔 → 可用系統；示範催收）
2. **互動地圖儀表板** — 已有（模式「地圖」）
3. **靜態簡報／紙本作業圖** — 已有（模式「簡報」：①②③ 框線全覽）
4. **操作演示／影片** — 已有演示動畫（模式「演示」：打字／帶出／圈選）；真影片可晚做
5. **顧問輸出** — 建議、漏情境、風險、死欄位（熱圖已有死欄位；顧問建議待做）

示範系統包：離職單（`system.json`）、催收單（`systems/collection.json`）。

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
- 互動＋契約：[scenario-system-walkthrough.md](./scenario-system-walkthrough.md)
- Skill：[`docs/walkthrough/SKILL.md`](../../docs/walkthrough/SKILL.md)
