---
title: ALR5 簽核系統
status: drafting
updated: 2026-08-04
note: 口頭對談整理進本檔；以 diff 確認。尚未口頭確認的區塊保持空白或標「待補」。
---

# ALR5 簽核系統

> 本檔是 ALR5 的**規格單一來源**：流程、規則、角色、權限、通知信、動作。  
> 畫面／API／JSON 實作以此為準；有衝突時先改本檔再改程式。  
> **標準化互通（可貼給 AI）：** `docs/approval/alr5-standard.json` ＋ `docs/approval/ALR5標準互通.md`；網頁按鈕「ALR5功能」。  
> **互通原則：** `interop_checklist` 全部必填通過 → JSON 可互通。

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
| 目標 | 表單＋關卡簽核＋通知＋權限；JSON 可跨系統互通 |
| 本機 PoC | SEED `docs/approval/`（Pages） |
| 與其他簽核系統關係 | （待補：是否要整合／取代／並存） |
| 資料交換 | 以 JSON／API 為主（與現行 SEED 申請單 document JSON 對齊方向） |
| 權限模型摘要 | 單據參與者＋sys 收件可見；`owner`＝form 全控；`admin`＝item 全控；`it_admin`＝全 Form 治理（無主可 archive／export／補 owner）；`super_user`／`audit` 另計 |

### 1b. 互通架構（MVC 語意，定案）

| 層 | 對應 | 說明 |
|----|------|------|
| **M（Model）** | 申請單／表單 **JSON** | 同一套結構認證後，可傳給其他平台 |
| **C（Controller）** | **功能**是否符合 ALR5 | `interop_checklist`／`decisions`；動作、level、權限、檢核 |
| **V（View）** | **畫面** | 依需求調整；AI 時代可由各人與 AI 自訂長相，**不綁死 UI** |

> 互通驗收看 **M＋C**；V 不強制同一畫面。

### 1c. AB 表單／可設定匯出／JSON 完全轉移（定案方向）

| 項目 | 定案 |
|------|------|
| **AB 表單** | **A＝表頭**（`header` 一筆）、**B＝明細**（`lines[]` 多列）；`form_schema.composition=AB`；**使用者設定**完成 |
| **固定格式匯出** | 給其他公司／系統；用 **`export_profiles[]`** 設定格式與欄位對應；可多 profile；設定也是 JSON |
| **完全轉移** | form／申請單／匯出設定／權限／流程皆可序列化搬遷 |
| **自動補齊** | 他系統依 ALR5 JSON 規範，對**缺少的功能或欄位**用標準預設補齊；**未知欄保留** |
| **設定優先** | 上述能力優先讓使用者自己設定完成，**不靠改程式** |
| **JSON 要寫好** | `alr5-standard.json` 必須機讀：形狀、預設、checklist、decisions 齊全 |

### 1d. 跨單關聯／認證鏈／兩種開單（定案方向）

> 你說「有點像認證」——在規格裡當成**合格證明／主檔狀態鏈**，不是登入認證。

| 項目 | 建議／定案 |
|------|------------|
| **怎麼串** | 三件套：`prerequisites`（前置）＋`links`（引用單號）＋`effects_on`（完成回寫） |
| **B 等 A** | B 的 Submit／建立前：prerequisite 要求已 link 的 A 達某 status／level |
| **C 等 B／A** | C 可同時設多條 prerequisite（B completed，和／或 A completed＋欄位未過期） |
| **校正較佳寫法** | **A＝儀器主檔**（存下次校正日）；**B＝每次校正事件**；B 完成 → effect 回寫 A；C 主要查 A |
| **開單 on_demand** | 需要時建立，預設無上限 |
| **開單 preallocated** | 預建名額／庫位／時段；行事曆看 **open** item 搶；實物到齊再往下 |

機器原文：`cross_links`／`create_modes`（standard **0.2.7**）。

### 1e. 全系統進 ALR5＋大量匯入（定案方向）

| 項目 | 定案 |
|------|------|
| **平台願景** | 未來**所有系統都交付進 ALR5**：在內都能處理，並**轉成／維持可轉移 JSON** |
| **大量匯入** | 支援 **header＋detail（lines）** 批次匯入（如退貨發票明細超多） |
| **怎麼做** | `import_profiles[]` 設定欄位對應（匯出的反向）；可一單多明細或檔內多單 |
| **進單後** | 先入 **draft／new** → 再跑必填／前置條件 → Submit |
| **設定優先** | 對應與規則用 JSON 設定，可完全轉移 |

機器原文：`platform_scope`／`bulk_import`（standard **0.2.8**）。

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
| 設計表單的人 | `owner` | 表單擁有者 | 對 **form** full control（欄位／流程／權限範本） |
| IT Administrator | `it_admin` | IT 管理員 | **一次管理所有 Form**；無 owner／owner 離職／無人維護 → 整份 **archive** 或 **export** |
| Admin（單據） | `admin` | 單據管理員 | **不能改表單設計**；對 **item** full control（改資料、決該單權限）；編輯留版本 |
| Super user | `super_user` | 進階經辦 | 可看符合條件／全部單；簽核完畢後仍可編**專門開給他的欄位** |
| Audit | `audit` | 稽核 | **只能看**申請單，不可編、不可簽 |
| 主管 | `supervisor` | 主管 | 可與本人／admin 設定代理人 |

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
| `owner` | 表單設計者；form full control |
| `it_admin` | IT：跨所有 Form 治理；無主 form 可 archive／export |
| `admin` | 單據管理員；item full control；**不能改表單設計** |
| `super_user` | 事後補登欄位（發票等） |
| `audit` | 唯讀稽核 |
| `supervisor` | 可設代理人（與本人、admin） |

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
| `owner` | **設計表單**的人：對 form full control |
| `it_admin` | **IT Administrator**：可一次管理所有 Form；無 owner／離職／無人維護的 form 可整份 archive 或 export |
| `admin` | **單據**管理員：不能改表單設計；對 item full control（改資料、決該單權限）；每次編輯留版本 |
| `super_user` | 可看符合條件或全部申請單；簽核已完成後，仍可編輯**表單專門開放給 super_user 的欄位**（例：退貨單最後回填發票號碼） |
| `audit` | 稽核：只能純粹查看申請單，不能改、不能簽 |
| `supervisor` | 主管：可與本人／admin 設定代理人 |

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

### 2.4 同意／不同意用語（Approve / Reject → Completed / Denied）

| 面向 | 定案 |
|------|------|
| 動作 | `approve`／`reject` |
| 整單狀態 | 全過 → `completed`（Completed）；拒絕 → `denied`（Denied） |
| 與舊討論 | 不再以 `approved`／`rejected` 當主狀態 id；顯示名固定對齊口頭五態 |

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
| CopyTo | `cc` | ✅ |
| 系統副本收件 | `cc_system` | ✅（定案：可開單） |
| 系統結案知會收件 | `fyi_system` | ✅（定案：可開單） |
| 關卡通過通知收件 | `stage_notifies` | ✅（定案：可開單） |
| FYI | `fyi`（及是否含 `fyi_system`：待補，建議 ✅） | ✅ |
| Approver | `approvers[]` 任一關 | ✅ |
| 關卡通過通知收件 | `stage_notifies[]` | （待補：建議 ✅ 至少可看） |
| 其他人 | — | ❌ |

**例外（系統角色）：**

| 角色 | 可見範圍 |
|------|----------|
| `owner` | 其所設計表單相關單（及設計權） |
| `it_admin` | **所有 Form**（治理）；尤其無主／無人維護者 |
| `admin` | 所管範圍之申請單 item（不可改表單設計） |
| `super_user` | **符合條件**的申請單，或設定為可看**全部**（依表單／條件設定） |
| `audit` | 依稽核範圍可看的申請單（唯讀；範圍待補：全部 or 條件） |

### 3.2 權限總表（流程需求）

| 角色 | 可檢視 | 可編輯 | 可簽核 | 建表／設規則 | 備註 |
|------|--------|--------|--------|--------------|------|
| `creator` | 自己相關單 | 草稿欄位；簽核中可改「可編且未簽」的簽核人 | 否（除非身兼） | 否 | 可代填；可與 requester 不同 |
| requester | 自己是需求人的單 | 簽核中可改「可編且未簽」的簽核人（其餘待補） | 否 | 否 | 需求歸屬 |
| `approver` | 自己在簽核鏈上的單 | 通常否（待補意見欄） | ✅ 輪到自己時 approve／reject | 否 | 關卡推進 |
| `cc`／`fyi` 收件人 | 被列入的單 | 否 | 否 | 否 | 知會 |
| `owner` | 所設計表單 | 設計期欄位／流程 | — | ✅ form full control | 設計表單 |
| `it_admin` | 所有 Form | 治理檢視 | — | 跨 Form；無主可 **archive／export** | 平台救火 |
| `admin` | 所管範圍 | **全部欄位**，含**已完成簽核**的單 | 可代操作（item 全控） | ❌ 不能改表單設計 | 每次編輯**必留版本**；可決單一 item 權限 |
| `super_user` | 條件／全部（設定） | 僅 **`super_user_fields`**（表單設計時開給他的欄） | 否 | 否 | **簽核完畢後仍可編**這些欄（例：發票號碼） |
| `audit` | 稽核範圍內 | ❌ 純看 | ❌ | 否 | 不可改任何資料 |

### 3.3 `owner` vs `admin` vs `it_admin`（定案）

| 角色 | 範圍 | 規則 |
|------|------|------|
| `owner` | **form** | 設計表單的人；對自己的表單 **full control**；**可多個 owner／owner 群組** |
| `admin` | **item** | **不能改表單設計**；對申請單 **full control**（改資料、決定該 item 權限）；**不可**改已簽核格人／結果 |
| `it_admin` | **全平台 Form** | **最高治理權之一**：跨 Form 管理；可 **archive／完整 export**；無主／離職／無人維護可 **補派／改派 owner**；form archive → 進行中 items **一律 Cancel** |
| 已簽核格 | 人／結果 | **admin 不行**；**owner** 與 **it_admin** 可以，**必留紀錄**可追溯 |
| 版本 | item 編輯 | admin／owner／it_admin 若改單據資料，**每一次編輯都留版本** |

> `it_admin` ≠ 日常改單的 `admin`：前者是表單資產治理／救火（含補 owner）；後者是單據資料與 item 權限。

### 3.3a Archive ≠ Cancel（定案）

| | **Archive（軟刪除）** | **Cancel（取消流程）** |
|--|----------------------|------------------------|
| 與 status | **無關**；**不改**原本 `status`／`current_level` | `status=cancelled`，`current_level=-1` |
| 旗標 | **`system.archived=true`**（不用 `status=archived`） | — |
| 列表 | 一般列表**預設看不到**；從 **Archive filter** 進入 | 用 cancelled 篩選／報表 |
| 進去之後 | 可檢視／編輯（權限內）；仍依原 level 規則 SAVE／Submit | Resubmit 同單號升 `.N` |
| **復原** | **admin 取消 archive／搬回來**（`archived=false`） | 見 Cancel→重送規則 |

> 整份 **form** 封存（`form.archived`）另案：進行中 items **一律 Cancel**——與單據 item 的軟刪除旗標不同。

### 3.3b 欄位型別／必填／欄位權限（定案）

| 項目 | 規則 |
|------|------|
| 型別 | `text`／`number`／`dropdown`／`multiline`／`date`／… |
| 必填 | `required`；或 `required_when`（依其他欄位值） |
| 階段必填 | `required_from_level`：見下方說明 |
| 欄位 ACL | `visible_to`／`editable_by`／`hidden_from`：可指定人員、群組、角色、或「某欄位裡的人」 |
| item 覆寫 | admin 可針對**單一申請單**調整權限；**與 form 預設衝突時以 admin／item 為準** |
| admin 邊界 | **不可改變表單結構**（欄位／流程設計）；只能編輯**資料**與**權限相關設定** |

#### `required_from_level` 是什麼？

欄位「**從某個 `current_level` 起才變成必填**」，且**之後各關都必填**。

| 門檻 | 意義 | 何時擋 |
|------|------|--------|
| **`0`** | **申請人填寫階段**起就必填，後續 1、2、3… 也必填 | 申請人 **Submit** 就擋（`current_level` 空或 0） |
| **`1`**（或更大） | 從該簽核關起必填（階段補資料） | **進到該 level 後**、**Approve／往下送前**擋；**不擋**申請人 Submit |
| （未設／null） | 不依 level 強制（可另用 `required`／`required_when`） | — |

例：設 `1` → level **1、2、3…** 都必須有值。設 `0` → 申請人送出前就要有，之後各關仍要有。

| 共通規則 | 說明 |
|----------|------|
| **SAVE 草稿不擋** | 暫存可空 |
| 比較式 | 當 `current_level ≥ required_from_level` 才強制（空／尚未 SAVE 視為申請人階段，對門檻 **0** 生效） |

> `required: true` 語意近似「申請人送出前必填」；與 `required_from_level: 0` 可並用或擇一實作，互通時兩者都應在 Submit 擋。

#### 每關 comment vs 階段補資料（定案）

| 概念 | 規則 |
|------|------|
| **comment** | **每一關／每位 approver 固定有一個**（簽核意見）；預設可自行填寫；可表單設是否必填 |
| **階段補資料** | 用**一般業務欄**＋`required_from_level`＋ACL（該關可編），**不要**用 comment 充當資料欄 |
| **代簽備註** | 與 comment 分開；正式 id **`proxy_original_note`**（舊範例名 `comment1_sys`） |
| 畫面建議 | 印章下：時間＋灰色 comment；補資料欄出現在表單本體 |

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

| 項目 | 定案 |
|------|------|
| 判斷欄位 | **`post_approval_amended`（bool）**：簽核完成後是否曾改過資料 |
| 畫面 | **`post_approval_amended=true` 時顯示明顯小小紅點**（印章縫／結案列） |
| 摘要欄位 | `post_approval_amendment_summary`（可選）：最後異動時間／人／欄位數 |
| 版本列表 | `versions[]` 或強化後的 `logs[]`（含 opened／saved／changes） |
| 點開紅點 | 看該段／該版 **紅綠 diff**（舊紅前、新綠後） |
| 誰會觸發旗標 | `admin` 改已完成單；`super_user` 填發票等；`owner`／`it_admin` 改已簽格等 |

示意（印鑑列）：

```
[協理印] —(•紅)— [課長印] — [申請印] …  Completed  [• 簽核後有異動]
                         ↑ 小紅點；點開看 diff
```

### 3.8 欄位可見／可編（業務欄，其餘待補）

| 欄位 | creator | requester | approver | super_user | admin | audit |
|------|----------|-----------|----------|------------|-------|-------|
| 一般業務欄 | 草稿可編 | （待補） | 看 | 否 | 全可編＋版本 | 看 |
| 發票號碼等 | 否 | 否 | 看 | ✅ 結案後 | ✅ | 看 |

---

## 4. 流程

> 從開單到結案的狀態與關卡。口頭情境（2026-08-04）已整理於 §4.2–§4.6。

### 4.1 申請單狀態（口頭定案）

| 狀態 ID（內部） | 顯示名稱 | 意義 | 典型 `current_level` |
|-----------------|----------|------|----------------------|
| `new` | New | 新申請（尚未暫存過） | 空／null |
| `draft` | Draft | 被暫存過了；或送出後被退回在建立者／需求人手上 | `0` |
| `in_process` | In Process | 已經送出，等待簽核 | `1`／`2`／`3`… |
| `completed` | Completed | 全部簽核過（含自動完成） | `9999` |
| `denied` | Denied | 有人拒絕了 | **`-2`** |
| `cancelled` | Cancelled | 已取消 | `-1` |

> **Archive 不是 status。** 用 `system.archived=true` 軟刪除；原本 `status`／`current_level` **不變**（見 §3.3a）。

| 常見轉換 | 說明 |
|----------|------|
| `new` → `draft` | **SAVE → `current_level=0`**（定案） |
| `new`／`draft` → `in_process` | Submit 且尚有待簽關；`current_level`→第一個有值關（1…） |
| `new`／`draft` → `completed` | Submit 後無簽核人；`current_level`→`9999` |
| `in_process` → `completed` | 全過／後方皆空；`current_level`→`9999` |
| `in_process` → `denied` | Reject；**`current_level=-2`**（定案）；**一人 Reject 整單 Denied** |
| `in_process` → `draft`（level `0`） | Return 退回 creator／requester |
| Return 到中間關 | **之後已簽關作廢並重簽**（定案） |
| 進行中 → `cancelled` | Cancel；`current_level`→`-1` |
| 任一狀態 → 軟隱藏 | **Archive**：`system.archived=true`；**status 不變**；一般列表隱藏 |
| 軟隱藏 → 一般列表 | **admin unarchive／搬回**：`archived=false` |
| `cancelled` → 再送 | 同 **doc_no** 升 **.N**（同一張紙）；creator／requester／admin 可重送 |
| `denied` → 再送 | **不可**同單號升版；用 **Copy** 開**全新單**；Denied 原單保留；**owner** 定可 copy 欄；**admin** 定誰／哪幾張可 copy |
| **整份 form archive** | 進行中的 items **一律 Cancel**（與 item 軟刪除不同） |

### 4.1b 角色 × `current_level`（口頭定案）

> `current_level`＝目前流程位置；與 `status` 並存（報表／權限都看得到）。

| `current_level` | 意義 | 誰在手上 | 可按動作 |
|-----------------|------|----------|----------|
| **空／null** | 新單、尚未 SAVE | `creator`／`requester` | **SAVE**、**Submit** |
| **`0`** | SAVE 後，或送出後退回人手上 | `creator`／`requester` | **SAVE**、**Submit**、**Archive**（軟刪除） |
| **`1, 2, 3…`** | 簽核關 | Current approver | Approve／Reject／Return／Cancel／Change；**Delegate 僅非平行關**且該階允許 |
| **`9999`** | 完成 | — | `super_user`／`admin` 事後欄 |
| **`-1`** | 已 Cancel | — | 同單號升版重送（Resubmit） |
| **`-2`** | 已 Denied | — | **Copy** 開全新單（原 Denied **保留**；不可同單號升版） |

**Cancel 誰可按（簽核關 `1…`）：** Current approver；另 **`creator`／`requester`／`admin` 也可 Cancel**（不限當階）。

**Archive：** 在 `current_level = 0` 時由 creator／requester（及有權者）使用；**≠ Cancel**（見 §3.3a）。

### 4.1c 委派 Delegate

| 項目 | 規則 |
|------|------|
| 目的 | 臨時多一個確認人（缺資訊、要請同事／別部門確認） |
| 誰發起 | Current approver（該階允許時） |
| 開關 | owner／Admin 決定該階段要不要能委派 |
| **平行關** | **禁止 Delegate**（定案：同關多人／平行簽核不可委派） |
| 流程 | 委派出去 → 被委派人**確認**後 → **回到該階原簽核者**身上 |
| 層層委派 | 若再委派，則**層層確認回來**後，才回到該階簽核者 |
| 與 Change 差別 | Change＝換掉簽核者；Delegate＝臨時外加確認，簽核責任仍回到原當階簽核者 |
| 與「指派代理人」差別 | 指派代理人＝流程外、依時段跨單代簽（§4.9）；Delegate＝單內臨時確認 |

示意：

```
Approver@Level2
  → Delegate → 同事A 確認
       → Delegate → 部門B 確認
            → B 確認完畢 → 回到 A
                 → A 確認完畢 → 回到 Approver@Level2（繼續 Approve／Reject…）
```

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
| **全部**簽核者都沒值 | 送出後（或進入簽核時）**自動 Completed**，不必等人簽 |
| Approver1 有值、Approver2 沒值 | Approver1 簽完後**跳過** Approver2，找下一個有值的關；若後面都沒人 → **自動 Completed** |
| 某一關有值但尚未輪到 | 不跳過該關；只跳「當下與後續仍為空」的關 |

文字流程：

```
submit
  → 找第一個「有至少一名簽核人」的關卡
      → 若找不到任何關 → 自動 completed
      → 否則進入該關等待簽核（狀態 in_process）
  → 本關依 pass_rule 通過後
      → 通知本關相關人（見 §4.5）＋ stage_notify（下一階或當階 notify）
      → 再找下一個有值的關；沒有 → 自動 completed＋通知 fyi／fyi_system
```

### 4.4 關內平行簽核（all / any）

| `pass_rule` | 意義 | 本關何時往下 |
|-------------|------|----------------|
| `all` | 全部都要通過才算通過 | 該關每位有值的簽核人都 approve |
| `any` | 其中一個通過就算通過 | 任一人 approve 即本關通過 |

**拒件（Reject → Denied）：** 定案——**不論 all／any，一人 Reject → 整單 Denied**，`current_level=-2`。

### 4.5 階段結果通知（該關所有人）

> 口頭：若有人簽過且算往下一階段，**當階段所有人都要收到通知**（approved 或 denied 語意）。

| 時機 | 收件人 | 內容方向 |
|------|--------|----------|
| 本關通過（往下或結案） | **本關所有簽核人**（含尚未按、或 any 模式下未按到的人） | 本關已通過 |
| 本關／整單被拒 | **本關所有簽核人** | Denied |
| 另 | `stage_notifies[n]`（當階 notify） | 備料／提早做事；Approve 成功時通知下一階或當階 notify |
| Reject 時 | 必通知 `requester`＋`creator`；`cc`／已收過通知的 notify 是否通知 → **Admin 設定**（見 §6 Reject） | |

### 4.6 代填與換簽核人（Change）

| 規則 | 說明 |
|------|------|
| 代填 | `creator` **可以與** `requester` **不同** |
| 誰可 Change | **當階簽核者**、`admin`、`creator`、`requester` |
| 可改範圍 | 針對**自己填的／有權限的**簽核人員欄位更換成別人 |
| 常見原因 | 同名同姓給錯人、離職、改找代理人等 |
| 鎖定欄 | 填單時預設不可編 → **僅 admin** 可換（與先前規則一致） |
| 已簽過 | 該格已有結果者不可再換（除非另開 admin 例外，待補） |

權限摘要：

| 簽核人欄位屬性 | 尚未簽核 | 已簽核 |
|----------------|----------|--------|
| 填單時可編輯 | creator／requester 可換；admin 可換 | 不可換（admin 是否能改已簽：待補，建議走版本異動） |
| 填單時鎖定（預設不可編） | **僅 admin** 可換 | 同上 |

### 4.7 關卡一覽表（與跳關併用）

| 關卡順序 | 欄位 | 空則 | 通過條件 | 通過後 |
|----------|------|------|----------|--------|
| 1…n | `stages[n].approvers` | 跳過整關 | `pass_rule` = all／any | 通知本關所有人＋`stage_notify`；找下一有值關 |
| 無任何有值關 | — | — | — | 自動 `completed` |
| 最後有值關通過且後方皆空 | — | — | — | 自動 `completed`；`fyi`＋`fyi_system` |

### 4.8 流程圖（文字版）

```
creator 開單／填單（可代填；requester 可為另一人）
  → SAVE → draft｜Submit → 通知 cc + cc_system
  → 掃描 stages：跳過全空關
      → 若零關有人 → 自動 completed → fyi + fyi_system
      → 否則 in_process；進入第一有值關（平行：all 或 any）
            → Approve（達通過條件）→ 通知本關所有人＋當階／下一階 notify
                 → 再跳空關… → 全過則 completed
            → Reject → Denied；必通知 requester＋creator（其餘見 Admin 設定）
            → Return → 退回指定已簽階或 creator／requester，改完從該階往下簽
            → Change → 換未簽簽核人
            → Cancel → 取消（通知範圍見 Admin／操作者設定）
            → Notify → 手動再寄一封（寫入通知紀錄）
```

### 4.9 流程外：指派代理人（代簽核）

> **不在單張申請單流程按鈕內**，而是人員／系統層級的代理設定。  
> 用途：請假、請長假等期間，由代理人代簽。

| 項目 | 規則 |
|------|------|
| 前提 | **系統有支援**指派代理人功能時才啟用 |
| 誰可設 | **本人／主管／admin**（定案） |
| 生效範圍 | 生效期間內，原簽核者名下**所有相關申請單**可改為**代簽核** |
| 改哪些關 | **所有還沒簽到的**簽核人欄位 → 改成代理人 |
| 已簽過的 | **不动** |
| 代理期間 | 可設定 **代理開始**、**代理結束** |
| 代理結束 | **自動改回原本簽核人**；之後仍可用 **Change** 換人 |
| 系統欄位 | `*_system` 等 **除 admin 外不可編輯** |
| 原簽核者備註 | 正式欄 **`proxy_original_note`**（舊例名 `comment1_sys`）備註原簽核者 |
| 與 Change／Delegate | Change＝單張換人；Delegate＝單內臨時確認；本功能＝請假跨單代簽 |

建議資料（示意）：

```json
{
  "proxy_assignment": {
    "principal": "原簽核者 user_id",
    "agent": "代理人 user_id",
    "start_at": "2026-08-10 00:00:00",
    "end_at": "2026-08-20 23:59:59",
    "reason": "leave | long_leave | …",
    "enabled": true
  }
}
```

單據上代簽後（示意）：

| 欄位 | 行為 |
|------|------|
| 未簽的 `approvers[]` | 值改為代理人 |
| `proxy_original_note` | 寫入／附加「原簽核者：○○○」（系統欄，非 admin 不可改） |
| 其他 `*_system` | 維持鎖定，僅 admin 可編 |

### 4.10 其他例外（待補）

- 抽回／撤回：部分由 Return／Cancel 涵蓋
- 加會／會辦：
- 逾期：見 Notify 類型「逾期通知」

---

## 5. 規則

> 業務規則、檢核、單號、版本、必填等。

### 5.1 開單／送出規則

- `creator` 可與 `requester` 不同（代填）
- SAVE：有編輯權即可暫存 → 狀態 `draft`（若原為 `new`）
- Submit：通常 `creator` 或 `requester`；`admin` 可代送（忘記送、電話請改資料後重送）
- 送出後發送 `cc` + `cc_system` 通知
- 送出時依 §4.3 **跳過空關**；若無任何簽核人 → **直接 `completed`**

### 5.2 欄位檢核（定案）

| 規則 | 時機 | 說明 |
|------|------|------|
| `required` | Submit／Resubmit | 申請人必填欄；SAVE 草稿不強制 |
| `required_when` | 條件成立時 | Submit 或該關 Approve／往下送前 |
| `required_from_level` | `current_level ≥ 門檻` | **＝0** → 申請人 **Submit** 擋；**≥1** → 該關 Approve／往下送前擋；SAVE 不擋 |
| form ACL vs item | 讀寫權限計算 | **以 admin 對該 item 的覆寫為準** |
| 換簽核人 | Change | 當階 approver／admin／creator／requester；鎖定欄僅 admin |
| 通知客製 | 寄信前 | 每人範本可客製；Admin 決定給不給改 |

### 5.3 單號／版本

- 單號格式：（待補）
- 申請單版本（如 doc_no `.2`）：（待補，與「重新送出」有關）
- **內容版本紀錄 `versions[]`／`logs[]`：** 編輯儲存都要留版；簽核完成後的異動另抬 `post_approval_amended`
- Change／Notify／Cancel 等動作寫入可追溯紀錄

### 5.4 其他業務規則

- 簽核完成後：一般參與者不可改主資料；`super_user` 僅可改開放欄；`admin` 可改但必留版本並標示簽核後異動
- 關卡 `pass_rule`：`all`｜`any`（表單設計時由 admin 設定）

---

## 6. 動作（Actions）

> 口頭定案動作 id 用大寫語意：SAVE／Submit／Approve／Reject／Return／Change／Cancel／Notify。  
> API／JSON 建議小寫：`save`／`submit`／`approve`／`reject`／`return`／`change`／`cancel`／`notify`。

### 6.1 總表（依 `current_level`）

| 動作 | `current_level` | 誰可執行 | 說明／副作用 |
|------|-----------------|----------|--------------|
| **SAVE** | 空／`0` | 有編輯權；主要 `creator`／`requester` | 暫存；空→常進 `0`＋`draft` |
| **Submit** | 空／`0`；或 Cancel 後重送 | 通常 `creator`／`requester`；**`admin` 可代送** | 進簽核 `1…` 或自動 `9999`；Cancel 後亦可重送 |
| **Archive** | `0` | `creator`／`requester` | **軟刪除** |
| **Approve** | `1,2,3…` | Current approver | 過關／往下；成功通知下一階或當階 notify |
| **Reject** | `1,2,3…` | Current approver | →`denied`；必通知 requester＋creator；其餘 Admin 控 |
| **Return** | `1,2,3…` | Current approver（等） | 退回上一階／上上階／creator／requester；退到人手上常→`0` |
| **Change** | `1,2,3…` | 當階簽核者、admin、creator、requester | 換簽核人 |
| **Delegate** | `1,2,3…` | Current approver（**Admin 決定該階開不開**） | 臨時加確認人；確認後層層回到原當階簽核者 |
| **指派代理人**（流程外） | — | 本人／主管／admin | 設定代理起迄；未簽關改代理人；`proxy_original_note` 備註原簽核者 |
| **Cancel** | `1,2,3…`（進行中） | Current approver；**另 creator／requester／admin** | →`cancelled`，`current_level=-1`；通知策略見 Admin |
| **Notify** | （多階段） | 有權限者／admin | 手動通知＋`notification_logs` |
| **Resubmit** | `-1` | `creator`／`requester`／`admin` | Cancel 後重送（同 doc_no 升 .N） |
| **Copy** | `-2`（Denied） | 通常 `creator`／`requester`；admin 可代 | 開**全新單**；owner 定可 copy 欄；Denied 原單保留；建議寫 `copied_from` |

另保留：`admin_amend`、`super_user_fill`（`9999` 等結案後）。

### 6.1b Copy（Denied → 全新單）

| 項目 | 規則 |
|------|------|
| 何時 | `status=denied`／`current_level=-2` |
| 與 Cancel 差別 | Cancel＝**同一張紙**升 `.N`；Denied＝**保留拒件紀錄**，Copy＝**另一張新紙** |
| 誰定可 copy 欄 | **owner**（form 設計：`copyable_fields` 或 `fields[].copyable`） |
| 誰可 Copy／哪幾張 | **admin 決定**（可到單一 item：誰可以 copy 哪張、甚至只允許某幾張） |
| 結果 | 新 `doc_no`；簽核清空；通常 `new`／`draft`；源單不動 |
| 追溯 | 建議 `system.copied_from = { doc_no, item_id }` |

### 6.2 SAVE

- `current_level` 空或 `0`；有編輯權
- 效果：暫存；常使狀態→`draft`，`current_level`→`0`

### 6.3 Submit／Resubmit

- 誰：通常 `creator`／`requester`；`admin` 可代按
- **Cancel 之後**（`current_level=-1`）：creator／requester／admin **可以重送**
- 效果：進 `1…` 或自動 `completed`（`9999`）；寄 cc

### 6.3b Archive

- `current_level=0`；creator／requester
- **軟刪除**（資料保留、列表預設不顯示；還原規則待補）

### 6.4 Approve

- `current_level=1,2,3…`；Current approver
- 單一／平行；成功通知下一階或當階 notify；全過→`9999`

### 6.5 Reject

- →`denied`；必通知 requester＋creator
- CopyTo／已通知過的 notify：Admin 設定；部分階層可否當下改通知：Admin 定

### 6.6 Return

- 退回上一階／上上階／creator／requester
- 退到 creator／requester 時：`current_level→0`
- 改完後從該階往下簽

### 6.7 Change

- 當階簽核者、admin、creator、requester；換自己有權的簽核人欄

### 6.7b Delegate（委派）

- 臨時加確認人；確認後回到原當階簽核者；可層層委派再層層回來
- **Admin 決定該階段能不能委派**
- 不同於 §4.9 **指派代理人**（請假／長假跨單代簽）

### 6.7c 指派代理人（流程外）

- 見 §4.9
- 代理開始／結束可設；期間內未簽關改代理人；`proxy_original_note` 備註原簽核者；非 admin 不可編系統欄

### 6.8 Cancel

- 誰：current approver；以及 creator／requester／admin
- 效果：狀態 `cancelled`，**`current_level = -1`**
- 通知：已收過通知者範圍可設定；Admin 決定能否自選或必通知
- **之後可重送**（§6.3）

### 6.9 Notify（手動通知）

- 手動寄送；紀錄時間、內容、類型：`process`／`overdue`／`manual`…

---

## 7. 通知信

> 每一個人收到的信都可**客製化**（由 Admin 決定給不給改）；畫面／流程上要能**流程化顯示**信件／通知內容。

### 7.1 通知觸發一覽

| 通知 ID | 觸發 | 收件人 | 備註 |
|---------|------|--------|------|
| `notify_on_submit` | Submit | `cc`＋`cc_system` | |
| `notify_need_approve` | 輪到某關 | 該關待簽者 | |
| `notify_on_stage_pass` | Approve 成功往下 | `stage_notifies`（當階 notify） | 備料等 |
| `notify_stage_peers` | 本關通過／被拒 | 本關所有簽核人 | |
| `notify_on_reject` | Reject | 必：requester＋creator；可選：cc、已通知過的 notify | Admin 控制可選範圍與是否允許當下改 |
| `notify_on_return` | Return | 被退回對象等 | （待補範本） |
| `notify_on_cancel` | Cancel | 依設定：已收過通知者子集 | Admin：可自選 or 必通知 |
| `notify_on_completed` | Completed（含自動） | `fyi`＋`fyi_system` | |
| `notify_manual` | Notify 動作 | 操作者選擇／規則 | 寫入通知紀錄 |
| `notify_overdue` | 逾期規則 | （待補） | 類型 overdue |

### 7.2 客製化與流程化顯示

| 規則 | 說明 |
|------|------|
| 每人範本 | 每個收件角色／個人收到的信都可客製（主旨、內文、變數） |
| 誰能改範本 | **Admin 決定**該範本「允許被改」或「鎖定」 |
| 流程化顯示 | UI 依流程節點展示將寄／已寄的通知內容（不是只藏在後台） |
| 可追溯 | 見 §7.3 `notification_logs[]` |

### 7.3 通知紀錄（必做）

```json
{
  "id": "nlog_…",
  "at": "2026-08-04 17:00:00",
  "type": "process | overdue | manual | …",
  "action": "submit | approve | reject | cancel | notify | …",
  "to": { "people": [], "groups": [], "emails": [] },
  "subject": "…",
  "body": "…",
  "actor": { "id": "…", "name": "…" }
}
```

| 欄位 | 說明 |
|------|------|
| `at` | 通知時間 |
| `type` | 流程／逾期／手動等 |
| `subject`／`body` | 實際寄出內容 |
| `to` | 收件名單 |
| `actor` | 若為手動 Notify，誰按的 |

### 7.4 通知範本（待補逐封正文）

```
主旨：（待補）
內文：（待補；支援變數如 doc_no、creator、requester、連結…）
```

---

## 8. 操作紀錄（Log）與版本

> 按按鈕／存檔記錄時間、操作者、開啟時值、儲存後值；diff 紅前綠後。  
> **簽核後異動**另見 §3.7：印章中間＋Completed 後明顯標記。  
> **通知**另見 `notification_logs[]`（§7.3）。

| 項目 | 規則 |
|------|------|
| 何時寫入 | save／submit／approve／reject／return／change／cancel／notify／admin_amend／super_user_fill 等 |
| 必記欄位 | 時間、操作者、動作、opened、saved、changes |
| 呈現 | GitHub 風格：舊值紅刪線在前、新值綠在後 |
| 存放 | `logs[]`／`versions[]`；通知另存 `notification_logs[]` |
| 簽核後異動旗標 | `post_approval_amended` |

---

## 9. 資料／JSON 對應

| 規格概念 | JSON／API 欄位 | 說明 |
|----------|----------------|------|
| 建立者 | `creator` | 人員（舊系統用語；可代填） |
| 需求人／申請人 | `requester` | 人員 |
| 送出副本 | `cc` | 名單物件 |
| 系統送出副本 | `cc_system` | 名單物件，鎖定 |
| 簽核人 | `stages[].approvers` | 可空＝跳關 |
| 關卡通過規則 | `stages[].pass_rule` | `all`｜`any` |
| 簽核人欄是否可編 | `approvers[].editable` | false＝僅 admin 可換 |
| 關卡通過通知 | `stages[].stage_notify` | 當階 notify |
| 結案知會 | `fyi`／`fyi_system` | |
| 狀態 | `system.status` | `new`／`draft`／`in_process`／`completed`／`denied`／`cancelled` |
| 目前關卡 | `system.current_level` | 空＝新申請；`0`＝creator／requester；`1…`＝簽核關；`9999`＝完成；`-1`＝取消 |
| 委派鏈 | `delegation_stack[]`（建議） | 層層委派／確認回來 |
| 指派代理人 | `proxy_assignment`（人員層） | start_at／end_at／principal／agent |
| 代簽備註原簽核者 | `stages[].approvers[].proxy_original_note` | 系統欄；非 admin 不可編（舊例名 `comment1_sys`） |
| 每關簽核意見 | `stages[].approvers[].comment` | 每位 approver 固定 |
| Denied Copy 來源 | `system.copied_from` | 追溯源 Denied 單 |
| 欄位可複製 | `fields[].copyable` | owner 決定 Copy 帶哪些欄 |
| 軟刪除 | `archived` 或同等旗標 | Archive 於 level `0` |
| 動作 | `actions[]` | save／submit／approve／reject／return／change／cancel／notify… |
| 操作 log | `logs[]` | |
| 通知紀錄 | `notification_logs[]` | 時間、內容、類型可追溯 |
| 信件範本 | `mail_templates[]` | 可客製；admin 鎖或放編 |
| 簽核後曾異動 | `post_approval_amended` | bool |

---

## 10. 已定案（2026-08-04 口頭）

| 題 | 定案 |
|----|------|
| Denied 的 level | **`-2`** |
| any 關一人 Reject | **整單 Denied** |
| Return 到中間關 | **後面已簽關作廢並重簽** |
| 第一次 SAVE | **level → 0**（SAVE 前可為空） |
| Cancel 後重送 | **同 doc_no，升 .N**（同一張紙） |
| Denied 後重送 | **不可**同單號升版；用 **Copy** 開全新單；原單保留；**owner** 定可 copy 欄 |
| Copy 誰／哪張 | **admin 決定**誰可 copy、可 copy 哪幾張（可到單一 item） |
| 誰可設代理人 | **本人／主管／admin**；結束**自動改回**原簽核人；仍可用 Change |
| 平行關＋Delegate | **平行關禁止 Delegate** |
| cc_system／fyi_system 能否開單 | **能** |
| form ACL vs item 覆寫 | **以 admin／item 為準**；admin 不可改表單結構 |
| `required_from_level` | 自該 level 起必填；**＝0** 申請人 Submit 擋；**≥1** Approve 前擋、不擋 Submit |
| 每關 comment | **固定**每位 approver 有 `comment`；階段補資料用業務欄 |
| 代簽備註 | 正式 id **`proxy_original_note`**（舊例 `comment1_sys`） |
| Archive ≠ Cancel | **`system.archived` 軟刪除**，**不改 status**；admin **unarchive** 復原；與 cancelled 分開 |
| 已簽核格改人／結果 | **admin 不行**；**owner／it_admin** 可以，必留紀錄 |
| 多 owner | **可以**（多 owner／owner 群組） |
| it_admin 無主 form | **最高治理**：可 **補派 owner**（不只 archive／export） |
| export 範圍 | **全部**：form 定義＋歷史 items＋附件（完整給新平台） |
| form archive → items | 進行中 **一律 Cancel** |
| 簽核後異動標記 | **`post_approval_amended`** 判斷；畫面**明顯小紅點** |
| 互通架構 | **MVC 語意**：M＝可認證 JSON；C＝功能符合 checklist；V＝各端／AI 自訂畫面 |
| AB 表單 | **A＝header、B＝lines**；使用者設定；JSON 可轉移 |
| 固定格式匯出 | **`export_profiles[]`** 設定對應；與完整遷移包分開 |
| JSON 自動補齊 | 依規範補缺欄／缺功能預設；未知欄保留 |
| 設定優先 | AB／匯出等讓使用者自己設定完成，不靠改程式 |
| 跨單關聯 | prerequisites＋links＋effects_on；建議主檔＋事件（校正回寫） |
| 開單模式 | **on_demand**／**preallocated**（名額搶位＋行事曆） |
| 全系統進 ALR5 | 各系統交付於此，處理並轉成可轉移 JSON |
| 大量匯入 | header＋lines 批次匯入（退貨發票等）；import_profiles 設定 |

## 10b. 仍待決

- [ ] 明細是否支援列級簽核／列級 ACL，或一律整單簽核？
- [ ] 匯出檔存放與重送策略（只留 log，還是存檔案）？
- [ ] 跨單：畫面如何選他單／顯示認證鏈？
- [ ] 多張事件單回寫同一主檔欄位時，衝突以誰為準？
- [ ] 預建池誰批次產生？held 逾時多久自動釋放？
- [ ] 明細超級多：lines 全內嵌，還是分片／外掛？單單上限？
- [ ] 大量匯入檢核是否非同步？失敗列如何修？

---

## 11. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-08-04 | 建立檔案骨架，等待口頭整理 |
| 2026-08-04 | 角色／名單：creator、requester、cc、cc_system、approvers、stage_notifies、fyi、fyi_system；同意／不同意用語建議 |
| 2026-08-04 | 權限角色：admin 完全控制＋版本；super_user 結案後專欄；audit 唯讀；單據可見性；簽核後異動明顯標記（`post_approval_amended`） |
| 2026-08-04 | 流程：空關跳過、全員空白自動完成、關內 all／any 平行簽核、關員全員通知、代填、簽核中換未簽可編簽核人 |
| 2026-08-04 | 欄位主名：建立者改為舊系統慣用 `creator`（不再以 preparer 為主） |
| 2026-08-04 | 狀態五態＋動作 SAVE／Submit／Approve／Reject／Return／Change／Cancel／Notify；通知客製與 notification_logs |
| 2026-08-04 | `current_level`：空／0／1…／9999／-1；Archive；Delegate 層層回來；Cancel 後可重送；cancelled 正式列入 |
| 2026-08-04 | 流程外指派代理人：起迄時段、未簽改代簽、`comment1_sys` 備註原簽核者、系統欄非 admin 不可編 |
| 2026-08-04 | 標準化：alr5-standard.json＋ALR5標準互通.md＋網頁「ALR5功能」與互通檢查清單 |
| 2026-08-04 | 定案：Denied=-2；一人Reject整單Denied；Return作廢後續；SAVE→0；Cancel同單號升版；代理人本人／主管／admin；平行禁Delegate；sys收件可開單；owner≠admin；欄位型別／條件必填／ACL |
| 2026-08-04 | 新增 `it_admin`：一次管理所有 Form；無主／離職／無人維護可整份 archive／export |
| 2026-08-04 | v0.2.2：ACL item 優先；required_from_level 檢核時機；Denied Copy；每關 comment／proxy_original_note |
| 2026-08-04 | v0.2.3：補定 `required_from_level=0`＝申請人階段起必填（Submit 擋，後續亦必填） |
| 2026-08-04 | v0.2.4：拍板 Archive≠Cancel、已簽格權限、多 owner、it_admin 補 owner、完整 export、form archive→Cancel、Copy 授權、紅點 |
| 2026-08-04 | v0.2.5：Archive＝`system.archived` 與 status 無關；admin unarchive 復原；互通 MVC（M＝JSON／C＝功能／V＝自訂畫面） |
| 2026-08-04 | v0.2.6：AB 表單、可設定 export_profiles、json_completeness 自動補齊；設定優先＋JSON 完全轉移 |
| 2026-08-04 | v0.2.7：跨單 prerequisites／links／effects_on；開單 on_demand／preallocated；校正主檔＋事件建議 |
| 2026-08-04 | v0.2.8：全系統交付 ALR5→JSON；大量匯入 header＋detail（import_profiles） |
