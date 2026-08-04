#!/usr/bin/env bash
# 本機開啟簽核畫面（不依賴 GitHub Pages）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8765}"
cd "$ROOT/docs"
echo "Approval 本機預覽：http://127.0.0.1:${PORT}/"
echo "按 Ctrl+C 結束"
exec python3 -m http.server "$PORT"
