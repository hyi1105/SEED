# ALR5 標準互通規格（可貼給 AI）

> **用途：** 整份複製貼給新的 AI／Agent，要求依此實作簽核 JSON 互傳。  
> **機器可讀原文：** `docs/approval/alr5-standard.json`（standard_version **0.1.0**）  
> **人讀總規：** `approval/ALR5簽核系統.md`  
> **檢查原則：** `interop_checklist` 裡所有 `required: true` 通過 → 視為可與 ALR5 互通。

---

## 給 AI 的開場（請一併貼上）

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.1.0** 與 `json_contract`／`interop_checklist` 實作。狀態、`current_level`、動作 id 不得自創別名（顯示字眼除外）。`open_questions` 未決項不得臆造，應標 TODO。產出必須能通過所有 `required: true` 的互通檢查。

---

## 一眼看懂：功能 → 實際情境

| 功能 | 實際情境 |
|------|----------|
| 空關跳過 | Approver1 沒人就找 Approver2，一路跳到有人的關 |
| 無簽核人自動完成 | 全部簽核關都空 → 送出後直接 Completed（level=9999） |
| 平行 all／any | 一關多人：要全過，或一人過即可；過關時該關所有人收通知 |
| 關卡通過通知 | 課長一同意，倉管先備料 |
| SAVE／Submit／… | 依 current_level 決定誰能暫存、送出、簽、退、換、取消、手動通知 |
| Reject 通知策略 | 一定通知建立者＋需求人；其他人看 Admin |
| Return | 退回上一階或填寫人；改完從那一階往下簽 |
| Delegate | 臨時請同事確認，確認完回到原簽核者；可層層回來 |
| 指派代理人 | 請假期間未簽關改代理人；系統欄備註原簽核者；可設起迄 |
| Archive | 草稿軟刪 |
| 可見性 | 正常只有單上的人看得到 |
| Admin 版本／異動標記 | 改已完成單必留版；印章間與 Completed 後明顯標異動 |
| Super user 補欄 | 結案後填發票號碼等 |
| 通知客製＋log | 每人信件可客製；每次寄出可追溯 |
| 單號 .N | doc_no 末尾版本 |

完整規則與 JSON 欄位對照見 `alr5-standard.json` 的 `features[]`。

---

## 狀態與 current_level（必一致）

| status | 意義 | 典型 current_level |
|--------|------|-------------------|
| new | 新申請 | 空 |
| draft | 已暫存／退回人手上 | 0 |
| in_process | 等待簽核 | 1,2,3… |
| completed | 全部簽完 | 9999 |
| denied | 有人拒絕 | （待決） |
| cancelled | 已取消 | -1 |

| current_level | 誰在手上 | 可按 |
|---------------|----------|------|
| 空 | creator／requester | save, submit |
| 0 | creator／requester | save, archive |
| 1..n | current approver | approve, reject, return, cancel, change, delegate |
| 9999 | 完成 | super_user_fill／admin_amend |
| -1 | 已取消 | resubmit（creator／requester／admin） |

另：creator／requester／admin 在簽核中也可 Cancel。

---

## JSON 契約摘要

必備根欄：`schema_version`, `meta`, `creator`, `requester`, `system`, `stages`, `status_model_ref`  

`system` 必備：`status`, `current_level`, `doc_no`, `doc_version`  

名單形狀：`{ "people": [], "groups": [], "emails": [] }`  

動作 enum：save, submit, resubmit, approve, reject, return, change, delegate, cancel, notify, archive, admin_amend, super_user_fill  

最小範例見 `alr5-standard.json` → `json_contract.minimal_document_example`。

---

## 互通檢查清單（全部 required 通過才算互通）

1. 宣告版本對應 ALR5/0.1.0  
2. status 枚舉正確  
3. current_level 語意正確（空／0／1..／9999／-1）  
4. 有 creator、requester（可同可異）  
5. 每關 pass_rule=all|any；空關可跳過  
6. 實作空關跳過＋全員空白自動完成  
7. 動作依 level／角色開放  
8. Reject 必通知 creator＋requester  
9. Cancel→-1，之後可重送  
10. logs 含 opened／saved／changes  
11. notification_logs 可追溯  
12. 系統欄非 admin 不可編  
13. 簽核後異動有 post_approval_amended  
14. 名單為 {people,groups,emails}  

可選：指派代理人、Delegate。

---

## 請產品／業務拍板（open_questions）

1. **Denied 時 current_level？** 停拒件關／回 0／特殊值？  
2. **any 關一人 Reject？** 整單 Denied，還是可被其他人 Approve？  
3. **Return 到中間關後，後面已簽關是否作廢重簽？**  
4. **null 與 0 的邊界？** 第一次 SAVE 前是空還是 0？  
5. **Cancel 重送：** 同單號升 .2 還是新單號？  
6. **誰可設代理人？** 本人／主管核准／僅 admin？  
7. **代理結束是否自動改回原簽核者？**  
8. **cc_system 等收件人能否打開該單？**  
9. **代簽備註欄是否固定 comment1_sys？**  
10. **Archive 能否還原？與 Cancel 如何區分？**  
11. **平行關＋Delegate：** 其他人能否繼續簽？委派中是否計入 all／any？  
12. **admin 能否改已簽那格？**

## 邏輯風險（實作必防）

- 空關跳過＋any 可能重複完成或跳錯關  
- 代理 vs 單上 Change 衝突、代理結束覆蓋問題  
- Return／Reject／Cancel 通知風暴與去重  
- status 與 current_level 不同步  
- 委派環狀 A→B→A  

---

## 版本

- standard_version: **0.1.0**  
- 更新日期: 2026-08-04  
