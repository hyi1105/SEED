# 網頁精靈（桌面板）

本機小面板：打開指定網頁 → 丟檔 → 輸入文字 → **截圖**，用畫面確認有沒有做對。

> 探索版：先證明「能丟檔／能輸入／能截圖」。影像比對自動點擊之後再加。

## 需要

- Node.js 18+
- 第一次要裝 Chromium（Playwright）

## 啟動

```bash
cd desktop-wizard
npm install
npm run install:browser
npm start
```

瀏覽器開：http://127.0.0.1:3847

1. 按「載入本機練習頁」
2. 選一個檔案
3. 按「開始執行」
4. 下方看執行紀錄與截圖

截圖會寫進 `desktop-wizard/output/`。

## 指令列（不開面板）

```bash
npm run demo
# 或
node runner.js --recipe recipes/demo.json --headless
```

## 配方欄位（recipes/*.json）

| 欄位 | 說明 |
|---|---|
| `url` | 目標網頁 |
| `file` | 本機檔案路徑 |
| `fileInput` | 檔案 input 的 CSS 選取器 |
| `dropTarget` | 拖放區選取器（沒有 file input 時用） |
| `text` | 要輸入的文字 |
| `textTarget` | 文字欄位選取器 |
| `submit` | 送出按鈕選取器（可選） |
| `steps` | 額外步驟：`click` / `type` / `wait` / `screenshot` |
| `headed` | 是否顯示瀏覽器 |
| `fullPage` | 是否整頁截圖 |

## 限制（探索版刻意不做）

- 還沒做「用參考截圖找按鈕再點」（影像辨識）
- 還不能操控「已經開著的 Chrome 分頁」，會另開 Playwright 瀏覽器
- 雲端 Agent 環境通常沒有你的桌面視窗；請在自己電腦跑面板

## 之後可加

- 截圖模板比對點擊
- 錄製宏（點哪、打什麼）存成配方
- 接到 SEED 控制台一鍵匯出／上傳
