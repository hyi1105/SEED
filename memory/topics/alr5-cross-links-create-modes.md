# ALR5：跨單關聯與開單模式

> 對應 standard **0.2.7** 的 `cross_links`／`create_modes`。

## 跨單／跨系統怎麼串（建議）

本質是**可設定的前置條件＋關聯＋完成效果**，語感像「認證鏈」，不是登入認證。

| 元件 | 用途 |
|------|------|
| `prerequisites[]` | 建立／Submit／某 level 前：他單須達某 status／level／欄位 |
| `links[]` | 本單引用的他單（form_id、doc_no、item_id） |
| `effects_on[]` | 本單完成時回寫他單欄位（必留 log） |

### 儀器校正（建議較好的方式）

| 單 | 角色 |
|----|------|
| **A** | 儀器**主檔**（長期）：下次校正日、合格旗標 |
| **B** | **事件**（每次校正報告）：Submit 前必須 link 到 A；Completed → 回寫 A 的下次校正日 |
| **C** | 後續申請：查 **A** 是否合格／未過期（也可再要求最近 B completed） |

試玩包（walkthrough，假資料、AFON／BFON 命名）：[`docs/walkthrough/vn/abfon.json`](../../docs/walkthrough/vn/abfon.json) · 場次 [2026-08-08-abfon-bfon-walkthrough](../sessions/2026-08-08-abfon-bfon-walkthrough.md)。

**更新（2026-08-08）：** 使用者要的是**同級獨立表單**＋圖狀連結，不是一張表分區。料號範例：[`vn/material-graph.json`](../../docs/walkthrough/vn/material-graph.json)；場次 [independent-forms-graph](../sessions/2026-08-08-independent-forms-graph.md)。

這樣 C 不必每次追整條鏈；「認證狀態」住在主檔上。

### 純流程鏈

若沒有主檔：只用 prerequisites 串 A→B→C 亦可（適合一次性專案）。

## 兩種新增方式

| 模式 | 說明 |
|------|------|
| **on_demand** | 需要時建立，預設無上限 |
| **preallocated** | 預先建立 item 池（庫位／名額／時段）；行事曆看 **open** 來搶；實物到齊或條件滿足再 Submit |

預建 allocation 狀態建議：`open`｜`held`｜`consumed`｜`released`。

展示區例：區域×工作天 capacity=5 → 每日五個 open slots。

## 仍待決

- 畫面如何選他單、顯示認證鏈
- 多事件回寫同一主檔欄位的衝突規則
- 預建池誰批次產生；held 逾時多久
