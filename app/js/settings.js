/* VeloMD settings — ayar yükleme, canlı uygulama ve kalıcılık.
   Uygulama teması (light/dark/system) hem arayüzü hem "auto" önizleme
   temalarını (github, solarized) belirler. */
(function () {
  'use strict';

  const bridge = () => VeloMD.bridge;

  const DEFAULTS = {
    editorFont: 'monospace',
    editorFontSize: 14,
    previewFont: 'sans-serif',
    previewFontSize: 15,
    previewTheme: 'github',
    uiTheme: 'system',
    language: 'system',
    lineNumbers: true,
    wordWrap: true,
    syncScroll: true,
    showPreview: true,
    autosave: true,
    autosaveDelay: 2.0,
    splitRatio: 0.5,
    lastOpenDir: null,
  };

  /* auto: genel temaya göre -light / -dark varyantı seçilir */
  const THEMES = [
    {
      id: 'github', name: 'GitHub', auto: true,
      light: { bg: '#ffffff', fg: '#1f2328', title: '#1f2328', code: '#d73a49' },
      dark: { bg: '#0d1117', fg: '#c9d1d9', title: '#f0f6fc', code: '#ff7b72' },
    },
    {
      id: 'solarized', name: 'Solarized', auto: true,
      light: { bg: '#fdf6e3', fg: '#586e75', title: '#073642', code: '#859900' },
      dark: { bg: '#002b36', fg: '#93a1a1', title: '#eee8d5', code: '#2aa198' },
    },
    { id: 'monokai', name: 'Monokai', dark: { bg: '#272822', fg: '#f8f8f2', title: '#a6e22e', code: '#f92672' } },
    { id: 'dracula', name: 'Dracula', dark: { bg: '#282a36', fg: '#f8f8f2', title: '#bd93f9', code: '#ff79c6' } },
    { id: 'nord', name: 'Nord', dark: { bg: '#2e3440', fg: '#d8dee9', title: '#88c0d0', code: '#81a1c1' } },
    { id: 'one-dark', name: 'One Dark', dark: { bg: '#282c34', fg: '#abb2bf', title: '#e5c07b', code: '#c678dd' } },
  ];

  const state = {
    settings: Object.assign({}, DEFAULTS),
    fonts: { mono: [], all: [] },
    systemLang: 'en',
    systemDark: null, // Python'dan gelen güvenilir sistem teması bilgisi
  };

  function cssFont(name) {
    return '"' + String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  /* eski sürüm ayar değerlerini yeni şemaya taşı */
  function migrate(s) {
    if (s.previewTheme === 'github-light' || s.previewTheme === 'github-dark') {
      s.previewTheme = 'github';
    } else if (s.previewTheme === 'solarized-light' || s.previewTheme === 'solarized-dark') {
      s.previewTheme = 'solarized';
    }
    return s;
  }

  function systemWantsDark() {
    // Python tespiti (tema adı/gsettings) WebKit'in prefers-color-scheme
    // sorgusundan güvenilirdir; yoksa medya sorgusuna düş.
    if (state.systemDark === true) return true;
    if (state.systemDark === false) return false;
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (err) {
      return true;
    }
  }

  function uiDark() {
    const t = state.settings.uiTheme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return systemWantsDark();
  }

  function resolvedUiTheme() {
    return uiDark() ? 'dark' : 'light';
  }

  function resolvedPreviewTheme() {
    const id = state.settings.previewTheme;
    const theme = THEMES.find(function (x) { return x.id === id; }) || THEMES[0];
    if (theme.auto) return theme.id + (uiDark() ? '-dark' : '-light');
    return theme.id;
  }

  function resolvedLang() {
    const l = state.settings.language;
    if (l === 'tr' || l === 'en') return l;
    return state.systemLang === 'tr' ? 'tr' : 'en';
  }

  function applyToDocument() {
    const s = state.settings;
    const root = document.documentElement;
    root.style.setProperty('--ed-font', cssFont(s.editorFont));
    root.style.setProperty('--ed-font-size', s.editorFontSize + 'px');
    root.style.setProperty('--pv-font', cssFont(s.previewFont));
    root.style.setProperty('--pv-font-size', s.previewFontSize + 'px');
    root.dataset.uiTheme = resolvedUiTheme();

    const pv = resolvedPreviewTheme();
    document.querySelectorAll('link[data-theme-css]').forEach(function (link) {
      link.disabled = link.dataset.themeCss !== pv;
    });
    const preview = document.getElementById('preview');
    if (preview) preview.dataset.theme = pv;
  }

  function applyToEditor() {
    if (VeloMD.editor && VeloMD.editor.cm) {
      VeloMD.editor.cm.setOption('lineNumbers', !!state.settings.lineNumbers);
      VeloMD.editor.cm.setOption('lineWrapping', !!state.settings.wordWrap);
    }
  }

  function applyLang() {
    if (VeloMD.i18n) VeloMD.i18n.setLang(resolvedLang());
  }

  function applyAll() {
    applyToDocument();
    applyToEditor();
    applyLang();
    if (VeloMD.app && VeloMD.app.applyPreviewVisibility) {
      VeloMD.app.applyPreviewVisibility();
    }
    if (VeloMD.settingsUi) VeloMD.settingsUi.syncControls();
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      state.settings.splitRatio = VeloMD.app ? VeloMD.app.currentSplitRatio() : state.settings.splitRatio;
      bridge().call('save_settings', { settings: state.settings });
    }, 350);
  }

  function update(patch) {
    Object.assign(state.settings, patch);
    applyAll();
    persist();
  }

  async function load() {
    const res = await bridge().call('get_settings');
    if (res && res.ok && res.settings) {
      Object.assign(state.settings, migrate(res.settings));
    }
    applyAll();
    return state.settings;
  }

  async function loadSystemTheme() {
    const res = await bridge().call('get_system_theme');
    if (res && res.ok && res.dark !== null && res.dark !== undefined) {
      state.systemDark = res.dark;
    }
  }

  // Python tarafı sistem teması değişince çağırır
  window.__systemThemeChanged = function (dark) {
    state.systemDark = !!dark;
    if (state.settings.uiTheme === 'system') applyAll();
  };

  async function loadFonts(kind) {
    const key = kind === 'mono' ? 'mono' : 'all';
    if (state.fonts[key].length) return state.fonts[key];
    const res = await bridge().call('list_fonts', { mono: kind === 'mono' });
    state.fonts[key] = res && res.ok ? res.fonts : [];
    return state.fonts[key];
  }

  function watchSystemTheme() {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', function () {
        if (state.settings.uiTheme === 'system') applyAll();
      });
    } catch (err) { /* eşleşme yoksa sorun değil */ }
  }

  /* PDF dışa aktarımı sırasında önizlemeyi geçici olarak light temaya alır;
     id=null ise kalıcı ayara döner (state'e dokunmadan yalnız DOM'a uygular). */
  function setPreviewDomTheme(id) {
    const pv = id || resolvedPreviewTheme();
    document.querySelectorAll('link[data-theme-css]').forEach(function (link) {
      link.disabled = link.dataset.themeCss !== pv;
    });
    const preview = document.getElementById('preview');
    if (preview) preview.dataset.theme = pv;
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.settings = {
    state,
    DEFAULTS,
    THEMES,
    load,
    loadFonts,
    loadSystemTheme,
    update,
    cssFont,
    migrate,
    uiDark,
    resolvedPreviewTheme,
    setPreviewDomTheme,
    watchSystemTheme,
  };
})();
