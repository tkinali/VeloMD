Name:           velomd
Version:        %{VERSION}
Release:        1%{?dist}
Summary:        Featherweight Markdown editor with live split-pane preview
License:        MIT
URL:            https://github.com/tkinali/VeloMD
BuildArch:      noarch

Requires:       python3-gobject
Requires:       webkitgtk6.0
Requires:       fontconfig
Recommends:     google-noto-sans-mono-fonts

Source0:        %{name}-%{version}.tar.gz

%description
VeloMD is a featherweight Markdown editor for Linux: source on the left,
live preview on the right. Tabs with hot-exit session restore, find &
replace on both panes, bilingual UI (Turkish/English), light/dark/system
themes and six preview themes. Built on GTK4 + WebKit2GTK (~600 KB of
vendored JS, no Electron).

%prep
%setup -q

%build
# nothing to compile

%install
install -Dm644 main.py        %{buildroot}%{_datadir}/velomd/main.py
install -Dm644 VERSION        %{buildroot}%{_datadir}/velomd/VERSION
install -Dm644 logo.png       %{buildroot}%{_datadir}/velomd/logo.png
cp -r app                     %{buildroot}%{_datadir}/velomd/app
install -Dm644 logo.png       %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/com.velomd.VeloMD.png
install -Dm644 packaging/rpm/velomd.desktop %{buildroot}%{_datadir}/applications/com.velomd.VeloMD.desktop
install -d %{buildroot}%{_bindir}
cat > %{buildroot}%{_bindir}/velomd <<'EOF'
#!/bin/sh
exec python3 %{_datadir}/velomd/main.py "$@"
EOF
chmod 755 %{buildroot}%{_bindir}/velomd

%files
%{_bindir}/velomd
%{_datadir}/velomd/
%{_datadir}/icons/hicolor/512x512/apps/com.velomd.VeloMD.png
%{_datadir}/applications/com.velomd.VeloMD.desktop

%changelog
* Mon Sep 28 2026 tkinali <tkinali@users.noreply.github.com> - 1.0.0-1
- Initial package
