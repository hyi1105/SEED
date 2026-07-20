---
date: 2026-07-20
time: 09:23 (UTC+8)
tags: [github, learning, pages, actions, beginner]
status: active
---

# GitHub 是什麼、怎麼跟 SEED 搭配

## Summary

使用者對「Run workflow」不熟，需要搞懂 GitHub 能做什麼，以及和 SEED（公開筆記 + Pages 操作畫面）怎麼串。

## 用生活比喻

| GitHub 名詞 | 白話 |
|---|---|
| **Repository（repo）** | 一個專案資料夾的雲端備份（你的是 `SEED`） |
| **Commit** | 存成一版（有時間、說明） |
| **Push** | 把電腦上的新版本上傳到 GitHub |
| **main** | 目前對外的主線版本（像「正式那一疊」） |
| **GitHub Pages** | 把資料夾變成**網站**給人用瀏覽器打開 |
| **Actions / Workflow** | 你一 push（或手動按），GitHub **自動幫你跑一組步驟**（像自動影印、自動上架） |
| **Run workflow** | **現在立刻手動按一次**那組自動步驟（不等下次 push） |

## SEED 這條流水線

```text
你在 Cursor 改筆記
        ↓ push
   GitHub 上的 SEED（檔案倉庫）
        ↓ Actions「pages」工作流程
   做成網站 https://hyi1105.github.io/SEED/
        ↓
   陌生人也能打開操作畫面
```

- **倉庫**：放 `.md`、規格、`docs/` 網頁檔  
- **Pages**：讓外人用網址看操作畫面  
- **Actions**：負責「把 `docs/` 佈署成 Pages」；失敗就沒綠勾、網址 404  

## 「Run workflow」是什麼

在  
https://github.com/hyi1105/SEED/actions/workflows/pages.yml  

按 **Run workflow** → 選 Branch **main** → 再按綠色 **Run workflow**：

= 「請 GitHub **現在**用 `main` 上的檔案，跑一次名叫 pages 的自動佈署。」

成功 → 綠勾 → Pages 網址才看得到。  
沒跑過／失敗 → 就會像現在這樣看不到正式網站。

## 你需要會的操作（個人版最少）

1. 看檔案：repo 首頁點進 `memory/`、`docs/`  
2. 看歷史：某個檔 → History（誰何時改了什麼）  
3. 看自動工作：上方 **Actions** 分頁（綠＝好、紅＝壞）  
4. 開網站設定：**Settings → Pages**（Source 用 GitHub Actions）  
5. 暫時看畫面：可用 raw.githack 連結（不靠 Pages）

## Open threads

- 2026-07-20：GitHub **Actions／Pages 服務異常**（githubstatus 顯示 partial outage）。Run workflow 出現 “unexpected error”／startup_failure 屬平台問題，非操作錯誤。恢復後再手動 Run 一次 `pages`。
- 正式網址：https://hyi1105.github.io/SEED/  
- 臨時網址（不靠 Pages）：https://raw.githack.com/hyi1105/SEED/main/docs/index.html
- 狀態頁：https://githubstatus.com
