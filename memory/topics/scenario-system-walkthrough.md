---
date: 2026-08-06
time: 17:45 (UTC)
tags: [產品, 系統理解, 資料血緣, 情境, 角色, 上手, JSON]
status: active
---

# 情境式系統理解（角色 × 情境 × 欄位逐步高亮）

## 一句話

用「我是誰、我要做什麼」走完系統，讓表／欄位／聯動在步驟中自己亮起來——比靜態 ER 圖更快上手，也更容易找出多餘欄位與風險。

## 核心概念（使用者原構想）

1. **資料視圖**：有哪些表、欄位、來源、lookup／同步關係（例：離職單的人事 API → 人員主檔 → 離職單主檔）。
2. **角色切換**：員工／主管／HR（可擴充）。
3. **情境選擇**：例如「想離職了」「育嬰留停需填離職單」。
4. **操作步驟**：每一步標出會動到的欄位（寫入／自動帶出／參照），對應欄位變醒目色。

目標：透過**所有情境**快速熟悉系統邏輯、關聯、優缺點與風險；可在任何平台實作（資料與畫面分離）。

## 評價

方向正確，而且比「只畫資料血緣」多一層**可驗證的行為模型**。靜態圖回答「有什麼」；角色＋情境＋步驟回答「為什麼存在、誰在何時動它」。後者才是接手陌生系統時最缺的。

## 建議強化（比原構想更好落地）

### 1. 三層分離，勿混用語

| 層 | 選什麼 | 例子 |
|---|---|---|
| 角色 Role | 我是誰 | 員工 |
| 情境 Scenario | 我要完成什麼事 | 自願離職申請 |
| 步驟 Step | 系統／人做了什麼 | 填姓名 → lookup 帶部門 |

「員工」是角色，不是情境。UI 上兩個下拉分開，步驟才不會亂。

### 2. 步驟要標「動作類型」，不只高亮

建議每步固定一種（或少數）動作，顏色／圖例一致：

| 動作 | 意義 | 例子 |
|---|---|---|
| write | 人手填／改 | 離職單.姓名 |
| lookup | 依鍵參照帶出 | 人員主檔.部門 → 離職單.部門 |
| sync | 外部同步寫入 | api.pyc → 人員主檔 |
| auto | 系統自動產生 | 離職單.ID（AUTO） |
| validate | 檢核／阻擋 | 在職才可開單 |
| approve | 簽核決定 | 主管同意 |
| notify | 通知 | 寄信給 HR |

同一畫面用圖例，一眼分得出「人填」與「系統帶」。

### 3. 跨角色接龍（完整生命周期）

單一「員工填單」不夠。建議情境可串：

`員工申請 → 主管簽核 → HR 結案`

同一張資料血緣圖上，不同角色步驟高亮不同子集；才看得到權限、欄位在關卡間是否重複、是否該鎖死。

### 4. 跑完所有情境後，輸出「欄位覆蓋熱圖」

這是找出多餘／舊欄位的關鍵：

- 從未被任何步驟 touch 的欄位 → **候選死欄位／舊欄位**
- 只被一個極冷情境用到 → **保留但標註稀有**
- 多情境 write 同一欄且無單一真相來源 → **風險：重複輸入／不一致**

靜態血緣圖辦不到；要靠情境覆蓋率。

### 5. 風險註記掛在步驟或邊上

每步／每條邊可選填風險標籤，例如：

- 主檔不同步（API 延遲）
- 姓名當 lookup 鍵（應用人員 ID）
- 部門冗餘存放（可算即時帶出卻落庫）
- 無權限卻可見

上手同時等於做一輪輕量審計。

### 6. 平台無關：先定一份 JSON，再決定畫面

任何平台（靜態網頁、SEED Pages、ALR5 學習模式、內部工具）都只消費同一份模型：

```json
{
  "system": "離職單",
  "entities": [
    {
      "id": "hr_api",
      "label": "人事 API",
      "kind": "api"
    },
    {
      "id": "personnel",
      "label": "人員主檔",
      "fields": [
        { "id": "id", "label": "ID" },
        { "id": "dept", "label": "部門" }
      ]
    },
    {
      "id": "resignation",
      "label": "離職單主檔",
      "fields": [
        { "id": "id", "label": "ID", "auto": true },
        { "id": "name", "label": "姓名" },
        { "id": "dept", "label": "部門" }
      ]
    }
  ],
  "edges": [
    {
      "from": "hr_api",
      "to": "personnel",
      "kind": "sync",
      "label": "api.pyc"
    },
    {
      "from": "personnel.id",
      "to": "resignation.name",
      "kind": "lookup",
      "label": "lookup (人員主檔.ID)"
    },
    {
      "from": "personnel.dept",
      "to": "resignation.dept",
      "kind": "lookup",
      "label": "lookup (人員主檔.部門)"
    }
  ],
  "roles": ["employee", "manager", "hr"],
  "scenarios": [
    {
      "id": "voluntary-resign",
      "title": "想離職了",
      "role": "employee",
      "next": "manager-approve",
      "steps": [
        {
          "n": 1,
          "action": "write",
          "fields": ["resignation.name"],
          "note": "填寫離職單主檔的姓名"
        },
        {
          "n": 2,
          "action": "lookup",
          "fields": ["personnel.dept", "resignation.dept"],
          "edge": "personnel.dept→resignation.dept",
          "note": "依姓名／人員鍵自動帶出部門"
        }
      ]
    }
  ]
}
```

畫面只負責：選角色／情境 → 播步驟 → 高亮 `fields`／`edges`。換平台不必重寫知識。

### 7. 建議最小可行產品（MVP）

先做**一個系統（離職單）+ 靜態 JSON + 單頁播放器**，驗證：

1. 角色／情境／步驟三選單
2. 逐步高亮＋動作圖例
3. 覆蓋熱圖（死欄位清單）
4. （可選）風險標籤

確認好用後，再接到 ALR5／SEED：ALR5 已有角色、欄位、流程圖，此模式可當「學習／審計視圖」，不必另起一套產品。

### 8. 與既有方向的關係

- 資料血緣圖：底圖（entities + edges）
- ALR5 自由流程說明圖（人／欄位／箭頭）：可共用視覺語言
- 「學新系統」場景模板：筆記可連結到某個 scenario 的覆蓋結果

## 示範系統（離職單）— 資料視圖摘要

來源圖：`資料血緣：離職單`

- **人事 API** →（sync `api.pyc`）→ **人員主檔**（ID、部門）
- **人員主檔.ID** →（lookup）→ **離職單主檔.姓名**
- **人員主檔.部門** →（lookup）→ **離職單主檔.部門**
- **離職單主檔.ID**：AUTO

（原圖二進位未附在此環境；以文字記憶為準。若之後補圖，放 `assets/2026-08-06-resignation-lineage.png`。）

## 決定／偏好（本場）

- 認同此方向；優先強化「動作類型＋覆蓋熱圖＋跨角色接龍＋JSON 可攜」
- 用語嚴格分開：角色 ≠ 情境 ≠ 步驟
- 跨平台靠資料模型，不靠特定 UI 框架
- **2026-08-06 追加：** 呈現改地圖儀表板（手機可拖可縮）；執行期 JSON；契約用 Schema + SKILL.md（先不要發明新語法）

## 待續

- [x] 離職單 MVP 單頁（`docs/walkthrough/`）
- [x] 地圖式拖拉／縮放儀表板
- [x] schema.json + SKILL.md（AI 產 JSON）
- [ ] 多系統切換（系統目錄）
- [ ] 版面匯出／匯入 layout
- [ ] 是否把此模型併入 ALR5「學習模式」
- [ ] 補上原資料血緣圖檔到 assets
- [ ] AI 依 skill 產第二個示範系統驗證契約

## MVP 實作（2026-08-06）

- 路徑：`docs/walkthrough/`（`index.html` / `app.js` / `styles.css` / `system.json`）
- 功能：角色／情境下拉、步驟清單、欄位與邊高亮、動作圖例、跨情境接龍、覆蓋熱圖（候選死欄位）
- 示範死欄位：`人員主檔.舊識別證號`、`離職單主檔.傳真備註`

## 地圖儀表板＋語言契約（同日追加）

- 手機：地圖全螢幕＋底部可收合導覽面板；桌面：右欄面板
- 單指拖地圖、雙指／滾輪縮放、拖卡片標題列重排；版面存 localStorage
- [`schema.json`](../../docs/walkthrough/schema.json)＝文法；[`SKILL.md`](../../docs/walkthrough/SKILL.md)＝AI 寫作規範；`system.json`＝執行期
- 單檔預覽：`docs/walkthrough/standalone.html`

## 總願景連結（2026-08-06 睡前）

互動地圖只是工具之一。完整目標見 [system-consultant-vision.md](./system-consultant-vision.md)：靜態簡報全覽、操作演示／影片（阿嬤路徑）、多來源統一成 JSON、進階顧問（漏情境／風險）。

## 導引＝漸進拼圖記憶（2026-08-08）

- 偏好：像四合院 Shorts——**一塊一塊長出來**，名稱／用途綁在空間區塊上；先問再長出，答對才長。
- 用途：上手一堆**陌生名稱、用途、需求**（降低認知負荷）。
- `guide.json` 用 `style: "build-qa"`：`build.zones` + 每關 `reveal.pieces`；答對才累積到舞台。
- 參考：Google Photos `ARjDdXCuyPNYhSiP8`（錄 YouTube 四合院）；場次見 [2026-08-08-build-puzzle-learn.md](../sessions/2026-08-08-build-puzzle-learn.md)。
