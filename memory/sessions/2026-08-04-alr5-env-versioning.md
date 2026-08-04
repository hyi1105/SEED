---
date: 2026-08-04
time: 18:38 (UTC)
tags: [SEED, Approval, ALR5, 版本, 環境, 發布, 遷移, 偏好]
status: active
---

# 需求記憶：Form 版本、正式環境試跑、漸進發布／退回、JSON 升級

## 摘要

使用者睡前定調：每個 form 可指定執行版本；新版本用「正式環境」名義測試；再抓幾個正式環境試；再漸進發布到複雜環境（可自動 SOP＋退回）；JSON 改版要能升到最新結構。已寫入 standard **0.3.0**。

## 重點

1. `form_version` ≠ `schema_version`  
2. formal + production_like_test＝沒測試機時的試跑法  
3. publish_sop：試跑→canary→rollout／rollback  
4. schema_migration＋autofill  

## 待續（早上可看）

- 測試環境資料是否隔離  
- 進行中單是否鎖定開單版  
- 自動 SOP 門檻  
