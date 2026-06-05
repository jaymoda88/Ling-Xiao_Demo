#!/bin/bash
# 凌霄錄 — build script (Tweego + SugarCube 2.37.3, same engine as Degrees of Lewdity)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
export TWEEGO_PATH="$ROOT/tools/storyformats"
OUT="$ROOT/凌霄錄/build/凌霄錄.html"
# 清除 macOS AppleDouble 垃圾檔（.twee 副檔名會被 Tweego 誤讀）
find "$ROOT/凌霄錄/src" -name '._*' -delete 2>/dev/null || true
"$ROOT/tools/tweego" -o "$OUT" "$ROOT/凌霄錄/src/"
# 音訊素材：若 凌霄錄/audio/ 有檔，複製到 build/audio/（與 HTML 同層，供 setup.audio 載入）
if [ -d "$ROOT/凌霄錄/audio" ]; then
	mkdir -p "$ROOT/凌霄錄/build/audio"
	cp -f "$ROOT/凌霄錄/audio/"*.mp3 "$ROOT/凌霄錄/audio/"*.ogg "$ROOT/凌霄錄/build/audio/" 2>/dev/null || true
fi
# 圖片素材：若 凌霄錄/img/ 有檔，複製到 build/img/（與 HTML 同層，供立繪/敵圖載入）
if [ -d "$ROOT/凌霄錄/img" ]; then
	mkdir -p "$ROOT/凌霄錄/build/img"
	cp -f "$ROOT/凌霄錄/img/"*.png "$ROOT/凌霄錄/img/"*.jpg "$ROOT/凌霄錄/img/"*.jpeg "$ROOT/凌霄錄/img/"*.webp "$ROOT/凌霄錄/build/img/" 2>/dev/null || true
fi
echo "✓ built -> $OUT"
