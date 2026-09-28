#!/usr/bin/env bash
# VeloMD DEB derleme — docker'daki Debian konteyneri içinde (noarch).
# Kullanım: ./packaging/build-deb.sh [sürüm]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${1:-$(cat "$ROOT/VERSION" | tr -d '[:space:]')}"
DISTRO="${DISTRO:-debian:12}"
OUT_DIR="$ROOT/dist"

rm -rf "$OUT_DIR/_deb"
mkdir -p "$OUT_DIR"

# dosya ağacını hazırla (_ev dizini konteynere bağlanır)
STAGE="$OUT_DIR/_deb/velomd_${VER}_all"
mkdir -p "$STAGE/usr/share/velomd" "$STAGE/usr/bin" \
         "$STAGE/usr/share/icons/hicolor/512x512/apps" \
         "$STAGE/usr/share/applications" "$STAGE/DEBIAN"

cp -r "$ROOT/main.py" "$ROOT/app" "$ROOT/logo.png" "$ROOT/VERSION" "$STAGE/usr/share/velomd/"
cp "$ROOT/packaging/rpm/velomd.desktop" "$STAGE/usr/share/applications/com.velomd.VeloMD.desktop"
cp "$ROOT/logo.png" "$STAGE/usr/share/icons/hicolor/512x512/apps/com.velomd.VeloMD.png"

cat > "$STAGE/usr/bin/velomd" <<'EOF'
#!/bin/sh
exec python3 /usr/share/velomd/main.py "$@"
EOF
chmod 755 "$STAGE/usr/bin/velomd"

sed "s/VERSION_PLACEHOLDER/$VER/" "$ROOT/packaging/deb/control" > "$STAGE/DEBIAN/control"

docker run --rm -v "$OUT_DIR/_deb":/pkg "$DISTRO" \
    dpkg-deb --build --root-owner-group "/pkg/velomd_${VER}_all" \
    "/pkg/velomd_${VER}_all.deb"

mv "$OUT_DIR/_deb/velomd_${VER}_all.deb" "$OUT_DIR/"
rm -rf "$OUT_DIR/_deb"
echo "→ dist/velomd_${VER}_all.deb"
echo "Kurulum: sudo apt install dist/velomd_${VER}_all.deb"
