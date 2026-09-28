#!/bin/bash
#
# VeloMD — installer / uninstaller
# Works on any Linux distribution.
#
# Usage:
#   ./install.sh              install
#   ./install.sh --uninstall  remove completely
#   ./install.sh --lang=en    force a language (en | tr)
#
# The interface follows your system locale, like the app itself.
#
# Install: system dependencies (if missing), icon, `velomd` command in
# ~/.local/bin and the application menu entry. Uninstall removes every
# trace from your home directory (command, menu entry, icon, settings).
#

set -euo pipefail

APP_NAME="VeloMD"
APP_ID="com.velomd.VeloMD"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/velomd"
ICON_DIR="$HOME/.local/share/icons"
DESKTOP_DIR="$HOME/.local/share/applications"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════
#  LANGUAGE — follows the system locale, falls back to English
# ═══════════════════════════════════════════════════════════════

VM_LANG=""
for arg in "$@"; do
    case "$arg" in
        --lang=*) VM_LANG="${arg#--lang=}" ;;
    esac
done
if [ -z "$VM_LANG" ]; then
    case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in
        tr*|TR*) VM_LANG=tr ;;
        *)       VM_LANG=en ;;
    esac
fi
[ "$VM_LANG" = "tr" ] || VM_LANG=en

declare -A MSG_EN=(
    [checking]="Checking your system..."
    [installing]="Installing..."
    [py_missing]="Python 3 not found."
    [py_hint]="Please install Python 3 first (e.g. sudo dnf install python3)."
    [py_found]="Python %s found"
    [deps_ok]="System dependencies already installed"
    [deps_missing]="System dependencies missing — installing (sudo may ask for your password)"
    [deps_fail]="Could not install the dependencies. Install these packages manually, then run this script again:"
    [deps_list]="PyGObject + GTK4 & WebKit2GTK 6.0 (or GTK3 & WebKit 4.1), fontconfig"
    [no_pkgmgr]="No known package manager found (dnf/apt/pacman/zypper/apk)."
    [icons]="Icons installed"
    [launcher]="Command installed: %s"
    [desktop]="Application menu entry created"
    [path_missing]="'%s' is not in your PATH — the command may not work in a terminal."
    [path_hint]="Add this line to your ~/.bashrc and reopen the terminal:"

    [sum_done]="Installation complete!"
    [sum_start]="Start the application:"
    [sum_cmd]="from a terminal:"
    [sum_menu]="from the application menu"
    [sum_uninstall]="To remove it again:"
    [sum_src_note]="Note: this script installs into your home directory only; the application folder itself stays where it is."

    [un_warn]="VeloMD will be removed completely, including your settings and session."
    [un_confirm]="Do you want to continue?"
    [un_cancel]="Uninstall cancelled."
    [un_running]="Removing..."
    [un_launcher]="Command removed"
    [un_desktop]="Application menu entry removed"
    [un_icons]="Icons removed"
    [un_config]="Settings removed (%s)"
    [un_no_config]="No settings found"
    [un_done]="Removal complete!"

    [help_usage]="Usage:"
    [help_install]="  ./install.sh              install VeloMD"
    [help_uninstall]="  ./install.sh --uninstall  remove VeloMD completely"
    [help_lang]="  ./install.sh --lang=tr    force a language (en | tr)"
    [help_help]="  ./install.sh --help       show this message"
)

declare -A MSG_TR=(
    [checking]="Sistem kontrol ediliyor..."
    [installing]="Kurulum yapılıyor..."
    [py_missing]="Python 3 bulunamadı."
    [py_hint]="Lütfen önce Python 3 kurun (örn. sudo dnf install python3)."
    [py_found]="Python %s bulundu"
    [deps_ok]="Sistem bağımlılıkları zaten kurulu"
    [deps_missing]="Sistem bağımlılıkları eksik — kuruluyor (şifrenizi sorabilir)"
    [deps_fail]="Bağımlılıklar kurulamadı. Şu paketleri elle kurup betiği yeniden çalıştırın:"
    [deps_list]="PyGObject + GTK4 & WebKit2GTK 6.0 (veya GTK3 & WebKit 4.1), fontconfig"
    [no_pkgmgr]="Bilinen bir paket yöneticisi bulunamadı (dnf/apt/pacman/zypper/apk)."
    [icons]="İkonlar kuruldu"
    [launcher]="Komut kuruldu: %s"
    [desktop]="Uygulama menüsü girdisi oluşturuldu"
    [path_missing]="'%s' PATH içinde değil — komut terminalde çalışmayabilir."
    [path_hint]="Şu satırı ~/.bashrc dosyanıza ekleyip terminali yeniden açın:"

    [sum_done]="Kurulum tamamlandı!"
    [sum_start]="Uygulamayı başlatmak için:"
    [sum_cmd]="terminalden:"
    [sum_menu]="uygulama menüsünden"
    [sum_uninstall]="Kaldırmak için:"
    [sum_src_note]="Not: bu betik yalnızca ev dizininize kurar; uygulama klasörü olduğu yerde kalır."

    [un_warn]="VeloMD, ayarlar ve oturum dahil tamamen kaldırılacak."
    [un_confirm]="Devam etmek istiyor musunuz?"
    [un_cancel]="Kaldırma iptal edildi."
    [un_running]="Kaldırılıyor..."
    [un_launcher]="Komut silindi"
    [un_desktop]="Uygulama menüsü girdisi silindi"
    [un_icons]="İkonlar silindi"
    [un_config]="Ayarlar silindi (%s)"
    [un_no_config]="Ayar bulunamadı"
    [un_done]="Kaldırma tamamlandı!"

    [help_usage]="Kullanım:"
    [help_install]="  ./install.sh              VeloMD'yi kurar"
    [help_uninstall]="  ./install.sh --uninstall  VeloMD'yi tamamen kaldırır"
    [help_lang]="  ./install.sh --lang=en    dili sabitler (en | tr)"
    [help_help]="  ./install.sh --help       bu mesajı gösterir"
)

msg() {
    local key="$1"; shift
    local text="${MSG_EN[$key]}"
    if [ "$VM_LANG" = "tr" ] && [ -n "${MSG_TR[$key]+set}" ]; then
        text="${MSG_TR[$key]}"
    fi
    if [ "$#" -gt 0 ]; then
        # shellcheck disable=SC2059  # the format string is ours, not user input
        printf "$text" "$@"
    else
        printf '%s' "$text"
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  📝 ${GREEN}$APP_NAME${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

print_step()    { echo -e "  ${GREEN}✓${NC} $1"; }
print_warning() { echo -e "  ${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "  ${RED}✗${NC} $1"; }
print_info()    { echo -e "  ${CYAN}ℹ${NC} $1"; }

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    local reply hint

    if [ "$default" = "y" ]; then
        [ "$VM_LANG" = "tr" ] && hint="(E/h)" || hint="(Y/n)"
    else
        [ "$VM_LANG" = "tr" ] && hint="(e/H)" || hint="(y/N)"
    fi

    if ! read -r -p "  $prompt $hint " reply; then
        echo ""
        reply="$default"
    fi
    reply="${reply:-$default}"
    [[ "$reply" =~ ^([eEyY]|[eE]vet|[yY]es)$ ]]
}

# ═══════════════════════════════════════════════════════════════
#  BAĞIMLILIKLAR
# ═══════════════════════════════════════════════════════════════

PY=python3

check_python() {
    if command -v python3 &> /dev/null; then
        PY=python3
    elif command -v python &> /dev/null; then
        PY=python
    else
        print_error "$(msg py_missing)"
        echo "  $(msg py_hint)"
        exit 1
    fi
    print_step "$(msg py_found "$($PY --version 2>&1 | awk '{print $2}')")"
}

deps_ok() {
    "$PY" - <<'PYEOF' >/dev/null 2>&1
import gi
try:
    gi.require_version('Gtk', '4.0')
    gi.require_version('WebKit', '6.0')
except ValueError:
    gi.require_version('Gtk', '3.0')
    gi.require_version('WebKit', '4.1')
from gi.repository import Gtk, WebKit
PYEOF
}

install_dependencies() {
    if deps_ok; then
        print_step "$(msg deps_ok)"
        return 0
    fi

    print_info "$(msg deps_missing)"

    local pkg_mgr=""
    if   command -v dnf &> /dev/null;      then pkg_mgr=dnf
    elif command -v apt-get &> /dev/null;  then pkg_mgr=apt
    elif command -v pacman &> /dev/null;   then pkg_mgr=pacman
    elif command -v zypper &> /dev/null;   then pkg_mgr=zypper
    elif command -v apk &> /dev/null;      then pkg_mgr=apk
    fi

    if [ -z "$pkg_mgr" ]; then
        print_error "$(msg no_pkgmgr)"
        echo "  $(msg deps_list)"
        exit 1
    fi

    # Preferred GTK4+WebKit 6.0 set, falling back to GTK3+WebKit 4.1
    local sets
    case "$pkg_mgr" in
        dnf)    sets=("python3-gobject gtk4 webkitgtk6.0 fontconfig"
                      "python3-gobject gtk3 webkit2gtk4.1 fontconfig") ;;
        apt)    sets=("python3-gi gir1.2-gtk-4.0 gir1.2-webkit-6.0 fontconfig"
                      "python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1 fontconfig") ;;
        pacman) sets=("python-gobject gtk4 webkit2gtk-5.0 fontconfig"
                      "python-gobject gtk3 webkit2gtk-4.1 fontconfig") ;;
        zypper) sets=("python3-gobject typelib-1_0-Gtk-4_0 typelib-1_0-WebKit-6_0 fontconfig"
                      "python3-gobject typelib-1_0-Gtk-3_0 typelib-1_0-WebKit2-4_1 fontconfig") ;;
        apk)    sets=("py3-gobject gtk4.0 webkit2gtk-6.0 fontconfig"
                      "py3-gobject gtk+3.0 webkit2gtk-4.1 fontconfig") ;;
    esac

    local ok=no
    local set_pkgs
    for set_pkgs in "${sets[@]}"; do
        echo -e "  ${CYAN}→${NC} $pkg_mgr install: $set_pkgs"
        case "$pkg_mgr" in
            dnf)    sudo dnf install -y $set_pkgs || true ;;
            apt)    sudo apt-get update -qq && sudo apt-get install -y $set_pkgs || true ;;
            pacman) sudo pacman -S --needed --noconfirm $set_pkgs || true ;;
            zypper) sudo zypper --non-interactive install $set_pkgs || true ;;
            apk)    sudo apk add $set_pkgs || true ;;
        esac
        if deps_ok; then ok=yes; break; fi
        echo "  ..."
    done

    if [ "$ok" != yes ]; then
        print_error "$(msg deps_fail)"
        echo "  $(msg deps_list)"
        exit 1
    fi
    print_step "$(msg deps_ok)"
}

# ═══════════════════════════════════════════════════════════════
#  KURULUM
# ═══════════════════════════════════════════════════════════════

install_icon() {
    install -Dm644 "$APP_DIR/logo.png" \
        "$ICON_DIR/hicolor/512x512/apps/$APP_ID.png"
    if command -v gtk-update-icon-cache &> /dev/null; then
        gtk-update-icon-cache -f -t "$ICON_DIR/hicolor" 2>/dev/null || true
    fi
    print_step "$(msg icons)"
}

create_launcher() {
    mkdir -p "$BIN_DIR"
    cat > "$BIN_DIR/velomd" << LAUNCHER
#!/bin/bash
exec "$PY" "$APP_DIR/main.py" "\$@"
LAUNCHER
    chmod +x "$BIN_DIR/velomd"
    print_step "$(msg launcher "$BIN_DIR/velomd")"
}

create_desktop_entry() {
    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_DIR/$APP_ID.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=VeloMD
GenericName=Markdown Editor
GenericName[tr]=Markdown Editörü
Comment=Lightweight markdown editor with live preview
Comment[tr]=Hafif, canlı önizlemeli Markdown editörü
Exec=$BIN_DIR/velomd %f
Icon=$APP_ID
Terminal=false
Categories=TextEditor;Utility;
Keywords=markdown;editor;text;md;
MimeType=text/markdown;text/x-markdown;
StartupNotify=true
StartupWMClass=$APP_ID
DESKTOP
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    fi
    print_step "$(msg desktop)"
}

warn_path() {
    case ":$PATH:" in
        *":$BIN_DIR:"*) return ;;
    esac
    print_warning "$(msg path_missing "$BIN_DIR")"
    echo "  $(msg path_hint)"
    echo -e "    ${CYAN}export PATH=\"$BIN_DIR:\$PATH\"${NC}"
}

print_summary() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  ✅ ${GREEN}$(msg sum_done)${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  $(msg sum_start)"
    echo -e "    $(msg sum_cmd)  ${CYAN}velomd${NC}"
    echo -e "    $(msg sum_menu)"
    echo ""
    echo -e "  $(msg sum_uninstall)"
    echo -e "    ${YELLOW}./install.sh --uninstall${NC}"
    echo ""
    print_info "$(msg sum_src_note)"
    echo ""
}

do_install() {
    print_header
    echo "  $(msg checking)"
    check_python
    install_dependencies
    echo ""
    echo "  $(msg installing)"
    install_icon
    create_launcher
    create_desktop_entry
    warn_path
    print_summary
}

# ═══════════════════════════════════════════════════════════════
#  KALDIRMA
# ═══════════════════════════════════════════════════════════════

do_uninstall() {
    print_header
    echo -e "  ${YELLOW}$(msg un_warn)${NC}"
    echo ""
    if ! ask_yes_no "$(msg un_confirm)"; then
        echo "  $(msg un_cancel)"
        exit 0
    fi
    echo ""
    echo "  $(msg un_running)"

    [ -f "$BIN_DIR/velomd" ] && rm -f "$BIN_DIR/velomd" && print_step "$(msg un_launcher)"
    [ -f "$DESKTOP_DIR/$APP_ID.desktop" ] && rm -f "$DESKTOP_DIR/$APP_ID.desktop" && print_step "$(msg un_desktop)"

    rm -f "$ICON_DIR/hicolor/512x512/apps/$APP_ID.png"
    if command -v gtk-update-icon-cache &> /dev/null; then
        gtk-update-icon-cache -f -t "$ICON_DIR/hicolor" 2>/dev/null || true
    fi
    print_step "$(msg un_icons)"

    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "${CONFIG_DIR:?}"
        print_step "$(msg un_config "$CONFIG_DIR")"
    else
        print_info "$(msg un_no_config)"
    fi

    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    fi

    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  🗑️  ${GREEN}$(msg un_done)${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════
#  ANA AKIŞ
# ═══════════════════════════════════════════════════════════════

ACTION="install"
for arg in "$@"; do
    case "$arg" in
        --uninstall|-u) ACTION="uninstall" ;;
        --help|-h)      ACTION="help" ;;
        --lang=*)       ;;  # already consumed by the language detection above
        *) if [ -n "$arg" ]; then
               print_error "Unknown option: $arg"
               ACTION="help"
           fi ;;
    esac
done

case "$ACTION" in
    uninstall) do_uninstall ;;
    help)
        echo "$(msg help_usage)"
        echo "$(msg help_install)"
        echo "$(msg help_uninstall)"
        echo "$(msg help_lang)"
        echo "$(msg help_help)"
        ;;
    *) do_install ;;
esac
