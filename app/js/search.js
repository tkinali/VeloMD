/* VeloMD pvSearch — önizleme içinde Ctrl+F araması.
   Eşleşmeler span.pv-hit ile sarılır (aktif olan .active), Enter ile
   ilerlenir. Önizleme yeniden render edilince arama yeniden uygulanır. */
(function () {
  'use strict';

  let marks = [];
  let activeIdx = -1;
  let term = '';
  let debounceTimer = null;

  const bar = () => document.getElementById('pv-search');
  const input = () => document.getElementById('pv-search-input');
  const counter = () => document.getElementById('pv-search-count');
  const preview = () => document.getElementById('preview');

  function isOpen() {
    return !bar().classList.contains('hidden');
  }

  /* ---- işaretleme -------------------------------------------------- */

  function clearMarks() {
    preview().querySelectorAll('span.pv-hit').forEach(function (el) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      parent.normalize();
    });
    marks = [];
    activeIdx = -1;
  }

  function wrapRange(node, start, end) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const span = document.createElement('span');
    span.className = 'pv-hit';
    try {
      range.surroundContents(span);
      return span;
    } catch (err) {
      return null;
    }
  }

  function searchAll(t) {
    clearMarks();
    if (!t || t.length < 1) {
      updateCounter();
      return;
    }
    // metin düğümlerini önce statik olarak topla (sarma sırasında ağaç değişir)
    const nodes = [];
    const walker = document.createTreeWalker(preview(), NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      if (node.parentElement.closest('script, style, span.pv-hit')) continue;
      nodes.push(node);
    }
    const low = t.toLowerCase();
    nodes.forEach(function (n) {
      const text = n.data.toLowerCase();
      const positions = [];
      let idx = text.indexOf(low);
      while (idx !== -1) {
        positions.push(idx);
        idx = text.indexOf(low, idx + low.length);
      }
      // geriye doğru sar: önceki konumlar bölünmeden kalır
      for (let i = positions.length - 1; i >= 0; i--) {
        const span = wrapRange(n, positions[i], positions[i] + low.length);
        if (span) marks.push(span);
      }
    });
    marks.reverse(); // belge sırasına dön
    if (marks.length) setActive(0, false);
    else activeIdx = -1;
    updateCounter();
  }

  function setActive(i, scroll) {
    marks.forEach(function (m) { m.classList.remove('active'); });
    activeIdx = i;
    if (marks[i]) {
      marks[i].classList.add('active');
      if (scroll !== false) {
        // kaydırma sync'i tetiklemesin
        if (VeloMD.sync && VeloMD.sync.suppress) VeloMD.sync.suppress(600);
        marks[i].scrollIntoView({ block: 'center' });
      }
    }
    updateCounter();
  }

  function updateCounter() {
    counter().textContent = (marks.length ? activeIdx + 1 : 0) + '/' + marks.length;
    input().classList.toggle('no-results', !!term && !marks.length);
  }

  function next() {
    if (!marks.length) return;
    setActive((activeIdx + 1) % marks.length);
  }

  function prev() {
    if (!marks.length) return;
    setActive((activeIdx - 1 + marks.length) % marks.length);
  }

  /* ---- arama çubuğu ------------------------------------------------ */

  function open() {
    bar().classList.remove('hidden');
    const cm = VeloMD.editor ? VeloMD.editor.cm : null;
    const sel = cm && cm.getSelection ? cm.getSelection() : '';
    if (sel && sel.indexOf('\n') === -1 && input().value === '') {
      input().value = sel;
    }
    input().focus();
    input().select();
    if (input().value) {
      term = input().value;
      searchAll(term);
    }
  }

  function close() {
    bar().classList.add('hidden');
    term = '';
    clearMarks();
    updateCounter();
  }

  function reapply() {
    if (isOpen() && term) searchAll(term);
  }

  function init() {
    input().addEventListener('input', function () {
      term = this.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { searchAll(term); }, 220);
    });
    input().addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (ev.shiftKey) prev(); else next();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
        const cm = VeloMD.editor ? VeloMD.editor.cm : null;
        if (cm) cm.focus();
      }
    });
    document.getElementById('pv-search-prev').addEventListener('click', prev);
    document.getElementById('pv-search-next').addEventListener('click', next);
    document.getElementById('pv-search-close').addEventListener('click', close);
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.pvSearch = { init, open, close, isOpen, reapply, next, prev };
})();
