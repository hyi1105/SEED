# ALR5 標準互通規格（可貼給 AI）

> **機器可讀原文：** `docs/approval/alr5-standard.json`（**0.2.9**）  
> **人讀總規：** `approval/ALR5簽核系統.md`

## 給 AI 的開場

依 **ALR5/0.2.9** 實作。`decisions` 不得違反。可轉移 JSON **不得含私鑰**；加密用 envelope；公證用 `notary_records`。缺欄依 `json_completeness` 補齊。

## 平台願景（含期許）

- 所有系統交付進 ALR5 → 處理 → 可轉移 JSON  
- **跨公司公證**（類律師／法院）：對 content_hash＋時間背書  
- **加密**：手上鑰匙或第三方備份鑰匙才能解密  

## JSON 適合加密／公證嗎？

| 適合用 JSON | 不要放進可轉移 JSON |
|-------------|---------------------|
| 結構、流程、關聯、設定 | 私鑰、對稱金鑰明文 |
| 公證紀錄、加密**信封**中繼 | 未加密機密附件本體 |
| 密文引用（blob id） | 復原種子 |

模式：**JSON envelope + 密文 blob + 外部金鑰保管**。

## 能力地圖（已融入）

簽核狀態／level｜AB｜export／import｜跨單 links｜開單模式｜Archive｜Copy｜自動補齊｜**notary**｜**crypto envelope**｜全系統平台

## 仍待決（高優先與期許相關）

公證節點誰當｜備份鑰匙解鎖條件｜哪些欄位強制加密｜明細分片｜跨單 UI…

## 版本

**0.2.9**｜2026-08-04
