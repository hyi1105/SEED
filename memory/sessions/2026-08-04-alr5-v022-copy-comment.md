---
date: 2026-08-04
time: 17:54 (UTC)
tags: [SEED, Approval, ALR5, 定案, Copy, comment]
status: active
---

# ALR5 v0.2.2：ACL／Copy／comment／required_from_level

## 摘要

釐清並定案四題：`required_from_level` 意義與檢核時機、form ACL vs admin item 覆寫、Denied 後 Copy、每關 comment 與階段補資料。寫入 standard **0.2.2**。

## 重點

1. **`required_from_level`**：從某 level 起（含之後）必填；用途＝階段補資料。**進到該 level 後、Approve／往下送前**檢核；**不因門檻≥1 擋 Submit**。
2. **ACL**：admin／item 覆寫優先；admin 不可改表單結構，只能編資料與權限。
3. **Denied**：不可同單號升版；**Copy** 開全新單；原單保留；**owner** 定可 copy 欄。
4. **comment**：每關每位 approver 固定有；階段補資料用業務欄；代簽備註正式 id＝`proxy_original_note`（舊例 `comment1_sys`）。

## 決定／偏好

- Cancel＝同紙升版；Denied＝留拒件＋Copy 新紙。
- comment ≠ 補資料欄。

## 待續

- Copy 誰可按細節；runtime 畫面實作 Copy／每關 comment。
- 其餘 open_questions（Archive、多 owner、it_admin 改派等）。
