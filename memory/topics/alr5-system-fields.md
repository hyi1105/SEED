# ALR5 系統欄位（簽核相關）

> SSOT：`approval/ALR5簽核系統.md` §2.1／system 模型。  
> 與「簽核內容欄位」分開：系統欄位由流程／報表使用，Owner 不當一般欄位增刪。

## 名單／身分欄位（§2.1）

| id | 顯示名稱 | 說明 |
|---|---|---|
| `creator` | 建立者 | 填單人；可代填 |
| `requester` | 需求人 | 真正有需求的人 |
| `cc` | 副本 | 送出後通知；可編 |
| `cc_system` | 系統副本 | Admin 預設；不可編 |
| `approvers[]`／`approver_n` | 簽核人 | 對應 `step_n` |
| `stage_notifies[]`／`stage_notify_n` | 關卡通過通知 | 該關同意往下時 |
| `fyi` | 結案知會 | 整張完成後；可編 |
| `fyi_system` | 系統結案知會 | Admin 預設；不可編 |

## 流程／系統狀態

| id | 說明 |
|---|---|
| `system.status` | new／draft／in_process／completed／denied／cancelled |
| `system.current_level` | 空／0／1…／9999／-1／-2 |
| `system.doc_no` | 單號（含 `.N`） |
| `system.archived` | 封存旗標（非 status） |
| `current_approver` | 當階簽核者 |

## 隨關展開（扁平）

對每個 `step_n`（n≥1）：

- `approver_n`
- `stage_notify_n`
- `approver_n.comment`
- `approver_n.proxy_original_note`

## 不採用

口頭草稿寫法如 `Creator`、`Approval_1_Name`、`Notify_1_Mail` 等——以規格 snake_case 為準。

## 內容欄位（可增刪）

申請畫面填寫用，例如：申請人、假別、起始日、天數、代理人（`fields.*.kind = content`）。
