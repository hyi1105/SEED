# ALR5 標準互通規格（可貼給 AI）

> **用途：** 整份複製貼給新的 AI／Agent，要求依此實作簽核 JSON 互傳。  
> **機器可讀原文：** `docs/approval/alr5-standard.json`（standard_version **0.2.3**）  
> **人讀總規：** `approval/ALR5簽核系統.md`  
> **檢查原則：** `interop_checklist` 裡所有 `required: true` 通過 → 視為可與 ALR5 互通。

---

## 給 AI 的開場（請一併貼上）

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.3** 與 `json_contract`／`interop_checklist`／`decisions` 實作。狀態、`current_level`、動作 id 不得自創別名。`decisions` 已定案不得違反。產出必須通過全部 `required: true` 檢查。

---

## 已定案（必遵守）

| 題 | 定案 |
|----|------|
| Denied 的 level | **`-2`** |
| any／all 一人 Reject | **整單 Denied** |
| Return 到中間關 | **後面已簽關作廢並重簽** |
| 第一次 SAVE | **level → 0**（之前可為空） |
| Cancel 後重送 | **同 doc_no，升 .N**（同一張紙） |
| Denied 後重送 | **不可**同單號升版；用 **Copy** 開**全新單**；Denied 原單**保留紀錄**；**owner** 決定哪些欄可 copy |
| 誰可設代理人 | **本人／主管／admin**；結束**自動改回**原簽核人；仍可用 Change |
| 平行關＋Delegate | **平行關禁止 Delegate** |
| cc_system／fyi_system | **收件人可以打開該單** |
| Owner vs Admin | **owner＝form full control**；**admin＝item full control，不能改表單設計** |
| form ACL vs item 覆寫 | **以 admin／item 為準**；admin 只可編**資料與權限**，不可改表單結構 |
| IT Administrator | **`it_admin`**：一次管所有 Form；無 owner／離職／無人維護 → 整份 **archive** 或 **export** |
| `required_from_level` | 自該 level 起（含之後）必填；**＝0**＝申請人階段起（**Submit 擋**）；**≥1**＝該關 Approve 前擋、**不擋 Submit**；SAVE 不擋 |
| 每關 comment | **每位 approver 固定有 `comment`**；階段補資料用業務欄＋`required_from_level`／ACL |
| 代簽備註欄 | 正式 id **`proxy_original_note`**（舊例 `comment1_sys` 僅範例名） |

---

## 一眼看懂：功能 → 實際情境

| 功能 | 實際情境 |
|------|----------|
| 空關跳過 | Approver1 沒人就找 Approver2 |
| 無簽核人自動完成 | 全部空 → Completed（9999） |
| 平行 all／any | 全過或一人過；**一人 Reject 整單 Denied（-2）** |
| 關卡通過通知 | 同意後備料通知 |
| SAVE／Submit／… | 依 current_level 決定誰能按；**SAVE→0** |
| Return | 退回後**後續已簽作廢重簽** |
| Delegate | 臨時確認；**平行關不可用** |
| 指派代理人 | 請假代簽；本人／主管／admin；結束改回 |
| Denied Copy | 拒件保留；Copy 成全新單（owner 定可 copy 欄） |
| Owner／Admin／IT | 設計表單 vs 管單據 vs 全 Form 治理（無主 archive／export） |
| 欄位型別／必填／ACL | text／number／…；條件必填；階段必填；誰能看能編；**item 覆寫優先** |
| 每關 comment／補資料 | 印章下寫意見；關內補欄位用業務欄 |

完整見 `alr5-standard.json` 的 `features[]`、`field_schema`、`decisions`。

---

## 狀態與 current_level

| status | 典型 current_level |
|--------|-------------------|
| new | 空（尚未 SAVE） |
| draft | 0 |
| in_process | 1,2,3… |
| completed | 9999 |
| cancelled | -1 |
| denied | **-2** |

| current_level | 誰 | 可按 |
|---------------|----|------|
| 空 | creator／requester | save, submit |
| 0 | creator／requester | save, submit, archive |
| 1..n | current approver | approve, reject, return, cancel, change；（非平行才）delegate |
| 9999 | — | super_user_fill／admin_amend |
| -1 | — | resubmit（同單號升版） |
| -2 | — | **copy**（全新單；原 Denied 保留） |

---

## 欄位模型（摘要）

- **型別：** text, number, dropdown, multiline, date, …
- **必填：** `required`／`required_when`／`required_from_level`
- **`required_from_level`：** 自某 level 起（含之後）必填  
  - **＝0**：申請人填寫階段起必填 → **Submit 擋**，後續也必填  
  - **≥1**：該簽核關起才必填 → **Approve 前擋**，不擋申請人 Submit  
  - **SAVE** 草稿一律不擋
- **ACL：** visible_to／editable_by／hidden_from；**admin 對單一 item 覆寫優先於 form 預設**
- **Copy：** owner 設 `copyable`／`copyable_fields`；Denied 用 `copy` 開新單

---

## 互通檢查

見 `alr5-standard.json` → `interop_checklist`。

---

## 仍待決

1. Archive 還原？與 Cancel 列表區分  
2. admin 改已簽那格？  
3. 多個 owner？  
4. it_admin 對無主 form 能否改派 owner／暫改設計？  
5. form export 範圍；archive 後進行中 items 如何處理？  
6. Denied Copy 誰可按（除 creator／requester／admin）？  
7. 印章縫異動標記粒度？  

---

## 版本

- standard_version: **0.2.3**  
- 更新日期: 2026-08-04  
