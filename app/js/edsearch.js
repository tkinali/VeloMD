/* VeloMD edSearch — editör içinde bul/değiştir.
   CodeMirror SearchCursor altyapısı + uygulamanın kendi arayüzü
   (tam i18n). Eşleşmeler .cm-searching, aktif eşleşme
   .velomd-activematch sınıfıyla vurgulanır. */
(function () {
  'use strict';

  let cm = null;
  let overlay = null;
  let queryRe = null;
  let term = '';
  let matches = [];       // {from, to} konumları; her değişimde yeniden hesaplanır
  let activeIdx = -1;
  let activeMark = null;
  let debounceTimer = null;

  const bar = () => document.getElementById('ed-search');
  const findInput = () => document.getElementById('ed-find-input');
  const repInput = () => document.getElementById('ed-replace-input');
  const counter = () => document.getElementById('ed-find-count');

  function isOpen() {
    return !bar().classList.contains('hidden');
  }

  function buildRe(t) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'gi'); // büyük/küçük harf duyarsız
  }

  function searchOverlay() {
    return {
      token: function (stream) {
        queryRe.lastIndex = stream.pos;
        const match = queryRe.exec(stream.string);
        if (match && match.index === stream.pos) {
          stream.pos += match[0].length || 1;
          return 'searching';
        } else if (match) {
          stream.pos = match.index;
        } else {
          stream.skipToEnd();
        }
      },
    };
  }

  function clearAll() {
    if (overlay) { cm.removeOverlay(overlay); overlay = null; }
    if (activeMark) { activeMark.clear(); activeMark = null; }
    matches = [];
    activeIdx = -1;
    counter().textContent = '0/0';
    findInput().classList.remove('no-results');
  }

  function recompute() {
    if (activeMark) { activeMark.clear(); activeMark = null; }
    if (overlay) { cm.removeOverlay(overlay); overlay = null; }
    matches = [];
    if (term) {
      queryRe = buildRe(term);
      const cur = cm.getSearchCursor(queryRe, null, { caseFold: true });
      while (cur.findNext()) {
        matches.push({ from: cur.from(), to: cur.to() });
      }
      if (matches.length) {
        overlay = searchOverlay();
        cm.addOverlay(overlay);
      }
    } else {
      queryRe = null;
    }
    counter().textContent = matches.length
      ? Math.min(activeIdx + 1, matches.length) + '/' + matches.length
      : '0/0';
    findInput().classList.toggle('no-results', !!term && !matches.length);
    if (matches.length) {
      if (activeIdx < 0 || activeIdx >= matches.length) activeIdx = 0;
      markActive(false);
    }
  }

  function markActive(scroll) {
    if (activeMark) { activeMark.clear(); activeMark = null; }
    const m = matches[activeIdx];
    if (!m) return;
    activeMark = cm.markText(m.from, m.to, { className: 'velomd-activematch' });
    counter().textContent = (activeIdx + 1) + '/' + matches.length;
    if (scroll !== false) {
      if (VeloMD.sync && VeloMD.sync.suppress) VeloMD.sync.suppress(600);
      cm.scrollIntoView({ from: m.from, to: m.to }, 60);
    }
  }

  function next() {
    if (!matches.length) return;
    activeIdx = (activeIdx + 1) % matches.length;
    markActive(true);
  }

  function prev() {
    if (!matches.length) return;
    activeIdx = (activeIdx - 1 + matches.length) % matches.length;
    markActive(true);
  }

  /* ---- değiştir ----------------------------------------------------- */

  function replaceOne() {
    const m = matches[activeIdx];
    if (!m) return;
    cm.replaceRange(repInput().value, m.from, m.to);
    recompute(); // matches tazelendi; aynı sıradaki (bir sonraki) eşleşme aktif olur
    if (matches.length) markActive(true);
  }

  function replaceAll() {
    if (!term || !queryRe) return;
    const replacement = repInput().value;
    cm.operation(function () {
      const cur = cm.getSearchCursor(queryRe, null, { caseFold: true });
      while (cur.findNext()) cur.replace(replacement);
    });
    recompute();
  }

  /* ---- çubuk -------------------------------------------------------- */

  function open(opts) {
    bar().classList.remove('hidden');
    if (!findInput().value) {
      const sel = cm.getSelection ? cm.getSelection() : '';
      if (sel && sel.indexOf('\n') === -1) findInput().value = sel;
    }
    if (opts && opts.focusReplace) {
      repInput().focus();
    } else {
      findInput().focus();
      findInput().select();
    }
    if (findInput().value && findInput().value !== term) {
      term = findInput().value;
      recompute();
    }
  }

  function close() {
    bar().classList.add('hidden');
    term = '';
    clearAll();
    if (cm) cm.focus();
  }

  /* editör içeriği değiştiyse (yazma, değiştir) listeyi tazele */
  function onChange() {
    if (!isOpen()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recompute, 250);
  }

  /* sekme değiştiyse konumlar geçersizdir */
  function onDocChanged() {
    if (!isOpen()) return;
    activeIdx = -1;
    recompute();
  }

  function init(editorCm) {
    cm = editorCm;
    findInput().addEventListener('input', function () {
      term = this.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        activeIdx = -1;
        recompute();
        if (matches.length) { activeIdx = 0; markActive(true); }
      }, 220);
    });
    findInput().addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (ev.shiftKey) prev(); else next();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });
    repInput().addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (ev.ctrlKey) replaceAll();
        else replaceOne();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });
    document.getElementById('ed-find-prev').addEventListener('click', prev);
    document.getElementById('ed-find-next').addEventListener('click', next);
    document.getElementById('ed-search-close').addEventListener('click', close);
    document.getElementById('ed-replace-one').addEventListener('click', replaceOne);
    document.getElementById('ed-replace-all').addEventListener('click', replaceAll);
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.edSearch = { init, open, close, isOpen, next, prev, onChange, onDocChanged };
})();
