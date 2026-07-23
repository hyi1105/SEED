---
date: 2026-07-23
tags: [桌面, 按鍵精靈, 網頁自動化, Playwright, 截圖]
status: active
---

# 桌面網頁精靈（按鍵精靈）

本機小工具：對**指定網頁**自動丟檔、輸入文字，並用**截圖**確認有沒有做對。

## 要解決什麼

手動反覆「開同一個上傳頁 → 選檔 → 打字 → 看有沒有成功」很煩。希望有桌面板一鍵跑完，並留下畫面證據。

## 現況（探索版 0.2）

| 能力 | 狀態 |
|---|---|
| 桌面板設定網址／文字／檔案 | 有（`desktop-wizard/public`） |
| **Windows 執行檔 `WebWizard.exe`** | 有（已放 `desktop-wizard/release/`，CI 用 Windows 自動打包） |
| 開指定網頁 | 有（Playwright Chromium） |
| 丟檔到 file input 或拖放區 | 有 |
| 輸入文字到指定欄位 | 有 |
| 執行前／後截圖 | 有 |
| 用參考截圖找按鈕再點 | **尚未** |
| 操控已開著的瀏覽器分頁 | **尚未** |

## 怎麼用（一般使用者）

1. 下載 [`desktop-wizard/release/WebWizard.exe`](../../desktop-wizard/release/WebWizard.exe)
2. 若打不開：右鍵 → 內容 → **解除封鎖**；SmartScreen 選「仍要執行」
3. 雙擊 →「載入本機練習頁」→ 選檔 → 開始執行  
   （你的電腦**不必**先裝 Node）

### 開發／自己打包

```bash
cd desktop-wizard
npm install
npm run dist:win
```

細節見 [`desktop-wizard/README.md`](../../desktop-wizard/README.md)、[`desktop-wizard/release/README.md`](../../desktop-wizard/release/README.md)。

## 配方概念

一次執行＝一份 JSON 配方（網址、檔案、選取器、文字、額外步驟）。面板會組出同等資料打給 `/api/run`。

## 與 SEED 的關係

- **現在**：獨立工具，不綁 Pages／seed 流程
- **之後可選**：從 SEED 控制台匯出檔案後，交給精靈上傳到外部系統

## 開放問題（等使用者一句話）

「透過截圖可以 ____」完整目標是哪一種？

1. **驗證**：跑完給我看圖，人眼確認  
2. **導航**：用小圖找畫面上的按鈕再點（傳統按鍵精靈）  
3. **兩者都要**
