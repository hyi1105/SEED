# Skill：產出統一系統 JSON（畫面與資料分開）

把任意系統編成**一份人看得懂的 JSON**，丟進 SEED 播放器（`docs/walkthrough/index.html`）即可：

1. **Show**：底下 LINE 式對話＋上一步／下一步；上方表單跟著填  
2. **表單**：依角色 ACL 真的辦單  
3. **設定**：事後改「誰必填／誰可看／誰可編」，再匯出 JSON  

播放器**不內建業務邏輯**；只讀 JSON。

## 產出什麼

只產出一個 JSON（建議 `vn/<id>.json`），結構對齊 [`vn/leave.json`](./vn/leave.json)。

### 三層分開（務必遵守）

| 區塊 | 給誰看 | 內容 |
|---|---|---|
| `meta` + `roles` + `form` + `actions` + `tables` | **人**（也給系統執行） | 欄位、意義、ACL、流程按鈕、表結構說明 |
| `show` | **教學腳本** | cast、nodes（台詞／焦點／選項） |
| `demo` | **範例用** | persona、示範填值（不要把假資料寫進 form） |

Show 節點用 `fillFromDemo: ["name"]` 引用 `demo.values`，不要在腳本裡寫死「林小華」。

## form.fields[].acl

```json
"acl": {
  "requiredFrom": ["applicant"],
  "read": ["applicant", "manager", "hr"],
  "write": ["applicant"]
}
```

- `requiredFrom`：哪些角色送出／動作時此欄必填  
- `read`：哪些角色看得到  
- `write`：哪些角色能編輯  

匯入後可在播放器「設定」頁改，再匯出。

## show.nodes 常用欄位

| 欄位 | 用途 |
|---|---|
| `speaker` / `line` | 對話 |
| `focus` | 高亮哪個欄位（或 `btn_submit`） |
| `reveal` | 解開哪些欄位顯示 |
| `fillFromDemo` | 從 `demo.values` 取值填入 |
| `mapFill` | demo key → 真實 field id（可選） |
| `typewriter` | 打字填入 |
| `next` / `choices` | 下一步或分歧 |
| `cta` | 結局按鈕：`open-form` / `open-settings` / `restart` |

## 禁止

- 把示範姓名／電話寫進 `form`（應放 `demo.values`）  
- 一開始攤開完整 ER  
- 做成答題過關、沒有上一步／下一步  
- 混用舊的「導引／簡報／演示」模式資料  

## 提示詞範本

```text
請依 docs/walkthrough/SKILL.md 與 vn/leave.json，
為「○○系統」產出一份 JSON。
必須分開：form+acl+actions（人讀設定）、show（教學腳本）、demo（範例值）。
Show 用 fillFromDemo，不要把假資料寫進 nodes。
只輸出 JSON。
```

## 驗收

- [ ] 播放器可匯入此 JSON  
- [ ] Show 有上一步／下一步與對話泡泡  
- [ ] 表單依 acl 顯示／鎖定  
- [ ] 設定頁可改必填／可看／可編並匯出  
