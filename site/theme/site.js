// Generated from release/public/site/src/site.ts; edit the TypeScript source.
"use strict";
/* The documentation site's only browser entry: no runtime dependencies. */
(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeKey = 'nexttavern-docs-theme';
    const clicked = (event, selector) => event.target.closest(selector);
    function readTheme() {
        try {
            const saved = localStorage.getItem(themeKey);
            if (saved === 'light' || saved === 'dark')
                return saved;
        }
        catch { /* Theme selection still works when storage is unavailable. */ }
        return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function applyTheme(theme) {
        root.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5efdf' : '#111d30');
        document.dispatchEvent(new Event('nexttavern-theme'));
    }
    applyTheme(readTheme());
    document.addEventListener('click', event => {
        if (!clicked(event, '[data-theme-toggle]'))
            return;
        const next = root.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try {
            localStorage.setItem(themeKey, next);
        }
        catch { /* Keep this page's selection. */ }
    });
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const typed = document.querySelector('[data-hero-typed]');
    if (typed) {
        // Match the original site's timing and exact skin-sourced slogan order.
        const lines = JSON.parse(document.getElementById('hero-taglines').textContent);
        const heading = typed.closest('h1');
        let position = 0;
        let column = lines[0].length;
        let deleting = true;
        let delay = 4500;
        let timer;
        const format = (line) => line.replace('，', '，\n');
        const sizeLine = (line) => {
            const longest = Math.max(...format(line).split('\n').map(part => Array.from(part).reduce((width, character) => width + (/^[\x20-\x7e]$/.test(character) ? .58 : 1), 0)));
            // Fit each intentional line while the box keeps a fixed two-line height.
            heading.style.setProperty('--headline-columns', String(Math.max(7, longest + .45)));
        };
        sizeLine(lines[0]);
        const schedule = () => {
            clearTimeout(timer);
            root.classList.toggle('has-hero-motion', !reducedMotion.matches && !document.hidden);
            if (reducedMotion.matches || document.hidden)
                return;
            timer = window.setTimeout(step, delay);
        };
        const step = () => {
            const line = lines[position];
            if (deleting) {
                column -= 1;
                typed.textContent = format(line.slice(0, Math.max(0, column)));
                if (column <= 0) {
                    deleting = false;
                    position = (position + 1) % lines.length;
                    sizeLine(lines[position]);
                    delay = 620;
                }
                else
                    delay = 55;
            }
            else {
                column += 1;
                typed.textContent = format(line.slice(0, column));
                if (column >= line.length) {
                    deleting = true;
                    delay = 4500;
                }
                else
                    delay = 105;
            }
            schedule();
        };
        reducedMotion.addEventListener('change', () => {
            if (reducedMotion.matches) {
                column = lines[position].length;
                deleting = true;
                delay = 4500;
                typed.textContent = format(lines[position]);
            }
            schedule();
        });
        document.addEventListener('visibilitychange', schedule);
        schedule();
    }
    class PostcardCarousel {
        element;
        frames;
        pages;
        pause;
        count;
        current = 0;
        requested = 0;
        paused = false;
        pending = false;
        revision = 0;
        timer;
        constructor(element) {
            this.element = element;
            this.frames = [...element.querySelectorAll('.carousel-frame')];
            this.pages = [...element.querySelectorAll('[data-carousel-page]')];
            this.pause = element.querySelector('[data-carousel-pause]');
            this.count = element.querySelector('output');
            element.querySelector('.carousel-controls').hidden = false;
            element.querySelector('[data-carousel-prev]').addEventListener('click', () => {
                void this.show(this.requested - 1);
            });
            element.querySelector('[data-carousel-next]').addEventListener('click', () => {
                void this.show(this.requested + 1);
            });
            this.pages.forEach((page, index) => page.addEventListener('click', () => { void this.show(index); }));
            this.pause.addEventListener('click', () => { this.paused = !this.paused; this.refresh(); });
            document.addEventListener('nexttavern-theme', () => this.refresh());
            document.addEventListener('visibilitychange', () => this.refresh());
            reducedMotion.addEventListener('change', () => this.refresh());
            this.refresh();
        }
        active() {
            return this.element.dataset.heroCarousel === root.dataset.theme;
        }
        schedule() {
            clearTimeout(this.timer);
            if (!this.active() || document.hidden || reducedMotion.matches || this.paused || this.pending)
                return;
            this.timer = window.setTimeout(() => { void this.show(this.current + 1); }, 7000);
        }
        async show(index) {
            clearTimeout(this.timer);
            const revision = ++this.revision;
            this.requested = (index + this.frames.length) % this.frames.length;
            const target = this.requested;
            const image = this.frames[target];
            this.pending = true;
            // Only the active theme's first frame is requested at startup. Every other
            // image is requested on its first visit, then reused from this DOM node.
            if (!image.hasAttribute('src')) {
                image.loading = 'eager';
                image.src = image.dataset.src;
            }
            try {
                await image.decode();
            }
            catch {
                if (revision !== this.revision)
                    return;
                this.pending = false;
                this.requested = this.current;
                this.count.textContent = '图片暂未载入';
                this.schedule();
                return;
            }
            // Fast repeated page choices must not let a slower earlier load win.
            if (revision !== this.revision)
                return;
            this.frames[this.current].classList.remove('is-active');
            this.frames[this.current].setAttribute('aria-hidden', 'true');
            this.current = target;
            this.pending = false;
            image.classList.add('is-loaded', 'is-active');
            image.setAttribute('aria-hidden', 'false');
            this.pages.forEach((page, position) => page.setAttribute('aria-pressed', String(position === target)));
            this.count.textContent = String(target + 1).padStart(2, '0') + ' / ' + String(this.frames.length).padStart(2, '0');
            this.schedule();
        }
        refresh() {
            this.pause.textContent = reducedMotion.matches ? '静态模式' : this.paused ? '播放' : '暂停';
            this.pause.disabled = reducedMotion.matches;
            this.pause.setAttribute('aria-pressed', String(this.paused || reducedMotion.matches));
            if (this.active() && !document.hidden && !this.frames[this.current].hasAttribute('src') && !this.pending) {
                void this.show(this.current);
            }
            else
                this.schedule();
        }
    }
    document.querySelectorAll('[data-hero-carousel]').forEach(element => new PostcardCarousel(element));
    const markVisibility = () => root.classList.toggle('page-hidden', document.hidden);
    document.addEventListener('visibilitychange', markVisibility);
    markVisibility();
    if (!reducedMotion.matches) {
        const reveals = [...document.querySelectorAll('.chapter, .section-heading, .field-entry, .install-section, .map-column, .screenshot-invitation, .article > h2')];
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting)
                    continue;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            }
        }, { threshold: .06, rootMargin: '0px 0px -24px 0px' });
        root.classList.add('has-scroll-effects');
        reveals.forEach((element, index) => {
            element.classList.add('reveal-target');
            element.style.setProperty('--reveal-delay', String(index % 3 * 55) + 'ms');
            observer.observe(element);
        });
        reducedMotion.addEventListener('change', () => {
            if (!reducedMotion.matches)
                return;
            observer.disconnect();
            root.classList.remove('has-scroll-effects');
        });
    }
    const hero = document.querySelector('.journal-hero');
    if (hero) {
        const pointer = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 941px)');
        let frame = 0;
        let x = 0;
        let y = 0;
        const reset = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            hero.style.setProperty('--pointer-x', '0');
            hero.style.setProperty('--pointer-y', '0');
        };
        hero.addEventListener('pointermove', event => {
            if (reducedMotion.matches || !pointer.matches)
                return;
            x = event.clientX;
            y = event.clientY;
            if (frame)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const box = hero.getBoundingClientRect();
                hero.style.setProperty('--pointer-x', String((x - box.left) / box.width - .5));
                hero.style.setProperty('--pointer-y', String((y - box.top) / box.height - .5));
            });
        });
        hero.addEventListener('pointerleave', reset);
        pointer.addEventListener('change', reset);
        reducedMotion.addEventListener('change', reset);
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            reset(); });
    }
    const navButton = document.querySelector('[data-nav-toggle]');
    function setNav(open) {
        body.dataset.nav = open ? 'open' : 'closed';
        navButton?.setAttribute('aria-expanded', String(open));
    }
    document.addEventListener('click', event => {
        if (clicked(event, '[data-nav-toggle]'))
            setNav(body.dataset.nav !== 'open');
        if (clicked(event, '[data-nav-scrim], .sidebar a'))
            setNav(false);
        const toggle = clicked(event, '[data-group-toggle]');
        if (!toggle)
            return;
        const group = toggle.closest('.nav-group');
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
    const tocLinks = [...document.querySelectorAll('.toc a[href^="#"]')];
    if (tocLinks.length) {
        const byId = new Map(tocLinks.map(link => [decodeURIComponent(link.hash.slice(1)), link]));
        const visible = new Map();
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting)
                    visible.set(entry.target.id, entry.target);
                else
                    visible.delete(entry.target.id);
            }
            const first = [...visible.values()].sort((a, b) => a.offsetTop - b.offsetTop)[0];
            if (!first)
                return;
            tocLinks.forEach(link => link.classList.toggle('active', link === byId.get(first.id)));
        }, { rootMargin: '-100px 0px -65% 0px' });
        for (const id of byId.keys()) {
            const heading = document.getElementById(id);
            if (heading)
                observer.observe(heading);
        }
    }
    document.addEventListener('click', async (event) => {
        const button = clicked(event, '[data-copy]');
        if (!button)
            return;
        const code = button.closest('.code-block').querySelector('code');
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
            try {
                await navigator.clipboard.writeText(text);
                done();
                return;
            }
            catch { /* Use selection fallback. */ }
        }
        const area = document.createElement('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;opacity:0';
        document.body.append(area);
        area.select();
        try {
            if (document.execCommand('copy'))
                done();
        }
        finally {
            area.remove();
            button.focus();
        }
    });
    const tabList = document.querySelector('[data-install-tabs]');
    if (tabList) {
        const buttons = [...tabList.querySelectorAll('button[aria-controls]')];
        const select = (button) => {
            buttons.forEach(item => {
                const selected = item === button;
                item.setAttribute('aria-selected', String(selected));
                item.tabIndex = selected ? 0 : -1;
                document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
            });
        };
        buttons.forEach((button, position) => {
            button.addEventListener('click', () => select(button));
            button.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
                    next = (position + 1) % buttons.length;
                else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
                    next = (position - 1 + buttons.length) % buttons.length;
                else if (event.key === 'Home')
                    next = 0;
                else if (event.key === 'End')
                    next = buttons.length - 1;
                else
                    return;
                event.preventDefault();
                buttons[next].focus();
                select(buttons[next]);
            });
        });
    }
    const lightbox = document.querySelector('[data-lightbox]');
    let lightboxReturn = null;
    const lightboxImage = lightbox.querySelector('img');
    function closeLightbox() {
        if (lightbox.dataset.open !== 'true')
            return;
        lightbox.dataset.open = 'false';
        body.classList.remove('no-scroll');
        lightboxImage.removeAttribute('src');
        lightboxReturn?.focus();
    }
    document.addEventListener('click', event => {
        const image = clicked(event, '.article img');
        if (image) {
            lightboxReturn = image;
            lightboxImage.src = image.dataset.full || image.src;
            lightboxImage.alt = image.alt;
            lightbox.querySelector('figcaption').textContent = image.dataset.caption || image.alt;
            lightbox.dataset.open = 'true';
            body.classList.add('no-scroll');
            lightbox.querySelector('button').focus();
        }
        if (event.target === lightbox || clicked(event, '[data-lightbox-close]'))
            closeLightbox();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape')
        closeLightbox(); });
    const overlay = document.querySelector('[data-search]');
    const input = overlay.querySelector('input');
    const list = overlay.querySelector('.search-results');
    const empty = overlay.querySelector('.search-empty');
    let loading;
    let active = -1;
    let searchReturn = null;
    const loadIndex = () => loading ??= fetch('assets/search.json')
        .then(response => response.ok ? response.json() : [])
        .catch(() => []);
    function highlight(element, text, query) {
        if (!query) {
            element.textContent = text;
            return;
        }
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
    function rank(entry, query) {
        const title = entry.t.toLowerCase();
        if (title === query)
            return 0;
        if (title.startsWith(query))
            return 1;
        if (title.includes(query))
            return 2;
        if ((entry.h + ' ' + entry.x).toLowerCase().includes(query))
            return 3;
        return -1;
    }
    async function search() {
        const query = input.value.trim().toLowerCase();
        const data = await loadIndex();
        // A later input owns the visible results if the index arrived asynchronously.
        if (input.value.trim().toLowerCase() !== query)
            return;
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
            ]) {
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
    function openSearch() {
        searchReturn = document.activeElement;
        overlay.dataset.open = 'true';
        body.classList.add('no-scroll');
        input.focus();
        input.select();
        void loadIndex();
    }
    function closeSearch() {
        overlay.dataset.open = 'false';
        body.classList.remove('no-scroll');
        searchReturn?.focus();
    }
    document.addEventListener('click', event => {
        if (clicked(event, '[data-search-open]')) {
            event.preventDefault();
            openSearch();
        }
        if (event.target === overlay || clicked(event, '[data-search-close]'))
            closeSearch();
    });
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (overlay.dataset.open === 'true')
                closeSearch();
            else
                openSearch();
            return;
        }
        if (overlay.dataset.open !== 'true')
            return;
        const links = [...list.querySelectorAll('a')];
        if (event.key === 'Escape')
            closeSearch();
        else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && links.length) {
            event.preventDefault();
            active = (active + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links.forEach((link, index) => link.classList.toggle('active', index === active));
            links[active].scrollIntoView({ block: 'nearest' });
        }
        else if (event.key === 'Enter' && active >= 0)
            links[active].click();
    });
})();
