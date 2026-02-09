(function () {
  'use strict';

  var STORAGE_KEY = 'flashcards-js-progress';

  function parseConteudo(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    var normalized = rawText.replace(/\r\n/g, '\n');
    var blocks = normalized.split(/\nCopiar\n/);
    return blocks
      .map(function (block) {
        var lines = block.trim().split('\n').filter(function (l) { return l.trim().length > 0; });
        if (lines.length === 0) return null;
        var concept = lines[0].trim();
        var content = lines.slice(1).map(function (l) { return l.trim(); }).join('\n').trim();
        return { concept: concept, content: content };
      })
      .filter(Boolean);
  }

  function formatContent(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var html = [];
    var inCode = false;
    var codeBlock = [];

    function flushCode() {
      if (codeBlock.length) {
        html.push('<code class="hl-block">' + highlightJs(codeBlock.join('\n')) + '</code>');
        codeBlock = [];
      }
      inCode = false;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.trim();
      var isCode = t.length > 0 && (/^(var|let|const|function|if|else|for|while|switch|case|return|console\.|[\{\}\(\)\;]|\/\/)/.test(t) || (t.indexOf('=') !== -1 && /[\{\}\;]|\/\//.test(t)) || t === '}' || t === '};' || t.indexOf('()') !== -1);
      if (isCode || (inCode && (t === '' || t.indexOf('//') === 0 || t.indexOf('*') === 0 || t.indexOf('/*') === 0 || /^[\s\w\.\'\"\,\=\{\}\(\)\[\]\;\:\<\>\/\-]+$/.test(t)))) {
        if (!inCode) flushCode();
        inCode = true;
        codeBlock.push(line);
      } else {
        flushCode();
        if (t) html.push('<p>' + escapeHtml(t) + '</p>');
      }
    }
    flushCode();
    return html.join('');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightJs(code) {
    if (!code) return '';
    var keywords = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'true', 'false', 'null', 'undefined', 'new', 'this', 'typeof', 'in', 'of', 'continue', 'try', 'catch', 'finally', 'throw', 'class', 'extends', 'super', 'import', 'export', 'from', 'async', 'await'];
    var i = 0;
    var n = code.length;
    var out = '';
    var ch;
    function peek() { return i < n ? code.charAt(i) : ''; }
    function take() { ch = i < n ? code.charAt(i) : ''; i++; return ch; }
    function span(cls, text) { return '<span class="hl-' + cls + '">' + escapeHtml(text) + '</span>'; }
    function readWhile(test) { var s = ''; while (i < n && test(code.charAt(i))) s += take(); return s; }
    function readWord() { return readWhile(function (c) { return /[\w\$]/.test(c); }); }
    function readNumber() {
      var s = '';
      if (peek() === '-' && i + 1 < n && /\d/.test(code.charAt(i + 1))) s += take();
      s += readWhile(function (c) { return /\d/.test(c); });
      if (peek() === '.') { s += take(); s += readWhile(function (c) { return /\d/.test(c); }); }
      if (peek() === 'e' || peek() === 'E') { s += take(); if (peek() === '+' || peek() === '-') s += take(); s += readWhile(function (c) { return /\d/.test(c); }); }
      return s;
    }
    while (i < n) {
      var start = i;
      var c = peek();
      if (c === '"' || c === "'") {
        var quote = take();
        var str = quote;
        while (i < n) {
          var next = take();
          str += next;
          if (next === '\\') { if (i < n) str += take(); continue; }
          if (next === quote) break;
        }
        out += span('str', str);
        continue;
      }
      if (c === '`') {
        take();
        var str = '`';
        while (i < n) {
          var next = take();
          str += next;
          if (next === '\\') { if (i < n) str += take(); continue; }
          if (next === '`') break;
          if (next === '$' && peek() === '{') { str += take(); var depth = 1; while (i < n && depth) { var x = take(); str += x; if (x === '{') depth++; else if (x === '}') depth--; } }
        }
        out += span('str', str);
        continue;
      }
      if (c === '/' && i + 1 < n && code.charAt(i + 1) === '/') {
        var line = '';
        while (i < n && take() !== '\n') line += ch;
        if (ch === '\n') line += '\n';
        out += span('com', line);
        continue;
      }
      if (c === '/' && i + 1 < n && code.charAt(i + 1) === '*') {
        take(); take();
        var block = '/*';
        while (i < n) {
          var a = take();
          block += a;
          if (a === '*' && peek() === '/') { block += take(); break; }
        }
        out += span('com', block);
        continue;
      }
      if (/\d/.test(c) || (c === '.' && i + 1 < n && /\d/.test(code.charAt(i + 1)))) {
        if (c === '.') take();
        var num = readNumber();
        if (c === '.') num = '.' + num;
        else num = (code.charAt(start) === '-' ? '-' : '') + num;
        out += span('num', num);
        continue;
      }
      if (/[\w\$]/.test(c)) {
        var word = readWord();
        out += keywords.indexOf(word) !== -1 ? span('kw', word) : span('id', word);
        continue;
      }
      if (c === '\n' || c === ' ' || c === '\t') {
        out += escapeHtml(take());
        continue;
      }
      take();
      out += span('op', ch);
    }
    return out;
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function getProgress() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var data = JSON.parse(saved);
        if (data && typeof data.lastIndex === 'number' && Array.isArray(data.studied)) {
          return {
            lastIndex: data.lastIndex,
            studied: data.studied || [],
            order: Array.isArray(data.order) ? data.order : null
          };
        }
      }
    } catch (e) {}
    return { lastIndex: 0, studied: [], order: null };
  }

  function saveProgress(lastIndex, studied, order) {
    try {
      var payload = { lastIndex: lastIndex, studied: studied };
      if (order && order.length) payload.order = order;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function loadCards(done) {
    fetch('conteudo.txt')
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var cards = parseConteudo(text);
        if (cards.length) done(cards);
        else tryFallback(done);
      })
      .catch(function () { tryFallback(done); });
  }

  function tryFallback(done) {
    var el = document.getElementById('embedded-cards');
    if (el && el.textContent) {
      try {
        var cards = JSON.parse(el.textContent);
        if (Array.isArray(cards) && cards.length) done(cards);
        else showEmpty();
      } catch (e) { showEmpty(); }
    } else {
      showEmpty();
    }
  }

  function showEmpty() {
    var main = document.querySelector('.main');
    var empty = document.getElementById('emptyState');
    if (main) main.style.display = 'none';
    if (empty) {
      empty.removeAttribute('hidden');
    }
  }

  function init(cards) {
    var progress = getProgress();
    var order = progress.order;
    if (!order || order.length !== cards.length) {
      order = shuffleArray(cards.map(function (_, i) { return i; }));
      saveProgress(0, [], order);
    }
    var orderedCards = order.map(function (i) { return cards[i]; });

    var studied = progress.studied || [];
    var lastIndex = Math.min(Math.max(0, progress.lastIndex), orderedCards.length - 1);
    var currentIndex = lastIndex;

    var counterEl = document.getElementById('counter');
    var cardEl = document.getElementById('card');
    var cardWrapper = document.getElementById('cardWrapper');
    var conceptEl = document.getElementById('cardConcept');
    var contentEl = document.getElementById('cardContent');
    var btnNext = document.getElementById('btnNext');
    var btnPrev = document.getElementById('btnPrev');
    var btnReset = document.getElementById('btnReset');

    function markStudied(index) {
      if (index < 0 || index >= orderedCards.length) return;
      if (studied.indexOf(index) === -1) studied.push(index);
      saveProgress(currentIndex, studied, order);
    }

    function updateCounter() {
      var count = studied.length;
      var total = orderedCards.length;
      if (counterEl) counterEl.textContent = count + ' / ' + total + ' cards estudados';
    }

    function updateButtons() {
      if (btnNext) btnNext.disabled = currentIndex >= orderedCards.length - 1;
      if (btnPrev) btnPrev.disabled = currentIndex <= 0;
    }

    function renderCard(index) {
      if (index < 0 || index >= orderedCards.length) return;
      var card = orderedCards[index];
      if (conceptEl) conceptEl.textContent = card.concept;
      if (contentEl) contentEl.innerHTML = formatContent(card.content);
      cardEl.classList.remove('flipped');
      updateCounter();
      updateButtons();
    }

    function goToNext() {
      markStudied(currentIndex);
      var nextIndex = currentIndex + 1;
      if (nextIndex >= orderedCards.length) nextIndex = orderedCards.length - 1;

      if (nextIndex !== currentIndex) {
        cardWrapper.classList.add('changing');
        var inner = cardEl.querySelector('.card-inner');
        if (inner) inner.classList.remove('anim-in');
        setTimeout(function () {
          currentIndex = nextIndex;
          renderCard(currentIndex);
          cardWrapper.classList.remove('changing');
          inner = cardEl.querySelector('.card-inner');
          if (inner) inner.classList.add('anim-in');
        }, 280);
      } else {
        updateCounter();
        updateButtons();
      }
    }

    function goToPrev() {
      var prevIndex = currentIndex - 1;
      if (prevIndex < 0) prevIndex = 0;
      if (prevIndex === currentIndex) return;
      cardWrapper.classList.add('changing');
      var inner = cardEl.querySelector('.card-inner');
      if (inner) inner.classList.remove('anim-in');
      setTimeout(function () {
        currentIndex = prevIndex;
        renderCard(currentIndex);
        cardWrapper.classList.remove('changing');
        inner = cardEl.querySelector('.card-inner');
        if (inner) inner.classList.add('anim-in');
      }, 280);
    }

    function resetProgress() {
      studied = [];
      order = shuffleArray(cards.map(function (_, i) { return i; }));
      orderedCards = order.map(function (i) { return cards[i]; });
      currentIndex = 0;
      saveProgress(0, [], order);
      cardWrapper.classList.add('changing');
      setTimeout(function () {
        renderCard(0);
        cardWrapper.classList.remove('changing');
        var inner = cardEl.querySelector('.card-inner');
        if (inner) inner.classList.add('anim-in');
      }, 200);
    }

    cardEl.addEventListener('click', function () {
      cardEl.classList.toggle('flipped');
    });

    btnNext.addEventListener('click', function () {
      goToNext();
    });

    if (btnPrev) btnPrev.addEventListener('click', function () {
      goToPrev();
    });

    btnReset.addEventListener('click', function () {
      resetProgress();
    });

    updateCounter();
    updateButtons();
    renderCard(currentIndex);
  }

  function run() {
    loadCards(function (cards) {
      init(cards);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
