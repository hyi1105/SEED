# Skill：產出統一系統包（邊講邊填 + 真實表單）

你要把一個「陌生／任意系統」編成**同一份 JSON**，讓 SEED 播放器（`docs/walkthrough/index.html`）能：

1. **Show**：邊講邊填——台詞描述「為什麼需要這一欄」，再打字填入  
2. **表單**：同一欄位定義變成可切角色、真的送出／簽核的表單  

不要再產「導引／簡報／演示」舊模式資料。

## 你要產出什麼

只產出**一個 JSON 物件**（寫成 `vn/<id>.json`），結構對齊 [`vn/leave.json`](./vn/leave.json)。

並可把系統加進 [`catalog.json`](./catalog.json)。

## 核心結構

| 區塊 | 用途 |
|---|---|
| `roles` | 申請人／主管／HR…（表單切換用） |
| `form.sections[].fields` | 真實欄位：`type`／`write`／`meaning` |
| `actions` | 送出、同意、退回、拒絕…（`whenStatus` + `set`） |
| `cast` + `nodes` | Show 腳本：`line`／`fill`／`typewriter`／`choices` |
| `tables` | 結局：幾張表、每欄起源 |

## 欄位寫作標準

每一欄必須能回答：

- **為什麼需要**（`meaning`，也會出現在 Show 台詞）
- **誰能寫**（`write: ["applicant"]` 等）
- **型別**（`text`／`tel`／`date`／`select`／`textarea`）

Show 的每一步最好只講**一欄**（或一小撮），先描述再 `fill` + `typewriter: true`。

## 禁止

- 一開始攤開完整 ER／選單  
- 做成答題過關  
- 長篇一次講完  
- 只產標籤拼圖、沒有可填的 `form`／`actions`

## 給使用者的提示詞範本

```text
請依 docs/walkthrough/SKILL.md 與 vn/leave.json 的結構，
為「○○系統」產出一份 vn/<id>.json。
要有：roles、form（含 meaning／write）、actions（狀態機）、
以及邊講邊填的 nodes（每欄先描述再填）。
結局 CTA 指向 open-form。
只輸出 JSON。
```

## 驗收

- [ ] Show 能點下一步邊講邊填  
- [ ] 表單模式能切角色、送出、改狀態  
- [ ] 清空／重來可用  
- [ ] `tables` 能對回每一欄的起源  
