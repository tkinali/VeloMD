/* VeloMD tabs — çoklu dosya sekmeleri. Her sekme kendi CodeMirror.Doc
   örneğini taşır; aktif sekme cm.swapDoc ile editöre takılır. */
(function () {
  'use strict';

  const list = [];
  let active = -1;
  let untitledSeq = 0;
  let dragFrom = -1;

  const bar = () => document.getElementById('tabbar');

  function nameFromPath(path) {
    return path.split('/').pop() || path;
  }

  function emitChanged() {
    if (VeloMD.app && VeloMD.app.onTabsChanged) VeloMD.app.onTabsChanged();
  }

  function findPath(path) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].path && list[i].path === path) return i;
    }
    return -1;
  }

  function create(path, content, dirty) {
    const idx = path ? findPath(path) : -1;
    if (idx >= 0) { activate(idx); return list[idx]; }

    const tab = {
      path: path || null,
      name: path ? nameFromPath(path)
                 : VeloMD.i18n.t('tab.untitled') + '-' + (++untitledSeq) + '.md',
      doc: CodeMirror.Doc(content || '', 'gfm'),
      dirty: !!dirty,
    };
    list.push(tab);
    activate(list.length - 1);
    return tab;
  }

  function activate(i) {
    if (i < 0 || i >= list.length) return;
    active = i;
    const cm = VeloMD.editor.cm;
    cm.swapDoc(list[i].doc);
    cm.refresh();
    buildBar();
    emitChanged();
  }

  function remove(i) {
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    if (list.length === 0) {
      active = -1;
      buildBar();
      emitChanged();
      return;
    }
    if (active >= i) active = Math.max(0, active - 1);
    // aktif değiştiyse doc'u tak
    const cm = VeloMD.editor.cm;
    cm.swapDoc(list[active].doc);
    cm.refresh();
    buildBar();
    emitChanged();
  }

  function current() {
    return active >= 0 ? list[active] : null;
  }

  function markDirty(tab, dirty) {
    tab.dirty = dirty;
    buildBar();
    emitChanged();
  }

  /* sekme sırasını değiştir (sürükle-bırak); aktif sekme obje olarak
     takip edilir, doc swap'ına gerek kalmaz */
  function reorder(from, to) {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return;
    const activeTab = list[active];
    const moved = list.splice(from, 1)[0];
    list.splice(to, 0, moved);
    active = list.indexOf(activeTab);
    buildBar();
    emitChanged();
  }

  function buildBar() {
    const el = bar();
    el.innerHTML = '';
    list.forEach(function (tab, i) {
      const t = VeloMD.i18n.t;
      const node = document.createElement('div');
      node.className = 'tab' + (i === active ? ' active' : '') + (tab.dirty ? ' dirty' : '');
      node.title = tab.path || tab.name + t('tab.unsaved');
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = tab.name;
      const dirty = document.createElement('span');
      dirty.className = 'tab-dirty';
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.textContent = '×';
      close.title = t('tab.close');
      node.appendChild(label);
      node.appendChild(dirty);
      node.appendChild(close);
      // sürükle-bırak ile yeniden sıralama
      node.draggable = true;
      node.addEventListener('dragstart', function (ev) {
        dragFrom = i;
        node.classList.add('dragging');
        ev.dataTransfer.effectAllowed = 'move';
        try { ev.dataTransfer.setData('text/plain', String(i)); } catch (e) {}
      });
      node.addEventListener('dragend', function () {
        node.classList.remove('dragging');
        el.querySelectorAll('.tab').forEach(function (n) { n.classList.remove('drag-over'); });
        dragFrom = -1;
      });
      node.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'move';
        el.querySelectorAll('.tab').forEach(function (n) { n.classList.remove('drag-over'); });
        if (dragFrom !== i) node.classList.add('drag-over');
      });
      node.addEventListener('drop', function (ev) {
        ev.preventDefault();
        node.classList.remove('drag-over');
        if (dragFrom >= 0) reorder(dragFrom, i);
      });
      node.addEventListener('click', function (ev) {
        if (ev.target === close) return;
        activate(i);
      });
      close.addEventListener('click', function (ev) {
        ev.stopPropagation();
        VeloMD.app.requestClose(i);
      });
      node.addEventListener('auxclick', function (ev) {
        if (ev.button === 1) { // orta tuş
          ev.preventDefault();
          VeloMD.app.requestClose(i);
        }
      });
      el.appendChild(node);
    });
    const act = el.querySelector('.tab.active');
    if (act) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.tabs = {
    list,
    get active() { return active; },
    create,
    activate,
    remove,
    reorder,
    current,
    markDirty,
    buildBar,
    findPath,
  };
})();
