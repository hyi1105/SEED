---
date: 2026-07-21
time: 10:46 (UTC+8)
tags: [SEED, 簽核, workflow, approval, 權限, 通知]
status: active
---

# 簽核模板工作流

## 定位

簽核模板不是一般問卷，而是四層系統：

1. **欄位設計**：誰填什麼、資料從哪裡來。
2. **角色與權限**：誰能看、能改、必須填哪些欄位。
3. **簽核流程**：依序、平行、退回、委派、代理及超時處理。
4. **通知**：每個動作會通知誰、何時寄、信件哪些段落可改。

## 角色

- **Requester／申請人**：有需求的人。
- **Filler／填寫人**：實際建立及送出申請的人。
- **Approver**：一或多個簽核階段。
- **CopyTo**：Submit 時收到通知，通常只能看。
- **FYI**：整張申請完成後收到通知。
- **Admin**：可查看此 SEED 的所有申請單。
- **Owner**：設計欄位、流程、權限、通知及逾時規則。

預設一般人只能看到自己擔任上述角色的申請單。

## 欄位與 Lookup

- 欄位可為單行、多行或下拉選單。
- 下拉選項來源：
  - 手動輸入。
  - CSV、TSV、Excel 的指定欄（A、B、C……）。
- 可設定第一列是否為標題；標題預設不列入選項。
- 可設定選完清單後是否仍允許手動輸入。
- Owner 權限表可為欄位設定：
  - 角色能否查看。
  - 能否編輯。
  - 是否必填。
  - 條件顯示。
  - CSV／Excel lookup 來源。

## 簽核流程

- 依序：`Approver1 → Approver2 → Approver3`。
- 平行：例如 `Approver3_1`、`Approver3_2` 同時收到，可選：
  - 一人 Approve 即通過。
  - 全部 Approve 才通過。
- Approver 可執行：
  - `Approve`
  - `Deny`
  - `Return`：退回 Requester 或前一階段。
  - `Delegate`：委派後必須回到原簽核者確認。
- 委派鏈：
  - A 委派 B：`A → B → A`
  - B 再委派 C：`A → B → C → B → A`
- 代理：指定期間內，某人全部待簽自動轉給代理人；代理人 Approve 視同本人 Approve。

## 申請單狀態

- `Draft`：Save 草稿，尚未送出。
- `Submitted`：已送出或退回 Requester 等待重新送出。
- `In Process`：目前正在簽核。
- `Approved`：全部流程通過。
- `Denied`：流程拒絕。

同時保存：

- Current Approver
- Current Level
- Last Submit Date
- Last Approval Date
- Comment、操作紀錄與通知紀錄

## 使用體感

- Requester／Filler 像使用 LINE 對話，但每個對話框是一組被指派的欄位。
- `Save 草稿` 與 `Submit 送出` 是兩件事。
- Approver 只看到自己可看的欄位，並可填寫被指派的欄位及 Comment。
- Owner 可關閉 Comment。
- 點流程人頭切換角色視角；點其他人頭可理解或選擇退回位置。
- 流程箭頭代表通知；點開可看 Mail 標題、內容、預計時間及 Reminder。
- 流程可切換成「依階段」或「以人為主」視圖；後者同一人只出現一次，回簽用箭頭連回。

## 通知

動作模板包含 Submit、Approve、Deny、Return、Delegate、Reminder、Complete。

每封通知包含：

- Owner 鎖定的固定前段。
- Requester 可編輯的中段。
- Owner 鎖定的固定後段。
- 收件人、預計寄送時間及 Reminder。

Requester 的 `Call 這張單` 預設通知 Current Approver、曾收過通知的 Approver／CopyTo，以及 Owner；Requester 可決定是否真的寄出。

## 目前前端原型

已可操作：

- `申請單／欄位／流程／權限／通知` 五個頁籤。
- CSV／TSV／Excel 解析、選欄、標題列與手動輸入設定。
- 角色、依序／平行階段、通過規則、Reminder、超時動作及代理設定。
- 欄位 × 角色權限矩陣。
- 對話式填寫、Comment、Submit、Approve、Deny、Return、Delegate、Call。
- 流程圖、狀態值與動作紀錄。
- 通知固定段／可編輯段與預覽。

## 尚需後端

目前資料只存在瀏覽器及 SEED 版本，不代表正式企業權限已生效。下列能力需要登入、資料庫及排程服務：

- 真實使用者身分與角色授權。
- 申請單彼此隔離及 Admin／Owner 存取控制。
- Email／站內通知實際寄送。
- Reminder、逾時自動 Approve／Deny。
- 代理期間自動轉派。
- 平行簽核的交易鎖與多人同時操作。
- 完整稽核紀錄及不可竄改性。
