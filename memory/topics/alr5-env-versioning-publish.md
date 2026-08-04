# ALR5：Form 版本、環境與發布

> standard **0.3.0**：`form_versioning`／`environments`／`publish_sop`／`schema_migration`

## 一句話

每個 form 選版本跑；沒測試機就開「正式名義」環境試；少量正式→全面；可退回；JSON 結構可升級。

## 流程

1. 建新 `form_version`  
2. 建／選測試用 formal 環境綁新版  
3. 再綁幾個正式環境試  
4. 通過 → rollout；失敗 → rollback（改 binding）  
5. ALR5 `schema_version` 變了 → migration 升結構  

## 分開兩種「版本」

| 欄位 | 意思 |
|------|------|
| `form_version` | 業務表單設計版 |
| `schema_version` | ALR5 JSON 結構版 |
