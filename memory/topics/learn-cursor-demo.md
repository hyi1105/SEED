---
date: 2026-07-20
time: 14:50 (UTC+8)
tags: [demo, cursor, 上手, 驗收]
status: active
---

# Cursor 上手筆記（示範 seed）

> 這份給 **E 驗收**用：走一輪六動作（自己改 → 請 AI 改 → 看差異 → 用／不要 → 存成一版 → 回到舊的 → 打包）。

## 我現在要做什麼

把 SEED 知識拼圖當成「可煉化的學習筆記」：首頁拼圖、點種子才出操作列、選單裡換模板。

## 我已經會的

- 在 Cursor 裡跟 Agent 對話、看 diff 確認改檔
- 用 GitHub Pages 開 SEED 操作畫面
- 拖曳種子改拼圖位置；有鑰匙可「存拼圖位置」

## 今天學會的

- **知識拼圖**取代有東南西北的地圖；模板可選 8×8／10×10／12×12 或橫貫公路示範
- **個人版**可標公開／私人（公開 repo 下私人僅標記，真正隱私要登入）
- **社群版**可花點數搶空格；存成一版會 +10 點
- 路線優先序：**A 同步筆記 → B UX → D 社群 → E 示範**；付費 AI 代辦（C）晚點集中做

## 常踩的坑

- 預覽 html 請用 **raw.githack**，不要用 raw.githubusercontent（會變純文字）
- 改拼圖位置後只存在瀏覽器；要永久保存得選單 → **存拼圖位置**（需 GitHub 鑰匙）
- 公司電腦關機後，OneDrive 上的 Cursor_KB 可能落後 GitHub；回來先 `git pull`

## 重要決定

- 2026-07-20：C（付費 AI／server）先不做，和「AI 自動抓資料」一起排
- 記憶庫用 diff 審核；Agent 直接改 `memory/` 裡的 md

## 還不懂、下次要問的

- 社群版被更高點數挤走時怎麼通知？
- 私人拼圖登入後要怎麼和 GitHub 權限接？

## 給接手的人（三句話）

1. SEED = 阿嬤也能用的 Markdown 煉化工具；首頁是知識拼圖。
2. 核心六動作 + 打包帶走都在 Pages 上線版。
3. 進度看 `memory/topics/progress-final.md`；拼圖規格看 `knowledge-puzzle.md`。
