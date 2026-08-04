---
date: 2026-08-04
time: 13:40 (UTC)
tags: [SEED, Approval, 簽核, 本機, 雙層儲存, 關卡]
status: active
---

# 簽核系統本機化（SEED 接手 Approval）

## 摘要

上游 `hyi1105/Approval` 假畫面已完成，但使用者開不了 GitHub Pages。SEED 接手後改走本機 HTTP，並把 A1–A6 做成可執行 PoC，放在 SEED 倉庫 `approval/`（cursor[bot] 無法 push 上游 Approval）。

## 重點

- 「本機」＝Agent／電腦端 HTTP；**手機要用 SEED Pages** `…/SEED/approval/`
- 開發開啟：`bash approval/scripts/serve.sh` → http://127.0.0.1:8765/
- schema 驅動欄位；簽名流水線／對話綁欄寫入狀態
- 雙層儲存：shared vs personal.{userId}；切成簽核人看不到個人備註格
- 登入身分切換＋可選 Teams 通知 stub
- 總進度約 85%；下一步接真 SharePoint／Entra（需公司憑證）

## 決定／偏好

- 不卡 Pages
- 真系統優先於公開網址
- 可執行碼以 SEED `approval/` 為準

## 圖片

- 資產: assets/2026-08-04-approval-applicant.webp
  - 文字記憶: 申請人王小明視角；紙本請假單含「僅自己可見備註」personal 欄；左側登入切換與本機真系統標籤。
- 資產: assets/2026-08-04-approval-approver.webp
  - 文字記憶: 切成林主管後個人備註格消失（雙層隱私規則成立）。

## 待續

- 接 Graph／SharePoint 共用清單
- Entra／MSAL 真實登入
- Teams 通知改真 Graph 呼叫
