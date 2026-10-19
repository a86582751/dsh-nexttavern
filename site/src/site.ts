/* The documentation site's only browser entry: no runtime dependencies. */
(() => {
  const root = document.documentElement;
  const body = document.body;
  const themeKey = 'nexttavern-docs-theme';
  type Theme = 'light' | 'dark';
  const clicked = (event: MouseEvent, selector: string) =>
    (event.target as Element).closest<HTMLElement>(selector);

  function readTheme(): Theme {
    try {
      const saved = localStorage.getItem(themeKey);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* Theme selection still works when storage is unavailable. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme: Theme): void {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'light' ? '#f5efdf' : '#111d30');
  }
  applyTheme(readTheme());
  document.addEventListener('click', event => {
    if (!clicked(event, '[data-theme-toggle]')) return;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(themeKey, next); } catch { /* Keep this page's selection. */ }
  });

  const navButton = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  function setNav(open: boolean): void {
    body.dataset.nav = open ? 'open' : 'closed';
    navButton?.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', event => {
    if (clicked(event, '[data-nav-toggle]')) setNav(body.dataset.nav !== 'open');
    if (clicked(event, '[data-nav-scrim], .sidebar a')) setNav(false);
    const toggle = clicked(event, '[data-group-toggle]');
    if (!toggle) return;
    const group = toggle.closest<HTMLElement>('.nav-group')!;
    const collapsed = group.dataset.collapsed === 'true';
    group.dataset.collapsed = String(!collapsed);
    toggle.setAttribute('aria-expanded', String(collapsed));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && body.dataset.nav === 'open') {
      setNav(false);
      navButton?.focus();
    }
  });

  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
  if (tocLinks.length) {
    const byId = new Map(tocLinks.map(link => [decodeURIComponent(link.hash.slice(1)), link]));
    const visible = new Map<string, HTMLElement>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.target as HTMLElement);
        else visible.delete(entry.target.id);
      }
      const first = [...visible.values()].sort((a, b) => a.offsetTop - b.offsetTop)[0];
      if (!first) return;
      tocLinks.forEach(link => link.classList.toggle('active', link === byId.get(first.id)));
    }, { rootMargin: '-100px 0px -65% 0px' });
    for (const id of byId.keys()) {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    }
  }

  document.addEventListener('click', async event => {
    const button = clicked(event, '[data-copy]');
    if (!button) return;
    const code = button.closest('.code-block')!.querySelector<HTMLElement>('code')!;
    const text = code.innerText.replace(/\s+$/, '');
    const done = () => {
      button.classList.add('done');
      button.textContent = '已复制';
      setTimeout(() => {
        button.classList.remove('done');
        button.textContent = '复制';
      }, 1600);
    };
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); done(); return; } catch { /* Use selection fallback. */ }
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    try { if (document.execCommand('copy')) done(); } finally { area.remove(); button.focus(); }
  });

  const tabList = document.querySelector('[data-install-tabs]');
  if (tabList) {
    const buttons = [...tabList.querySelectorAll<HTMLButtonElement>('button[aria-controls]')];
    const select = (button: HTMLButtonElement) => {
      buttons.forEach(item => {
        const selected = item === button;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')!)!.hidden = !selected;
      });
    };
    buttons.forEach((button, position) => {
      button.addEventListener('click', () => select(button));
      button.addEventListener('keydown', event => {
        let next: number;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (position + 1) % buttons.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (position - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[next]!.focus();
        select(buttons[next]!);
      });
    });
  }

  const lightbox = document.querySelector<HTMLElement>('[data-lightbox]')!;
  let lightboxReturn: HTMLElement | null = null;
  const lightboxImage = lightbox.querySelector('img')!;
  function closeLightbox(): void {
    if (lightbox.dataset.open !== 'true') return;
    lightbox.dataset.open = 'false';
    body.classList.remove('no-scroll');
    lightboxImage.removeAttribute('src');
    lightboxReturn?.focus();
  }
  document.addEventListener('click', event => {
    const image = clicked(event, '.article img') as HTMLImageElement | null;
    if (image) {
      lightboxReturn = image;
      lightboxImage.src = image.dataset.full || image.src;
      lightboxImage.alt = image.alt;
      lightbox.querySelector('figcaption')!.textContent = image.dataset.caption || image.alt;
      lightbox.dataset.open = 'true';
      body.classList.add('no-scroll');
      lightbox.querySelector<HTMLButtonElement>('button')!.focus();
    }
    if (event.target === lightbox || clicked(event, '[data-lightbox-close]')) closeLightbox();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeLightbox(); });

  interface SearchEntry { p: string; a: string; t: string; h: string; x: string }
  const overlay = document.querySelector<HTMLElement>('[data-search]')!;
  const input = overlay.querySelector('input')!;
  const list = overlay.querySelector('.search-results')!;
  const empty = overlay.querySelector<HTMLElement>('.search-empty')!;
  let loading: Promise<SearchEntry[]> | undefined;
  let active = -1;
  let searchReturn: HTMLElement | null = null;
  const loadIndex = () => loading ??= fetch('assets/search.json')
    .then(response => response.ok ? response.json() as Promise<SearchEntry[]> : [])
    .catch(() => []);

  function highlight(element: HTMLElement, text: string, query: string): void {
    if (!query) { element.textContent = text; return; }
    const lower = text.toLowerCase();
    let cursor = 0;
    for (let at = lower.indexOf(query); at !== -1; at = lower.indexOf(query, cursor)) {
      element.append(document.createTextNode(text.slice(cursor, at)));
      const mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + query.length);
      element.append(mark);
      cursor = at + query.length;
    }
    element.append(document.createTextNode(text.slice(cursor)));
  }
  function rank(entry: SearchEntry, query: string): number {
    const title = entry.t.toLowerCase();
    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (title.includes(query)) return 2;
    if ((entry.h + ' ' + entry.x).toLowerCase().includes(query)) return 3;
    return -1;
  }
  async function search(): Promise<void> {
    const query = input.value.trim().toLowerCase();
    const data = await loadIndex();
    // A later input owns the visible results if the index arrived asynchronously.
    if (input.value.trim().toLowerCase() !== query) return;
    const entries = query ? data.map(entry => ({ entry, rank: rank(entry, query) }))
      .filter(row => row.rank >= 0).sort((a, b) => a.rank - b.rank).slice(0, 24).map(row => row.entry) : [];
    list.replaceChildren();
    active = -1;
    empty.hidden = entries.length > 0 || !query;
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = entry.p + (entry.a ? '#' + entry.a : '');
      const at = Math.max(0, entry.x.toLowerCase().indexOf(query) - 60);
      for (const [className, text] of [
        ['page', entry.t], ['hit', entry.h || entry.t], ['snippet', entry.x.slice(at, at + 170)]
      ] as const) {
        const span = document.createElement('span');
        span.className = className;
        highlight(span, text, query);
        link.append(span);
      }
      item.append(link);
      list.append(item);
    }
  }
  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { void search(); }, 90);
  });
  function openSearch(): void {
    searchReturn = document.activeElement as HTMLElement;
    overlay.dataset.open = 'true';
    body.classList.add('no-scroll');
    input.focus();
    input.select();
    void loadIndex();
  }
  function closeSearch(): void {
    overlay.dataset.open = 'false';
    body.classList.remove('no-scroll');
    searchReturn?.focus();
  }
  document.addEventListener('click', event => {
    if (clicked(event, '[data-search-open]')) { event.preventDefault(); openSearch(); }
    if (event.target === overlay || clicked(event, '[data-search-close]')) closeSearch();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (overlay.dataset.open === 'true') closeSearch(); else openSearch();
      return;
    }
    if (overlay.dataset.open !== 'true') return;
    const links = [...list.querySelectorAll('a')];
    if (event.key === 'Escape') closeSearch();
    else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && links.length) {
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((link, index) => link.classList.toggle('active', index === active));
      links[active]!.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && active >= 0) links[active]!.click();
  });
})();
