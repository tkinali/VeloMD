/* VeloMD preview — markdown-it tabanlı render.
   Her üst düzey blok, kaynak satır aralığını data-source-line /
   data-source-end öznitelikleriyle taşır (scroll sync + highlight için). */
(function () {
  'use strict';

  let md = null;

  function escapeHtml(str) {
    return md.utils.escapeHtml(str);
  }

  function init() {
    md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && window.hljs && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
          } catch (err) { /* düşerek düz metne geç */ }
        }
        return '';
      },
    });

    // Açılış blok tokenlarına kaynak satır bilgisi işle
    md.core.ruler.push('velomd_srcmap', function (state) {
      for (let i = 0; i < state.tokens.length; i++) {
        const t = state.tokens[i];
        if (t.map && t.nesting === 1) {
          t.attrSet('data-source-line', String(t.map[0]));
          t.attrSet('data-source-end', String(t.map[1]));
        }
      }
    });

    // fence: pre elementine kaynak satırı koyan özel renderer
    md.renderer.rules.fence = function (tokens, idx) {
      const token = tokens[idx];
      const langPart = token.info ? token.info.trim().split(/\s+/)[0] : '';
      let highlighted;
      if (langPart && hljs.getLanguage(langPart)) {
        try {
          highlighted = hljs.highlight(token.content, {
            language: langPart, ignoreIllegals: true,
          }).value;
        } catch (err) { highlighted = ''; }
      } else {
        highlighted = '';
      }
      if (!highlighted) highlighted = escapeHtml(token.content);
      const langAttr = langPart
        ? ' class="hljs language-' + escapeHtml(langPart) + '"'
        : ' class="hljs"';
      const src = token.map
        ? ' data-source-line="' + token.map[0] + '" data-source-end="' + token.map[1] + '"'
        : '';
      return '<pre' + src + '><code' + langAttr + '>' + highlighted + '</code></pre>\n';
    };
  }

  function render(src) {
    if (!md) init();
    return md.render(src || '');
  }

  window.VeloMD = window.VeloMD || {};
  VeloMD.preview = { init, render };
})();
