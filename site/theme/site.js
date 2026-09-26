/* NextTavern documentation client.
 * Vanilla ES module-free script: theme switch, navigation drawer, table of
 * contents scroll-spy, copy buttons, install tabs, screenshot lightbox and a
 * client-side search over the generated index. */

(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;

  /* ------------------------------------------------------------- theme */

  var THEME_KEY = 'nexttavern-docs-theme';

  function readTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) {
      /* Storage can be unavailable in private modes. */
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f4ef' : '#080b12');
  }

  applyTheme(readTheme());

  /* -------------------------------------------------------------- hero */

  /* The hero speaks with the amber skin's voice: the same greeting lines, typed
     and deleted like the skin's own headline, and the same whale-girl art
     rotating in place. Both stand still when the visitor asks for less motion
     or the script never runs, because the first line and first picture are
     rendered into the HTML. */
  var calm = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var HERO_TYPE_MS = 105;
  var HERO_DELETE_MS = 55;
  var HERO_HOLD_MS = 4500;
  var HERO_GAP_MS = 620;
  var HERO_SHOT_MS = 6000;

  function readHeroLines() {
    var holder = document.getElementById('hero-taglines');
    if (!holder) return [];
    try {
      var parsed = JSON.parse(holder.textContent || '[]');
      return Object.prototype.toString.call(parsed) === '[object Array]' ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  (function typeHero() {
    var target = document.querySelector('[data-hero-typed]');
    var lines = readHeroLines();
    if (!target || calm || lines.length < 2) return;
    var index = 0;
    var column = 0;
    var deleting = false;

    function step() {
      var line = String(lines[index]);
      if (deleting) {
        column -= 1;
        target.textContent = line.slice(0, Math.max(column, 0));
        if (column <= 0) {
          deleting = false;
          index = (index + 1) % lines.length;
          window.setTimeout(step, HERO_GAP_MS);
          return;
        }
        window.setTimeout(step, HERO_DELETE_MS);
        return;
      }
      column += 1;
      target.textContent = line.slice(0, column);
      if (column >= line.length) {
        deleting = true;
        window.setTimeout(step, HERO_HOLD_MS);
        return;
      }
      window.setTimeout(step, HERO_TYPE_MS);
    }

    // The first line is already on screen; start by finishing it, then rotate.
    column = String(lines[0]).length;
    window.setTimeout(function () {
      deleting = true;
      step();
    }, HERO_HOLD_MS);
  })();

  (function rotateHeroArt() {
    var box = document.querySelector('[data-hero-art]');
    if (!box) return;
    var frames = Array.prototype.slice.call(box.querySelectorAll('img'));
    if (calm || frames.length < 2) return;
    var caption = document.querySelector('[data-hero-art-label]');
    var index = 0;

    window.setInterval(function () {
      frames[index].classList.remove('is-active');
      index = (index + 1) % frames.length;
      frames[index].classList.add('is-active');
      var label = frames[index].getAttribute('data-label');
      if (caption && label) caption.textContent = label;
    }, HERO_SHOT_MS);
  })();

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-theme-toggle]');
    if (!toggle) return;
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* Ignore storage failures; the theme still applies for this page. */
    }
  });

  /* --------------------------------------------------- navigation drawer */

  function setNav(open) {
    body.dataset.nav = open ? 'open' : 'closed';
    var button = document.querySelector('[data-nav-toggle]');
    if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-nav-toggle]')) {
      setNav(body.dataset.nav !== 'open');
      return;
    }
    if (event.target.closest('[data-nav-scrim]') || event.target.closest('.sidebar a')) {
      setNav(false);
      return;
    }
    var groupToggle = event.target.closest('[data-group-toggle]');
    if (groupToggle) {
      var group = groupToggle.closest('.nav-group');
      var collapsed = group.getAttribute('data-collapsed') === 'true';
      group.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
      groupToggle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && body.dataset.nav === 'open') setNav(false);
  });

  /* ------------------------------------------------------- table of contents */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));

  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (link) {
      byId[decodeURIComponent(link.getAttribute('href').slice(1))] = link;
    });
    var visible = new Map();
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.target);
          else visible.delete(entry.target.id);
        });
        var first = document.querySelector('main');
        var best = null;
        visible.forEach(function (element) {
          if (!best || element.offsetTop < best.offsetTop) best = element;
        });
        if (!best) return;
        tocLinks.forEach(function (link) {
          link.classList.toggle('active', link === byId[best.id]);
        });
        if (first) first.setAttribute('data-current', best.id);
      },
      { rootMargin: '-88px 0px -68% 0px', threshold: [0, 1] }
    );
    Object.keys(byId).forEach(function (id) {
      var heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
  }

  /* ----------------------------------------------------------- code copy */

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.copy-button');
    if (!button) return;
    var block = button.closest('.code-block');
    var code = block && block.querySelector('code');
    if (!code) return;
    var text = code.innerText.replace(/\s+$/, '');
    var done = function () {
      button.classList.add('done');
      var previous = button.textContent;
      button.textContent = '已复制';
      window.setTimeout(function () {
        button.classList.remove('done');
        button.textContent = previous;
      }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
      return;
    }
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } finally {
      document.body.removeChild(area);
    }
  });

  /* -------------------------------------------------------- install tabs */

  var tabList = document.querySelector('[data-install-tabs]');
  if (tabList) {
    var buttons = Array.prototype.slice.call(tabList.querySelectorAll('button[aria-controls]'));
    var select = function (button) {
      buttons.forEach(function (item) {
        var selected = item === button;
        item.setAttribute('aria-selected', selected ? 'true' : 'false');
        var panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
    };
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        select(button);
      });
      button.addEventListener('keydown', function (event) {
        var index = buttons.indexOf(button);
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          var next = buttons[(index + 1) % buttons.length];
          next.focus();
          select(next);
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          var previous = buttons[(index - 1 + buttons.length) % buttons.length];
          previous.focus();
          select(previous);
        }
      });
    });
  }

  /* ----------------------------------------------------------- lightbox */

  var lightbox = document.querySelector('[data-lightbox]');

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute('data-open', 'false');
    body.classList.remove('no-scroll');
    var image = lightbox.querySelector('img');
    if (image) image.removeAttribute('src');
  }

  if (lightbox) {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-shot], .article img, .hero-shot img');
      if (trigger && trigger.tagName === 'IMG') {
        var source = trigger.getAttribute('data-full') || trigger.getAttribute('src');
        var image = lightbox.querySelector('img');
        var caption = lightbox.querySelector('figcaption');
        if (image) {
          image.setAttribute('src', source);
          image.setAttribute('alt', trigger.getAttribute('alt') || '');
        }
        if (caption) {
          caption.textContent =
            trigger.getAttribute('data-caption') || trigger.getAttribute('alt') || '';
        }
        lightbox.setAttribute('data-open', 'true');
        body.classList.add('no-scroll');
        return;
      }
      if (event.target === lightbox || event.target.closest('[data-lightbox-close]')) closeLightbox();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeLightbox();
    });
  }

  /* ------------------------------------------------------------- search */

  var overlay = document.querySelector('[data-search]');
  if (!overlay) return;

  var input = overlay.querySelector('input');
  var list = overlay.querySelector('.search-results');
  var empty = overlay.querySelector('.search-empty');
  var index = null;
  var loading = null;
  var active = -1;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch('assets/search.json')
        .then(function (response) {
          return response.ok ? response.json() : [];
        })
        .then(function (data) {
          index = Array.isArray(data) ? data : [];
          return index;
        })
        .catch(function () {
          index = [];
          return index;
        });
    }
    return loading;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    if (!query) return safe;
    var lower = safe.toLowerCase();
    var target = query.toLowerCase();
    var out = '';
    var cursor = 0;
    var at = lower.indexOf(target);
    var guard = 0;
    while (at !== -1 && guard < 40) {
      out += safe.slice(cursor, at) + '<mark>' + safe.slice(at, at + target.length) + '</mark>';
      cursor = at + target.length;
      at = lower.indexOf(target, cursor);
      guard += 1;
    }
    return out + safe.slice(cursor);
  }

  function score(entry, query) {
    var title = entry.t.toLowerCase();
    var body = (entry.x || '').toLowerCase();
    if (title === query) return 0;
    if (title.indexOf(query) === 0) return 1;
    if (title.indexOf(query) !== -1) return 2;
    if (body.indexOf(query) !== -1) return 3;
    return -1;
  }

  function render(entries, query) {
    list.innerHTML = '';
    active = -1;
    if (!entries.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    entries.forEach(function (entry) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      var url = entry.p + (entry.a ? '#' + entry.a : '');
      link.href = url;
      var snippet = entry.x || '';
      if (query && snippet.toLowerCase().indexOf(query.toLowerCase()) === -1) {
        snippet = snippet.slice(0, 150);
      } else if (query) {
        var at = snippet.toLowerCase().indexOf(query.toLowerCase());
        snippet = snippet.slice(Math.max(0, at - 60), at + 110);
      } else {
        snippet = snippet.slice(0, 150);
      }
      link.innerHTML =
        '<span class="page">' +
        escapeHtml(entry.t) +
        '</span><span class="hit">' +
        highlight(entry.h || entry.t, query) +
        '</span><span class="snippet">' +
        highlight(snippet, query) +
        '</span>';
      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function search(query) {
    var trimmed = query.trim().toLowerCase();
    if (!trimmed) return Promise.resolve([]);
    return loadIndex().then(function (data) {
      var scored = [];
      data.forEach(function (entry) {
        var rank = score(entry, trimmed);
        if (rank >= 0) scored.push({ rank: rank, entry: entry });
      });
      scored.sort(function (a, b) {
        return a.rank - b.rank || a.entry.t.localeCompare(b.entry.t, 'zh-Hans-CN');
      });
      return scored.slice(0, 24).map(function (row) {
        return row.entry;
      });
    });
  }

  var timer = null;

  input.addEventListener('input', function () {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      search(input.value).then(function (entries) {
        render(entries, input.value.trim());
      });
    }, 90);
  });

  function openSearch() {
    overlay.setAttribute('data-open', 'true');
    body.classList.add('no-scroll');
    input.focus();
    input.select();
    loadIndex();
  }

  function closeSearch() {
    overlay.setAttribute('data-open', 'false');
    body.classList.remove('no-scroll');
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-search-open]')) {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.target === overlay || event.target.closest('[data-search-close]')) closeSearch();
  });

  document.addEventListener('keydown', function (event) {
    var isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (isShortcut) {
      event.preventDefault();
      if (overlay.getAttribute('data-open') === 'true') closeSearch();
      else openSearch();
      return;
    }
    if (overlay.getAttribute('data-open') !== 'true') return;
    var links = Array.prototype.slice.call(list.querySelectorAll('a'));
    if (event.key === 'Escape') {
      closeSearch();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!links.length) return;
      active = event.key === 'ArrowDown'
        ? (active + 1) % links.length
        : (active - 1 + links.length) % links.length;
      links.forEach(function (link, index) {
        link.classList.toggle('active', index === active);
      });
      links[active].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && active >= 0 && links[active]) {
      links[active].click();
    }
  });
})();
