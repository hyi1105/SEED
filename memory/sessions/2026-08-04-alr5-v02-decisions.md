---
date: 2026-08-04
time: 17:45 (UTC)
tags: [SEED, Approval, ALR5, 定案, 欄位]
status: active
---

# ALR5 v0.2.0 定案與欄位模型

## 摘要
拍板 8 題高優先邏輯；並定義 owner（form）vs admin（item）、欄位型別／條件必填／欄位 ACL。

## 重點定案
- Denied → current_level=-2；一人 Reject → 整單 Denied
- Return 作廢後續已簽並重簽；SAVE → level 0
- Cancel 重送同 doc_no 升 .N
- 代理人：本人／主管／admin；結束改回
- 平行關禁止 Delegate；sys 收件可開單

## 待續
- required_from_level 檢核時機、item 覆寫衝突、Denied 後能否再送
