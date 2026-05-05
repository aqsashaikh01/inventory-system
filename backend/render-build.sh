#!/usr/bin/env bash
set -e

npm install

mkdir -p /usr/share/fonts/noto
cp assets/NotoSansDevanagari-SemiBold.ttf /usr/share/fonts/noto/
fc-cache -f -v
echo "✓ Fonts installed"