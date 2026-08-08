#!/usr/bin/env python3
"""Assemble index.html from player.css + player.js + vn/*.json (for htmlpreview)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT = "material-graph"
ORDER = ["material-graph", "abfon", "leave"]


def main() -> None:
    css = (ROOT / "player.css").read_text(encoding="utf-8")
    js = (ROOT / "player.js").read_text(encoding="utf-8")
    library = {}
    for name in ORDER:
        path = ROOT / "vn" / f"{name}.json"
        if path.exists():
            library[name] = json.loads(path.read_text(encoding="utf-8"))
    if DEFAULT not in library:
        raise SystemExit(f"missing default pack {DEFAULT}")
    default_pack = library[DEFAULT]
    lib_json = json.dumps(library, ensure_ascii=False, indent=2)
    data_json = json.dumps(default_pack, ensure_ascii=False, indent=2)

    html = f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
  <title>統一表單系統 — SEED</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Noto+Sans+TC:wght@400;500;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap" rel="stylesheet" />
  <style>
{css}
  </style>
</head>
<body>
  <div class="app" id="app" data-mode="show">
    <header class="top">
      <a class="seed" href="../index.html">SEED</a>
      <div class="brand">
        <p class="eyebrow" id="eyebrow">Show · LINE 對話</p>
        <h1 id="title">系統</h1>
      </div>
      <label class="pack-pick" title="切換內建系統包">
        <span class="pack-pick-label">系統</span>
        <select id="pack-select" aria-label="選擇系統包"></select>
      </label>
      <div class="mode-tabs" role="tablist" aria-label="模式">
        <button type="button" class="mode-tab active" data-mode="show">Show</button>
        <button type="button" class="mode-tab" data-mode="form">表單</button>
        <button type="button" class="mode-tab" data-mode="board">總表</button>
        <button type="button" class="mode-tab" data-mode="settings">設定</button>
        <a class="mode-tab" href="./map.html">地圖</a>
      </div>
      <label class="ghost-btn import-row" style="border-radius:999px;padding:0.3rem 0.75rem;cursor:pointer">
        匯入 JSON
        <input type="file" id="file-import" accept="application/json,.json" hidden />
      </label>
      <button type="button" class="ghost-btn" id="btn-export-top" style="border-radius:999px;padding:0.3rem 0.75rem">匯出</button>
      <button type="button" class="ghost-btn" id="btn-restart" style="border-radius:999px;padding:0.3rem 0.75rem">重來</button>
    </header>

    <div class="stage-wrap" id="stage-wrap">
      <div class="form-toolbar" id="form-toolbar">
        <div class="mode-tabs" id="role-tabs" aria-label="角色"></div>
        <span class="progress">資料／設定存在此瀏覽器；可匯出 JSON 帶走</span>
      </div>
      <div id="form-type-tabs" class="mode-tabs" aria-label="獨立表單種類" hidden></div>
      <div id="doc-list" hidden></div>
      <section class="story-stage" id="story-stage" hidden aria-label="導引流程圖">
        <div class="story-legend" id="story-legend" aria-label="導引圖圖例">
          <span class="leg"><i class="sym-start"></i>開始／結束</span>
          <span class="leg"><i class="sym-process"></i>處理（做一件事）</span>
          <span class="leg"><i class="sym-io"></i>輸入／填寫</span>
          <span class="leg"><i class="sym-decision"></i>判斷／分支</span>
          <span class="leg"><i class="sym-arrow"></i>流程方向</span>
        </div>
        <p class="story-kicker" id="story-kicker">導引圖 · 上＝表單 · 左＝人 · 圖形＝動作種類 · 箭頭＝下一步</p>
        <div class="story-board" id="story-board">
          <div class="story-canvas" id="story-canvas">
            <div class="story-lanes story-matrix" id="story-lanes"></div>
            <svg class="story-flow-svg" id="story-flow-svg" aria-hidden="true"></svg>
          </div>
        </div>
      </section>
      <div class="stage-fit" id="stage-fit">
        <article class="form-sheet" id="form-sheet">
          <h2 class="form-title" id="form-title">表單</h2>
          <p class="form-sub" id="form-sub">空白開始 · 一欄一欄填進去</p>
          <div class="status-wrap"><span class="status-pill" id="status-pill">草稿</span></div>
          <div id="sections"></div>
          <div class="submit-row" id="submit-row">
            <button type="button" class="submit-btn" id="submit-btn">送出</button>
          </div>
          <div class="action-row" id="action-row"></div>
        </article>
      </div>
      <aside class="summary" id="summary"></aside>
      <p class="form-note">JSON：forms[] 同級獨立表單 · links 圖狀關聯 · show 腳本 · demo 單據／範例。畫面只是播放器。</p>
    </div>

    <section class="chat" id="chat" aria-label="對話">
      <div class="chat-log" id="chat-log"></div>
      <div class="chat-bar" id="chat-bar">
        <div id="chat-extra"></div>
        <div class="chat-nav">
          <button type="button" class="nav-btn" id="btn-prev">〈 上一步</button>
          <button type="button" class="nav-btn primary" id="btn-next">下一步 〉</button>
        </div>
      </div>
    </section>
  </div>
  <div class="toast" id="toast" role="status"></div>

  <script type="application/json" id="vn-data" data-default="{DEFAULT}">
{data_json}
  </script>
  <script type="application/json" id="vn-library">
{lib_json}
  </script>
  <script>
{js}
  </script>
</body>
</html>
"""
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    print(f"wrote index.html default={DEFAULT} packs={list(library)}")


if __name__ == "__main__":
    main()
