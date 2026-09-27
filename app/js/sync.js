/* VeloMD sync — editör↔önizleme çift yönlü kaydırma eşitleme ve
   imleç satırının önizleme karşılığını vurgulama.
   Kaynak satır haritası preview.js'in data-source-line /
   data-source-end öznitelikleriyle kurulur. Kısa süreli bir kilit
   (guard) geri besleme döngüsünü engeller. */
(function () {
  'use strict';

  let cm = null;
  let pane = null;
  let frame = null;          // rAF kuyruğu
  let lastHighlight = null;  // son vurgulanan element
  let guardUntil = 0;        // döngü koruması (ms)
  const GUARD_MS = 150;

  function syncEnabled() {
    return VeloMD.settings.state.settings.syncScroll !== false;
  }

  function blocks() {
    return pane.querySelectorAll('[data-source-line]');
  }

  function blockForLine(line) {
    const list = blocks();
    for (let i = 0; i < list.length; i++) {
      const a = +list[i].dataset.sourceLine;
      const b = +list[i].dataset.sourceEnd;
      if (line >= a && line < b) return list[i];
      if (a > line) break;
    }
    return null;
  }

  function narrowestBlockForLine(line) {
    const list = blocks();
    let best = null;
    let bestSpan = Infinity;
    for (let i = 0; i < list.length; i++) {
      const a = +list[i].dataset.sourceLine;
      const b = +list[i].dataset.sourceEnd;
      if (line >= a && line < b && b - a < bestSpan) {
        best = list[i];
        bestSpan = b - a;
      }
      if (a > line && best) break;
    }
    return best;
  }

  /* elemanın kaydırma bölmesindeki mutlak üst konumu */
  function relTop(el) {
    return el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
  }

  /* ---- editör kaydırması → önizleme -------------------------------- */

  function syncScrollToPreview() {
    const info = cm.getScrollInfo();
    if (info.top <= 0) { pane.scrollTop = 0; return; }
    if (info.top + info.clientHeight >= info.height - 2) {
      pane.scrollTop = pane.scrollHeight;
      return;
    }

    const topLine = cm.coordsChar({ left: 8, top: info.top + 4 }, 'local').line;
    const el = blockForLine(topLine);
    if (!el) return;

    const a = +el.dataset.sourceLine;
    const b = +el.dataset.sourceEnd;
    const frac = Math.min(1, Math.max(0, (topLine - a) / Math.max(1, b - a - 1)));
    pane.scrollTop = relTop(el) - 22 + frac * el.offsetHeight; // 22px üst dolgu
  }

  /* ---- önizleme kaydırması → editör -------------------------------- */

  function syncScrollToEditor() {
    if (pane.scrollTop <= 0) { cm.scrollTo(null, 0); return; }
    if (pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2) {
      cm.scrollTo(null, cm.getScrollInfo().height);
      return;
    }

    const list = blocks();
    let el = null;
    for (let i = 0; i < list.length; i++) {
      if (relTop(list[i]) + list[i].offsetHeight > pane.scrollTop + 4) { el = list[i]; break; }
    }
    if (!el) return;

    const a = +el.dataset.sourceLine;
    const b = +el.dataset.sourceEnd;
    const frac = Math.min(1, Math.max(0, (pane.scrollTop + 22 - relTop(el)) / Math.max(1, el.offsetHeight)));
    const line = Math.max(a, Math.min(b - 1, Math.round(a + frac * (b - a - 1))));
    const y = cm.charCoords({ line: line, ch: 0 }, 'local').top;
    cm.scrollTo(null, Math.max(0, y - 8));
  }

  let pendingDir = null;
  function requestScroll(dir) {
    if (frame && pendingDir === dir) return;
    pendingDir = dir;
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = null;
      const dir = pendingDir;
      pendingDir = null;
      if (dir === 'to-preview') syncScrollToPreview();
      else if (dir === 'to-editor') syncScrollToEditor();
    });
  }

  /* ---- imleç satırı → önizleme vurgusu ------------------------------ */

  function highlightCursorBlock() {
    const line = cm.getCursor().line;
    const el = narrowestBlockForLine(line);
    if (el === lastHighlight) return;
    if (lastHighlight) lastHighlight.classList.remove('sync-source-highlight');
    lastHighlight = el;
    if (el) el.classList.add('sync-source-highlight');
  }

  function resetHighlight() {
    if (lastHighlight) lastHighlight.classList.remove('sync-source-highlight');
    lastHighlight = null;
  }

  /* arama/geçici kaydırmaların scroll-sync'i tetiklemesini engelle */
  function suppress(ms) {
    guardUntil = Math.max(guardUntil, Date.now() + ms);
  }

  function init() {
    cm = VeloMD.editor.cm;
    pane = document.getElementById('preview-pane');

    cm.on('scroll', function () {
      if (!syncEnabled() || Date.now() < guardUntil) return;
      guardUntil = Date.now() + GUARD_MS;
      requestScroll('to-preview');
    });
    pane.addEventListener('scroll', function () {
      if (!syncEnabled() || Date.now() < guardUntil) return;
      guardUntil = Date.now() + GUARD_MS;
      requestScroll('to-editor');
    });

    cm.on('cursorActivity', function () {
      requestScroll('to-preview');
      highlightCursorBlock();
    });
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.sync = { init, resetHighlight, refresh: highlightCursorBlock, suppress };
})();
