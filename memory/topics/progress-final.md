---
date: 2026-07-20
time: 14:43 (UTC+8)
tags: [progress, mvp, final, status, puzzle]
status: active
---

# 個人 MVP 最終版進度（同步）

> 這份是「現在已上線」的總表。畫面細節可再改；**六動作＋知識拼圖＋封包**已齊。

## 判定

| 項 | 狀態 |
|---|---|
| 知識拼圖首頁（拖曳、存位置、圖示短標、可選模板） | **完成** |
| 手機／桌面：選單＋點種子才出操作列 | **完成** |
| 六動作：自己改／AI 回答／看差異／用·不要／存一版／回舊的 | **完成** |
| AI 問答流程：System → User → AI | **完成** |
| Pages 操作畫面 | **上線** — https://hyi1105.github.io/SEED/ |
| 用語藏工程（不說 commit／push／branch） | **完成** |

## 進行中（不算缺核心）

| 項 | 狀態 |
|---|---|
| 拼圖 UX 收尾（公開／私人、存位置提示、手機拖曳） | **完成 — B** |
| 社群版搶位＋點數 | **規格已定，尚未上線 — D** |
| 「學 Cursor」示範 seed | **完成 — E** — `learn-cursor-demo.md` |

## 刻意晚做（使用者 2026-07-20 14:43 決定）

- **C**：付費 AI 代辦、部署 server、`apiBase` — 與 AI 自動抓資料集中處理
- 用登入授權取代手貼鑰匙（私人拼圖真正隱私）
- 多張拼圖／縮放／連線、手機原生 App、多人即時協作
- system feedback board / player records / 包裝說明頁不做

## 對照規格

- 規格：`personal-mvp-spec.md`（六動作）
- 拼圖：`knowledge-puzzle.md`
- 不可少清單：`core-features.md`
- 封包：`seed-pack.md`
- 路線場次：`sessions/2026-07-20-continuation-roadmap.md`

## 怎麼用這份

之後若問「做到哪了／最終版有什麼」，以本檔＋`core-features.md` 為準。

## 發佈紀錄

- 2026-07-20：最終版同步 PR 合併；Pages 重新部署。
- 同日：使用者確認 Pages 可開啟。
- 同日：知識拼圖改版（無方位、拼圖模板、選單 UX）合併上線。
- 2026-07-20 14:43：本機與 GitHub 合併；路線 A→B→D→E，C 暫緩。
- 2026-07-20：互動改成最小流程：System → User → AI；回饋板、紀錄 UI、包裝說明入口隱藏。
