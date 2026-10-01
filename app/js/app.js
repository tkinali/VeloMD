/* VeloMD app — orkestrasyon: başlangıç, oturum geri yükleme, dosya
   işlemleri, otomatik kaydetme, durum çubuğu, kısayollar, ayar ekranı,
   tema/dil yönetimi ve kapanış (hot-exit) akışı. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const bridge = () => VeloMD.bridge;
  const tabs = () => VeloMD.tabs;
  const editor = () => VeloMD.editor;
  const S = () => VeloMD.settings.state.settings;
  const t = (...args) => VeloMD.i18n.t(...args);

  let cm = null;
  let renderTimer = null;
  let autosaveTimer = null;
  let sessionTimer = null;
  let splitRatio = 0.5;

  /* ------------------------------------------------------------
     Önizleme
     ------------------------------------------------------------ */
  function renderPreview() {
    const tab = tabs().current();
    const text = tab ? tab.doc.getValue() : '';
    $('preview').innerHTML = VeloMD.preview.render(text);
    if (VeloMD.sync) {
      VeloMD.sync.resetHighlight();
      VeloMD.sync.refresh();
    }
    if (VeloMD.pvSearch) VeloMD.pvSearch.reapply();
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 120);
  }

  /* ------------------------------------------------------------
     Durum çubuğu
     ------------------------------------------------------------ */
  function updateStatus() {
    if (!cm) return; // editör hazır değilken (ör. dil ilk uygulama) çalışma
    const tab = tabs().current();
    const text = tab ? tab.doc.getValue() : '';
    const cur = cm.getCursor();
    const selLen = cm.getSelection().length;
    const words = (text.match(/[^\s]+/g) || []).length;

    $('st-cursor').textContent = t('st.cursor', cur.line + 1, cur.ch + 1);
    let counts = t('st.counts', words.toLocaleString('tr-TR'), text.length.toLocaleString('tr-TR'));
    if (selLen) counts += t('st.selected', selLen.toLocaleString('tr-TR'));
    $('st-counts').textContent = counts;

    const stPath = $('st-path');
    stPath.textContent = tab
      ? (tab.path || tab.name + t('st.unsavedSuffix'))
      : (tabs().list.length ? t('st.newFile') : t('st.noFile'));
    stPath.title = tab ? (tab.path || tab.name) : '';

    const stSave = $('st-save');
    if (!tab) { stSave.textContent = ''; stSave.className = ''; }
    else if (tab.dirty) { stSave.textContent = t('st.unsaved'); stSave.className = 'unsaved'; }
    else { stSave.textContent = t('st.saved'); stSave.className = 'saved'; }

    document.title = (tab ? tab.name + (tab.dirty ? ' ●' : '') + ' — ' : '') + 'VeloMD';
  }

  /* ------------------------------------------------------------
     Oturum (hot-exit)
     ------------------------------------------------------------ */
  function buildSession() {
    return {
      openFiles: tabs().list.map(function (tb) {
        if (tb.path && !tb.dirty) return { path: tb.path };
        return {
          path: tb.path,
          name: tb.name,
          content: tb.doc.getValue(),
          dirty: true,
        };
      }),
      active: tabs().active,
    };
  }

  function persistSession() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(function () {
      bridge().call('save_session', { session: buildSession() });
    }, 800);
  }

  async function restoreSession(session) {
    if (!session || !Array.isArray(session.openFiles) || !session.openFiles.length) {
      tabs().create(null, t('ed.welcome'), false);
      return;
    }
    for (const entry of session.openFiles) {
      if (entry.path) {
        let content = entry.content;
        if (typeof content !== 'string') {
          const res = await bridge().call('read_file', { path: entry.path });
          content = res && res.ok ? res.content : null;
        }
        if (content === null) continue; // dosya artık yoksa atla
        tabs().create(entry.path, content, !!entry.dirty);
      } else {
        tabs().create(null, entry.content || '', true);
      }
    }
    if (!tabs().list.length) tabs().create(null, '', false);
    const idx = Math.min(Math.max(0, session.active | 0), tabs().list.length - 1);
    tabs().activate(idx);
  }

  /* ------------------------------------------------------------
     Dosya işlemleri
     ------------------------------------------------------------ */
  async function openFile() {
    const res = await bridge().callAsync('open_dialog');
    if (!res || !res.ok || !res.path) return;
    await openPath(res.path);
  }

  async function openPath(path) {
    const res = await bridge().call('read_file', { path });
    if (!res || !res.ok) {
      await uiConfirmOk(t('cf.cannotRead', (res && res.error) || path));
      return;
    }
    tabs().create(path, res.content, false);
    cm.focus();
    persistSession();
  }

  async function saveTab(tab) {
    if (!tab) return false;
    if (!tab.path) return saveTabAs(tab);
    const res = await bridge().call('write_file', {
      path: tab.path, content: tab.doc.getValue(),
    });
    if (!res || !res.ok) {
      await uiConfirmOk(t('cf.cannotWrite', (res && res.error) || tab.path));
      return false;
    }
    tabs().markDirty(tab, false);
    persistSession();
    return true;
  }

  async function saveTabAs(tab) {
    const res = await bridge().callAsync('save_dialog', { suggested_name: tab.name });
    if (!res || !res.ok || !res.path) return false;
    tab.path = res.path;
    tab.name = res.path.split('/').pop() || res.path;
    const ok = await saveTab(tab);
    tabs().buildBar();
    return ok;
  }

  /* ------------------------------------------------------------
     Kapatma onayı
     ------------------------------------------------------------ */
  function confirmCloseDialog(tab) {
    return new Promise(function (resolve) {
      $('confirm-text').textContent = t('cf.dirty', tab.name);
      $('confirm-backdrop').classList.remove('hidden');
      const done = (val) => {
        $('confirm-backdrop').classList.add('hidden');
        $('confirm-save').onclick = $('confirm-discard').onclick = $('confirm-cancel').onclick = null;
        resolve(val); // 'save' | 'discard' | 'cancel'
      };
      $('confirm-save').onclick = () => done('save');
      $('confirm-discard').onclick = () => done('discard');
      $('confirm-cancel').onclick = () => done('cancel');
      $('confirm-save').focus();
    });
  }

  function uiConfirmOk(text) {
    return new Promise(function (resolve) {
      $('confirm-text').textContent = text;
      $('confirm-backdrop').classList.remove('hidden');
      $('confirm-discard').style.display = 'none';
      $('confirm-cancel').style.display = 'none';
      $('confirm-save').onclick = () => {
        $('confirm-backdrop').classList.add('hidden');
        $('confirm-discard').style.display = '';
        $('confirm-cancel').style.display = '';
        $('confirm-save').onclick = null;
        resolve();
      };
      $('confirm-save').focus();
    });
  }

  async function requestClose(i) {
    const tab = tabs().list[i];
    if (!tab) return;
    if (tab.dirty) {
      const choice = await confirmCloseDialog(tab);
      if (choice === 'cancel') return;
      if (choice === 'save') {
        const ok = await saveTab(tab);
        if (!ok) return; // kaydetme iptal edildiyse kapatma
      }
    }
    tabs().remove(i);
    if (!tabs().list.length) newTab();
    persistSession();
  }

  /* ------------------------------------------------------------
     Tek satırlık giriş (link/resim adresi)
     ------------------------------------------------------------ */
  function prompt(titleText, placeholder, initial) {
    return new Promise(function (resolve) {
      $('prompt-text').textContent = titleText;
      const input = $('prompt-input');
      input.value = initial || '';
      input.placeholder = placeholder || '';
      $('prompt-backdrop').classList.remove('hidden');
      input.focus();
      const done = (val) => {
        $('prompt-backdrop').classList.add('hidden');
        $('prompt-ok').onclick = $('prompt-cancel').onclick = null;
        input.onkeydown = null;
        resolve(val);
      };
      $('prompt-ok').onclick = () => done(input.value.trim());
      $('prompt-cancel').onclick = () => done(null);
      input.onkeydown = function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); done(input.value.trim()); }
        if (ev.key === 'Escape') { ev.preventDefault(); done(null); }
      };
    });
  }

  /* ------------------------------------------------------------
     Otomatik kaydetme
     ------------------------------------------------------------ */
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    if (!S().autosave) return;
    autosaveTimer = setTimeout(async function () {
      const tab = tabs().current();
      if (tab && tab.path && tab.dirty) {
        const ok = await saveTab(tab);
        if (ok) updateStatus();
      }
    }, Math.max(0.5, +S().autosaveDelay || 2) * 1000);
  }

  /* ------------------------------------------------------------
     Bölünmüş görünüm ayırıcısı
     ------------------------------------------------------------ */
  function applySplitRatio() {
    const clamped = Math.min(0.8, Math.max(0.2, splitRatio));
    $('editor-pane').style.flexBasis = (clamped * 100).toFixed(2) + '%';
  }

  function currentSplitRatio() {
    return splitRatio;
  }

  function initDivider() {
    const divider = $('divider');
    const split = $('split');
    let dragging = false;

    divider.addEventListener('pointerdown', function (ev) {
      dragging = true;
      divider.classList.add('dragging');
      divider.setPointerCapture(ev.pointerId);
      document.body.style.cursor = 'col-resize';
    });
    divider.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      const rect = split.getBoundingClientRect();
      splitRatio = (ev.clientX - rect.left) / rect.width;
      applySplitRatio();
    });
    divider.addEventListener('pointerup', function (ev) {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      divider.releasePointerCapture(ev.pointerId);
      document.body.style.cursor = '';
      VeloMD.settings.update({ splitRatio });
    });
    divider.addEventListener('dblclick', function () {
      splitRatio = 0.5;
      applySplitRatio();
      VeloMD.settings.update({ splitRatio });
    });
  }

  /* ------------------------------------------------------------
     PDF olarak kaydet — daima açık (light) görünümde
     ------------------------------------------------------------ */
  async function exportPdf() {
    const tab = tabs().current();
    const suggested = tab ? tab.name.replace(/\.(md|markdown|txt)$/i, '.pdf') : 'velomd.pdf';
    // PDF her zaman beyaz sayfa olsun: yazdırma bitene kadar light tema
    VeloMD.settings.setPreviewDomTheme('github-light');
    try {
      const res = await bridge().callAsync('export_pdf', { suggested_name: suggested });
      if (res && res.ok && res.path) {
        const st = $('st-save');
        st.textContent = '⤓ PDF: ' + res.path.split('/').pop();
        st.className = 'saved';
        setTimeout(function () { updateStatus(); }, 2500);
      }
    } finally {
      VeloMD.settings.setPreviewDomTheme(null);
    }
  }

  /* ------------------------------------------------------------
     Önizleme görünürlüğü (toolbar düğmesi + ayar)
     ------------------------------------------------------------ */
  function applyPreviewVisibility() {
    const show = S().showPreview !== false;
    const split = document.getElementById('split');
    if (split) split.classList.toggle('no-preview', !show);
    const btn = document.getElementById('btn-preview');
    if (btn) btn.classList.toggle('active', show);
    if (!show && VeloMD.pvSearch && VeloMD.pvSearch.isOpen()) {
      VeloMD.pvSearch.close();
    }
  }

  /* ------------------------------------------------------------
     Kod bloğu dil menüsü
     ------------------------------------------------------------ */
  const FENCE_LANGS = [
    ['', 'none'], ['bash', 'Bash'], ['sh', 'Shell'], ['python', 'Python'],
    ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['php', 'PHP'],
    ['c', 'C'], ['cpp', 'C++'], ['csharp', 'C#'], ['java', 'Java'],
    ['go', 'Go'], ['rust', 'Rust'], ['html', 'HTML'], ['css', 'CSS'],
    ['json', 'JSON'], ['yaml', 'YAML'], ['xml', 'XML'], ['sql', 'SQL'], ['diff', 'Diff'],
  ];

  function buildFenceMenu() {
    const menu = $('lang-menu');
    menu.innerHTML = '';
    FENCE_LANGS.forEach(function (entry) {
      const code = entry[0], key = entry[1];
      const item = document.createElement('div');
      item.className = 'lang-item';
      const label = document.createElement('span');
      label.textContent = code === '' ? t('lang.none') : key;
      const tag = document.createElement('span');
      tag.className = 'lang-code';
      tag.textContent = '```' + code;
      item.appendChild(label);
      item.appendChild(tag);
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        menu.classList.add('hidden');
        editor().fenceBlock(code);
      });
      menu.appendChild(item);
    });
  }

  function initFenceMenu() {
    buildFenceMenu();
    const menu = $('lang-menu');
    const btn = $('btn-fence');
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (ev) {
      if (!menu.classList.contains('hidden') &&
          !$('fence-wrap').contains(ev.target)) {
        menu.classList.add('hidden');
      }
    });
  }

  /* ------------------------------------------------------------
     Ayar ekranı
     ------------------------------------------------------------ */
  function setI18nLabel(el, val) {
    if (!el) return;
    el.dataset.i18nArg = val;
    el.textContent = t(el.dataset.i18n, val);
  }

  function sizeLabelOf(input) {
    const field = input.closest('.field');
    return field ? field.querySelector('[data-i18n]') : null;
  }

  function buildThemeGrid() {
    const grid = $('theme-grid');
    grid.innerHTML = '';
    const dark = VeloMD.settings.uiDark();
    VeloMD.settings.THEMES.forEach(function (th) {
      const pal = (th.auto && !dark) ? (th.light || th.dark) : th.dark;
      const card = document.createElement('div');
      card.className = 'theme-card' + (S().previewTheme === th.id ? ' selected' : '');
      card.title = th.name;
      card.innerHTML =
        '<div class="theme-swatch" style="background:' + pal.bg + '">' +
        '<span class="sw-title" style="background:' + pal.title + '"></span>' +
        '<span class="sw-line" style="background:' + pal.fg + ';opacity:.55"></span>' +
        '<span class="sw-code" style="background:' + pal.code + '"></span>' +
        '</div><div class="theme-name">' + th.name + '</div>';
      card.addEventListener('click', function () {
        VeloMD.settings.update({ previewTheme: th.id });
        grid.querySelectorAll('.theme-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
      });
      grid.appendChild(card);
    });
  }

  function buildFontList(kind) {
    const listEl = $(kind === 'mono' ? 'ed-font-list' : 'pv-font-list');
    const searchEl = $(kind === 'mono' ? 'ed-font-search' : 'pv-font-search');
    const current = kind === 'mono' ? S().editorFont : S().previewFont;
    const query = searchEl.value.trim().toLowerCase();
    listEl.innerHTML = '';
    const fonts = (kind === 'mono' ? VeloMD.settings.state.fonts.mono
                                  : VeloMD.settings.state.fonts.all) || [];
    const shown = fonts.filter(function (f) { return !query || f.toLowerCase().indexOf(query) >= 0; });
    if (!shown.length) {
      const empty = document.createElement('div');
      empty.className = 'font-empty';
      empty.textContent = t('set.noFonts');
      listEl.appendChild(empty);
      return;
    }
    let firstSelected = null;
    shown.forEach(function (f) {
      const item = document.createElement('div');
      item.className = 'font-item' + (f === current ? ' selected' : '');
      item.dataset.font = f;
      const sample = document.createElement('div');
      sample.className = 'font-sample';
      sample.style.fontFamily = VeloMD.settings.cssFont(f);
      sample.textContent = 'VeloMD — Markdown {code} 123';
      const name = document.createElement('div');
      name.className = 'font-name';
      name.textContent = f;
      item.appendChild(sample);
      item.appendChild(name);
      item.addEventListener('click', function () {
        if (kind === 'mono') VeloMD.settings.update({ editorFont: f });
        else VeloMD.settings.update({ previewFont: f });
        listEl.querySelectorAll('.font-item').forEach(function (x) { x.classList.remove('selected'); });
        item.classList.add('selected');
      });
      listEl.appendChild(item);
      if (f === current) firstSelected = item;
    });
    if (firstSelected) firstSelected.scrollIntoView({ block: 'nearest' });
  }

  function initSettingsUi() {
    $('btn-settings').addEventListener('click', openSettings);
    $('settings-close').addEventListener('click', closeSettings);
    $('settings-backdrop').addEventListener('pointerdown', function (ev) {
      if (ev.target === $('settings-backdrop')) closeSettings();
    });

    $('opt-uitheme').addEventListener('change', function () {
      VeloMD.settings.update({ uiTheme: this.value });
      buildThemeGrid(); // swatch'lar light/duruma göre değişir
    });
    $('opt-language').addEventListener('change', function () {
      VeloMD.settings.update({ language: this.value });
    });

    $('ed-font-search').addEventListener('input', function () { buildFontList('mono'); });
    $('pv-font-search').addEventListener('input', function () { buildFontList('all'); });

    $('ed-font-size').addEventListener('input', function () {
      VeloMD.settings.update({ editorFontSize: +this.value });
      setI18nLabel(sizeLabelOf(this), this.value);
    });
    $('pv-font-size').addEventListener('input', function () {
      VeloMD.settings.update({ previewFontSize: +this.value });
      setI18nLabel(sizeLabelOf(this), this.value);
    });
    $('opt-linenumbers').addEventListener('change', function () {
      VeloMD.settings.update({ lineNumbers: this.checked });
    });
    $('opt-wordwrap').addEventListener('change', function () {
      VeloMD.settings.update({ wordWrap: this.checked });
    });
    $('opt-showpreview').addEventListener('change', function () {
      VeloMD.settings.update({ showPreview: this.checked });
    });
    $('opt-syncscroll').addEventListener('change', function () {
      VeloMD.settings.update({ syncScroll: this.checked });
    });
    $('opt-autosave').addEventListener('change', function () {
      VeloMD.settings.update({ autosave: this.checked });
    });
    $('opt-autosave-delay').addEventListener('input', function () {
      VeloMD.settings.update({ autosaveDelay: +this.value });
      setI18nLabel(sizeLabelOf(this), this.value);
    });
  }

  async function openSettings() {
    syncSettingsControls();
    $('settings-backdrop').classList.remove('hidden');
    await VeloMD.settings.loadFonts('mono');
    await VeloMD.settings.loadFonts('all');
    buildFontList('mono');
    buildFontList('all');
    buildThemeGrid();
  }

  function closeSettings() {
    $('settings-backdrop').classList.add('hidden');
  }

  function syncSettingsControls() {
    const s = S();
    $('ed-font-search').value = '';
    $('pv-font-search').value = '';
    $('opt-uitheme').value = s.uiTheme || 'system';
    $('opt-language').value = s.language || 'system';
    $('ed-font-size').value = s.editorFontSize;
    setI18nLabel(sizeLabelOf($('ed-font-size')), s.editorFontSize);
    $('pv-font-size').value = s.previewFontSize;
    setI18nLabel(sizeLabelOf($('pv-font-size')), s.previewFontSize);
    $('opt-linenumbers').checked = !!s.lineNumbers;
    $('opt-wordwrap').checked = !!s.wordWrap;
    $('opt-showpreview').checked = S().showPreview !== false;
    $('opt-syncscroll').checked = !!s.syncScroll;
    $('opt-autosave').checked = !!s.autosave;
    $('opt-autosave-delay').value = s.autosaveDelay;
    setI18nLabel(sizeLabelOf($('opt-autosave-delay')), s.autosaveDelay);
    buildThemeGrid();
  }

  /* ------------------------------------------------------------
     Kısayollar
     ------------------------------------------------------------ */
  function initKeys() {
    document.addEventListener('keydown', function (ev) {
      const mod = ev.ctrlKey || ev.metaKey;

      if (ev.key === 'Escape') {
        if (VeloMD.edSearch && VeloMD.edSearch.isOpen()) {
          VeloMD.edSearch.close();
          return;
        }
        if (VeloMD.pvSearch && VeloMD.pvSearch.isOpen()) {
          VeloMD.pvSearch.close();
          return;
        }
        if (!$('lang-menu').classList.contains('hidden')) {
          $('lang-menu').classList.add('hidden');
          return;
        }
        if (!$('settings-backdrop').classList.contains('hidden')) { closeSettings(); return; }
        if (!$('prompt-backdrop').classList.contains('hidden')) return; // prompt kendi yakalar
        if (!$('confirm-backdrop').classList.contains('hidden')) return;
        return;
      }
      if (!mod) return;

      const k = ev.key.toLowerCase();
      // odak CodeMirror'daysa editör araması, değilse önizleme araması
      const inEditor = !!(ev.target && ev.target.closest &&
                          ev.target.closest('.CodeMirror'));
      if (ev.key === 'F3') {
        ev.preventDefault();
        if (inEditor) {
          if (VeloMD.edSearch.isOpen()) {
            if (ev.shiftKey) VeloMD.edSearch.prev();
            else VeloMD.edSearch.next();
          } else {
            VeloMD.edSearch.open();
          }
        } else if (S().showPreview !== false && VeloMD.pvSearch) {
          if (VeloMD.pvSearch.isOpen()) {
            if (ev.shiftKey) VeloMD.pvSearch.prev();
            else VeloMD.pvSearch.next();
          } else {
            VeloMD.pvSearch.open();
          }
        }
      } else if (k === 'f' && !ev.shiftKey) {
        ev.preventDefault();
        if (VeloMD.edSearch && VeloMD.edSearch.isOpen()) VeloMD.edSearch.open();
        else if (inEditor) VeloMD.edSearch.open();
        else if (S().showPreview !== false && VeloMD.pvSearch) VeloMD.pvSearch.open();
      } else if (k === 'f' && ev.shiftKey) {
        ev.preventDefault();
        VeloMD.edSearch.open({ focusReplace: true });
      } else if (k === 'p') {
        ev.preventDefault();
        exportPdf();
      } else if (k === 's' && ev.shiftKey) { ev.preventDefault(); saveTabAs(tabs().current()); }
      else if (k === 's') { ev.preventDefault(); saveTab(tabs().current()); }
      else if (k === 'o') { ev.preventDefault(); openFile(); }
      else if (k === 't' || k === 'n') { ev.preventDefault(); newTab(); }
      else if (k === 'w') { ev.preventDefault(); requestClose(tabs().active); }
      else if (ev.key === ',') { ev.preventDefault(); openSettings(); }
      else if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoom(1); }
      else if (ev.key === '-') { ev.preventDefault(); zoom(-1); }
      else if (ev.key === '0') { ev.preventDefault(); zoom(0); }
    });
  }

  function zoom(dir) {
    const s = S();
    if (dir === 0) {
      VeloMD.settings.update({
        editorFontSize: VeloMD.settings.DEFAULTS.editorFontSize,
        previewFontSize: VeloMD.settings.DEFAULTS.previewFontSize,
      });
    } else {
      VeloMD.settings.update({
        editorFontSize: Math.min(24, Math.max(10, s.editorFontSize + dir)),
        previewFontSize: Math.min(28, Math.max(11, s.previewFontSize + dir)),
      });
    }
    setI18nLabel(sizeLabelOf($('ed-font-size')), S().editorFontSize);
    setI18nLabel(sizeLabelOf($('pv-font-size')), S().previewFontSize);
  }

  /* ------------------------------------------------------------
     Kapanış akışı
     ------------------------------------------------------------ */
  window.__prepareQuit = function () {
    bridge().call('save_session', { session: buildSession() }).then(function () {
      bridge().call('ready_to_quit');
    });
  };

  /* ------------------------------------------------------------
     Başlangıç
     ------------------------------------------------------------ */
  function newTab() {
    tabs().create(null, '', false);
    cm.focus();
    persistSession();
  }

  function onTabsChanged() {
    updateStatus();
    renderPreview();
    clearTimeout(autosaveTimer);
    if (VeloMD.edSearch) VeloMD.edSearch.onDocChanged();
  }

  function onLangChanged() {
    updateStatus();
    buildFenceMenu();
    tabs().buildBar();
    if (!$('settings-backdrop').classList.contains('hidden')) {
      syncSettingsControls();
    }
  }

  async function start(clarg, session) {
    // sistem dili + sistem teması (ilk açılış "Sistem" seçenekleri için)
    const loc = await bridge().call('get_locale');
    if (loc && loc.ok) VeloMD.settings.state.systemLang = loc.locale || 'en';
    await VeloMD.settings.loadSystemTheme();

    await VeloMD.settings.load();

    VeloMD.preview.init();
    cm = VeloMD.editor.init();
    VeloMD.settings.watchSystemTheme();

    splitRatio = Math.min(0.8, Math.max(0.2, +S().splitRatio || 0.5));
    applySplitRatio();
    initDivider();

    cm.on('change', function () {
      const tab = tabs().current();
      if (tab && !tab.dirty) tabs().markDirty(tab, true);
      scheduleRender();
      updateStatus();
      scheduleAutosave();
      if (VeloMD.edSearch) VeloMD.edSearch.onChange();
    });
    cm.on('cursorActivity', function () {
      updateStatus();
    });

    VeloMD.sync.init();

    // sekmeler
    await restoreSession(session);
    if (clarg) {
      const idx = tabs().findPath(clarg);
      if (idx >= 0) tabs().activate(idx);
      else await openPath(clarg);
    }

    // UI olayları
    $('tab-new').addEventListener('click', newTab);
    $('btn-open').addEventListener('click', openFile);
    $('btn-save').addEventListener('click', function () { saveTab(tabs().current()); });
    $('btn-preview').addEventListener('click', function () {
      VeloMD.settings.update({ showPreview: S().showPreview === false });
    });
    // önizlemede bir bloğa tıklayınca editörde karşılığına git + vurgula
    // (odak önizlemede kalır: Ctrl+F hâlâ önizleme aramasını açar)
    $('preview-pane').addEventListener('click', function (ev) {
      if (ev.target.closest('a')) return; // bağlantılar tarayıcıya gider
      const block = ev.target.closest('[data-source-line]');
      if (!block) return;
      const line = Math.max(0, parseInt(block.dataset.sourceLine, 10) || 0);
      cm.setCursor({ line: line, ch: 0 });
      if (VeloMD.sync) VeloMD.sync.suppress(600);
      cm.scrollIntoView({ line: line, ch: 0 }, 40);
    });
    // PDF olarak kaydet (düğme + Ctrl+P)
    $('btn-pdf').addEventListener('click', exportPdf);
    document.querySelectorAll('.tb-btn[data-md]').forEach(function (btn) {
      btn.addEventListener('click', function () { editor().applyAction(btn.dataset.md); });
    });
    initFenceMenu();
    initSettingsUi();
    initKeys();
    VeloMD.pvSearch.init();
    VeloMD.edSearch.init(cm);

    updateStatus();
    renderPreview();
    cm.focus();
  }

  // Python tarafı sayfa yüklenince çağırır
  window.__velomdReady = function (clarg, session) {
    start(clarg || null, session || null).catch(function (err) {
      console.error('VeloMD başlatma hatası:', err);
    });
  };

  // çalışan örneğe gelen "velomd dosya.md" çağrısı
  window.__openPathRemote = function (path) {
    if (!path) return;
    openPath(path);
  };

  window.VeloMD = window.VeloMD || {};
  VeloMD.app = {
    requestClose,
    prompt,
    currentSplitRatio,
    onTabsChanged,
    onLangChanged,
    applyPreviewVisibility,
  };
})();
