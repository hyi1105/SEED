# Skill：產出統一系統 JSON（畫面與資料分開）

把任意系統編成**一份人看得懂的 JSON**，丟進 SEED 播放器（`docs/walkthrough/index.html`）即可：

1. **Show**：底下 LINE 式對話＋上一步／下一步；上方隨劇情切換**獨立表單**  
2. **表單**：多種同級表單、多張單據、用連結組圖  
3. **總表**：一眼看各單據狀態是否完成、連出／連入  
4. **設定**：事後改「誰必填／誰可看／誰可編」，再匯出 JSON  

播放器**不內建業務邏輯**；只讀 JSON。

## 產出什麼

只產出一個 JSON（建議 `vn/<id>.json`）。

| 範例 | 說明 |
|---|---|
| [`vn/material-graph.json`](./vn/material-graph.json) | **多表單圖**：A 料號→B 需求→C 底料→D 採購 |
| [`vn/abfon.json`](./vn/abfon.json) | 單表單內分區示範（較舊；新系統請用 forms[]） |
| [`vn/leave.json`](./vn/leave.json) | 單表單流程 |

### 三層分開（務必遵守）

| 區塊 | 給誰看 | 內容 |
|---|---|---|
| `meta` + `roles` + `forms` + `linkRules` + `actions` + `tables` | **人**（也給系統執行） | 多種獨立表單、連結規則、ACL、動作 |
| `show` | **教學腳本** | cast、nodes（可切 `form`／`doc`、建立 `links`、`showBoard`） |
| `demo` | **範例用** | `values`（打字用）、`docs`＋`links`（圖的種子） |

### 關鍵觀念：A／B 是同級獨立表單

- **不要**把 B 做成 A 表單裡的 section。  
- 用 `forms[]`：每個元素一種表單（可標 `level`: A／B／C／D）。  
- 用 `demo.links` / 節點 `links`：`from` 單據 id → `to` 單據 id（支援 1:n、n:n）。  
- 狀態住在**各單據自己的** `statusField`；總表依 `doneWhen` 打勾。

## forms[]

```json
{
  "id": "material",
  "label": "料號主檔",
  "level": "A",
  "title": "A · 料號主檔",
  "titleField": "sku",
  "statusField": "status",
  "doneWhen": ["已就緒", "已完成"],
  "sections": [{ "id": "main", "label": "…", "fields": [/* 含 acl */] }]
}
```

相容：若只給舊的單一 `form`，播放器會自動包成 `forms[0]`。

## linkRules（給人看的規則說明）

```json
{
  "from": "material",
  "to": "need",
  "cardinality": "1:n",
  "label": "料號 A 可掛多個需求 B"
}
```

實際連結存在 `demo.links`／執行期單據圖，不是寫死在欄位裡。

## form.fields[].acl

```json
"acl": {
  "requiredFrom": ["planner"],
  "read": ["planner", "warehouse", "buyer"],
  "write": ["planner"]
}
```

## show.nodes 常用欄位

| 欄位 | 用途 |
|---|---|
| `speaker` / `line` | 對話 |
| `form` / `doc` | 切到哪個獨立表單／哪張單據 |
| `ensureDoc` / `ensureDocs` | 建立或更新單據（含 `values`） |
| `link` / `links` | 建立 from→to（可多條） |
| `showSchema` | 開場顯示「表單種類」虛擬關係圖（forms＋linkRules；不露空白欄位） |
| `schemaHighlight` | 高亮的 level／form id（配合 `showSchema`） |
| `schemaRules` | 高亮的 linkRules id（如 `material->need`） |
| `showBoard` | 改顯示關聯總表（已有單據實例後） |
| `boardHighlight` | 總表高亮哪些單據 id |
| `focus` / `reveal` / `fillFromDemo` / `typewriter` | 同前 |
| `next` / `choices` / `cta` | 推進；cta 可 `open-board` |

## actions

可加 `"form": "need"`，只在該獨立表單作用。

## 禁止

- 把多種業務塞進同一張 form 的 section 假裝 A／B  
- 把示範姓名寫進 fields 預設值（放 `demo`）  
- 做成答題過關、沒有上一步／下一步  

## 提示詞範本

```text
請依 docs/walkthrough/SKILL.md 與 vn/material-graph.json，
為「○○系統」產出一份 JSON。
必須用 forms[] 做同級獨立表單；用 links 做 A→多B→多C 圖；
demo.docs / demo.links 放種子；show 開場若有多張 forms，先 showSchema 畫關係，再進欄位；其後用 form/doc/links/showBoard。
只輸出 JSON。
```

## 驗收

- [ ] 播放器可匯入；頂部可切系統  
- [ ] 多表單 Show：**先**表單關係圖、**再**空白欄位（不要一開場就空 AA）  
- [ ] Show 有上一步／下一步；會切換不同獨立表單  
- [ ] 總表看得到狀態與連結  
- [ ] 表單可新建單據並「連到…」  
- [ ] 設定頁可改各表單 ACL 並匯出  
