---
date: 2026-08-05
time: 00:35 (UTC)
tags: [SEED, Approval, ALR5, 簽核階層, stage_notify, mail, UI]
status: active
---

# 簽核階層：level 置左、預設 Approver、可改、notify、mail

## 摘要

簽核階層改名精簡；level 最左給人看；step_id／role 預設隱藏；Display name／預設 Approver；申請人可否改（editable）；每關 stage_notify；表單級通知信範本（§7）。

## 重點

- 表頭：`level`／`Display name`／`default Approver`／`editable`／`stage_notify`
- `editable`＝申請人／建立者可 Change 未簽核人；否＝僅 admin
- `stage_notify`＝關卡通過通知名單（people／emails／@groups）
- `mail_templates[]`：Submit／請簽／通過／拒件／退回／取消／結案／手動／逾期

## 決定／偏好

- step_id 給系統，可勾選才顯示
