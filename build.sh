#!/bin/bash
# 凌霄錄 — build script (Tweego + SugarCube 2.37.3, same engine as Degrees of Lewdity)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
export TWEEGO_PATH="$ROOT/tools/storyformats"
OUT="$ROOT/凌霄錄/build/凌霄錄.html"
# 清除 macOS AppleDouble 垃圾檔（.twee 副檔名會被 Tweego 誤讀）
find "$ROOT/凌霄錄/src" -name '._*' -delete 2>/dev/null || true
"$ROOT/tools/tweego" -o "$OUT" "$ROOT/凌霄錄/src/"
echo "✓ built -> $OUT"
