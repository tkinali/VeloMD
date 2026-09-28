#!/usr/bin/env bash
# VeloMD AppImage derleme.
# Python + arayüz paketin içinde; GTK/WebKit sistemden beklenir
# (çalışma anı bağımlılığı: python3-gobject, WebKit2GTK, fontconfig).
# Kullanım: ./packaging/build-appimage.sh [sürüm]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${1:-$(cat "$ROOT/VERSION" | tr -d '[:space:]')}"
OUT_DIR="$ROOT/dist"
APPDIR="$OUT_DIR/_appimage/VeloMD.AppDir"

rm -rf "$OUT_DIR/_appimage"
mkdir -p "$APPDIR/usr/share/velomd" "$APPDIR/usr/bin" "$OUT_DIR"

cp -r "$ROOT/main.py" "$ROOT/app" "$ROOT/logo.png" "$ROOT/VERSION" "$APPDIR/usr/share/velomd/"
cp "$ROOT/packaging/rpm/velomd.desktop" "$APPDIR/velomd.desktop"
sed -i 's/^Icon=.*/Icon=velomd/' "$APPDIR/velomd.desktop"
cp "$ROOT/logo.png" "$APPDIR/velomd.png"
cp "$ROOT/logo.png" "$APPDIR/.DirIcon"

cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
# VeloMD AppImage başlatıcı — Python ve GTK/WebKit sistemden gelir.
HERE="$(dirname "$(readlink -f "$0")")"
exec python3 "$HERE/usr/share/velomd/main.py" "$@"
EOF
chmod 755 "$APPDIR/AppRun"

TOOL="$OUT_DIR/_appimage/appimagetool"
curl -sSL -o "$TOOL" \
    "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
chmod +x "$TOOL"

ARCH=x86_64 "$TOOL" --appimage-extract-and-run \
    "$APPDIR" "$OUT_DIR/VeloMD-${VER}-x86_64.AppImage"

rm -rf "$OUT_DIR/_appimage"
echo "→ dist/VeloMD-${VER}-x86_64.AppImage"
echo "Not: AppImage, GTK/WebKit'i sistemden kullanır; eksikse dağıtımının "
echo "    PyGObject + WebKit2GTK paketlerini kurman gerekir."
