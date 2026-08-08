---
date: 2026-08-08
updated: 2026-08-08
tags: [整理, repo, token, Skill, 記憶庫, 偏好]
status: active
---

# 帳號 Repo 整理＋減少 Agent 讀多餘 MD

## 帳號現況（2026-08-08）

| Repo | 性質（建議標籤） | 建議 |
|---|---|---|
| [SEED](https://github.com/hyi1105/SEED) | **系統／產品＋知識庫** | 主幹；學習節奏 Skill、播放器、`memory/` |
| [AI_MD](https://github.com/hyi1105/AI_MD) | **學習／知識工具** | 先留獨立；若功能重疊再遷進 SEED 子目錄 |
| [approval](https://github.com/hyi1105/approval) | **系統（簽核）** | 與 SEED 內 `approval/` 可能重疊；合併前先對照，勿一次塞 |
| [down-the-stairs](https://github.com/hyi1105/down-the-stairs) | **娛樂小遊戲** | **不要**併進 SEED；保持獨立 |

## 能不能「一個帳號全部整合」？

- **能當「目錄地圖」整合**：一個主 repo（SEED）當總部，其餘用 README 連過去或 submodule／subtree。
- **不建議立刻物理合併全部程式**：遊戲＋知識工具＋簽核舊碼一次塞，歷史與 CI 會更亂。
- **Skill／規則**：放在「你當下打開的那個專案」；不是 GitHub 帳號自動全域。要全域才放 `~/.cursor/skills/`（電腦本機）。

## Token／速度：真正吃上下文的是什麼

Agent **不會自動讀完你帳號所有 repo**。慢通常來自：

1. 目前工作區裡被掃到的檔（大量 `memory/sessions/*.md`）
2. `alwaysApply` 規則太長
3. Agent 一次開太多 MD

對策（已／應做）：

| 做法 | 作用 |
|---|---|
| `.cursorignore` 忽略舊場次／產物 | 預設索引不掃進去 |
| 回憶只先讀 `memory/index.md` | 按需再開單一 session／topic |
| Skill 保持短；細節放 `references/` | 啟動只載 name＋description |
| 場次定期归档到 `memory/archive/` | 主索引變薄 |

## 建議分兩步（先整理、再合併）

### 第一步（現在）：分類＋瘦身上下文

- 每個 repo README 頂部加一行標籤：`學習`／`系統`／`娛樂`
- SEED：`memory/index.md` 當唯一入口；舊 session 進 archive＋ignore
- 不要為了「一個 repo」先砍掉歷史；先標籤

### 第二步（之後）：有重疊再合併

- `approval` ↔ SEED：確認哪個是真相來源，再遷或 archive 舊 repo
- `AI_MD`：若只是 MD 工具，可變成 SEED 的 `tools/ai-md/` 或保持獨立給學習用
- `down-the-stairs`：永遠分開

## 決定／偏好（本場）

- 先做**基本組織＋降 token**，不一次大融合
- 學習節奏 Skill 留在 SEED；需要跨專案再說
