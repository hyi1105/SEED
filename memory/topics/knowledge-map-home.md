---
date: 2026-07-20
time: 09:32–09:46 (UTC+8)
tags: [product, ux, map, seed, homepage]
status: active
---

# 首頁：知識地圖格

## Summary

每個 `.md`（seed）像資料夾裡的檔案，但首頁不是清單，而是**超簡易地圖**：例如 10×10 格子，把知識擺在有相對／地理邏輯的位置。解析度依使用再調。

## Example

| 主題 | 地圖直覺 |
|---|---|
| 北橫交通議題 | 偏北 |
| 中橫交通議題 | 偏中 |
| 南橫交通議題 | 偏南 |
| 蘇花交通議題 | 偏東（蘇花） |

## Product rules

1. Seed = 一格上的「檔案／地標」  
2. 位置有意義（相對關係）  
3. 空格可留白；可拖去空格  
4. 點一格 → 讀／看差異／回舊版  
5. **存到倉庫** → 把 `col`/`row` 正式寫回 `docs/seeds.json`

## 寫回倉庫（已做）

1. 瀏覽器拖曳（可先存在 localStorage）  
2. 「設定鑰匙」：Fine-grained PAT，只給 `SEED` 的 Contents Read and write；權杖只存瀏覽器  
3. 「存到倉庫」：經 GitHub API 更新 `docs/seeds.json` 並 commit  

預覽網址請用 raw.githack（勿用 raw.githubusercontent／jsDelivr 開 html）。

## Later

- 多張地圖、縮放、連線  
- OAuth 登入取代手貼權杖（更阿嬤）  
- 公司電腦 pull 同步 OneDrive 工作區
