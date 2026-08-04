---
date: 2026-08-04
time: 18:28 (UTC)
tags: [SEED, Approval, ALR5, 平台願景, 大量匯入, JSON, 偏好]
status: active
---

# 需求記憶：全系統進 ALR5＋大量匯入 header／detail

## 摘要

使用者定調：未來所有系統都交付給 ALR5，都能處理並轉成 JSON。另需大量匯入表頭＋明細（如退貨發票明細超多）。

## 重點

1. ALR5＝統一承載平台；進出皆可轉移 JSON  
2. 大量匯入 AB：header＋lines；import_profiles 設定  
3. 先 draft 再檢核／送出  

## 待續

- 超多明細的儲存策略（內嵌 vs 分片）  
- 匯入非同步與失敗列修復 UI  
