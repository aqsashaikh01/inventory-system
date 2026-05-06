#!/usr/bin/env bash
set -e

npm install

mkdir -p /tmp/fonts
cp assets/NotoSansDevanagari-SemiBold.ttf /tmp/fonts/

cat > /tmp/fonts/fonts.conf << 'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fonts</dir>
</fontconfig>
EOF

echo "✓ Font setup complete"