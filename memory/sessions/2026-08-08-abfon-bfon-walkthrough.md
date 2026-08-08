---
date: 2026-08-08
time: 10:21 (UTC)
tags: [產品, walkthrough, AFON, BFON, 儀器, 校正, 假資料, 試玩]
status: active
---

# AFON／BFON 儀器校正試玩包

## 摘要

使用者要用 walkthrough 模型試 **AFON（儀器主檔）× BFON（年度校正報告）**：例如顯微鏡；從 AFON 可看關聯報告；兩邊各有人員；用假資料幫忙熟悉系統、判斷模型是否適合。

## 重點

| 名稱 | 角色 |
|---|---|
| **AFON** | 儀器主檔（長期）：編號、名稱、型號、地點、保管人、合格、下次校正日、關聯 BFON 清單 |
| **BFON** | 年度校正報告（事件）：掛接 AFON、校正日、結果、建議下次校正日 |
| **人員** | 儀器管理員（AFON）／校正人員（BFON）／品保 |

- 合格路徑：建主檔 → 開 BFON → 品保放行 → **回寫**主檔下次校正日  
- 另有退回補件、不合格停用兩條 Show 分歧

## 決定／偏好

- 先用假報告試模型適不適合，再談真系統  
- 維持三層 JSON＋LINE Show＋事後 ACL

## 實作

- [`docs/walkthrough/vn/abfon.json`](../../docs/walkthrough/vn/abfon.json)
- 播放器預設系統＝abfon；頂部可切請假單
- 組裝：`python3 docs/walkthrough/build-index.py`

## 待續

- [ ] 若模型適合：再拆成兩張獨立表單＋真關聯 UI（目前同一張表分區示範）
- [ ] 更多假儀器／多張歷史 BFON 樣本
