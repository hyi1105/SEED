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

---

## 2. 角色與名單欄位

> 口頭定義（2026-08-04）＋建議欄位名稱。  
> **內部 id 穩定**（給 API／報表／整合）；**顯示字眼**可由各 Admin 自訂。

### 2.1 建議欄位名稱對照

| # | 你說的概念 | 建議欄位 id | 建議顯示名稱 | 可編輯 | 通知時機 | 值型別 |
|---|------------|-------------|--------------|--------|----------|--------|
| 1 | 填單人（多為助理） | `preparer` | 填單人 | 視權限（待補） | —（身分欄，非通知名單） | 單一人員 |
| 2 | 需求人（多為業務） | `requester` | 需求人 | 視權限（待補） | — | 單一人員 |
| 3 | CopyTo | `cc` | 副本 | ✅ 可編；可空或有預設 | **送出申請單後** | 名單（見 2.3） |
| 4 | CopyTo_sys | `cc_system` | 系統副本 | ❌ 不可編（Admin 預設） | **送出申請單後** | 名單 |
| 5 | approver1, 2, … | `approvers[]`（或 `approver_1`…） | 簽核人（第 n 關） | 視表單設計（待補） | 輪到該關時請簽；同意／不同意見 §6 | 單人／依關卡 |
| 6 | Notify1, 2, … | `stage_notifies[]`（或 `stage_notify_1`…） | 關卡通過通知 | 視設計（待補） | **該關同意、流程往下**時（備料／提早做事） | 名單 |
| 7 | FYI | `fyi` | 結案知會 | ✅ 可編；可空或有預設 | **整張簽核完成後** | 名單 |
| 8 | FYI_sys | `fyi_system` | 系統結案知會 | ❌ 不可編（Admin 預設） | **整張簽核完成後** | 名單 |
| — | （隐含）管理員 | `admin` | 管理員 | 設定字眼／系統名單等 | — | 角色 |

**為何這樣取名（簡短）：**

| 建議 id | 理由 |
|---------|------|
| `preparer` | 國際表單常見「填單／代填」＝preparer；比 filer／assistant 更中性 |
| `requester` | 「需求提出人／受益業務」最通用；避免與 preparer 都叫 applicant |
| `cc` / `cc_system` | 對應郵件 CC；`_system`＝系統鎖定、不可改（比 `_sys` 好讀） |
| `approvers[]` | 關卡數不定時用陣列；若必須扁平欄位可用 `approver_1`、`approver_2` |
| `stage_notifies[]` | 強調「關卡通過才通知」，與送出時的 `cc`、結案的 `fyi` 分開 |
| `fyi` / `fyi_system` | 業界常用 FYI＝知會、不需簽核；同樣用 `_system` 表鎖定 |

不建議繼續當正式 id 的寫法：`CopyTo`（大小寫混）、`CopyTo_sys`、`Notify1`（與關卡對齊關係不明顯）。

### 2.2 角色說明（口頭整理）

| 角色／欄位 id | 說明 |
|---------------|------|
| `preparer` | 實際填單的人，通常是助理 |
| `requester` | 真正有需求的人，通常是業務 |
| `cc` | 送出後要副本通知的名單；可空、可有預設；可多選人員／群組，或手動輸入 mail |
| `cc_system` | 同上時機，但名單由 Admin 預設，填單者不可改 |
| `approvers[]` | 各關簽核人。同意＝approve；不同意＝reject（用語見 2.4） |
| `stage_notifies[]` | 與關卡對齊：某關**確定同意、往下一關**時通知（例如要備料、提早準備） |
| `fyi` | 整張都簽完後通知；通常是確定要接著做事的人；可空或有預設 |
| `fyi_system` | 結案知會的系統鎖定名單，Admin 決定，不可編 |
| `admin` | 可決定狀態顯示字眼、系統名單（`cc_system`／`fyi_system`）等 |

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

> 誰能看什麼、改什麼、按什麼。可依「角色 × 狀態 × 欄位／動作」描述。

### 3.1 權限總表（待補）

| 角色 | 可檢視 | 可編輯欄位 | 可執行動作 | 條件／備註 |
|------|--------|------------|------------|------------|
| preparer | （待補） | 表單欄位、`cc`、`fyi`…（待補） | save／submit… | |
| requester | （待補） | （待補） | （待補） | |
| approver（該關） | （待補） | （待補） | approve／reject | 僅輪到自己 |
| admin | 設定 | `cc_system`、`fyi_system`、狀態顯示字眼 | （待補） | |

### 3.2 名單欄位可編規則（已部分確認）

| 欄位 id | preparer／填單時 | admin |
|---------|------------------|-------|
| `cc` | ✅ 可編（可空／預設） | 可設預設 |
| `cc_system` | ❌ | ✅ 維護 |
| `fyi` | ✅ 可編（可空／預設） | 可設預設 |
| `fyi_system` | ❌ | ✅ 維護 |
| `stage_notifies[]` | （待補：表單設計時鎖定 or 可編） | （待補） |

### 3.3 欄位可見／可編（其餘待補）

| 欄位 | preparer | requester | approver | 其他 |
|------|----------|-----------|----------|------|
| | | | | |

---

## 4. 流程

> 從開單到結案的狀態與關卡。

### 4.1 狀態一覽（待補；顯示字眼 Admin 可調）

| 狀態 ID（內部） | 預設顯示名稱 | 意義 | 可進入的下一狀態 |
|-----------------|--------------|------|------------------|
| `draft` | Draft | （待補） | |
| `in_process` | In Process | （待補） | |
| `approved` | Approved（可改 Completed／自訂） | 全部同意 | |
| `rejected` | Rejected（可改 Denied／自訂） | 有人不同意 | |

### 4.2 關卡／簽核階層（待補）

| 關卡順序 | 角色／欄位 | 通過條件 | 通過後通知 | 拒絕後去向 |
|----------|------------|----------|------------|------------|
| 1 | `approvers[0]` | approve | `stage_notifies[0]` | （待補） |
| 2 | `approvers[1]` | approve | `stage_notifies[1]` | （待補） |
| … | | | | |
| 全部通過 | — | — | `fyi` + `fyi_system` | — |

### 4.3 流程圖（文字版）

```
preparer 填單（requester 為需求人）
  → submit
      → 通知：cc + cc_system
      → approver_1 →（approve → 通知 stage_notify_1）→ approver_2 → …
      → 全數 approve → 通知：fyi + fyi_system → 狀態 approved
      → 任關 reject → 狀態 rejected（後續待補）
```

### 4.4 例外流程（待補）

- 抽回／撤回：
- 加會／會辦：
- 代理簽核：
- 逾期：

---

## 5. 規則

> 業務規則、檢核、單號、版本、必填等。

### 5.1 開單／送出規則（待補）

- 送出後發送 `cc` + `cc_system` 通知

### 5.2 欄位檢核（待補）

| 規則 | 時機 | 說明 |
|------|------|------|
| | | |

### 5.3 單號／版本（待補）

- 單號格式：
- 版本（如 `.2`）：

### 5.4 其他業務規則（待補）

-

---

## 6. 動作（Actions）

> 畫面上／API 可觸發的動作；每個動作寫：誰能按、前置條件、結果、是否寫 log。

| 動作 ID | 預設顯示名稱 | 誰可執行 | 前置條件 | 執行後狀態／副作用 | 寫入 log |
|---------|--------------|----------|----------|--------------------|----------|
| `save` | 儲存 | （待補） | （待補） | 存檔 | 是 |
| `submit` | 送出 | （待補） | （待補） | 進流程；通知 `cc`+`cc_system` | 是 |
| `approve` | Approve（顯示可改） | 該關 approver | 輪到該關 | 往下；通知對應 `stage_notify`；若最後一關再通知 `fyi`+`fyi_system`，狀態 `approved` | 是 |
| `reject` | Reject（顯示可改 Denied 等） | 該關 approver | 輪到該關 | 狀態 `rejected`；（後續待補） | 是 |

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

---

## 7. 通知信

> 何時寄、寄給誰、主旨／內文要點、是否可關閉。

| 通知 ID | 觸發時機 | 收件人欄位 | 主旨要點 | 內文要點 | 備註 |
|---------|----------|------------|----------|----------|------|
| `notify_on_submit` | 送出申請單後 | `cc` + `cc_system` | （待補） | （待補） | |
| `notify_on_stage_pass` | 第 n 關同意且往下 | `stage_notifies[n]` | （待補） | 備料／提早做事 | 與關卡對齊 |
| `notify_on_completed` | 整張簽核完成 | `fyi` + `fyi_system` | （待補） | 可往下做事 | |
| `notify_need_approve` | 輪到某關 | 該關 `approvers[n]` | （待補） | 請簽核 | （待補是否要做） |

### 7.1 通知範本（待補）

#### （通知名稱）

```
主旨：
內文：
```

---

## 8. 操作紀錄（Log）

> 與現行方向對齊：按按鈕時記錄時間、操作者、開啟時值、儲存後值；diff 紅前綠後。

| 項目 | 規則 |
|------|------|
| 何時寫入 | （待補：哪些動作要寫；至少 save／submit／approve／reject） |
| 必記欄位 | 時間、操作者、動作、opened、saved、changes |
| 呈現 | GitHub 風格：舊值紅刪線在前、新值綠在後 |
| 存放 | document JSON／未來 API（待補細節） |

---

## 9. 資料／JSON 對應

| 規格概念 | JSON／API 欄位 | 說明 |
|----------|----------------|------|
| 填單人 | `preparer` | 人員 |
| 需求人 | `requester` | 人員 |
| 送出副本 | `cc` | 名單物件 |
| 系統送出副本 | `cc_system` | 名單物件，鎖定 |
| 簽核人 | `approvers[]` | 依關卡 |
| 關卡通過通知 | `stage_notifies[]` | 與 approvers 對齊 |
| 結案知會 | `fyi` | 名單物件 |
| 系統結案知會 | `fyi_system` | 名單物件，鎖定 |
| 目前操作者 | `actor` | 執行按鈕的人 |
| 狀態 | `system.status` | 內部 id |
| 狀態顯示字對照 | `status_labels`（待補結構） | Admin 自訂顯示 |
| 動作 | `actions[]` | |
| 紀錄 | `logs[]` | |

---

## 10. 待決問題

- [ ] `stage_notifies`／`approvers` 用陣列還是 `approver_1` 扁平欄位？（建議陣列）
- [ ] `stage_notifies` 填單時可否編輯，或僅表單設計／Admin 可編？
- [ ] reject 之後：退回填單人修改？結案不可再送？可升版 `.2` 再送？
- [ ] 預設顯示要用 Rejected 還是 Denied？（建議預設 Rejected，Admin 可改）
- [ ] preparer 與 requester 是否允許同一人？
- [ ] 送出時若 `cc` 與 `cc_system` 重複，是否去重只寄一封？

---

## 11. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-08-04 | 建立檔案骨架，等待口頭整理 |
| 2026-08-04 | 角色／名單：preparer、requester、cc、cc_system、approvers、stage_notifies、fyi、fyi_system；同意／不同意用語建議 |
