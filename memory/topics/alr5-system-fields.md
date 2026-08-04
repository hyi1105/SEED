# ALR5 系統欄位（簽核相關）

> 與「簽核內容欄位」分開：系統欄位由流程／報表使用，Owner 不當一般欄位增刪。

## 固定系統欄位

| id | 說明 |
|---|---|
| Creator | 建立者 |
| Requester | 申請人 |
| Status | 狀態 |
| CC | 副本 |
| FYI | 知會 |
| current_level | 目前關卡 |
| current_approver | 目前簽核人 |

## 隨簽核關（step_n）展開

對每個 `step_n`（n≥1）：

- `Approval_n_Name`
- `Approval_n_Date`
- `Approval_n_Status`
- `Approval_n_Comment`
- `Approval_n_Comment_sys`
- `Notify_n_Mail`

## 簽核關 id

- `step_0`：申請關（送出）
- `step_1`、`step_2`…：簽核人關；可刪除，刪後重編

## 內容欄位（可增刪）

申請畫面填寫用，例如：申請人、假別、起始日、天數、代理人（`fields.*.kind = content`）。
