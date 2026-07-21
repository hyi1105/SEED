---
date: 2026-07-21
time: 09:32 (UTC+8)
tags: [SEED, 系統導覽, 功能, 架構, Markdown]
status: active
---

# 如何從 Markdown 讀懂 SEED 系統

## 最短閱讀路線

不必逐檔翻。依序看這四份即可：

1. [`../../README.md`](../../README.md)：SEED 是什麼、操作網站在哪裡。
2. [`core-features.md`](core-features.md)：系統不可缺少的功能。
3. [`knowledge-puzzle.md`](knowledge-puzzle.md)：目前棋盤、編輯、文件檢視與歷程記錄的操作設計。
4. [`progress-final.md`](progress-final.md)：哪些已完成、哪些仍待開發。

若只想知道「今天改了什麼」，從 [`../index.md`](../index.md) 的「場次」找最新日期。

## Markdown 資料夾怎麼分

- `memory/topics/`：持續更新的主題規格；了解系統時優先讀。
- `memory/sessions/`：每次討論和改版紀錄；用來追「為什麼變成現在這樣」。
- `memory/maps/`：棋盤上的示範內容。
- `memory/index.md`：所有筆記的總入口。
- `server/README.md`：付費 AI 代理服務的設定方式。

## 功能對照

- **首頁棋盤**：看 `knowledge-puzzle.md`。
- **三種 SEED**（文件、簽核、主題討論）：看 `knowledge-puzzle.md` 的「三種 SEED」。
- **編輯、Save、版本、歷程差異**：看 `core-features.md` 的「煉化／版本」。
- **文件匯入與匯出**：看 `knowledge-puzzle.md` 的「A4 匯出」及「連續正文＋文件匯入」。
- **完整產品方向與完成度**：看 `personal-mvp-spec.md`、`progress-final.md`。
- **AI 服務**：看 `paid-grandma-ai.md` 和 `server/README.md`。

## 規格與實際程式的關係

Markdown 說明「系統應該做什麼」，實際功能以程式為準：

- `docs/index.html`：畫面上有哪些區塊與按鈕。
- `docs/styles.css`：版面、A4、棋盤和手機顯示。
- `docs/app.js`：點擊、拖曳、Save、版本、匯入匯出等行為。
- `docs/seeds.json`：棋盤設定、SEED 名稱、檔案路徑與位置。
- `server/`：付費 AI API。

如果 Markdown 與畫面不一致，代表文件需要同步；請直接告訴 Agent「用現在程式更新系統導覽」。

## 建議的了解方式

1. 先開 [GitHub Pages](https://hyi1105.github.io/SEED/) 實際點一次首頁、編輯、文件檢視、歷程記錄。
2. 再讀本頁的「最短閱讀路線」，把看到的畫面與規格對照。
3. 想追設計理由時才讀 `memory/sessions/`，不需要從第一場開始看。
4. 不確定時直接問 Agent：「目前 SEED 的某功能怎麼運作？」Agent 會查程式與筆記後回答。

## 維護原則

- 完成功能並驗證後，自動發布到 GitHub Pages。
- Agent 同步修改主題筆記；使用者主要看 Cursor diff，不必自己維護索引。
- `.md` 是可閱讀的產品說明與內容資料，但不是自動產生的完整 API 文件。
