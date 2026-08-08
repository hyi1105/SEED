# Skill：產出 System Walkthrough JSON

你要把一個「陌生系統」編成**可播放的導覽資料包**，讓網站播放器（`docs/walkthrough/`）能用地圖式儀表板呈現：表／欄位可拖可縮，角色 × 情境 × 步驟會高亮欄位與連線。

## 你要產出什麼

只產出**一個 JSON 物件**（可寫成 `system.json`），必須符合同目錄的 [`schema.json`](./schema.json)。

不要產出 HTML／CSS／解釋長文（除非使用者明確要求）。先 JSON，必要時再附「死欄位清單」與「風險摘要」各三行以內。

## 核心詞彙（這就是語言）

| 詞 | 意思 | 不是 |
|---|---|---|
| role | 我是誰（員工／主管／HR） | 不是情境 |
| scenario | 我要完成的事 | 不是角色 |
| step | 一步動作：誰動了哪些欄位 | 不是整段流程說明文 |
| entity | 表／API／服務 | 不要塞流程邏輯進 entity |
| edge | 同步／lookup 等關係 | 不要用邊描述 UI 按鈕 |
| action | write／lookup／sync／auto／validate／approve／notify | 一步只選一個主動作 |

## 寫作步驟（照做）

1. **定系統名** `system` + 一句 `subtitle`。
2. **列 roles**（至少 1 個；企業流程通常 ≥2）。
3. **列 entities + fields**  
   - 每個欄位要有人看得懂的 `label`  
   - 疑似舊欄位加 `note`（例如「疑似舊欄位」）  
   - 自動產生加 `"auto": true`
4. **列 edges**（資料怎麼流）：`from`／`to` 用 `entityId` 或 `entityId.fieldId`。
5. **為每個角色寫 ≥1 個 scenario**，步驟要能講完「為什麼有這些欄位」。
6. **跨角色接龍**：用 `next` 串起來（員工 → 主管 → HR）。
7. **覆蓋檢查**：故意保留 1～2 個**從未出現在任何 step.fields** 的欄位，讓熱圖能標「候選死欄位」。
8. **風險**：真正危險的步驟加 `risks[]`（短句）。
9. **layout（建議）**：給每個 entity 預設 `x,y`（地圖座標，單位約像素）。手機橫向可先排一列，直向可排成縱向瀑布。

## 步驟品質標準

每一 step 必須：

- 有明確 `action`
- `fields` 至少 1 個，且都真實存在於 entities
- `note` 用白話講「這一刻發生什麼」
- 若有 lookup／sync，把對應 `edges` id 寫上，播放器才能亮線

禁止：

- 把角色名稱寫進 scenario title 卻忘了設 `role`
- 一步同時塞五種無關動作
- 欄位 id 用中文或空白
- 邊的 from/to 指向不存在的欄位

## 預設 actions 標籤（可原樣複製）

```json
[
  { "id": "write", "label": "人手填寫" },
  { "id": "lookup", "label": "查閱帶出" },
  { "id": "sync", "label": "同步寫入" },
  { "id": "auto", "label": "自動產生" },
  { "id": "validate", "label": "檢核" },
  { "id": "approve", "label": "簽核" },
  { "id": "notify", "label": "通知" }
]
```

## 給使用者的提示詞範本

把下面貼給 AI（可改系統名）：

```text
請依 docs/walkthrough/SKILL.md 與 schema.json，
為「○○系統」產出一份完整 system.json。
角色包含：… 
主要表單／主檔：…
至少 3 個情境，含跨角色接龍與 1～2 個候選死欄位。
每個 step 請附 fill（演示用假資料），並在根層加 demo.values。
只輸出 JSON。
```

## 簡報／演示額外欄位

| 欄位 | 用途 |
|---|---|
| `demo.values` | 全域演示假資料 |
| `demo.persona` | 角色顯示名（作業紙抬頭） |
| `scenario.demoSeed` | 進入此情境前已填好的值（主管／HR） |
| `scenario.demoValues` | 情境覆寫值 |
| `step.fill` | 此步寫入／帶出的值（演示打字用） |

播放器模式讀同一份 JSON：`地圖`／`簡報`／`演示`。  
另有教學模式 `導引`（`guide.json`）：示範「聊需求 → 補欄位 → 問權限 → 成檔 → 打開系統」。  
另有 **Show**（視覺小說）：`show.html` + `vn/leave.json`——空舞台五分區，點下一步長「名稱＋用途」，關鍵選項分歧，結局列出幾張表。  
示範系統：`system.json`（離職）、`systems/collection.json`（催收）、`systems/leave.json`（請假，Show 驗證用）。

## 驗收清單

- [ ] 通過 schema 精神（必填齊、id 格式對、action 枚舉對）
- [ ] 每個 role 至少 1 scenario
- [ ] 有 next 接龍或明確註記無後續
- [ ] 至少 1 個欄位沒被任何 step 碰到（死欄位示範）或明確說明系統很乾淨無死欄位
- [ ] 放到 `docs/walkthrough/system.json` 後，播放器能選角色／情境並高亮
