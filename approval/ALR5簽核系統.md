---
title: ALR5 簽核系統
status: drafting
updated: 2026-08-04
note: 口頭對談整理進本檔；以 diff 確認。尚未口頭確認的區塊保持空白或標「待補」。
---

# ALR5 簽核系統

> 本檔是 ALR5 的**規格單一來源**：流程、規則、角色、權限、通知信、動作。  
> 畫面／API／JSON 實作以此為準；有衝突時先改本檔再改程式。

---

## 0. 文件怎麼用

| 項目 | 說明 |
|------|------|
| 寫入方式 | 你口頭說 → Agent 整理進本檔 → 你看 diff 確認／改 |
| 用語 | 台灣繁體中文；專有名詞可保留原文（ALR5、API 等） |
| 待補 | 尚未講清楚的用 `（待補）` |
| 欄位命名 | JSON／API 用 **snake_case 英文 id**；畫面上另有顯示名稱（可多語） |

---

## 1. 系統定位

| 項目 | 內容 |
|------|------|
| 系統名稱 | ALR5 |
| 用途 | （待補） |
| 與其他簽核系統關係 | （待補：是否要整合／取代／並存） |
| 資料交換 | 以 JSON／API 為主（與現行 SEED 申請單 document JSON 對齊方向） |
| 權限模型摘要 | 單據參與者可見；`admin` 全控＋版本；`super_user` 結案後專欄；`audit` 唯讀 |

---

## 2. 角色與名單欄位

> 口頭定義（2026-08-04）＋建議欄位名稱。  
> **內部 id 穩定**（給 API／報表／整合）；**顯示字眼**可由各 Admin 自訂。

### 2.1 建議欄位名稱對照

| # | 你說的概念 | 建議欄位 id | 建議顯示名稱 | 可編輯 | 通知時機 | 值型別 |
|---|------------|-------------|--------------|--------|----------|--------|
| 1 | 建立者／填單人（多為助理） | `creator` | 建立者 | 視權限（待補） | —（身分欄，非通知名單） | 單一人員 |
| 2 | 需求人（多為業務） | `requester` | 需求人 | 視權限（待補） | — | 單一人員 |
| 3 | CopyTo | `cc` | 副本 | ✅ 可編；可空或有預設 | **送出申請單後** | 名單（見 2.3） |
| 4 | CopyTo_sys | `cc_system` | 系統副本 | ❌ 不可編（Admin 預設） | **送出申請單後** | 名單 |
| 5 | approver1, 2, … | `approvers[]`（或 `approver_1`…） | 簽核人（第 n 關） | 視表單設計（待補） | 輪到該關時請簽；同意／不同意見 §6 | 單人／依關卡 |
| 6 | Notify1, 2, … | `stage_notifies[]`（或 `stage_notify_1`…） | 關卡通過通知 | 視設計（待補） | **該關同意、流程往下**時（備料／提早做事） | 名單 |
| 7 | FYI | `fyi` | 結案知會 | ✅ 可編；可空或有預設 | **整張簽核完成後** | 名單 |
| 8 | FYI_sys | `fyi_system` | 系統結案知會 | ❌ 不可編（Admin 預設） | **整張簽核完成後** | 名單 |

**權限角色（系統級，非申請單名單欄位）：**

| 你說的概念 | 建議角色 id | 建議顯示名稱 | 一句話 |
|------------|-------------|--------------|--------|
| 創立申請表單的 admin | `admin` | 表單管理員 | 建表、設規則、**完全控制**單據（含已完成）；編輯必留版本 |
| Super user | `super_user` | 進階經辦 | 可看符合條件／全部單；簽核完畢後仍可編**專門開給他的欄位** |
| Audit | `audit` | 稽核 | **只能看**申請單，不可編、不可簽 |

欄位主名採舊系統熟悉的 **`creator`**（建立者／填單人；可為代填）。不再以 preparer 為主 id。

**為何這樣取名（簡短）：**

| 建議 id | 理由 |
|---------|------|
| `creator` | 舊系統慣用詞＝建立者／填單人（可代填）；國際文檔若需可註 alias preparer |
| `requester` | 「需求提出人／受益業務」最通用；避免與 creator 都叫 applicant |
| `cc` / `cc_system` | 對應郵件 CC；`_system`＝系統鎖定、不可改（比 `_sys` 好讀） |
| `approvers[]` | 關卡數不定時用陣列；若必須扁平欄位可用 `approver_1`、`approver_2` |
| `stage_notifies[]` | 強調「關卡通過才通知」，與送出時的 `cc`、結案的 `fyi` 分開 |
| `fyi` / `fyi_system` | 業界常用 FYI＝知會、不需簽核；同樣用 `_system` 表鎖定 |
| `admin` | 表單／租戶管理員，非單上名單 |
| `super_user` | 事後補登欄位（發票等），權限小於 admin |
| `audit` | 唯讀稽核 |

不建議繼續當正式 id 的寫法：`CopyTo`（大小寫混）、`CopyTo_sys`、`Notify1`（與關卡對齊關係不明顯）。

### 2.2 角色說明（口頭整理）

| 角色／欄位 id | 說明 |
|---------------|------|
| `creator` | 建立者：實際開單／填單的人，通常是助理；可與 requester 不同（代填） |
| `requester` | 真正有需求的人，通常是業務 |
| `cc` | 送出後要副本通知的名單；可空、可有預設；可多選人員／群組，或手動輸入 mail |
| `cc_system` | 同上時機，但名單由 Admin 預設，填單者不可改 |
| `approvers[]` | 各關簽核人。同意＝approve；不同意＝reject（用語見 2.4） |
| `stage_notifies[]` | 與關卡對齊：某關**確定同意、往下一關**時通知（例如要備料、提早準備） |
| `fyi` | 整張都簽完後通知；通常是確定要接著做事的人；可空或有預設 |
| `fyi_system` | 結案知會的系統鎖定名單，Admin 決定，不可編 |
| `admin` | **創立／維護申請表單**的管理員：能做所有事，含改已完成簽核單；每次編輯留版本紀錄 |
| `super_user` | 可看符合條件或全部申請單；簽核已完成後，仍可編輯**表單專門開放給 super_user 的欄位**（例：退貨單最後回填發票號碼） |
| `audit` | 稽核：只能純粹查看申請單，不能改、不能簽 |

### 2.3 名單值型別（`cc`／`cc_system`／`stage_notifies`／`fyi`／`fyi_system`）

統一結構（建議）：

```json
{
  "people": ["user_id_or_account", "..."],
  "groups": ["group_id", "..."],
  "emails": ["name@example.com", "..."]
}
```

| 規則 | 說明 |
|------|------|
| 多選 | 人員、群組可多選 |
| 手動 mail | 允許直接輸入 email（寫入 `emails`） |
| 可空 | `cc`、`fyi` 允許空（無預設也不強制） |
| 預設值 | 表單範本可帶入預設名單；`*_system` 僅 Admin／範本維護 |

### 2.4 同意／不同意用語（Approve / Deny / Reject）

| 面向 | 建議 |
|------|------|
| 國外常見 | 簽核／BPM、GitHub、Adobe 等較常 **reject / rejected**；**deny / denied** 也常見（偏權限／門禁語感） |
| ALR5 內部 id（穩定） | 動作：`approve`／`reject`；狀態：`approved`／`rejected`（不要拿顯示字當 id） |
| 顯示字眼（Admin 可調） | 同意後：`Approved`／`Completed`／自訂；不同意後：`Denied`／`Rejected`／自訂 |
| 預設顯示（建議） | 同意 → `Approved`；不同意 → `Rejected`（Admin 可改成 Denied 等） |

> 結論：程式與 API 用 **reject／rejected**；畫面要寫 deny／denied／自訂都交給 Admin 設定，不改內部 id。

### 2.5 關卡對齊關係（示意）

```
送出 submit
  ├─ 通知 cc + cc_system
  └─ 進入 approver_1
        ├─ approve → 通知 stage_notify_1 → approver_2 → …
        └─ reject  → （拒件流程，待補）
全部通過
  └─ 通知 fyi + fyi_system
```

`stage_notifies[n]` 對應「第 n 關同意後、往下走」的通知（與 `approvers[n]` 對齊）。精確索引從 0 或 1 起算：（待補，建議 API 用 0-based 陣列，顯示用第 1、2 關）。

---

## 3. 權限

> 誰能看什麼、改什麼、按什麼。分：**單據參與者** vs **系統角色**（admin／super_user／audit）。

### 3.1 誰看得到這筆申請單（可見性）

**預設（正常）：** 只有「這張單上的人」看得到。

| 身分 | 對應欄位 | 可見 |
|------|----------|------|
| 建立者 | `creator` | ✅ |
| 需求人 | `requester` | ✅ |
| CopyTo | `cc`（及是否含 `cc_system`：待補，建議 ✅） | ✅ |
| FYI | `fyi`（及是否含 `fyi_system`：待補，建議 ✅） | ✅ |
| Approver | `approvers[]` 任一關 | ✅ |
| 關卡通過通知收件 | `stage_notifies[]` | （待補：建議 ✅ 至少可看） |
| 其他人 | — | ❌ |

**例外（系統角色）：**

| 角色 | 可見範圍 |
|------|----------|
| `admin` | 其所管表單下的申請單（通常＝全部相關單；待補是否跨表單） |
| `super_user` | **符合條件**的申請單，或設定為可看**全部**（依表單／條件設定） |
| `audit` | 依稽核範圍可看的申請單（唯讀；範圍待補：全部 or 條件） |

### 3.2 權限總表（流程需求）

| 角色 | 可檢視 | 可編輯 | 可簽核 | 建表／設規則 | 備註 |
|------|--------|--------|--------|--------------|------|
| `creator` | 自己相關單 | 草稿欄位；簽核中可改「可編且未簽」的簽核人 | 否（除非身兼） | 否 | 可代填；可與 requester 不同 |
| requester | 自己是需求人的單 | 簽核中可改「可編且未簽」的簽核人（其餘待補） | 否 | 否 | 需求歸屬 |
| `approver` | 自己在簽核鏈上的單 | 通常否（待補意見欄） | ✅ 輪到自己時 approve／reject | 否 | 關卡推進 |
| `cc`／`fyi` 收件人 | 被列入的單 | 否 | 否 | 否 | 知會 |
| `admin` | 所管範圍 | **全部欄位**，含**已完成簽核**的單 | 可代操作（完全控制） | ✅ 創立／維護表單 | 每次編輯**必留版本** |
| `super_user` | 條件／全部（設定） | 僅 **`super_user_fields`**（表單設計時開給他的欄） | 否 | 否 | **簽核完畢後仍可編**這些欄（例：發票號碼） |
| `audit` | 稽核範圍內 | ❌ 純看 | ❌ | 否 | 不可改任何資料 |

### 3.3 `admin`（表單管理員）— 完全控制

| 項目 | 規則 |
|------|------|
| 職責 | 創立申請表單、流程、預設名單、狀態顯示字眼、`cc_system`／`fyi_system`、super_user 可編欄位等 |
| 單據權限 | 能做所有事，**包含修改已完成簽核的申請單資訊** |
| 版本 | **每一次編輯都留下版本紀錄**（不可默默改） |
| 與一般人差異 | 一般人簽完不能改主資料；admin 可以，但必須可稽核 |

### 3.4 `super_user` — 事後補登

| 項目 | 規則 |
|------|------|
| 可見 | 符合條件／所有申請單（表單或角色設定） |
| 可編 | 僅表單標記為 `editable_by: ["super_user"]`（或同等）的欄位 |
| 時機 | **簽核已完成（approved）之後仍可編**這些欄 |
| 範例（退貨） | 先跑退貨申請 → 業務同意退貨 → 實際退貨 → 最後才有發票；`super_user` 回填**發票號碼** |
| 版本 | 建議同樣寫入版本／log（待補：是否與 admin 同等嚴格） |
| 不可 | 任意改未開放欄位；不取代 approver 簽核（除非另兼角色） |

### 3.5 `audit` — 純看

| 項目 | 規則 |
|------|------|
| 可 | 開啟申請單、看欄位、看簽核、看版本／diff |
| 不可 | 編輯、儲存、送出、approve／reject、改名單 |

### 3.6 名單欄位可編規則

| 欄位 id | creator／填單時 | admin | super_user | audit |
|---------|------------------|-------|------------|-------|
| `cc` | ✅ 可編（可空／預設） | ✅ | ❌（除非列入 super_user_fields） | ❌ |
| `cc_system` | ❌ | ✅ 維護 | ❌ | ❌ |
| `fyi` | ✅ 可編（可空／預設） | ✅ | ❌（除非列入） | ❌ |
| `fyi_system` | ❌ | ✅ 維護 | ❌ | ❌ |
| `stage_notifies[]` | （待補） | ✅ | ❌ | ❌ |
| `super_user_fields` 內欄位 | 視設計 | ✅ | ✅（結案後也可） | ❌ |

### 3.7 簽核後資料異動（明顯呈現）

> 口頭需求：有人編輯過的版本不能只靠純文字 log；要能一眼判斷是否合理。  
> 呈現位置：出現在**各個印章中間**，以及 **Completed（結案）後面**；並有**專門欄位**記錄整張簽核完成後是否發生過資料異動。

| 項目 | 建議 |
|------|------|
| 旗標欄位 | `post_approval_amended`（bool）：簽核完成後是否曾改過資料 |
| 摘要欄位 | `post_approval_amendment_summary`（可選）：最後異動時間／人／欄位數 |
| 版本列表 | `versions[]` 或沿用強化後的 `logs[]`（含 opened／saved／changes） |
| 畫面——印章列 | 關與關之間若該時段後有異動，顯示**異動標記**（可點開看紅綠 diff），不要只靠文末文字 |
| 畫面——Completed 後 | 結案狀態／印鑑列後方固定顯示「簽核後有異動」或「簽核後無異動」 |
| 誰會觸發旗標 | `admin` 改已完成單；`super_user` 填發票等；其他若允許的結案後編輯 |
| 判斷「合理」 | 標記＋點開 GitHub 紅綠 diff（舊紅前、新綠後）；純文字流水不夠 |

示意（印鑑列）：

```
[協理印] —(異動•)— [課長印] — [申請印] …  Completed  [簽核後有異動]
                         ↑ 點開看該段／該版 diff
```

### 3.8 欄位可見／可編（業務欄，其餘待補）

| 欄位 | creator | requester | approver | super_user | admin | audit |
|------|----------|-----------|----------|------------|-------|-------|
| 一般業務欄 | 草稿可編 | （待補） | 看 | 否 | 全可編＋版本 | 看 |
| 發票號碼等 | 否 | 否 | 看 | ✅ 結案後 | ✅ | 看 |

---

## 4. 流程

> 從開單到結案的狀態與關卡。口頭情境（2026-08-04）已整理於 §4.2–§4.6。

### 4.1 狀態一覽（顯示字眼 Admin 可調）

| 狀態 ID（內部） | 預設顯示名稱 | 意義 | 可進入的下一狀態 |
|-----------------|--------------|------|------------------|
| `draft` | Draft | 填寫中／暫存 | submit → `in_process` 或直接 `approved`（見跳關） |
| `in_process` | In Process | 簽核進行中 | `approved`／`rejected` |
| `approved` | Approved（可改 Completed／自訂） | 有效關卡皆通過，或**無任何簽核人而自動完成** | （結案；事後補登另計） |
| `rejected` | Rejected（可改 Denied／自訂） | 有人不同意（關卡 reject 規則待補細節） | （待補） |

### 4.2 關卡模型（一關可多人）

每一「階段／關卡」`stages[n]`：

| 項目 | 說明 |
|------|------|
| 簽核人 | 可 **一個或多個**（平行簽核） |
| 通過模式 `pass_rule` | `all`＝**全部**同意才算本關通過；`any`＝**其中一人**同意即本關通過 |
| 空關 | 該關**所有簽核人欄位都沒值** → **整關跳過**（不當成待簽） |
| 對應通知 | 本關通過後可觸發 `stage_notifies[n]`（備料等） |

建議結構（示意）：

```json
{
  "stages": [
    {
      "id": "stage_1",
      "pass_rule": "all",
      "approvers": [{ "person": "U001", "editable": true }, { "person": null }],
      "stage_notify": { "people": [], "groups": [], "emails": [] }
    }
  ]
}
```

（扁平 `approver_1`／`approver_2` 亦可，但多人關卡較適合 `stages[]`。）

### 4.3 空關跳過與自動完成（核心情境）

| 情境 | 行為 |
|------|------|
| Approver1 沒值 | **直接跳到**下一關有值的簽核（如 Approver2） |
| Approver2 也沒值 | 繼續往下跳，直到某一關有值 |
| **全部**簽核者都沒值 | 送出後（或進入簽核時）**自動 Approved／Completed**，不必等人簽 |
| Approver1 有值、Approver2 沒值 | Approver1 簽完後**跳過** Approver2，找下一個有值的關；若後面都沒人 → **自動完成** |
| 某一關有值但尚未輪到 | 不跳過該關；只跳「當下與後續仍為空」的關 |

文字流程：

```
submit
  → 找第一個「有至少一名簽核人」的關卡
      → 若找不到任何關 → 自動 approved（Completed）
      → 否則進入該關等待簽核
  → 本關依 pass_rule 通過後
      → 通知本關相關人（見 §4.5）＋ stage_notify
      → 再找下一個有值的關；沒有 → 自動 approved＋通知 fyi／fyi_system
```

### 4.4 關內平行簽核（all / any）

| `pass_rule` | 意義 | 本關何時往下 |
|-------------|------|----------------|
| `all` | 全部都要通過才算通過 | 該關每位有值的簽核人都 approve |
| `any` | 其中一個通過就算通過 | 任一人 approve 即本關通過 |

**拒件（reject／denied）對 all／any 的精確影響：**（待補；至少「有人 reject 是否整單 rejected」需定案）

### 4.5 階段結果通知（該關所有人）

> 口頭：若有人簽過且算往下一階段，**當階段所有人都要收到通知**（approved 或 denied）。

| 時機 | 收件人 | 內容方向 |
|------|--------|----------|
| 本關通過（往下或結案） | **本關所有簽核人**（含尚未按、或 any 模式下未按到的人） | 本關結果為 approved（已通過） |
| 本關／整單被拒 | **本關所有簽核人** | denied／rejected（用 Admin 顯示字眼） |
| 另 | `stage_notifies[n]` | 備料／提早做事（與簽核人通知可分開） |

### 4.6 代填與換簽核人

| 規則 | 說明 |
|------|------|
| 代填 | `creator`（建立者／代填人）**可以與** `requester`（需求人）**不同** |
| 誰可在簽核中改簽核人 | **`creator` 或 `requester`** |
| 可改哪些人 | 原本填單時**可以編輯**的簽核人欄位，且該人**尚未簽核過** |
| 為何要改 | 填錯、對方休假不在等 → 直接換人 |
| 不可由填寫／需求人改 | 填單時即為**預設且不可編輯**的簽核人 → **僅 `admin` 可換人** |
| 已簽過的人 | 不可再被換成別人（該格已蓋印／已有結果） |

權限摘要：

| 簽核人欄位屬性 | 尚未簽核 | 已簽核 |
|----------------|----------|--------|
| 填單時可編輯 | creator／requester 可換；admin 可換 | 不可換（admin 是否能改已簽：待補，建議走版本異動） |
| 填單時鎖定（預設不可編） | **僅 admin** 可換 | 同上 |

### 4.7 關卡一覽表（與跳關併用）

| 關卡順序 | 欄位 | 空則 | 通過條件 | 通過後 |
|----------|------|------|----------|--------|
| 1…n | `stages[n].approvers` | 跳過整關 | `pass_rule` = all／any | 通知本關所有人＋`stage_notify`；找下一有值關 |
| 無任何有值關 | — | — | — | 自動 `approved` |
| 最後有值關通過且後方皆空 | — | — | — | 自動 `approved`；`fyi`＋`fyi_system` |

### 4.8 流程圖（文字版）

```
creator 開單／填單（可代填；requester 可為另一人）
  → submit → 通知 cc + cc_system
  → 掃描 stages：跳過全空關
      → 若零關有人 → 自動 approved／Completed → fyi + fyi_system
      → 否則進入第一有值關（平行：all 或 any）
            → approve（達通過條件）→ 通知本關所有人（approved）
                 → stage_notify → 再跳空關…
            → reject → 通知本關所有人（denied）→ rejected（細節待補）
  → 簽核中：creator／requester 可改「可編且未簽」的簽核人；鎖定欄僅 admin
```

### 4.9 例外流程（待補）

- 抽回／撤回：
- 加會／會辦：
- 代理簽核：（與「換簽核人」不同，待補是否另做）
- 逾期：

---

## 5. 規則

> 業務規則、檢核、單號、版本、必填等。

### 5.1 開單／送出規則

- `creator` 可與 `requester` 不同（代填）
- 送出後發送 `cc` + `cc_system` 通知
- 送出時依 §4.3 **跳過空關**；若無任何簽核人 → **直接 approved／Completed**

### 5.2 欄位檢核（待補）

| 規則 | 時機 | 說明 |
|------|------|------|
| 換簽核人 | 簽核中存檔 | 僅可改「可編＋未簽」；鎖定欄僅 admin |

### 5.3 單號／版本

- 單號格式：（待補）
- 申請單版本（如 doc_no `.2`）：（待補，與「重新送出」有關）
- **內容版本紀錄 `versions[]`／`logs[]`：** 任何人（尤其 `admin`、`super_user`）編輯儲存都要留版；簽核完成後的異動另抬 `post_approval_amended`
- 換簽核人建議寫入 log（誰、何時、舊簽核人→新簽核人）

### 5.4 其他業務規則

- 簽核完成後：一般參與者不可改主資料；`super_user` 僅可改開放欄；`admin` 可改但必留版本並標示簽核後異動
- 關卡 `pass_rule`：`all`｜`any`（表單設計時由 admin 設定）

---

## 6. 動作（Actions）

> 畫面上／API 可觸發的動作；每個動作寫：誰能按、前置條件、結果、是否寫 log。

| 動作 ID | 預設顯示名稱 | 誰可執行 | 前置條件 | 執行後狀態／副作用 | 寫入 log／版本 |
|---------|--------------|----------|----------|--------------------|----------------|
| `save` | 儲存 | creator（可編階段）、admin、super_user（限其欄） | 有編輯權 | 存檔；可能設 `post_approval_amended` | 是 |
| `approve` | Approve（顯示可改） | 該關 approver；admin 可代操作 | 輪到該關且該關有值 | 依 pass_rule 過關→通知本關所有人→跳空關；無下一關→approved＋fyi | 是 |
| `submit` | 送出 | creator 等（待補） | （待補） | 通知 cc；跳空關；若無簽核人→直接 approved | 是 |
| `change_approver` | 更換簽核人 | creator／requester（可編未簽）；admin（含鎖定欄） | 目標人尚未簽 | 寫 log；不重開已簽關 | 是 |
| `reject` | Reject（顯示可改 Denied 等） | 該關 approver；admin 可代操作 | 輪到該關 | 狀態 `rejected`；（後續待補） | 是 |
| `admin_amend` | 管理員修正 | admin | 任意狀態（含已完成） | 改資料＋版本；若已 approved → `post_approval_amended=true` | 是（強制） |
| `super_user_fill` | 進階經辦回填 | super_user | 單據可見；欄位在 super_user_fields | 只寫開放欄；若已 approved → 建議同樣標異動 | 是 |

### 6.1 動作詳細（待補）

#### save — 儲存

- （待補）

#### submit — 送出

- 通知收件：`cc` ∪ `cc_system`

#### approve — 同意

- 內部 id 固定 `approve`；完成態內部 id `approved`
- 顯示字眼：Admin 可設 Approved／Completed／自訂

#### reject — 不同意

- 內部 id 固定 `reject`；狀態內部 id `rejected`
- 顯示字眼：Admin 可設 Rejected／Denied／自訂

#### admin_amend — 管理員修正已完成單

- 完全控制；強制版本＋簽核後異動標記與印章間／Completed 後可見提示

#### super_user_fill — 例：回填發票號碼

- 退貨流程：申請 → 同意退貨 → 退貨執行 → 發票產生後由 super_user 回填

---

## 7. 通知信

> 何時寄、寄給誰、主旨／內文要點、是否可關閉。

| 通知 ID | 觸發時機 | 收件人欄位 | 主旨要點 | 內文要點 | 備註 |
|---------|----------|------------|----------|----------|------|
| `notify_on_submit` | 送出申請單後 | `cc` + `cc_system` | （待補） | （待補） | |
| `notify_on_stage_pass` | 第 n 關通過且往下 | `stage_notifies[n]` | （待補） | 備料／提早做事 | 與關卡對齊 |
| `notify_stage_peers` | 本關通過或被拒、流程前進／結案 | **本關所有簽核人** | （待補） | 告知本關 approved 或 denied | 含 any 模式下未按鍵者 |
| `notify_on_completed` | 整張簽核完成（含自動完成） | `fyi` + `fyi_system` | （待補） | 可往下做事 | 含「全員空白自動 approved」 |
| `notify_need_approve` | 輪到某關 | 該關尚待簽的人 | （待補） | 請簽核 | （待補） |

### 7.1 通知範本（待補）

#### （通知名稱）

```
主旨：
內文：
```

---

## 8. 操作紀錄（Log）與版本

> 按按鈕／存檔記錄時間、操作者、開啟時值、儲存後值；diff 紅前綠後。  
> **簽核後異動**另見 §3.7：印章中間＋Completed 後明顯標記。

| 項目 | 規則 |
|------|------|
| 何時寫入 | save／submit／approve／reject／admin_amend／super_user_fill 等 |
| 必記欄位 | 時間、操作者、動作、opened、saved、changes |
| 呈現 | GitHub 風格：舊值紅刪線在前、新值綠在後 |
| 存放 | document JSON／未來 API：`logs[]`／`versions[]` |
| 簽核後異動旗標 | `post_approval_amended`；畫面不可只靠文末文字 |

---

## 9. 資料／JSON 對應

| 規格概念 | JSON／API 欄位 | 說明 |
|----------|----------------|------|
| 建立者 | `creator` | 人員（舊系統用語；可代填） |
| 需求人 | `requester` | 人員 |
| 送出副本 | `cc` | 名單物件 |
| 系統送出副本 | `cc_system` | 名單物件，鎖定 |
| 簽核人 | `stages[].approvers` 或 `approvers[]` | 可空＝跳關 |
| 關卡通過規則 | `stages[].pass_rule` | `all`｜`any` |
| 簽核人欄是否可編 | `approvers[].editable`（或欄位 schema） | false＝僅 admin 可換 |
| 關卡通過通知 | `stages[].stage_notify`／`stage_notifies[]` | 與關卡對齊 |
| 結案知會 | `fyi` | 名單物件 |
| 系統結案知會 | `fyi_system` | 名單物件，鎖定 |
| 目前操作者 | `actor` | 執行按鈕的人 |
| 狀態 | `system.status` | 內部 id |
| 狀態顯示字對照 | `status_labels`（待補結構） | Admin 自訂顯示 |
| 系統角色 | 使用者／群組綁定 `admin`／`super_user`／`audit` | 非單上欄位 |
| super_user 可編欄 | 表單 schema：`editable_by` 含 `super_user` | 例：`invoice_no` |
| 簽核後曾異動 | `post_approval_amended` | bool |
| 簽核後異動摘要 | `post_approval_amendment_summary` | 可選 |
| 動作 | `actions[]` | |
| 紀錄／版本 | `logs[]`／`versions[]` | |

---

## 10. 待決問題

- [ ] `stages[]` 物件 vs 扁平 `approver_1`？（多人關卡建議 `stages[]`）
- [ ] `stage_notifies` 填單時可否編輯，或僅表單設計／Admin 可編？
- [ ] reject：`all` 關一人 reject 是否整單 rejected？`any` 關一人 reject 是否整單 rejected、或等其他人？
- [ ] 預設顯示要用 Rejected 還是 Denied？（建議預設 Rejected，Admin 可改）
- [ ] creator 與 requester 是否允許同一人？（已允許不同；同一人應可）
- [ ] 送出時若 `cc` 與 `cc_system` 重複，是否去重只寄一封？
- [ ] `cc_system`／`fyi_system`／`stage_notifies` 收件人是否算「單上的人」而有權限檢視？
- [ ] `super_user` 回填是否一律把 `post_approval_amended` 設為 true？
- [ ] 印章「中間」的異動標記：對應「兩關之間時段」還是「任意簽核後異動都顯示在每道縫」？
- [ ] `admin` 與 `super_user` 範圍：依表單、依部門、還是全域？
- [ ] admin 能否修改「已簽核」的簽核人結果／換人？
- [ ] 自動 approved 時是否仍發 `notify_need_approve`？（應不發，只發 completed／fyi）

---

## 11. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-08-04 | 建立檔案骨架，等待口頭整理 |
| 2026-08-04 | 角色／名單：creator、requester、cc、cc_system、approvers、stage_notifies、fyi、fyi_system；同意／不同意用語建議 |
| 2026-08-04 | 權限角色：admin 完全控制＋版本；super_user 結案後專欄；audit 唯讀；單據可見性；簽核後異動明顯標記（`post_approval_amended`） |
| 2026-08-04 | 流程：空關跳過、全員空白自動完成、關內 all／any 平行簽核、關員全員通知、代填、簽核中換未簽可編簽核人 |
| 2026-08-04 | 欄位主名：建立者改為舊系統慣用 `creator`（不再以 preparer 為主） |
