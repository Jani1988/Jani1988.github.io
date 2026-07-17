/* =========================================================================
   Gebäudereinigung Rada — main.js
   Vanilla JS, kein Framework, kein Build. Reihenfolge:
     1) Header/Footer-Partials per fetch() laden (data-include, root-absolut)
     2) danach alle Interaktionen initialisieren (Header/Footer sind dann im DOM)
   Interaktionen sind die 1:1-Vanilla-Nachbildung des des8gn-Export-Scripts:
   Scroll-Reveal, Header-Scroll-Zustand + Scroll-Progress, Mobile-Burger,
   Custom-Cursor, Magnetic-Buttons und die style-hover/focus/active-Handler.
   prefers-reduced-motion und pointer:fine werden respektiert.
   ========================================================================= */

'use strict';

/* Umgebung einmal ermitteln */
var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var FINE_POINTER   = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

/* ------------------------------------------------------------------------
   HTML-Includes (Header/Footer)
   Lädt alle Elemente mit [data-include] per fetch() und ersetzt deren Inhalt.
   Pfade sind root-absolut (z. B. /partials/header.html) — kein {{ROOT}} nötig.
   ------------------------------------------------------------------------ */
async function loadIncludes() {
  const targets = Array.from(document.querySelectorAll('[data-include]'));
  for (const el of targets) {
    const url = el.getAttribute('data-include');
    if (!url) continue;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      el.innerHTML = await res.text();
    } catch (e) {
      console.error('Include failed:', e);
      el.innerHTML = '<div style="padding:12px;border:1px solid rgba(255,0,0,.35);border-radius:12px">' +
        'Include konnte nicht geladen werden: <code>' + url + '</code></div>';
    }
  }
}

/* ------------------------------------------------------------------------
   style-hover / style-focus / style-active
   Wendet die im Export als Attribut hinterlegten Deklarationen bei Interaktion
   an und stellt beim Verlassen den vorherigen Inline-Zustand wieder her.
   ------------------------------------------------------------------------ */
function initStyleBehaviors(root) {
  root = root || document;

  const parse = (str) => (str || '')
    .split(';').map((s) => s.trim()).filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return i === -1 ? null : [d.slice(0, i).trim(), d.slice(i + 1).trim()];
    })
    .filter(Boolean);

  function bind(el, attr, onEvents, offEvents) {
    const flag = '_sb_' + attr;
    if (el[flag]) return;
    el[flag] = true;
    const decls = parse(el.getAttribute(attr));
    if (!decls.length) return;
    let saved = null;

    const on = () => {
      saved = {};
      decls.forEach((d) => { saved[d[0]] = el.style.getPropertyValue(d[0]); });
      decls.forEach((d) => {
        const imp = /!important/i.test(d[1]);
        el.style.setProperty(d[0], d[1].replace(/\s*!important/i, '').trim(), imp ? 'important' : '');
      });
    };
    const off = () => {
      if (!saved) return;
      decls.forEach((d) => {
        if (saved[d[0]]) el.style.setProperty(d[0], saved[d[0]]);
        else el.style.removeProperty(d[0]);
      });
      saved = null;
    };

    onEvents.forEach((ev) => el.addEventListener(ev, on));
    offEvents.forEach((ev) => el.addEventListener(ev, off));
  }

  root.querySelectorAll('[style-hover]').forEach((el) => bind(el, 'style-hover', ['mouseenter'], ['mouseleave']));
  root.querySelectorAll('[style-focus]').forEach((el) => bind(el, 'style-focus', ['focus'], ['blur']));
  root.querySelectorAll('[style-active]').forEach((el) => bind(el, 'style-active',
    ['mousedown', 'touchstart'], ['mouseup', 'mouseleave', 'touchend', 'touchcancel']));
}

/* ------------------------------------------------------------------------
   Aktive Navigation
   Setzt aria-current="page" auf den passenden Header-/Mobile-Menü-Link
   anhand des aktuellen Pfads (Header kommt aus einem Partial, daher per JS).
   ------------------------------------------------------------------------ */
function initActiveNav() {
  const norm = (p) => {
    try { p = new URL(p, location.href).pathname; } catch (e) { /* noop */ }
    return p.replace(/\/index\.html$/, '/') || '/';
  };
  const here = norm(location.pathname);
  document.querySelectorAll('.rr-navlink, .rr-mobile-menu a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^(tel:|mailto:|https?:)/.test(href)) return;
    const link = norm(href);
    let active = link === here;
    if (!active && link === '/leistungen.html' &&
        (here.indexOf('/leistungen-') === 0 || here.indexOf('/leistungen/') === 0)) {
      active = true; // Leistungs-Detail- und Standortseiten -> "Leistungen" aktiv
    }
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ------------------------------------------------------------------------
   Scroll-Reveal  ([data-reveal], optional [data-reveal-delay])
   ------------------------------------------------------------------------ */
var _revealIO = null;
function initReveal(root) {
  const els = (root || document).querySelectorAll('[data-reveal]');
  if (REDUCED_MOTION) {
    els.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }
  if (!_revealIO) {
    _revealIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'none';
          e.target.setAttribute('data-revealed', '1');
          _revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
  }
  els.forEach((el) => {
    if (el.hasAttribute('data-rv')) return;
    el.setAttribute('data-rv', '1');
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity .9s cubic-bezier(.22,1,.36,1), transform .9s cubic-bezier(.22,1,.36,1)';
    el.style.transitionDelay = (el.getAttribute('data-reveal-delay') || '0') + 'ms';
    _revealIO.observe(el);
  });
}

/* ------------------------------------------------------------------------
   Magnetic-Buttons  ([data-magnetic]) — nur feine Zeiger, nicht reduced-motion
   ------------------------------------------------------------------------ */
function initMagnetic(root) {
  if (REDUCED_MOTION || !FINE_POINTER) return;
  (root || document).querySelectorAll('[data-magnetic]').forEach((el) => {
    if (el._mag) return;
    el._mag = true;
    el.addEventListener('mousemove', (ev) => {
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left - r.width / 2) / r.width;
      const y = (ev.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = 'translate(' + (x * 10).toFixed(1) + 'px,' + (y * 8).toFixed(1) + 'px)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1)';
      el.style.transform = 'translate(0,0)';
      setTimeout(() => { el.style.transition = ''; }, 560);
    });
  });
}

/* ------------------------------------------------------------------------
   Header-Scroll-Zustand + Scroll-Progress-Bar (oben, gradient)
   ------------------------------------------------------------------------ */
function createProgressBar() {
  let existing = document.getElementById('rr-progress');
  if (existing) return existing.firstElementChild;
  const wrap = document.createElement('div');
  wrap.id = 'rr-progress';
  wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:90;height:3px;background:transparent;pointer-events:none;';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#0AA3DC,#1EB45F);';
  wrap.appendChild(fill);
  document.body.appendChild(wrap);
  return fill;
}

function initHeaderScroll() {
  const header = document.querySelector('.rr-header');
  const fill = createProgressBar();
  let raf = null;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY || window.pageYOffset || 0;
      if (fill) fill.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      if (header) {
        const scrolled = y > 20;
        header.style.padding = scrolled ? '10px 4vw' : '16px 4vw';
        header.style.boxShadow = scrolled ? '0 10px 34px rgba(12,30,44,.1)' : 'none';
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ------------------------------------------------------------------------
   Mobile-Burger — öffnet/schließt das Overlay-Menü ([data-mobile-menu])
   ------------------------------------------------------------------------ */
function initBurger() {
  const btn = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!btn || !menu) return;

  const setOpen = (open) => {
    if (open) menu.removeAttribute('hidden');
    else menu.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('rr-nav-open', open);
  };

  btn.addEventListener('click', () => setOpen(menu.hasAttribute('hidden')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hasAttribute('hidden')) setOpen(false);
  });
  const mq = window.matchMedia('(min-width: 901px)');
  if (mq.addEventListener) mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* ------------------------------------------------------------------------
   Custom-Cursor (Ring + Dot) — nur pointer:fine, nicht reduced-motion
   ------------------------------------------------------------------------ */
function initCursor() {
  if (REDUCED_MOTION || !FINE_POINTER) return;

  const ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;top:0;left:0;width:38px;height:38px;border-radius:50%;border:1.5px solid rgba(12,30,44,.45);pointer-events:none;z-index:9999;transform:translate(-100px,-100px);transition:width .3s,height .3s,border-color .3s,opacity .3s;margin:-19px 0 0 -19px;';
  const dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;top:0;left:0;width:7px;height:7px;border-radius:50%;background:linear-gradient(115deg,#0AA3DC,#1EB45F);pointer-events:none;z-index:9999;transform:translate(-100px,-100px);margin:-3.5px 0 0 -3.5px;';
  document.body.appendChild(ring);
  document.body.appendChild(dot);

  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
  });
  const loop = () => {
    rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
    ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('mouseover', (e) => {
    const hit = e.target.closest && e.target.closest('a,button,input,select,textarea,label,[data-magnetic]');
    ring.style.width = hit ? '58px' : '38px';
    ring.style.height = hit ? '58px' : '38px';
    ring.style.margin = hit ? '-29px 0 0 -29px' : '-19px 0 0 -19px';
    ring.style.borderColor = hit ? 'rgba(30,180,95,.8)' : 'rgba(12,30,44,.45)';
  });
}

/* ------------------------------------------------------------------------
   Bootstrap
   Marquee ist reine CSS-Animation (@keyframes marquee) und braucht kein JS.
   ------------------------------------------------------------------------ */
(async () => {
  await loadIncludes();      // Header/Footer erst danach im DOM
  initActiveNav();
  initStyleBehaviors(document);
  initReveal(document);
  initMagnetic(document);
  initHeaderScroll();
  initBurger();
  initCursor();
})();
