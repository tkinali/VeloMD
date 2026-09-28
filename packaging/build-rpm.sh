#!/usr/bin/env bash
# VeloMD RPM derleme (Fedora/openSUSE hedefli, noarch)
# Kullanım: ./packaging/build-rpm.sh [sürüm]   (varsayılan: VERSION dosyası)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="${1:-$(cat "$ROOT/VERSION" | tr -d '[:space:]')}"
OUT_DIR="$ROOT/dist"
TOPDIR="$ROOT/dist/_rpm"

rm -rf "$TOPDIR"
mkdir -p "$TOPDIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS} "$OUT_DIR"

# kaynak tarı: velomd-<ver>/...
tar -czf "$TOPDIR/SOURCES/velomd-${VER}.tar.gz" \
    --transform "s,^,velomd-${VER}/," \
    -C "$ROOT" main.py app logo.png VERSION packaging/rpm/velomd.desktop

cp "$ROOT/packaging/rpm/velomd.spec" "$TOPDIR/SPECS/"

rpmbuild -bb \
    --define "_topdir $TOPDIR" \
    --define "VERSION $VER" \
    --define "dist .fc" \
    "$TOPDIR/SPECS/velomd.spec"

find "$TOPDIR/RPMS" -name "*.rpm" -exec cp {} "$OUT_DIR/" \;
rm -rf "$TOPDIR"
echo "→ $(ls "$OUT_DIR" | grep -E "velomd.*\.rpm")"
echo "Kurulum: sudo dnf install dist/velomd-${VER}*.rpm"
