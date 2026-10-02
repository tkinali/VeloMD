#!/usr/bin/env python3
"""VeloMD — hafif Markdown editörü.

GTK4 + WebKit2GTK kabuğu; arayüzün tamamı app/ altındaki HTML/CSS/JS'te.
Bu dosya yalnızca pencere yönetimi, JS köprüsü ve yerel sistem
işlemlerinden (dosya I/O, font listesi, ayar/oturum kalıcılığı,
native dosya pencereleri) sorumlu.
"""

import json
import os
import subprocess
import sys

PKG_HINT = """Sistem bileşenleri eksik. Dağıtımına uygun paketleri kur:

  Fedora:      sudo dnf install python3-gobject webkit2gtk6.0 fontconfig
  Ubuntu/Deb.: sudo apt install python3-gi gir1.2-webkit-6.0 gir1.2-gtk-4.0 fontconfig
               (eski sürümde: gir1.2-webkit2-4.1 gir1.2-gtk-3.0)
  Arch:        sudo pacman -S python-gobject webkit2gtk-5.0 fontconfig
  openSUSE:    sudo zypper install python3-gobject typelib-1_0-WebKit-6_0 \\
               typelib-1_0-Gtk-4_0 fontconfig

Ardından `./install.sh` bunu kendiliğinden de yapabilir."""

try:
    import gi
except ImportError:
    sys.stderr.write('VeloMD: PyGObject (python3-gobject / python3-gi) kurulu değil.\n'
                     + PKG_HINT + '\n')
    raise SystemExit(1)

try:
    try:
        gi.require_version('Gtk', '4.0')
        gi.require_version('WebKit', '6.0')
        GTK_MAJOR = 4
    except ValueError:
        # eski stack: GTK3 + WebKit2GTK 4.1
        gi.require_version('Gtk', '3.0')
        gi.require_version('WebKit', '4.1')
        GTK_MAJOR = 3
    from gi.repository import Gio, GLib, Gtk, WebKit  # noqa: E402
except (ValueError, ImportError):
    sys.stderr.write('VeloMD: GTK/WebKit2GTK bulunamadı.\n' + PKG_HINT + '\n')
    raise SystemExit(1)

APP_NAME = 'VeloMD'
# Test/izole çalıştırma için üstüne yazılabilir; normal kullanıcıya etkisi yok.
APP_ID = os.environ.get('VELOMD_APP_ID') or 'com.velomd.VeloMD'
APP_DIR = os.path.dirname(os.path.abspath(__file__))


def _read_version():
    try:
        with open(os.path.join(APP_DIR, 'VERSION'), encoding='utf-8') as fh:
            return fh.read().strip() or 'dev'
    except OSError:
        return 'dev'


APP_VERSION = _read_version()
CONFIG_DIR = os.path.join(GLib.get_user_config_dir(), 'velomd')
SETTINGS_PATH = os.path.join(CONFIG_DIR, 'settings.json')
SESSION_PATH = os.path.join(CONFIG_DIR, 'session.json')

DEFAULT_SETTINGS = {
    'editorFont': None,        # ilk açılışta fc-match ile doldurulur
    'editorFontSize': 14,
    'previewFont': None,
    'previewFontSize': 15,
    'previewTheme': 'github-dark',
    'lineNumbers': True,
    'wordWrap': True,
    'syncScroll': True,
    'autosave': True,
    'autosaveDelay': 2.0,
    'splitRatio': 0.5,
    'window': {'width': 1280, 'height': 820, 'maximized': False},
}


def read_json(path, fallback):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return fallback


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def default_font(pattern):
    """fc-match ile bir font alias'ının gerçek aile adını bul."""
    try:
        env = dict(os.environ, LC_ALL='C.UTF-8')
        out = subprocess.run(
            ['fc-match', '-f', '%{family}', pattern],
            capture_output=True, text=True, timeout=5, env=env,
        )
        return out.stdout.strip() or None
    except Exception:
        return None


def detect_system_dark():
    """Sistemin koyu tema kullanıp kullanmadığını güvenilir biçimde tespit et.

    WebKit'in prefers-color-scheme sorgusu bazı masaüstlerinde (ör. tema
    adı koyu ama color-scheme 'default' olan Linux Mint) yanlış 'açık'
    bildirdiği için burada kendimiz bakıyoruz. Sonuç bilinmiyorsa None.
    """
    # 1) açık belirteç: gsettings color-scheme
    try:
        out = subprocess.run(
            ['gsettings', 'get', 'org.gnome.desktop.interface', 'color-scheme'],
            capture_output=True, text=True, timeout=3,
        )
        val = out.stdout.strip()
        if 'prefer-dark' in val:
            return True
        if 'prefer-light' in val:
            return False
    except Exception:
        pass
    # 2) GTK tema adında 'dark' geçiyor mu (Mint-Y-Dark-Aqua, Adwaita-dark, ...)
    try:
        name = str(Gtk.Settings.get_default().get_property('gtk-theme-name') or '')
        if 'dark' in name.lower():
            return True
    except Exception:
        pass
    return None


class BridgeApi:
    """JS köprüsünden çağırılabilen yerel işlemler.

    Her metot {'ok': ...} ya da {'error': ...} sözlüğü döndürür.
    Dosya pencereleri asenkron çalışır: __async_id döndürürler,
    cevap JSC üzerinden sonra gelir.
    """

    def __init__(self, app):
        self.app = app

    # ---- yardımcılar -------------------------------------------------

    def dispatch(self, method, params):
        handler = getattr(self, 'api_' + method, None)
        if handler is None:
            return {'error': 'bilinmeyen metot: %s' % method}
        try:
            if isinstance(params, dict):
                return handler(**params)
            return handler()
        except Exception as exc:  # pragma: no cover - köprü hata sızıntısı olmasın
            return {'error': str(exc)}

    # ---- genel --------------------------------------------------------

    def api_ping(self):
        return {'ok': True, 'app': APP_NAME, 'gtk': GTK_MAJOR}

    def api_get_locale(self):
        """Sistem dilini 'tr' / 'en' olarak döndürür (başkası → 'en')."""
        try:
            for name in GLib.get_language_names():
                code = str(name).split('_')[0].split('.')[0].lower()
                if code in ('tr', 'en'):
                    return {'ok': True, 'locale': code}
        except Exception:
            pass
        return {'ok': True, 'locale': 'en'}

    def api_get_system_theme(self):
        return {'ok': True, 'dark': detect_system_dark()}

    # ---- dosya işlemleri ----------------------------------------------

    def api_read_file(self, path):
        with open(path, encoding='utf-8') as fh:
            return {'ok': True, 'content': fh.read()}

    def api_write_file(self, path, content):
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(content)
        return {'ok': True}

    # ---- fontlar -------------------------------------------------------

    def api_list_fonts(self, mono=False):
        env = dict(os.environ, LC_ALL='C.UTF-8')
        args = ['fc-list', ':mono', 'family'] if mono else ['fc-list', ':', 'family']
        out = subprocess.run(args, capture_output=True, text=True, timeout=15, env=env)
        families = set()
        for line in out.stdout.splitlines():
            for fam in line.split(','):
                fam = fam.strip()
                if fam and not fam.lower().startswith('monospace'):
                    # "monospace" gibi jenerik alias'ları gizle
                    if fam.lower() in ('monospace', 'sans', 'sans-serif', 'serif'):
                        continue
                    families.add(fam)
        return {'ok': True, 'fonts': sorted(families, key=str.casefold)}

    # ---- ayarlar / oturum ----------------------------------------------

    def api_get_settings(self):
        return {'ok': True, 'settings': self.app.settings, 'version': APP_VERSION}

    def api_save_settings(self, settings):
        self.app.settings = settings
        write_json(SETTINGS_PATH, settings)
        return {'ok': True}

    def api_save_session(self, session):
        write_json(SESSION_PATH, session)
        return {'ok': True}

    # ---- PDF dışa aktarma ----------------------------------------------

    def api_export_pdf(self, suggested_name, _async_id):
        """Önizlemeyi PDF olarak kaydet: dosya penceresi + WebKit yazdırma
        (print CSS sayesinde yalnızca önizleme, renkler korunur)."""
        dlg = Gtk.FileDialog()
        dlg.set_title('PDF')
        filt = Gtk.FileFilter()
        filt.set_name('PDF')
        filt.add_pattern('*.pdf')
        store = Gio.ListStore.new(Gtk.FileFilter)
        store.append(filt)
        dlg.set_filters(store)
        if suggested_name:
            dlg.set_initial_name(suggested_name)
        last_dir = self._last_dir()
        if last_dir:
            try:
                dlg.set_initial_folder(Gio.File.new_for_path(last_dir))
            except Exception:
                pass

        def cb(d, res, *user_data):
            try:
                file = d.save_finish(res)
                path = file.get_path() if file else None
            except GLib.Error:
                path = None
            if not path:
                self.app.resolve_async(_async_id, {'ok': True, 'path': None})
                return
            if not path.lower().endswith('.pdf'):
                path += '.pdf'
            self._remember_dir(path)
            self.app.export_pdf(path, async_id)

        dlg.save(self.app.window, None, cb)
        return {'__async__': True}

    # ---- native dosya pencereleri (asenkron) ---------------------------

    def api_open_dialog(self, _async_id):
        self._run_file_dialog(Gtk.FileChooserAction.OPEN, 'Markdown Dosyası Aç',
                              None, _async_id)
        return {'__async__': True}

    def api_save_dialog(self, suggested_name, _async_id):
        self._run_file_dialog(Gtk.FileChooserAction.SAVE, 'Farklı Kaydet',
                              suggested_name, _async_id)
        return {'__async__': True}

    def _md_filters(self):
        filt = Gtk.FileFilter()
        filt.set_name('Markdown')
        for pat in ('*.md', '*.markdown', '*.mdown', '*.mkd', '*.txt'):
            filt.add_pattern(pat)
        any_f = Gtk.FileFilter()
        any_f.set_name('Tüm Dosyalar')
        any_f.add_pattern('*')
        return filt, any_f

    def _last_dir(self):
        d = self.app.settings.get('lastOpenDir')
        return d if d and os.path.isdir(d) else None

    def _remember_dir(self, path):
        if not path:
            return
        d = os.path.dirname(path)
        if d and d != self.app.settings.get('lastOpenDir'):
            self.app.settings['lastOpenDir'] = d
            write_json(SETTINGS_PATH, self.app.settings)

    def _run_file_dialog(self, action, title, suggested_name, async_id):
        last_dir = self._last_dir()

        if hasattr(Gtk, 'FileDialog'):
            # GTK >= 4.10: FileDialog (FileChooserNative bazı kurulumlarda
            # açılmadan iptal yanıtı döndürüyor)
            dlg = Gtk.FileDialog()
            dlg.set_title(title)
            filt, any_f = self._md_filters()
            store = Gio.ListStore.new(Gtk.FileFilter)
            store.append(filt)
            store.append(any_f)
            dlg.set_filters(store)
            if last_dir:
                try:
                    dlg.set_initial_folder(Gio.File.new_for_path(last_dir))
                except Exception:
                    pass
            if action == Gtk.FileChooserAction.SAVE and suggested_name:
                dlg.set_initial_name(suggested_name)

            def cb(d, res, *user_data):
                path = None
                try:
                    if action == Gtk.FileChooserAction.OPEN:
                        file = d.open_finish(res)
                    else:
                        file = d.save_finish(res)
                    path = file.get_path() if file else None
                except GLib.Error:
                    path = None  # kullanıcı iptal etti
                self._remember_dir(path)
                self.app.resolve_async(async_id, {'ok': True, 'path': path})

            if action == Gtk.FileChooserAction.OPEN:
                dlg.open(self.app.window, None, cb)
            else:
                dlg.save(self.app.window, None, cb)
            return

        # GTK3 / eski GTK4: FileChooserNative
        dlg = Gtk.FileChooserNative.new(
            title, self.app.window, action,
            '_Aç' if action == Gtk.FileChooserAction.OPEN else '_Kaydet', '_İptal')
        filt, any_f = self._md_filters()
        if GTK_MAJOR >= 4:
            store = Gio.ListStore.new(Gtk.FileFilter)
            store.append(filt)
            store.append(any_f)
            dlg.set_filters(store)
            if last_dir:
                try:
                    dlg.set_current_folder(Gio.File.new_for_path(last_dir))
                except Exception:
                    pass
        else:
            dlg.add_filter(filt)
            dlg.add_filter(any_f)
            if last_dir:
                try:
                    dlg.set_current_folder(last_dir)
                except Exception:
                    pass
        if action == Gtk.FileChooserAction.SAVE and suggested_name:
            dlg.set_current_name(suggested_name)

        def on_response(dialog, response):
            path = None
            if response == Gtk.ResponseType.ACCEPT:
                if GTK_MAJOR >= 4:
                    file = dialog.get_file()
                    path = file.get_path() if file else None
                else:
                    path = dialog.get_filename()
            self._remember_dir(path)
            dialog.destroy()
            self.app.resolve_async(async_id, {'ok': True, 'path': path})

        dlg.connect('response', on_response)
        dlg.show()


class VeloMDApp(Gtk.Application):
    def __init__(self):
        # HANDLES_COMMAND_LINE: uygulama açıkken "velomd dosya.md" çağrısı
        # dosyayı çalışan örnekte yeni sekme olarak açar
        super().__init__(application_id=APP_ID,
                         flags=Gio.ApplicationFlags.HANDLES_COMMAND_LINE)
        self.window = None
        self.webview = None
        self.settings = None
        self.quitting = False
        self._cli_arg = None

    # ---- başlangıç ------------------------------------------------------

    def do_command_line(self, command_line):  # noqa: N802
        args = command_line.get_arguments()[1:]
        for a in args:
            if a and not a.startswith('-'):
                self._cli_arg = a
                break
        self.activate()
        return 0

    def do_activate(self):  # noqa: N802
        if self.window is not None:
            self.window.present()
            # ikinci bir "velomd dosya.md" çağrısı: çalışan pencerede aç
            if getattr(self, '_cli_arg', None):
                arg = os.path.abspath(self._cli_arg)
                self._cli_arg = None
                self.eval_js('window.__openPathRemote && window.__openPathRemote(%s);'
                             % json.dumps(arg))
            return

        self.settings = dict_merge(DEFAULT_SETTINGS, read_json(SETTINGS_PATH, {}))
        if not self.settings.get('editorFont'):
            self.settings['editorFont'] = default_font('monospace') or 'monospace'
        if not self.settings.get('previewFont'):
            self.settings['previewFont'] = default_font('sans') or 'sans-serif'

        win = Gtk.ApplicationWindow(application=self)
        win.set_title(APP_NAME)
        size = self.settings.get('window', {})
        win.set_default_size(size.get('width', 1280), size.get('height', 820))
        if size.get('maximized'):
            win.maximize()
        win.connect('close-request' if GTK_MAJOR >= 4 else 'delete-event',
                    self.on_close_request)

        ucm = WebKit.UserContentManager.new()
        ucm.register_script_message_handler('velomd')
        ucm.connect('script-message-received::velomd', self.on_js_message)

        # ephemeral: disk önbelleği yok (arayüz güncellemeleri anında görür,
        # uygulama da diskte iz bırakmaz)
        try:
            wdm = WebKit.WebsiteDataManager.new_ephemeral()
            self.webview = WebKit.WebView(
                website_data_manager=wdm,
                user_content_manager=ucm,
            )
        except (AttributeError, TypeError):
            self.webview = WebKit.WebView(user_content_manager=ucm)
        ws = self.webview.get_settings()
        ws.set_enable_developer_extras(True)
        ws.set_enable_write_console_messages_to_stdout(True)
        ws.set_allow_file_access_from_file_urls(True)
        self.webview.connect('load-changed', self.on_load_changed)
        # document.title → GTK pencere başlığı
        self.webview.connect('notify::title', lambda v, _p: win.set_title(v.get_title() or APP_NAME))
        # linkler uygulama içinde açılmasın: gezinmeyi engelle, sistem
        # tarayıcısına yönlendir
        self.webview.connect('decide-policy', self.on_decide_policy)

        if GTK_MAJOR >= 4:
            win.set_child(self.webview)
        else:
            win.add(self.webview)
            self.webview.set_hexpand(True)
            self.webview.set_vexpand(True)
            self.webview.show()

        self.api = BridgeApi(self)
        self.window = win
        self._watch_theme_changes()
        index_uri = GLib.filename_to_uri(os.path.join(APP_DIR, 'app', 'index.html'), None)
        self.webview.load_uri(index_uri)
        win.present()

    def _watch_theme_changes(self):
        """Sistem teması değişince JS tarafına bildir."""
        try:
            Gtk.Settings.get_default().connect(
                'notify::gtk-theme-name', lambda *a: self._push_system_theme())
        except Exception:
            pass
        try:
            gs = Gio.Settings.new('org.gnome.desktop.interface')
            gs.connect('changed::color-scheme', lambda *a: self._push_system_theme())
        except Exception:
            pass

    def _push_system_theme(self):
        dark = detect_system_dark()
        if dark is None:
            return
        self.eval_js('window.__systemThemeChanged && window.__systemThemeChanged(%s);'
                     % ('true' if dark else 'false'))

    def on_decide_policy(self, view, decision, decision_type):
        """Önizlemedeki bağlantı tıklamalarını yakalar: gezinmeyi reddedip
        adresi sistem tarayıcısında açar (geri dönülemez bir uygulama içi
        sayfa değişimi yaşanmasın)."""
        try:
            nav_types = (WebKit.PolicyDecisionType.NAVIGATION_ACTION,
                         WebKit.PolicyDecisionType.NEW_WINDOW_ACTION)
            if decision_type not in nav_types:
                return False
            action = decision.get_navigation_action()
            if not action:
                return False
            if action.get_navigation_type() != WebKit.NavigationType.LINK_CLICKED:
                return False
            if action.get_mouse_button() not in (0, 1):
                return False  # orta tık vb.: WebKit'in kendi davranışına bırak
            uri = action.get_request().get_uri()
            decision.ignore()
            if uri and not uri.startswith(('file://', 'about:')):
                self.open_external(uri)
        except Exception:
            pass
        return False

    def open_external(self, uri):
        try:
            Gio.AppInfo.launch_default_for_uri(uri, None)
            return
        except Exception:
            pass
        try:
            subprocess.Popen(['xdg-open', uri],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    def export_pdf(self, path, async_id=None):
        """WebView'in geçerli sayfasını print CSS ile PDF dosyasına yaz.
        async_id verilirse 'finished' sinyaline kadar cevap geciktirilir
        (JS arayüz o ana kadar light temayı korur)."""
        try:
            po = WebKit.PrintOperation.new(self.webview)
            settings = Gtk.PrintSettings.new()
            settings.set_printer('Print to File')
            settings.set(Gtk.PRINT_SETTINGS_OUTPUT_URI, 'file://' + path)
            po.set_print_settings(settings)

            if async_id is None:
                po.print_()
                return True

            state = {'done': False}

            def finished(*_a):
                if state['done']:
                    return
                state['done'] = True
                self.api.resolve_async(async_id, {'ok': True, 'path': path})

            def failed(*_a):
                if state['done']:
                    return
                state['done'] = True
                self.api.resolve_async(async_id, {'ok': False, 'error': 'failed'})

            po.connect('finished', finished)
            po.connect('failed', failed)
            po.print_()

            def timeout():
                if not state['done']:
                    state['done'] = True
                    self.api.resolve_async(async_id, {'ok': True, 'path': path})
                return False

            GLib.timeout_add_seconds(30, timeout)
            return True
        except Exception as exc:
            print('PDF dışa aktarma hatası:', exc, file=sys.stderr)
            if async_id is not None:
                self.api.resolve_async(async_id, {'ok': False, 'error': str(exc)})
            return False

    def on_load_changed(self, view, event):
        if event == WebKit.LoadEvent.FINISHED:
            arg = getattr(self, '_cli_arg', None)
            self._cli_arg = None
            if not arg and len(sys.argv) > 1:
                for a in sys.argv[1:]:
                    if a and not a.startswith('-'):
                        arg = a
                        break
            arg = os.path.abspath(arg) if arg else None
            session = read_json(SESSION_PATH, None)
            self.eval_js('window.__velomdReady && window.__velomdReady(%s, %s);'
                         % (json.dumps(arg), json.dumps(session)))

    # ---- JS köprüsü ------------------------------------------------------

    def on_js_message(self, ucm, js_value):
        try:
            raw = js_value.to_string()
        except AttributeError:
            raw = js_value.get_js_value().to_string()
        try:
            msg = json.loads(raw)
        except ValueError:
            return
        req_id, method = msg.get('id'), msg.get('method')
        params = msg.get('params') or {}

        # Sıra önemli: save_session/save_settings önce yazılsın, ready_to_quit en son.
        if method == 'ready_to_quit':
            self.finish_quit()
            return

        result = self.api.dispatch(method, params)
        if result.get('__async__'):
            return
        self.resolve(req_id, result)

    def resolve(self, req_id, payload):
        self.eval_js('window.__bridgeResolve && window.__bridgeResolve(%s, %s);'
                     % (json.dumps(req_id), json.dumps(payload)))

    def resolve_async(self, async_id, payload):
        self.resolve(async_id, payload)

    def eval_js(self, script):
        try:
            if hasattr(self.webview, 'evaluate_javascript'):
                self.webview.evaluate_javascript(script, -1, None, None, None, None, None)
            else:  # WebKit2GTK < 2.40
                self.webview.run_javascript(script, None, None, None)
        except Exception:
            pass

    # ---- kapanış (hot-exit) ----------------------------------------------

    def on_close_request(self, *args):
        if self.quitting:
            return False
        self.quitting = True
        # Pencere boyutunu ayarlara yaz, sonra JS'ten oturumu isteyip kapat.
        w, h = (self.window.get_default_size() if GTK_MAJOR >= 4
                else self.window.get_size())
        self.settings['window'] = {
            'width': w, 'height': h, 'maximized': self.window.is_maximized(),
        }
        self.api.api_save_settings(self.settings)
        self.eval_js('window.__prepareQuit && window.__prepareQuit();')
        # WebKit cevap vermezse takılı kalmasın.
        GLib.timeout_add_seconds(3, self.force_quit)
        return True

    def finish_quit(self):
        if not self.quitting:
            return
        self.window.destroy()
        self.quit()

    def force_quit(self):
        if self.quitting:
            self.finish_quit()
        return False


def dict_merge(base, override):
    out = dict(base)
    for key, val in override.items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = dict_merge(out[key], val)
        else:
            out[key] = val
    return out


def main():
    app = VeloMDApp()
    app.run(sys.argv)


if __name__ == '__main__':
    main()
