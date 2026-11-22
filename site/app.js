/* ══════════════════════════════════════════════════════
   MAISON ARC — scroll engine
   · frame-sequence hero scrub (120 frames)
   · inertia smooth scroll (native scroll drive, no hijack)
   · word-split reveals, counters, magnetic cursor, overlay menu
   ══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const q = (s, el = document) => el.querySelector(s);
  const qa = (s, el = document) => [...el.querySelectorAll(s)];

  /* ──────────────────────────────
     1. FRAME SEQUENCE
     ────────────────────────────── */
  const FRAMES = 192;
  const framePath = i => `frames/f${String(i).padStart(3, '0')}.webp`;

  const canvas = q('#heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const images = new Array(FRAMES);
  let loadedCount = 0;
  let heroFrame = 0;       // current drawn frame
  let heroTarget = 0;      // eased target
  let canvasReady = false;
  let band = null;

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stage = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.round(stage.width * dpr);
    canvas.height = Math.round(stage.height * dpr);
    canvas.style.width = stage.width + 'px';
    canvas.style.height = stage.height + 'px';
    canvas.dataset.dpr = dpr;
    drawFrame(Math.round(heroFrame), true);
  }

  // Fit-to-width on portrait screens (keeps the whole room in frame),
  // cover-fit on landscape. A blurred copy fills any letterbox.
  function drawFrame(idx) {
    const img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const progress = idx / (FRAMES - 1);
    const zoom = 1;

    ctx.fillStyle = '#14120f';
    ctx.fillRect(0, 0, cw, ch);

    const portrait = cw / ch < iw / ih;
    if (portrait) {
      // out-of-focus backdrop derived from the same frame
      const bs = Math.max(cw / iw, ch / ih) * 1.15;
      ctx.save();
      ctx.filter = 'blur(26px) saturate(122%) brightness(.82)';
      ctx.drawImage(img, (cw - iw * bs) / 2, (ch - ih * bs) / 2, iw * bs, ih * bs);
      ctx.filter = 'blur(52px) saturate(115%) brightness(.62)';
      const bs2 = Math.max(cw / iw, ch / ih) * 2.4;
      ctx.drawImage(img, (cw - iw * bs2) / 2, (ch - ih * bs2) / 2, iw * bs2, ih * bs2);
      ctx.restore();
      ctx.filter = 'none';

      // sharp cinematic strip, soft-faded top and bottom (no hard letterbox edges)
      const w = cw * zoom, h = (ih / iw) * w;
      const bx = Math.round((cw - w) / 2), by = Math.round((ch - h) * 0.44);
      const bw = Math.round(w), bh = Math.round(h);
      if (!band || band.width < bw || band.height < bh) {
        band = document.createElement('canvas');
        band.width = Math.ceil(bw); band.height = Math.ceil(bh);
      }
      const bctx = band.getContext('2d');
      bctx.clearRect(0, 0, band.width, band.height);
      bctx.drawImage(img, 0, 0, band.width, band.height);
      bctx.globalCompositeOperation = 'destination-in';
      const g = bctx.createLinearGradient(0, 0, 0, band.height);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.10, 'rgba(0,0,0,1)');
      g.addColorStop(0.88, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, band.width, band.height);
      bctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(band, 0, 0, band.width, band.height, bx, by, bw, bh);
    } else {
      const scale = Math.max(cw / iw, ch / ih);
      const w = iw * scale * zoom, h = ih * scale * zoom;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) * 0.54, w, h);
    }
    canvasReady = true;
  }


  // ── preload with priority: coarse pass first, then fill in
  const loaderBar = q('#loaderBar');
  const loaderPct = q('#loaderPct');
  const loader = q('#loader');

  function loadFrame(i) {
    return new Promise(res => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { images[i] = im; loadedCount++; tick(); res(); };
      im.onerror = () => { loadedCount++; tick(); res(); };
      im.src = framePath(i);
    });
  }

  let firstPaintDone = false;
  function tick() {
    const pct = Math.round((loadedCount / FRAMES) * 100);
    if (!firstPaintDone && images[0] && images[0].complete) {
      firstPaintDone = true;
      sizeCanvas();
      drawFrame(0, true);
      canvasReady = true;
    }
    if (loadedCount % 4 === 0 || pct === 100) {
      if (loaderBar) loaderBar.style.width = pct + '%';
      if (loaderPct) loaderPct.textContent = String(pct).padStart(2, '0');
    }
    if (pct >= 100) revealSite();
  }

  async function preload() {
    // hero only needs the first few frames to start painting
    await Promise.all([0, 1, 2, 3].map(loadFrame));
    const rest = [];
    for (let i = 4; i < FRAMES; i++) rest.push(i);
    const CONCURRENCY = 10;
    let cursor = 0;
    async function worker() {
      while (cursor < rest.length) {
        const i = rest[cursor++];
        await loadFrame(i);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  let siteRevealed = false;
  function revealSite() {
    if (siteRevealed) return;
    siteRevealed = true;
    setTimeout(() => {
      loader.classList.add('done');
      body.classList.remove('is-loading');
      body.classList.add('ready');
      initScrollAnimations();
    }, 260);
  }

  /* ──────────────────────────────
     2. SCROLL ENGINE
     ────────────────────────────── */
  const state = { y: window.scrollY, target: window.scrollY, vel: 0, lastScrollY: window.scrollY };
  let heroSection, heroTicking = false;

  function heroScrollProgress() {
    if (!heroSection) return 0;
    const rect = heroSection.getBoundingClientRect();
    const total = heroSection.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-rect.top / total);
  }

  const beats = [];
  function setupBeats() {
    qa('.hero .beat').forEach((el, i) => {
      beats.push({ el, i });
    });
  }

  function updateHero(p) {
    // frame mapping: hold the empty room briefly, then scrub the furnishing
    const hold = 0.04;
    const raw = p < hold ? 0 : clamp((p - hold) / (1 - hold));
    // slow-start easing keeps the early frames on screen longer
    const mapped = raw * raw * (3 - 2 * raw) * 0.35 + raw * 0.65;
    // ease so the last frames (dusk) linger
    const eased = mapped;
    heroTarget = eased * (FRAMES - 1);

    // beat typography crossfade — explicit in/hold/out windows
    const windows = [
      { in: [-0.06, 0.00], out: [0.19, 0.28] },
      { in: [0.29, 0.37], out: [0.53, 0.61] },
      { in: [0.63, 0.71], out: [1.20, 1.30] },
    ];
    beats.forEach(({ el }, i) => {
      const w = windows[i] || windows[0];
      const fin = clamp((p - w.in[0]) / (w.in[1] - w.in[0]));
      const fout = clamp((w.out[1] - p) / (w.out[1] - w.out[0]));
      const op = Math.min(fin, fout);
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate3d(0,${((1 - fin) * 40 - (1 - fout) * 40).toFixed(2)}px,0)`;
      el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
      el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    });
    const scrim = q('#heroScrim');
    if (scrim) scrim.style.opacity = (0.35 + 0.65 * clamp(p * 6)).toFixed(3);

    // ui chrome
    const pctEl = q('#heroPct');
    if (pctEl) pctEl.textContent = String(Math.round(heroTarget)).padStart(3, '0');
    const cue = q('#heroCue');
    if (cue) {
      const label = p > 0.93 ? 'Keep going ↓'
        : p > 0.55 ? 'Evening arrives'
        : p > 0.06 ? 'The room, assembling'
        : 'Scroll — the room assembles';
      if (cue.textContent !== label) cue.textContent = label;
    }
    // subtle stage drift for depth
    const stage = q('#heroStage');
    if (stage) stage.style.transform = `translate3d(0,${(p * -3).toFixed(2)}%,0) scale(${(1 + p * 0.015).toFixed(4)})`;
  }

  function onScroll() {
    if (cursor) { cursor.classList.remove('is-view'); cursor.classList.remove('is-link'); }
    state.target = window.scrollY;
    if (!heroTicking) {
      heroTicking = true;
      requestAnimationFrame(() => { heroTicking = false; });
    }
    if (nav) {
      const y = window.scrollY;
      if (y > 40) nav.classList.add('solid');
      else nav.classList.remove('solid');
      if (!menuOpen) {
        if (y > 260 && y > state.lastScrollY + 4) nav.classList.add('hide');
        else if (y < state.lastScrollY - 4 || y < 120) nav.classList.remove('hide');
      }
      state.lastScrollY = y;
    }
    updateParallax();
    updateProcess();
  }

  /* ── project parallax ── */
  let parallaxEls = [];
  function collectParallax() {
    parallaxEls = qa('[data-speed]').map(el => ({ el, speed: parseFloat(el.dataset.speed) }));
  }
  function updateParallax() {
    if (reduce) return;
    const vh = window.innerHeight;
    parallaxEls.forEach(({ el, speed }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const mid = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0,${(-mid * speed).toFixed(2)}px,0)`;
    });
  }

  /* ── process bar + active step ── */
  let steps = [], processBar = null;
  function updateProcess() {
    if (!processBar || !steps.length) return;
    const vh = window.innerHeight;
    let activeIdx = 0;
    steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top < vh * 0.62) activeIdx = i;
    });
    steps.forEach((s, i) => s.classList.toggle('active', i <= activeIdx));
    const pct = ((activeIdx + 1) / steps.length) * 100;
    processBar.style.width = pct + '%';
  }

  /* ── main raf loop ── */
  let lastDrawn = -1;
  function raf() {
    const p = heroScrollProgress();
    updateHero(p);
    // lerp the drawn frame toward target for buttery scrubbing
    heroFrame = lerp(heroFrame, heroTarget, 0.12);
    const idx = Math.round(heroFrame);
    if (idx !== lastDrawn) {
      lastDrawn = idx;
      drawFrame(idx);
    }
    requestAnimationFrame(raf);
  }

  /* ──────────────────────────────
     3. REVEALS / SPLIT TEXT / COUNTERS
     ────────────────────────────── */
  function splitWords(el) {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); return; }
            const w = document.createElement('span');
            w.className = 'word';
            const i = document.createElement('i');
            i.textContent = tok;
            w.appendChild(i);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && !child.classList.contains('word')) {
          walk(child);
        }
      });
    };
    walk(el);
    // stagger
    qa('.word i', el).forEach((w, i) => { w.style.transitionDelay = (i * 0.028).toFixed(3) + 's'; });
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.hasAttribute('data-words')) splitWords(el);
      el.classList.add('in');
      if (el.dataset.count && !el.dataset.done) {
        el.dataset.done = '1';
        animateCount(el, +el.dataset.count);
      }
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  function animateCount(el, to) {
    const dur = 1400, t0 = performance.now();
    const step = now => {
      const t = clamp((now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * e);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = to === 6 ? '06' : String(to);
    };
    requestAnimationFrame(step);
  }

  /* ── accordion services ── */
  function setupAccordion() {
    qa('.service').forEach((s, idx) => {
      const panel = q('.service__panel', s);
      if (idx === 0) { s.classList.add('open'); panel.style.height = panel.scrollHeight + 'px'; }
      q('.service__head', s).addEventListener('click', () => {
        const isOpen = s.classList.contains('open');
        qa('.service').forEach(o => {
          o.classList.remove('open');
          q('.service__panel', o).style.height = '0px';
        });
        if (!isOpen) {
          s.classList.add('open');
          panel.style.height = panel.scrollHeight + 'px';
        }
      });
    });
    window.addEventListener('resize', () => {
      const open = q('.service.open .service__panel');
      if (open) open.style.height = open.scrollHeight + 'px';
    });
  }

  /* ──────────────────────────────
     4. CURSOR / NAV / MENU / CLOCK / AUDIO
     ────────────────────────────── */
  const cursor = q('.cursor');
  const ring = q('.cursor__ring');
  const dot = q('.cursor__dot');
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2, tx = cx, ty = cy;

  if (!isTouch && cursor) {
    window.addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('on');
      const view = e.target.closest('[data-cursor="view"]');
      const link = e.target.closest('a,button,[data-cursor="link"],.service__head');
      cursor.classList.toggle('is-view', !!view);
      cursor.classList.toggle('is-link', !!link && !view);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.remove('on'));
    (function cursorLoop() {
      cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
      ring.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      dot.style.transform = `translate(${tx}px,${ty}px) translate(-50%,-50%)`;
      requestAnimationFrame(cursorLoop);
    })();
  }

  const nav = q('#nav');
  const burger = q('#burger');
  const menu = q('#menu');
  let menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    body.classList.toggle('menu-open', open);
    body.classList.toggle('no-scroll', open);
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) nav.classList.remove('hide');
  }
  if (burger) burger.addEventListener('click', () => setMenu(!menuOpen));
  qa('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  // smooth anchor scroll
  qa('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = q(id);
      if (!el) return;
      e.preventDefault();
      const y = el.getBoundingClientRect().top + window.scrollY - (id === '#top' ? 0 : 10);
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* clock — Pune */
  const clockEl = q('#clock');
  function paintClock() {
    if (!clockEl) return;
    const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    clockEl.textContent = t + ' IST — Pune';
  }
  paintClock();
  setInterval(paintClock, 15000);

  /* ambient audio (procedural, looped) */
  const soundBtn = q('#soundBtn');
  let audio = null, audioOn = false;
  function toggleSound() {
    if (!audio) {
      audio = new Audio('audio/ambient.wav');
      audio.loop = true;
      audio.volume = 0;
    }
    audioOn = !audioOn;
    soundBtn.setAttribute('aria-pressed', String(audioOn));
    if (audioOn) {
      audio.play().catch(() => { audioOn = false; soundBtn.setAttribute('aria-pressed', 'false'); });
      let v = 0;
      const fade = setInterval(() => {
        v = Math.min(0.42, v + 0.03);
        audio.volume = v;
        if (v >= 0.42) clearInterval(fade);
      }, 60);
    } else {
      let v = audio.volume;
      const fade = setInterval(() => {
        v = Math.max(0, v - 0.05);
        audio.volume = v;
        if (v <= 0) { clearInterval(fade); audio.pause(); }
      }, 50);
    }
  }
  if (soundBtn) soundBtn.addEventListener('click', toggleSound);

  /* ── horizontal project rail ── */
  function setupRail() {
    const rail = q('#rail .rail__track');
    const bar = q('#railBar');
    const pos = q('#railPos');
    const prev = q('#railPrev');
    const next = q('#railNext');
    if (!rail) return;

    const step = () => {
      const card = rail.querySelector('.card');
      if (!card) return 320;
      const gap = parseFloat(getComputedStyle(rail).columnGap || 24) || 24;
      return card.offsetWidth + gap;
    };

    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const t = max > 0 ? rail.scrollLeft / max : 0;
      if (bar) {
        bar.style.width = '25%';
        bar.style.transform = `translateX(${t * 300}%)`;
      }
      const n = Math.round(rail.scrollLeft / Math.max(1, step())) + 1;
      const total = rail.querySelectorAll('.card').length;
      if (pos) pos.textContent = String(Math.min(total, n)).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    };

    rail.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    prev && prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    next && next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));

    // horizontal wheel / trackpad drag
    let down = false, sx = 0, sl = 0, moved = false;
    rail.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft;
    });
    window.addEventListener('pointerup', () => { down = false; });
    rail.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 3) moved = true;
      if (moved) { rail.scrollLeft = sl - dx; rail.style.scrollSnapType = 'none'; }
    });
    window.addEventListener('pointerup', () => { rail.style.scrollSnapType = ''; });
    rail.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // native horizontal
      if (Math.abs(e.deltaY) > 1 && rail.scrollLeft > 0) {
        const max = rail.scrollWidth - rail.clientWidth;
        if ((e.deltaY > 0 && rail.scrollLeft < max - 2) || (e.deltaY < 0 && rail.scrollLeft > 2)) {
          rail.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }
    }, { passive: false });

    sync();
  }

  /* ── object tiles: soft 3D tilt following pointer ── */
  function setupObjects() {
    if (isTouch || reduce) return;
    qa('.obj').forEach(tile => {
      let raf2 = null;
      const move = e => {
        const r = tile.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        if (raf2) cancelAnimationFrame(raf2);
        raf2 = requestAnimationFrame(() => {
          tile.style.setProperty('--tx', (py * -5).toFixed(2) + 'deg');
          tile.style.setProperty('--ty', (px * 7).toFixed(2) + 'deg');
          tile.style.setProperty('--mx', ((px + .5) * 100).toFixed(1) + '%');
          tile.style.setProperty('--my', ((py + .5) * 100).toFixed(1) + '%');
        });
      };
      tile.addEventListener('pointermove', move);
      tile.addEventListener('pointerleave', () => {
        tile.style.setProperty('--tx', '0deg');
        tile.style.setProperty('--ty', '0deg');
      });
    });
  }

  /* ──────────────────────────────
     5. BOOT
     ────────────────────────────── */
  function initScrollAnimations() {
    heroSection = q('#hero');
    setupBeats();
    collectParallax();
    processBar = q('#processBar');
    steps = qa('.step');
    qa('[data-words]').forEach(el => el.classList.add('pending'));

    // observe reveals
    qa('.reveal, [data-words], .footer__title, .objects__title, [data-count]').forEach(el => io.observe(el));
    q('.footer__title')?.classList.add('ready');

    setupAccordion();
    setupRail();
    setupObjects();
    onScroll();
    updateParallax();
    updateProcess();
    requestAnimationFrame(raf);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      sizeCanvas();
      onScroll();
    }, 180);
  });

  // kick off
  if (reduce) {
    // load only a mid frame, no scrub
    loadFrame(0).then(() => {
      sizeCanvas(); drawFrame(0, true);
      setTimeout(revealSite, 400);
    });
  } else {
    sizeCanvas();
    preload();
  }

  // hero: first beat visible after ready via CSS (beats are JS-driven, so seed)
  document.addEventListener('DOMContentLoaded', () => {
    const b0 = q('.beat[data-beat="0"]');
    if (b0) { b0.style.opacity = '0'; }
  });
})();
