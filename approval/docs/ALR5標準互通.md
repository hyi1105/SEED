# ALR5 標準互通規格（可貼給 AI）

> **用途：** 整份複製貼給新的 AI／Agent，要求依此實作簽核 JSON 互傳。  
> **機器可讀原文：** `docs/approval/alr5-standard.json`（standard_version **0.2.4**）  
> **人讀總規：** `approval/ALR5簽核系統.md`  
> **檢查原則：** `interop_checklist` 裡所有 `required: true` 通過 → 視為可與 ALR5 互通。

---

## 給 AI 的開場（請一併貼上）

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.4** 與 `json_contract`／`interop_checklist`／`decisions` 實作。狀態、`current_level`、動作 id 不得自創別名。`decisions` 已定案不得違反。產出必須通過全部 `required: true` 檢查。

---

## 已定案（必遵守）

| 題 | 定案 |
|----|------|
| Denied 的 level | **`-2`** |
| any／all 一人 Reject | **整單 Denied** |
| Return 到中間關 | **後面已簽關作廢並重簽** |
| 第一次 SAVE | **level → 0**（之前可為空） |
| Cancel 後重送 | **同 doc_no，升 .N**（同一張紙） |
| Denied 後重送 | **Copy** 開全新單；原單保留；**owner** 定可 copy 欄；**admin** 定誰／哪幾張可 copy |
| Archive ≠ Cancel | Archive＝預設列表隱藏，從 **archive filter** 進入可編→**Draft／Submit**；報表與 cancelled **分開** |
| 已簽核格改人／結果 | **admin 不行**；**owner／it_admin** 可以，**必留紀錄** |
| 多 owner | **可以**（多 owner／owner 群組） |
| it_admin | **最高治理**：可補派 owner；完整 export；form archive→進行中 **Cancel** |
| export | **全部**：form 定義＋歷史 items＋附件 |
| 簽核後異動 | **`post_approval_amended`**；畫面**明顯小紅點** |
| 誰可設代理人 | **本人／主管／admin**；結束自動改回；仍可用 Change |
| 平行關＋Delegate | **平行關禁止 Delegate** |
| cc_system／fyi_system | **收件人可以打開該單** |
| Owner vs Admin | **owner＝form**；**admin＝item**（不可改表單設計）；ACL 衝突以 **item** 為準 |
| `required_from_level` | **＝0** Submit 擋；**≥1** Approve 前擋、不擋 Submit；SAVE 不擋 |
| 每關 comment | 每位 approver 固定有；代簽備註＝`proxy_original_note` |

---

## 一眼看懂：功能 → 實際情境

| 功能 | 實際情境 |
|------|----------|
| Archive | 平常看不到；從 Archive 清單進去再編、存 Draft 或送出 |
| Cancel | 流程取消；列表用 cancelled 篩 |
| Denied Copy | 拒件保留；admin 決定誰能 copy 哪張 |
| it_admin | 無主表單可補 owner；整包 export 換平台 |
| 小紅點 | `post_approval_amended`＝有人簽完後改過資料 |

完整見 `alr5-standard.json` 的 `features[]`、`field_schema`、`decisions`。

---

## 狀態與 current_level

| status | 典型 current_level |
|--------|-------------------|
| new | 空 |
| draft | 0 |
| in_process | 1,2,3… |
| completed | 9999 |
| cancelled | -1 |
| denied | **-2** |
| archived | 通常 0（軟隱藏） |

| current_level | 誰 | 可按 |
|---------------|----|------|
| 空／0 | creator／requester | save, submit, archive |
| 1..n | current approver | approve, reject, return, cancel, change；（非平行）delegate |
| 9999 | — | super_user_fill／admin_amend |
| -1 | — | resubmit |
| -2 | — | copy（admin 授權） |

---

## 仍待決

1. Archive 要用獨立 `status=archived`，還是原 status＋`system.archived=true`？

---

## 版本

- standard_version: **0.2.4**  
- 更新日期: 2026-08-04  
