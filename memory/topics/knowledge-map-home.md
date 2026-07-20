---
date: 2026-07-20
time: 09:32–09:46 (UTC+8)
tags: [product, ux, map, seed, homepage]
status: active
---

# 首頁：知識地圖格

## 摘要

每個 `.md`（seed）像資料夾裡的檔案，但首頁不是清單，而是**超簡易地圖**：例如 10×10 格子，把知識擺在有相對／地理邏輯的位置。解析度依使用再調。

## 例子

| 主題 | 地圖直覺 |
|---|---|
| 北橫交通議題 | 偏北 |
| 中橫交通議題 | 偏中 |
| 南橫交通議題 | 偏南 |
| 蘇花交通議題 | 偏東（蘇花） |

## 產品規則

1. Seed = 一格上的「檔案／地標」  
2. 位置有意義（相對關係）  
3. 空格可留白；可拖去空格  
4. 點一格 → 讀／看差異／回舊版  
5. **存到倉庫** → 把 `col`/`row` 正式寫回 `docs/seeds.json`  
6. **圖示＋短標**：地圖上是大頭貼（`cover` 書封，或二字縮寫）＋下方 `short`；完整名稱用 `title`／`alias`

## 寫回倉庫（已做）

1. 瀏覽器拖曳（可先存在 localStorage）  
2. 「設定鑰匙」：Fine-grained PAT，只給 `SEED` 的 Contents Read and write；權杖只存瀏覽器  
3. 「存到倉庫」：經 GitHub API 更新 `docs/seeds.json` 並 commit  

**2026-07-20**：使用者已撤銷外洩權杖、重建並在瀏覽器完成「設定鑰匙」。權杖勿貼聊天。

預覽網址請用 raw.githack（勿用 raw.githubusercontent／jsDelivr 開 html）。

## 之後

- 多張地圖、縮放、連線  
- 用登入授權取代手貼權杖（更阿嬤）  
- 公司電腦 pull 同步 OneDrive 工作區
