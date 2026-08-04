# ALR5 標準互通規格（可貼給 AI）

> **機器可讀原文：** `docs/approval/alr5-standard.json`（**0.2.7**）  
> **人讀總規：** `approval/ALR5簽核系統.md`

## 給 AI 的開場

你是實作 ALR5 簽核互通的工程 Agent。請嚴格依 standard_version **ALR5/0.2.7** 與 `json_contract`／`interop_checklist`／`decisions`／`form_composition`／`export_profiles`／`json_completeness`／`cross_links`／`create_modes` 實作。`decisions` 已定案不得違反。缺欄／缺功能依 `json_completeness` 自動補齊。

## 互通 MVC

**M**＝可完全轉移 JSON｜**C**＝功能符合 checklist｜**V**＝各端／AI 自訂畫面

## 跨單關聯（建議串法）

| 元件 | 用途 |
|------|------|
| `prerequisites` | B／C 開單或 Submit 前：他單須達 status／level／欄位 |
| `links` | 引用他單 doc_no／item_id |
| `effects_on` | 本單完成 → 回寫他單（如校正日）；必留 log |

**校正建議：** A＝主檔（下次校正日）、B＝事件（每次校正）→ 回寫 A；C 查 A。  
語感像認證鏈，**不是**登入認證。

## 開單兩模式

| 模式 | 說明 |
|------|------|
| `on_demand` | 需要時建立 |
| `preallocated` | 預建名額／庫位；行事曆搶 `open`；條件滿足再往下 |

## 其他已定案（摘要）

AB 表單、export_profiles、自動補齊、Archive 旗標、Denied Copy、ACL item 優先、required_from_level、多 owner、it_admin… → 見 `decisions`。

## 仍待決

跨單 UI／回寫衝突；預建誰產生／held 逾時；明細列級簽核；匯出檔存放。

## 版本

**0.2.7**｜2026-08-04
