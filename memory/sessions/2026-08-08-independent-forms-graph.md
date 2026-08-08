---
date: 2026-08-08
time: 10:40 (UTC)
tags: [產品, walkthrough, 獨立表單, 關聯圖, 料號, 總表, 偏好]
status: active
---

# 同級獨立表單＋圖狀關聯（A→多 B→多 C）

## 摘要

使用者澄清：A／B **不是一張表裡的兩個區**，而是**同級的兩張獨立表單**。要能 A 連多個 B、B 連多個 C（圖）。範例：料號 A → 需求 B（生產／定價／備料）→ 底料 C（瓶子、新板）→ 採購 D；並用**總表**看各狀態是否完成。

## 重點

| 觀念 | 定案 |
|---|---|
| 表單 | `forms[]` 多種獨立表單（level A／B／C／D） |
| 關聯 | `links`：from／to 單據 id，1:n／n:n |
| 狀態 | 各單據自己的 status；總表依 `doneWhen` 打勾 |
| 反例 | 不要再把 AFON＋BFON 塞同一張 form 的 sections（那只是過渡示範） |

## 實作

- 播放器：`docs/walkthrough/player.js`（forms／docs／links／board 模式）
- 範例：`docs/walkthrough/vn/material-graph.json`
- 契約：`docs/walkthrough/SKILL.md`

## 待續

- [ ] 總表視覺再偏「節點圖」而非僅表格
- [ ] 連結規則強制校驗（目前規則偏說明）
- [ ] 把 AFON／BFON 改寫成兩張獨立 forms + links
