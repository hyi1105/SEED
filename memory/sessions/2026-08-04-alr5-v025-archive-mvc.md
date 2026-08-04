---
date: 2026-08-04
time: 18:14 (UTC)
tags: [SEED, Approval, ALR5, 定案, MVC, Archive]
status: active
---

# ALR5 v0.2.5：Archive 旗標＋MVC 互通語意

## 摘要

定案 Archive 與 status 無關（`system.archived` 軟刪除；admin unarchive 復原）；並確認互通採 MVC：M＝JSON、C＝功能符合、V＝自訂畫面。

## 重點

- 不用 `status=archived`；原 status／level 不變
- 復原＝admin 取消 archive／搬回
- form 級封存仍會 Cancel 進行中 items（與 item 軟刪除不同）
- MVC：互通看 M＋C；V 不綁死

## 待續

目前 open_questions 已清空。
