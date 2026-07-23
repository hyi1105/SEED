# 網頁精靈（桌面板／可打成 .exe）

本機小面板：打開指定網頁 → 丟檔 → 輸入文字 → **截圖**，用畫面確認有沒有做對。

可雙擊 **`WebWizard.exe`** 執行（Windows portable）。

> 探索版：先證明「能丟檔／能輸入／能截圖／能當執行檔」。影像比對自動點擊之後再加。

## 使用者：雙擊執行檔

1. 取得 `desktop-wizard/dist/WebWizard.exe`
2. 雙擊開啟「網頁精靈」視窗  
   - **第一次**會自動下載 Chromium（需網路，之後就不用）
3. 按「載入本機練習頁」→ 選檔 →「開始執行」
4. 下方看紀錄與截圖

截圖寫在使用者資料夾（AppData），不會弄髒 exe 旁邊。

### 自己打包 .exe

在有 Node 的電腦：

```bash
cd desktop-wizard
npm install
npm run dist:win
```

完成後：`desktop-wizard/dist/WebWizard.exe`  
（約百餘 MB；瀏覽器第一次開啟時再下載，避免打錯平台）

> 若在 **Windows** 上想把瀏覽器一併打進 exe：可自行加 `extraResources` 並用 `npm run dist:win:bundle`（進階）。

## 開發：不定打包時

```bash
cd desktop-wizard
npm install
npm run install:browser
npm run app          # Electron 視窗
# 或
npm start            # 只用瀏覽器開 http://127.0.0.1:3847
```

## 指令列

```bash
npm run demo
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
- 還不能操控「已經開著的 Chrome 分頁」，會另開自動化瀏覽器
- 防毒軟體可能對未簽名的 portable exe 多問一句（尚未代碼簽名）

## 之後可加

- 截圖模板比對點擊
- 錄製宏存成配方
- 代碼簽名、安裝程式（NSIS）
- 接到 SEED 控制台一鍵匯出／上傳
