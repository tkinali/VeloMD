/* VeloMD i18n — Türkçe / İngilizce arayüz metinleri.
   data-i18n (metin), data-i18n-title (araç ipucu) ve
   data-i18n-ph (yer tutucu) öznitelikli elemanlar statik olarak
   çevrilir; dinamik metinler t() ile alınır. */
(function () {
  'use strict';

  const M = {
    tr: {
      'menu.newTab': 'Yeni sekme (Ctrl+T)',
      'menu.open': 'Dosya aç (Ctrl+O)',
      'menu.save': 'Kaydet (Ctrl+S)',
      'menu.settings': 'Ayarlar (Ctrl+,)',
      'menu.about': 'Hakkında',

      'about.desc': 'Linux için hafif, bölünmüş önizlemeli Markdown editörü — sekmeler, bul/değiştir, iki dilli arayüz.',
      'about.developer': 'Geliştiren',
      'about.ai': 'Yapay zekâ katkısı',
      'about.license': 'MIT lisansı · GTK4 + WebKit2GTK ile yapıldı',
      'divider.hint': 'Bölümü sürükleyerek ayarla · çift tık: eşit böl',

      'tb.bold': 'Kalın (Ctrl+B)',
      'tb.italic': 'İtalik (Ctrl+I)',
      'tb.strike': 'Üstü çizili',
      'tb.code': 'Satır içi kod',
      'tb.h1': '1. başlık', 'tb.h2': '2. başlık', 'tb.h3': '3. başlık',
      'tb.h4': '4. başlık', 'tb.h5': '5. başlık',
      'tb.quote': 'Alıntı',
      'tb.ul': 'Madde listesi',
      'tb.ol': 'Numaralı liste',
      'tb.fence': 'Kod bloğu (dil seç)',
      'tb.link': 'Bağlantı (Ctrl+K)',
      'tb.image': 'Resim',
      'tb.hr': 'Yatay çizgi',
      'tb.preview': 'Önizlemeyi göster/gizle',
      'tb.pdf': 'Önizlemeyi PDF olarak kaydet',
      'lang.none': 'Dilsiz',

      'st.cursor': 'Satır %s, Sütun %s',
      'st.counts': '%s kelime · %s karakter',
      'st.selected': ' · %s seçili',
      'st.newFile': 'Yeni dosya',
      'st.noFile': 'Dosya açık değil',
      'st.unsavedSuffix': ' (kaydedilmedi)',
      'st.saved': '✓ Kaydedildi',
      'st.unsaved': '● Kaydedilmedi',

      'tab.close': 'Kapat (Ctrl+W)',
      'tab.unsaved': ' (kaydedilmedi)',
      'tab.untitled': 'adsız',

      'set.title': 'Ayarlar',
      'set.close': 'Kapat (Esc)',
      'set.general': 'Genel',
      'set.uiTheme': 'Uygulama teması',
      'set.themeSystem': 'Sistem',
      'set.themeLight': 'Açık',
      'set.themeDark': 'Koyu',
      'set.language': 'Dil',
      'set.langSystem': 'Sistem dili',
      'set.editor': 'Editör',
      'set.editorFont': 'Font (yalnızca monospace)',
      'set.previewFont': 'Font (sistemdeki tüm fontlar)',
      'set.fontSearch': 'Font ara…',
      'set.fontSize': 'Font boyutu %s px',
      'set.lineNumbers': 'Satır numaraları',
      'set.wordWrap': 'Uzun satırları kaydır',
      'set.preview': 'Önizleme',
      'set.theme': 'Tema',
      'set.syncScroll': 'Editör ile eşzamanlı kaydırma',
      'set.showPreview': 'Önizlemeyi göster',
      'set.saving': 'Kaydetme',
      'set.autosave': 'Otomatik kaydet',
      'set.autosaveDelay': 'Yazmayı bıraktıktan %s sn sonra kaydet',
      'set.noFonts': 'Eşleşen font yok',

      'cf.dirty': '"%s" içinde kaydedilmemiş değişiklikler var. Nasıl devam edilsin?',
      'cf.save': 'Kaydet',
      'cf.discard': 'Kaydetmeden kapat',
      'cf.cancel': 'İptal',
      'cf.ok': 'Tamam',
      'cf.cannotRead': 'Dosya okunamadı: %s',
      'cf.cannotWrite': 'Kaydedilemedi: %s',

      'pr.linkTitle': 'Bağlantı adresi',
      'pr.imageTitle': 'Resim adresi',
      'pr.linkPh': 'https://…',
      'pr.imagePh': 'resim/yolu.png',

      'pv.searchPh': 'Önizlemede ara…',
      'pv.prev': 'Önceki (Shift+Enter)',
      'pv.next': 'Sonraki (Enter)',
      'pv.close': 'Kapat (Esc)',

      'ed.findLabel': 'Bul',
      'ed.replaceLabel': 'Değiştir',
      'ed.findPh': 'Ara…',
      'ed.replacePh': 'yeni metin',
      'ed.replaceOne': 'Değiştir',
      'ed.replaceAll': 'Tümünü değiştir',

      'ed.text': 'metin',
      'ed.boldText': 'kalın metin',
      'ed.italicText': 'italik metin',
      'ed.strikeText': 'üstü çizili',
      'ed.codeText': 'kod',
      'ed.linkText': 'bağlantı metni',
      'ed.welcome': '# VeloMD\n\nMarkdown buraya yaz…\n',
    },
    en: {
      'menu.newTab': 'New tab (Ctrl+T)',
      'menu.open': 'Open file (Ctrl+O)',
      'menu.save': 'Save (Ctrl+S)',
      'menu.settings': 'Settings (Ctrl+,)',
      'menu.about': 'About',

      'about.desc': 'A featherweight Markdown editor for Linux — tabs, find & replace, bilingual UI.',
      'about.developer': 'Developed by',
      'about.ai': 'AI-assisted by',
      'about.license': 'MIT license · built on GTK4 + WebKit2GTK',
      'divider.hint': 'Drag to resize · double-click: split evenly',

      'tb.bold': 'Bold (Ctrl+B)',
      'tb.italic': 'Italic (Ctrl+I)',
      'tb.strike': 'Strikethrough',
      'tb.code': 'Inline code',
      'tb.h1': 'Heading 1', 'tb.h2': 'Heading 2', 'tb.h3': 'Heading 3',
      'tb.h4': 'Heading 4', 'tb.h5': 'Heading 5',
      'tb.quote': 'Blockquote',
      'tb.ul': 'Bullet list',
      'tb.ol': 'Numbered list',
      'tb.fence': 'Code block (pick language)',
      'tb.link': 'Link (Ctrl+K)',
      'tb.image': 'Image',
      'tb.hr': 'Horizontal rule',
      'tb.preview': 'Toggle preview',
      'tb.pdf': 'Save preview as PDF',
      'lang.none': 'Plain',

      'st.cursor': 'Line %s, Column %s',
      'st.counts': '%s words · %s chars',
      'st.selected': ' · %s selected',
      'st.newFile': 'New file',
      'st.noFile': 'No file open',
      'st.unsavedSuffix': ' (unsaved)',
      'st.saved': '✓ Saved',
      'st.unsaved': '● Unsaved',

      'tab.close': 'Close (Ctrl+W)',
      'tab.unsaved': ' (unsaved)',
      'tab.untitled': 'untitled',

      'set.title': 'Settings',
      'set.close': 'Close (Esc)',
      'set.general': 'General',
      'set.uiTheme': 'App theme',
      'set.themeSystem': 'System',
      'set.themeLight': 'Light',
      'set.themeDark': 'Dark',
      'set.language': 'Language',
      'set.langSystem': 'System language',
      'set.editor': 'Editor',
      'set.editorFont': 'Font (monospace only)',
      'set.previewFont': 'Font (all system fonts)',
      'set.fontSearch': 'Search fonts…',
      'set.fontSize': 'Font size %s px',
      'set.lineNumbers': 'Line numbers',
      'set.wordWrap': 'Wrap long lines',
      'set.preview': 'Preview',
      'set.theme': 'Theme',
      'set.syncScroll': 'Sync scroll with editor',
      'set.showPreview': 'Show preview',
      'set.saving': 'Saving',
      'set.autosave': 'Autosave',
      'set.autosaveDelay': 'Save %s s after you stop typing',
      'set.noFonts': 'No matching fonts',

      'cf.dirty': '"%s" has unsaved changes. How do you want to proceed?',
      'cf.save': 'Save',
      'cf.discard': 'Close without saving',
      'cf.cancel': 'Cancel',
      'cf.ok': 'OK',
      'cf.cannotRead': 'Could not read file: %s',
      'cf.cannotWrite': 'Could not save: %s',

      'pr.linkTitle': 'Link URL',
      'pr.imageTitle': 'Image URL',
      'pr.linkPh': 'https://…',
      'pr.imagePh': 'image/path.png',

      'pv.searchPh': 'Find in preview…',
      'pv.prev': 'Previous (Shift+Enter)',
      'pv.next': 'Next (Enter)',
      'pv.close': 'Close (Esc)',

      'ed.findLabel': 'Find',
      'ed.replaceLabel': 'Replace',
      'ed.findPh': 'Find…',
      'ed.replacePh': 'new text',
      'ed.replaceOne': 'Replace',
      'ed.replaceAll': 'Replace all',

      'ed.text': 'text',
      'ed.boldText': 'bold text',
      'ed.italicText': 'italic text',
      'ed.strikeText': 'strikethrough',
      'ed.codeText': 'code',
      'ed.linkText': 'link text',
      'ed.welcome': '# VeloMD\n\nStart typing Markdown…\n',
    },
  };

  let lang = 'tr';

  function t(key) {
    let str = (M[lang] && M[lang][key] !== undefined)
      ? M[lang][key]
      : (M.en[key] !== undefined ? M.en[key] : key);
    if (arguments.length > 1) {
      const args = Array.prototype.slice.call(arguments, 1);
      let i = 0;
      str = str.replace(/%s/g, function () { return args[i++] !== undefined ? args[i - 1] : ''; });
    }
    return str;
  }

  function applyStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.dataset.i18nArg !== undefined) {
        el.textContent = t(el.dataset.i18n, el.dataset.i18nArg);
      } else {
        el.textContent = t(el.dataset.i18n);
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.dataset.i18nPh);
    });
  }

  function setLang(l) {
    if (!M[l]) l = 'en';
    lang = l;
    applyStatic();
    if (window.VeloMD && VeloMD.app && VeloMD.app.onLangChanged) {
      VeloMD.app.onLangChanged();
    }
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.i18n = {
    t,
    setLang,
    applyStatic,
    get lang() { return lang; },
  };
})();
