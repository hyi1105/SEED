# SEED

公開的知識煉化實驗：把學習筆記變成可分享、可追蹤變化的 **seed**。

- Repo：https://github.com/hyi1105/SEED  
- **操作畫面（GitHub Pages）**：https://hyi1105.github.io/SEED/  
- 原則：**只放可公開的學習筆記**，不放公司敏感資料  
- 目標：不認識的人也能看、能追知識怎麼累積與改寫；介面用阿嬤用語（存一版、看看改了什麼、回到舊的）

## 第一次啟用 Pages（若網址 404／沒綠勾）

**先可看的臨時網址（不必等 Pages）：**  
https://raw.githack.com/hyi1105/SEED/main/docs/index.html  

⚠️ 不要用下面這些開 `index.html`，瀏覽器會顯示**純文字**（沒有地圖、不能拖）：
- `raw.githubusercontent.com/...`
- `cdn.jsdelivr.net/gh/.../index.html`
- GitHub 網頁上的「Raw」按鈕

正式 Pages 排查：

1. https://github.com/hyi1105/SEED/settings/actions → Actions permissions 選 **Allow all actions**
2. https://github.com/hyi1105/SEED/settings/environments → 點 `github-pages` → Deployment branches 改成 **No restriction**（或確認包含 `main`）
3. https://github.com/hyi1105/SEED/settings/pages → Source 維持 **GitHub Actions**
4. https://github.com/hyi1105/SEED/actions/workflows/pages.yml → **Run workflow** → Branch `main` → Run  
5. 等該次 run 變綠勾後再開 https://hyi1105.github.io/SEED/

## 現在怎麼看內容

1. 網頁操作：https://hyi1105.github.io/SEED/ （選一份 → 讀現在的 → 看看改了什麼）  
2. **系統功能導覽**：[`memory/topics/system-guide.md`](memory/topics/system-guide.md)  
3. 原始筆記索引：[`memory/index.md`](memory/index.md)  
4. 個人 MVP 規格：[`memory/topics/personal-mvp-spec.md`](memory/topics/personal-mvp-spec.md)

## 路線（最終版進度已同步）

| 階段 | 內容 | 狀態 |
|---|---|---|
| 知識庫 + Pages | 地圖首頁、讀取、舊版本、行級差異 | **完成** |
| 六動作 | 自己改、請 AI 改、看差異、用／不要、存一版、回舊的 | **完成** |
| 封包分享 | 打包帶走／還原回來 | **完成** |
| 付費代辦 AI | `server/` 代理 + 會員碼配額 | **進行中** |
| 之後 | 金流訂閱、書封 cover | 可晚做 |

詳見 [`memory/topics/progress-final.md`](memory/topics/progress-final.md)、[`memory/topics/core-features.md`](memory/topics/core-features.md)、[`server/README.md`](server/README.md)。  
關機改手機前：[`memory/topics/pc-before-mobile.md`](memory/topics/pc-before-mobile.md)。

## 桌面網頁精靈（探索中）

本機面板／**Windows 執行檔**：開指定網頁 → 丟檔 → 輸入文字 → 截圖確認。  
打出 `WebWizard.exe`：`cd desktop-wizard && npm run dist:win`  
見 [`desktop-wizard/README.md`](desktop-wizard/README.md)、[`memory/topics/desktop-web-wizard.md`](memory/topics/desktop-web-wizard.md)。

## 維護方式

在 Cursor 與 Agent 共同改筆記 → 看 diff；完成並驗證後由 Agent 自動發布。  
新公開筆記請同步加進 [`docs/seeds.json`](docs/seeds.json) 才會出現在 Pages 列表。
