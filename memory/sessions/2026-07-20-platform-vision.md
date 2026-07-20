---
date: 2026-07-20
time: 08:36–08:44 (UTC+8)
tags: [product, vision, platform, seed, versioning, personal-mvp, grandma-ux]
status: active
---

# 產品願景：可煉化的知識／文件平台

## Summary

現有生成式 AI 難把資訊存起來重複利用並煉成經典。做**個人版**平台（對應真實需求），自己當重度使用者。第一場景：用 Cursor Agent 從零學／建系統 → 煉成可分享知識庫；未來：接手舊系統、快速吃下別人工作。

**技術／產品決策（2026-07-20）**：選 **B 自建版本體驗**——目標是「80 歲阿嬤都會用」，不把 Git 術語暴露給使用者；直接鍛鍊符合需求的平台，而非先當 Git 重度使用者。

## Problem

- AI 對話產出一用即丟，難累積成可交接資產
- 新手學工具／系統時，知識散在聊天裡
- 現有開發者工具（Git／GitHub／Cursor diff）對非工程師門檻高

## Decisions

| 項 | 決定 |
|---|---|
| 範圍 | 先個人版，對應真實需求 |
| 場景 A（現在） | Cursor／新系統上手 → 知識庫 → 可分享 |
| 場景 B（未來） | 接手舊系統、吃下別人工作 |
| 版本底座 | **B：自建版本體驗**（阿嬤級 UX）；託管於 Public GitHub + Pages |
| 北極星 UX | 80 歲阿嬤都會用：無 commit／push／branch 用語 |
| 公開策略 | Public repo [`hyi1105/SEED`](https://github.com/hyi1105/SEED)；只放學習筆記；目標與陌生人分享並在 Pages 上看版本差異 |

## Desired capabilities (personal MVP)

對阿嬤／非工程師要長這樣（用語示意）：

1. **改一改** — 自己打字改，或請 AI 改
2. **看看改了什麼** — 用顏色／對照看出差異（不說 diff）
3. **存一版** — 「存成一版」／「這版叫：初稿」
4. **回到舊的** — 「回到某月某日那一版」再重來
5. **分享這一份** — 傳給家人／同事一個連結或檔案（seed）
6. **愈改愈好** — AI 依你的話繼續改，你點「用這次的」或「不要」

## Positioning

- 產品賣的是：**可煉化、可回退、可分享的文件**，不是 Git 教學
- Cursor_KB 仍是構想與需求來源；正式平台要藏起工程細節

## Tech note (B means)

「選 B」在實作上至少有兩層，產品決策鎖定的是 **體驗層 = 非 Git 用語**：

- **必須**：自建／自訂的版本 UI、名詞、流程（存一版、回到舊的、看看改了什麼）
- **可選（之後再定）**：底層儲存是自寫 DB，或內部仍用 Git 但完全不露出——第一版個人 MVP 可先自寫簡單版本表，求快驗證阿嬤流程

## Open threads

- ~~個人 MVP 畫面~~ → 已寫：`topics/personal-mvp-spec.md`
- ~~Seed 分享細節~~ → 已做：`topics/seed-pack.md`（`.seedpack.json` 打包／還原）
- ~~AI 提供者第一版~~ → 已接：瀏覽器存 OpenAI／相容 API 鑰匙 +「請 AI 改」
- ~~實作載體~~ → 已選：**GitHub Pages 單頁**（`docs/`）
- 之後可做（非核心）：OAuth、多地圖、原生 App — 見 `topics/progress-final.md`
