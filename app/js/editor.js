/* VeloMD editor — CodeMirror sarmalayıcı + markdown düzenleme eylemleri. */
(function () {
  'use strict';

  let cm = null;

  function init() {
    const s = VeloMD.settings.state.settings;
    cm = CodeMirror.fromTextArea(document.getElementById('cm-host'), {
      mode: 'gfm',
      theme: 'default',
      lineNumbers: !!s.lineNumbers,
      lineWrapping: !!s.wordWrap,
      styleActiveLine: true,
      indentUnit: 2,
      tabSize: 4,
      autoCloseBrackets: false,
      extraKeys: {
        Enter: 'newlineAndIndentContinueMarkdownList',
        'Ctrl-B': function () { applyAction('bold'); },
        'Ctrl-I': function () { applyAction('italic'); },
        'Ctrl-K': function () { applyAction('link'); },
        Tab: function (editor) {
          if (editor.somethingSelected()) editor.indentSelection('add');
          else editor.replaceSelection('  ', 'end');
        },
        'Shift-Tab': function (editor) { editor.indentSelection('subtract'); },
      },
    });
    cm.refresh();
    return cm;
  }

  /* ---- düzenleme eylemleri ---------------------------------------- */

  function wrapInline(before, after, placeholder) {
    after = after || before;
    placeholder = placeholder || VeloMD.i18n.t('ed.text');
    const sel = cm.getSelection();
    const cur = cm.getCursor();
    if (sel) {
      // işaret zaten varsa kaldır (toggle)
      const from = cm.getCursor('from');
      const to = cm.getCursor('to');
      const lineText = cm.getRange(
        { line: from.line, ch: Math.max(0, from.ch - before.length) },
        { line: to.line, ch: Math.min((cm.getLine(to.line) || '').length, to.ch + after.length) }
      );
      if (lineText === before + sel + after) {
        cm.replaceRange(sel, {
          line: from.line, ch: Math.max(0, from.ch - before.length),
        }, {
          line: to.line, ch: Math.min((cm.getLine(to.line) || '').length, to.ch + after.length),
        });
        cm.setSelection(
          { line: from.line, ch: from.ch - before.length },
          { line: to.line, ch: to.ch - before.length }
        );
        return;
      }
      cm.replaceSelection(before + sel + after);
      cm.setSelection(
        { line: from.line, ch: from.ch + before.length },
        { line: to.line, ch: to.ch + before.length }
      );
    } else {
      cm.replaceSelection(before + placeholder + after, 'around');
      cm.setSelection(cur, { line: cur.line, ch: cur.ch + before.length + placeholder.length });
    }
  }

  function setLinePrefix(prefix, pattern) {
    // imleç satırına önek ekle; aynı aileden önek varsa değiştir/kaldır
    const ranges = cm.listSelections();
    const edits = [];
    for (const r of ranges) {
      const fromLine = Math.min(r.anchor.line, r.head.line);
      const toLine = Math.max(r.anchor.line, r.head.line);
      const lines = [];
      let allHave = true;
      for (let l = fromLine; l <= toLine; l++) {
        const text = cm.getLine(l) || '';
        const m = text.match(pattern);
        lines.push({ line: l, text, current: m ? m[0] : null });
        if (!m) allHave = false;
      }
      for (const item of lines) {
        if (allHave && item.current === prefix) {
          // aynı önek: kaldır
          edits.push({ from: { line: item.line, ch: 0 }, to: { line: item.line, ch: item.current.length }, text: '' });
        } else {
          edits.push({ from: { line: item.line, ch: 0 }, to: { line: item.line, ch: item.current ? item.current.length : 0 }, text: prefix });
        }
      }
    }
    cm.operation(function () {
      for (const e of edits) cm.replaceRange(e.text, e.from, e.to);
    });
    cm.focus();
  }

  function heading(level) {
    if (level < 1) level = 1;
    if (level > 6) level = 6;
    const prefix = '#'.repeat(level) + ' ';
    setLinePrefix(prefix, /^(\#{1,6} )/);
  }

  function insertBlock(text) {
    const cur = cm.getCursor();
    const lineText = cm.getLine(cur.line) || '';
    const pre = lineText.trim() ? '\n\n' : '';
    cm.replaceSelection(pre + text);
    const ch = cm.getCursor().ch - 1; // hr sonuna imleç yakın
    cm.setCursor({ line: cm.getCursor().line, ch: Math.max(0, ch) });
    cm.focus();
  }

  function fenceBlock(lang) {
    lang = lang || '';
    const sel = cm.getSelection();
    const body = sel || VeloMD.i18n.t('ed.codeText');
    const open = '```' + lang + '\n';
    cm.replaceSelection(open + body + '\n```\n');
    if (!sel) {
      const cur = cm.getCursor();
      cm.setSelection({ line: cur.line - 2, ch: 3 }, { line: cur.line - 2, ch: 6 });
    }
    cm.focus();
  }

  function insertLink(isImage) {
    const t = VeloMD.i18n.t;
    return new Promise(function (resolve) {
      const sel = cm.getSelection();
      const alt = sel || t('ed.linkText');
      VeloMD.app.prompt(
        isImage ? t('pr.imageTitle') : t('pr.linkTitle'),
        isImage ? t('pr.imagePh') : t('pr.linkPh'),
        ''
      ).then(function (url) {
        if (url === null) { cm.focus(); resolve(); return; }
        const head = isImage ? '![' : '[';
        const mid = '](';
        const text = head + alt + mid + (url || '') + ')';
        if (sel) cm.replaceSelection(text);
        else cm.replaceSelection(text, 'end');
        // url kısmını seçili bırak
        const cur = cm.getCursor();
        cm.setSelection(
          { line: cur.line, ch: cur.ch - 1 },
          { line: cur.line, ch: cur.ch - 1 + (url || '').length }
        );
        cm.focus();
        resolve();
      });
    });
  }

  function applyAction(name) {
    const t = VeloMD.i18n.t;
    switch (name) {
      case 'bold': wrapInline('**', '**', t('ed.boldText')); break;
      case 'italic': wrapInline('*', '*', t('ed.italicText')); break;
      case 'strike': wrapInline('~~', '~~', t('ed.strikeText')); break;
      case 'code': wrapInline('`', '`', t('ed.codeText')); break;
      case 'h1': heading(1); break;
      case 'h2': heading(2); break;
      case 'h3': heading(3); break;
      case 'h4': heading(4); break;
      case 'h5': heading(5); break;
      case 'quote': setLinePrefix('> ', /^(> )/); break;
      case 'ul': setLinePrefix('- ', /^([-*+] )/); break;
      case 'ol': setLinePrefix('1. ', /^(\d+\. )/); break;
      case 'fence': fenceBlock(); break;
      case 'link': insertLink(false); break;
      case 'image': insertLink(true); break;
      case 'hr': insertBlock('---\n'); break;
    }
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.editor = {
    init,
    applyAction,
    fenceBlock,
    get cm() { return cm; },
  };
})();
