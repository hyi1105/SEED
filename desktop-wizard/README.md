# 網頁精靈（桌面板／Windows 執行檔）

本機小面板：打開指定網頁 → 丟檔 → 輸入文字 → **截圖**。

## 你的電腦不用裝開發工具

直接下載執行檔即可：

**[`release/WebWizard.exe`](./release/WebWizard.exe)**  
說明：[`release/README.md`](./release/README.md)  
下載頁：https://hyi1105.github.io/SEED/web-wizard.html （合併 main 後）

1. 下載 `WebWizard.exe`
2. 若被 Windows 擋住：右鍵 → 內容 → **解除封鎖**；或 SmartScreen → 其他資訊 → 仍要執行
3. 雙擊開啟 →「載入本機練習頁」→ 選檔 → 開始執行

不必先裝 Node／Playwright。需要的瀏覽器引擎會自動處理（或已內建）。

## 開發者：本機打包

```bash
cd desktop-wizard
npm install
npm run dist:win              # 一般版（首次開啟再下載 Chromium）
# Windows 上可打內建瀏覽器版：
npm run install:browser
npm run dist:win:bundle
```

產出：`dist/WebWizard.exe`。CI 會在 Windows runner 自動打包並上傳工件。

## 開發：不定打包時

```bash
npm run install:browser
npm run app          # Electron 視窗
npm start            # http://127.0.0.1:3847
```

## 配方欄位（recipes/*.json）

| 欄位 | 說明 |
|---|---|
| `url` | 目標網頁 |
| `file` | 本機檔案路徑 |
| `fileInput` | 檔案 input 的 CSS 選取器 |
| `dropTarget` | 拖放區選取器 |
| `text` / `textTarget` | 文字與欄位選取器 |
| `submit` | 送出按鈕 |
| `steps` | `click` / `type` / `wait` / `screenshot` |
| `headed` / `fullPage` | 顯示視窗／整頁截圖 |

## 限制（探索版）

- 尚未：用參考截圖找按鈕再點
- 尚未：操控已開著的 Chrome 分頁
- 尚未代碼簽名（SmartScreen 可能多問一句）
