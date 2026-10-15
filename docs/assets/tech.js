/* Tech edition — interactive dot field, target-tracking cursor, click
   shockwaves, word reveals, label decrypt and a restrained glitch.
   Everything here is decorative: content stays visible and usable when the
   script fails, on touch devices, and when motion is reduced. */
(() => {
  'use strict';
  const root = document.documentElement, body = document.body;
  if (!body) return;
  body.classList.add('tech-site');
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const fineQ = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => reduceQ.matches || root.classList.contains('motion-reduced');
  const fine = () => fineQ.matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const ACCENT = [122, 162, 255];
  const make = (tag, cls, parent = body) => { const el = document.createElement(tag); el.className = cls; el.setAttribute('aria-hidden', 'true'); parent.append(el); return el; };

  /* ------------------------------------------------------------------
     Li mark: the logo's own 64-unit geometry, reused at every size
     ------------------------------------------------------------------ */
  const LI = {
    frame: '<rect class="li-frame" x="6.75" y="6.75" width="50.5" height="50.5" rx="10" pathLength="1"/>',
    three: '<path class="li-three" d="M13.6 12.6H19.4L16.1 16.4A2.9 2.9 0 1 1 13.4 20.6" pathLength="1"/>',
    l: '<path class="li-l" d="M20 24V47H36" pathLength="1"/>',
    i: '<path class="li-i" d="M43.5 33V50.25" pathLength="1"/>',
    dot: '<circle class="li-halo" cx="43.5" cy="25" r="10"/><circle class="li-dot" cx="43.5" cy="25" r="3.9"/>'
  };
  const liSvg = (cls, extra = '') => `<svg class="li-svg ${cls}" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">${LI.frame}${LI.three}${LI.l}${LI.i}${LI.dot}${extra}</svg>`;
  make('div', 'li-defs').innerHTML = '<svg width="0" height="0" focusable="false"><defs>'
    + '<radialGradient id="li-glow"><stop offset="0" stop-color="#7aa2ff" stop-opacity=".8"/><stop offset=".4" stop-color="#7aa2ff" stop-opacity=".22"/><stop offset="1" stop-color="#7aa2ff" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="li-fade" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="60"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".01"/></linearGradient>'
    + '</defs></svg>';

  // First page of a visit: the mark draws itself full-screen, then flies into the header.
  // The head script sets .li-intro-on so the cover is there from the first paint; if this
  // script arrives late the cover has already lifted itself, so the intro is skipped.
  let introDone = Promise.resolve();
  if (root.classList.contains('li-intro-on')) introDone = intro();
  function intro() {
    const target = document.querySelector('.header .brand-mark');
    try { sessionStorage.setItem('li-intro', '1'); } catch {}
    if (!target || reduced() || performance.now() - (self.liIntroAt || 0) > 1200) { root.classList.remove('li-intro-on'); return Promise.resolve(); }
    const veil = make('div', 'li-intro');
    veil.innerHTML = `<div class="li-intro-mark">${liSvg('', '<circle class="li-wave" cx="43.5" cy="25" r="3.9"/>')}</div>`
      + '<p class="li-intro-cap"><span>CHUANGQI LEE</span><b></b><span>Li · 03</span></p>';
    const mark = veil.firstElementChild;
    root.classList.remove('li-intro-on'); // the veil is opaque itself; the cover sits above <body> and would hide it
    return new Promise(done => {
      let gone = false;
      const leave = () => {
        if (gone) return; gone = true; clearTimeout(timer);
        const a = mark.getBoundingClientRect(), b = target.getBoundingClientRect();
        mark.style.transform = `translate(${(b.left + b.width / 2 - a.left - a.width / 2).toFixed(1)}px,${(b.top + b.height / 2 - a.top - a.height / 2).toFixed(1)}px) scale(${(b.width / a.width).toFixed(4)})`;
        veil.classList.add('is-leaving');
        done();
        setTimeout(() => { veil.remove(); target.classList.add('li-ping'); }, 780);
      };
      const timer = setTimeout(leave, 1550);
      requestAnimationFrame(() => veil.classList.add('is-on'));
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(t => addEventListener(t, leave, { once: true, passive: true }));
    });
  }

  /* ------------------------------------------------------------------
     Canvases: a dot field behind the page, effects above it
     ------------------------------------------------------------------ */
  const field = make('canvas', 'tech-field'), fx = make('canvas', 'tech-fx');
  const dctx = field.getContext('2d'), fctx = fx.getContext('2d');
  let W = 0, H = 0, S = 26;
  function resize() {
    W = innerWidth; H = innerHeight; S = fine() ? 26 : 30;
    for (const c of [field, fx]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dirty = true;
  }

  const mouse = { x: -9999, y: -9999, active: false };
  const waves = [];          // click shockwaves travelling through the dot field
  const trail = [], rings = [], streaks = [];
  let dirty = true;

  function drawField(t) {
    dctx.clearRect(0, 0, W, H);
    const R = 170, R2 = R * R, still = reduced();
    const oy = still ? 0 : -((scrollY * .18) % S);
    const live = !still && fine();
    const near = [];
    dctx.fillStyle = 'rgba(255,255,255,.085)';
    dctx.beginPath();
    for (let gy = 0, iy = 0; gy < H + S; gy += S, iy++) {
      const y = gy + oy + S / 2;
      for (let gx = S / 2, ix = 0; gx < W; gx += S, ix++) {
        let x = gx, yy = y, glow = 0;
        if (mouse.active && live) {
          const dx = x - mouse.x, dy = yy - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const d = Math.sqrt(d2) || 1, f = 1 - d / R, e = f * f * (3 - 2 * f);
            x += dx / d * e * 9; yy += dy / d * e * 9; glow = e;
          }
        }
        for (const w of waves) {
          const dx = x - w.x, dy = yy - w.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = d - w.r;
          if (k > -40 && k < 40) {
            const b = Math.exp(-(k * k) / 360) * w.life;
            x += dx / d * b * 12; yy += dy / d * b * 12; glow = Math.max(glow, b);
          }
        }
        if (live && !glow) {
          // a sparse, slow twinkle: a few dots flicker at any moment
          const h = Math.sin(ix * 12.9898 + iy * 78.233) * 43758.5453;
          const tw = Math.sin(t * .0011 + (h - Math.floor(h)) * 6283);
          if (tw > .985) glow = (tw - .985) * 22;
        }
        if (glow > .02) near.push(x, yy, glow);
        else dctx.rect(x - .6, yy - .6, 1.2, 1.2);
      }
    }
    dctx.fill();
    for (let i = 0; i < near.length; i += 3) {
      const g = Math.min(1, near[i + 2]), r = Math.round(255 + (ACCENT[0] - 255) * g), gg = Math.round(255 + (ACCENT[1] - 255) * g);
      dctx.fillStyle = `rgba(${r},${gg},255,${.12 + g * .7})`;
      const s = 1.2 + g * 1.4;
      dctx.fillRect(near[i] - s / 2, near[i + 1] - s / 2, s, s);
    }
  }

  function drawFx() {
    fctx.clearRect(0, 0, W, H);
    // comet trail
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].life -= .06; if (trail[i].life <= 0) trail.splice(i, 1); }
    if (trail.length > 2) {
      fctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i - 1], q = trail[i], k = i / trail.length, a = q.life * k;
        fctx.strokeStyle = `rgba(${Math.round(255 - 133 * (1 - k))},${Math.round(255 - 93 * (1 - k))},255,${a * .55})`;
        fctx.lineWidth = .5 + k * 1.6;
        fctx.beginPath(); fctx.moveTo(p.x, p.y); fctx.lineTo(q.x, q.y); fctx.stroke();
      }
    }
    // click rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.r += (r.max - r.r) * .09; r.life -= .03;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      fctx.strokeStyle = `rgba(255,255,255,${r.life * .55})`; fctx.lineWidth = 1;
      fctx.beginPath(); fctx.arc(r.x, r.y, r.r, 0, 6.2832); fctx.stroke();
    }
    // streaks
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]; s.d += s.v; s.v *= .9; s.life -= .035;
      if (s.life <= 0) { streaks.splice(i, 1); continue; }
      const x1 = s.x + Math.cos(s.a) * s.d, y1 = s.y + Math.sin(s.a) * s.d, len = 4 + s.v * 3;
      fctx.strokeStyle = s.c.replace('A', s.life.toFixed(2)); fctx.lineWidth = 1.2;
      fctx.beginPath(); fctx.moveTo(x1, y1); fctx.lineTo(x1 + Math.cos(s.a) * len, y1 + Math.sin(s.a) * len); fctx.stroke();
    }
    return trail.length || rings.length || streaks.length;
  }

  function shock(x, y, light) {
    waves.push({ x, y, r: 0, life: 1 });
    rings.push({ x, y, r: 2, max: light ? 46 : 64, life: 1 });
    if (light) return;
    const n = 12;
    for (let i = 0; i < n; i++) streaks.push({ x, y, a: i / n * 6.2832 + Math.random() * .25, d: 6, v: 3.5 + Math.random() * 2.5, life: 1, c: i % 3 ? 'rgba(255,255,255,A)' : 'rgba(122,162,255,A)' });
  }

  /* ------------------------------------------------------------------
     Cursor: exact dot, trailing ring that locks onto targets, crosshair
     ------------------------------------------------------------------ */
  const dot = make('div', 'tech-dot'), ring = make('div', 'tech-ring'), cross = make('div', 'tech-cross'), readout = make('div', 'tech-readout');
  for (let i = 0; i < 4; i++) ring.append(document.createElement('i'));
  const rp = { x: -100, y: -100, w: 36, h: 36 };
  let lockEl = null, lastRead = '';
  const TARGETS = 'a,button,[role=button],summary,label[for],select,video';
  const pad = n => String(Math.max(0, Math.round(n))).padStart(4, '0');
  const cursorOn = () => fine() && !reduced();
  const syncCursor = () => root.classList.toggle('tech-cursor-on', cursorOn() && mouse.active);

  function drawCursor() {
    let tx, ty, tw, th;
    if (lockEl && lockEl.isConnected) {
      const b = lockEl.getBoundingClientRect();
      if (b.width > 0 && b.width < W * .8 && b.height < H * .6) { tx = b.left - 6; ty = b.top - 6; tw = b.width + 12; th = b.height + 12; }
    }
    if (tx === undefined) { tw = 36; th = 36; tx = mouse.x - 18; ty = mouse.y - 18; }
    rp.x += (tx - rp.x) * (lockEl ? .28 : .18); rp.y += (ty - rp.y) * (lockEl ? .28 : .18);
    rp.w += (tw - rp.w) * .25; rp.h += (th - rp.h) * .25;
    ring.style.transform = `translate3d(${rp.x}px,${rp.y}px,0)`;
    ring.style.width = rp.w + 'px'; ring.style.height = rp.h + 'px';
    dot.style.transform = `translate3d(${mouse.x}px,${mouse.y}px,0)`;
    cross.style.setProperty('--cx', mouse.x + 'px'); cross.style.setProperty('--cy', mouse.y + 'px');
    readout.style.transform = `translate3d(${Math.min(mouse.x + 20, W - 140)}px,${Math.min(mouse.y + 18, H - 34)}px,0)`;
    const verb = !lockEl ? '' : lockEl.matches('video') ? '▶ PLAY' : lockEl.matches('select') ? '◆ SELECT' : lockEl.matches('a') ? '→ OPEN' : '◆ ACTION';
    const text = `${verb ? `<em>${verb}</em><br>` : ''}X ${pad(mouse.x)}  Y ${pad(mouse.y)}`;
    if (text !== lastRead) { readout.innerHTML = text; lastRead = text; }
  }

  /* ------------------------------------------------------------------
     Main loop: runs only while something is moving
     ------------------------------------------------------------------ */
  let running = false;
  function frame(t) {
    if (document.hidden) { running = false; return; }
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.r += 11; w.life -= .016; if (w.life <= 0) waves.splice(i, 1); }
    const ambient = fine() && !reduced();
    if (ambient || dirty || waves.length) { drawField(t); dirty = false; }
    const busy = drawFx();
    if (cursorOn() && mouse.active) drawCursor();
    if (ambient || busy || waves.length) requestAnimationFrame(frame); else running = false;
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };

  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!mouse.active) { mouse.active = true; rp.x = mouse.x - 18; rp.y = mouse.y - 18; syncCursor(); }
    if (cursorOn()) { trail.push({ x: mouse.x, y: mouse.y, life: 1 }); if (trail.length > 18) trail.shift(); }
    const t = cursorOn() && e.target.closest ? e.target.closest(TARGETS) : null;
    if (t !== lockEl) { lockEl = t; ring.classList.toggle('is-lock', !!t); }
    kick();
  }, { passive: true });
  root.addEventListener('pointerleave', () => { mouse.active = false; lockEl = null; trail.length = 0; syncCursor(); dirty = true; kick(); });
  addEventListener('blur', () => { mouse.active = false; syncCursor(); });
  addEventListener('pointerdown', e => {
    ring.classList.add('is-down');
    if (reduced()) return;
    shock(e.clientX, e.clientY, e.pointerType === 'touch' || !fine());
    kick();
  }, { passive: true });
  addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });
  addEventListener('scroll', () => { dirty = true; if (!fine()) kick(); }, { passive: true });
  addEventListener('resize', () => { resize(); kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; kick(); } });
  const motionChanged = () => { syncCursor(); dirty = true; kick(); };
  reduceQ.addEventListener?.('change', motionChanged);
  fineQ.addEventListener?.('change', () => { resize(); motionChanged(); });
  new MutationObserver(motionChanged).observe(root, { attributes: true, attributeFilter: ['class'] });
  resize(); kick();

  /* ------------------------------------------------------------------
     Card light + magnetic controls
     ------------------------------------------------------------------ */
  const LIT = '.directory-card,.project-card,.contact-suite,.highlight-item,.databank-card,.equipment-card,.qe-service,.project,.hospital-city,.education,.research-metrics,.neuroboost-feature,.cv-entry,.qe-quality-cards article,.travel-shell,.le-notes';
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.(LIT); if (!card) return;
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - b.left}px`); card.style.setProperty('--my', `${e.clientY - b.top}px`);
  }, { passive: true });
  document.querySelectorAll('.button,.directory-arrow,.language,.le-pill,.corp-official,.corp-cta').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (!cursorOn()) return;
      const b = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - b.left - b.width / 2) * .2}px ${(e.clientY - b.top - b.height / 2) * .3}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });

  /* ------------------------------------------------------------------
     Label decrypt (mono labels; cancelled on language switch)
     ------------------------------------------------------------------ */
  const GLYPHS = '01<>/\\[]{}#*+=-_ABCDEFXZ';
  const active = new Map();
  const leaf = el => el.children.length === 0;
  function decrypt(el) {
    if (reduced() || active.has(el)) return;
    const final = el.textContent; if (!final.trim() || final.length > 64) return;
    el.dataset.techFinal = final;
    let f = 0; const total = 16;
    const tick = () => {
      if (!active.has(el)) return;
      const shown = Math.floor((++f / total) * final.length);
      el.textContent = Array.from(final, (ch, i) => i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
      if (f < total) active.set(el, requestAnimationFrame(tick)); else { el.textContent = final; active.delete(el); }
    };
    active.set(el, requestAnimationFrame(tick));
  }
  new MutationObserver(() => {
    // main.js rewrites data-en/data-zh text on a language switch; never let a decrypt write stale text afterwards.
    active.forEach((id, el) => { cancelAnimationFrame(id); if (!el.hasAttribute('data-en')) el.textContent = el.dataset.techFinal; });
    active.clear();
  }).observe(root, { attributes: true, attributeFilter: ['lang'] });
  const LABELS = '.eyebrow,.le-kicker,.corp-eyebrow,.qe-kicker,.directory-number,.edition-masthead span,.photo-index';
  const labelLeaves = el => (leaf(el) ? [el] : [...el.querySelectorAll('span')].filter(leaf));
  document.querySelectorAll(LABELS).forEach(el => el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') labelLeaves(el).forEach(decrypt); }));

  /* ------------------------------------------------------------------
     Scroll reveals: headings blur in word by word, cards rise in sequence
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(p); return; }
            const s = document.createElement('span'); s.className = 'tech-word'; s.style.setProperty('--i', i++); s.textContent = p; frag.append(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          if (child.matches('em')) { child.classList.add('tech-word'); child.style.setProperty('--i', i++); return; }
          if (child.matches('.accent,svg,img,br')) return;
          walk(child);
        }
      });
    };
    walk(el);
  }
  const RISE = '.highlight-item,.directory-card,.project,.publication,.databank-card,.equipment-card,.hospital-city,.qe-service,.contact-suite,.cv-entry,.experience-list li,.research-metrics,.qe-quality-cards article,.collection-photo,.october-photo';
  if ('IntersectionObserver' in window && !reduced()) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      el.classList.add('tech-in');
      if (el.matches(LABELS)) { el.classList.add('tech-flicker'); labelLeaves(el).forEach(decrypt); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('main h2').forEach(h => { if (!h.closest('.hero')) { splitWords(h); io.observe(h); } });
    const seen = new Map();
    document.querySelectorAll(RISE).forEach(el => {
      const n = seen.get(el.parentElement) || 0; seen.set(el.parentElement, n + 1);
      el.style.setProperty('--i', n % 6);
      el.classList.add('tech-rise');
      el.addEventListener('transitionend', function done(e) {
        if (e.propertyName !== 'opacity' || !el.classList.contains('tech-in')) return;
        el.classList.remove('tech-rise', 'tech-in'); el.style.removeProperty('--i'); el.removeEventListener('transitionend', done);
      });
      io.observe(el);
    });
    document.querySelectorAll('.eyebrow,.le-kicker,.corp-eyebrow,.qe-kicker').forEach(el => io.observe(el));
  }

  /* ------------------------------------------------------------------
     Hero: name builds in letter by letter, then glitches now and then
     ------------------------------------------------------------------ */
  const names = [...document.querySelectorAll('.name-first,.name-last')];
  names.forEach(el => { el.dataset.text = el.textContent; el.classList.add('tech-glitch'); });
  if (names.length && !reduced()) {
    let i = 0;
    names.forEach(el => {
      [...el.childNodes].forEach(n => {
        if (n.nodeType !== 3) { if (n.nodeType === 1) { n.classList.add('tech-word'); n.style.setProperty('--i', i++); } return; }
        const frag = document.createDocumentFragment();
        for (const ch of n.textContent) { const s = document.createElement('span'); s.className = 'tech-word'; s.style.setProperty('--i', i++); s.textContent = ch; frag.append(s); }
        n.replaceWith(frag);
      });
      introDone.then(() => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('tech-in'))));
    });
    const glitch = el => { if (reduced() || document.hidden) return; el.classList.remove('is-glitching'); void el.offsetWidth; el.classList.add('is-glitching'); };
    const loop = () => { names.forEach(glitch); setTimeout(loop, 7000 + Math.random() * 6000); };
    setTimeout(loop, 2600);
    names.forEach(el => el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') glitch(el); }));
  }
  const frame0 = document.querySelector('.portrait-frame');
  if (frame0) make('div', 'tech-hud', frame0).innerHTML = '<i></i><i></i><i></i><i></i><b>TRACKING · CL-01</b>';

  /* ------------------------------------------------------------------
     Li mark at scale: construction figure, card ghosts, footer lockup
     and the orbit back-to-top button
     ------------------------------------------------------------------ */
  const bp = document.querySelector('.li-blueprint');
  if (bp) {
    if ('IntersectionObserver' in window && !reduced()) {
      bp.classList.add('is-armed');
      const seen = new IntersectionObserver(([en]) => { if (en.isIntersecting) { bp.classList.add('is-drawn'); seen.disconnect(); setTimeout(() => bp.classList.add('is-done'), 3000); } }, { threshold: .3 });
      seen.observe(bp);
    }
    // The valence electron leans toward the pointer.
    const svg = bp.querySelector('svg'), electron = bp.querySelector('.bp-electron');
    bp.addEventListener('pointermove', e => {
      const m = cursorOn() && svg.getScreenCTM(); if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const dx = p.x - 43.5, dy = p.y - 25, d = Math.hypot(dx, dy) || 1, k = Math.min(d, 26) / d * .12;
      electron.style.transform = `translate(${(dx * k).toFixed(2)}px,${(dy * k).toFixed(2)}px)`;
    });
    bp.addEventListener('pointerleave', () => { electron.style.transform = ''; });
  }

  document.querySelectorAll('.directory-card').forEach(c => c.insertAdjacentHTML('beforeend', liSvg('li-ghost')));

  const foot = document.querySelector('.multi-footer');
  if (foot && getComputedStyle(foot, '::after').content.includes('Chuangqi')) {
    make('div', 'li-lockup', foot).innerHTML = liSvg('li-lockup-mark') + '<span>Chuangqi Lee</span>';
    foot.classList.add('has-li-lockup');
  }

  // Back to top: the i's dot leaves home and orbits the ring as the page is read.
  const orbit = document.createElement('a');
  orbit.className = 'li-orbit'; orbit.href = '#top';
  const zh = root.lang.startsWith('zh');
  orbit.innerHTML = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><circle class="li-orbit-track" cx="32" cy="32" r="28"/>'
    + '<circle class="li-orbit-fill" cx="32" cy="32" r="28" pathLength="1"/>'
    + `<g transform="translate(32 33) scale(.6) translate(-31.75 -35.7)"><g class="li-orbit-glyph">${LI.l}${LI.i}<circle class="li-orbit-home" cx="43.5" cy="25" r="3.9"/></g></g>`
    + '<g class="li-orbit-e"><circle class="li-halo" cx="32" cy="4" r="8"/><circle class="li-dot" cx="32" cy="4" r="3.3"/></g></svg>'
    + `<span class="li-orbit-tip" data-en="Back to top" data-zh="返回顶部">${zh ? '返回顶部' : 'Back to top'}</span>`;
  body.append(orbit);
  const orbitFill = orbit.querySelector('.li-orbit-fill'), orbitE = orbit.querySelector('.li-orbit-e');
  let orbitQueued = false;
  const syncOrbit = () => {
    orbitQueued = false;
    const max = root.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    orbit.classList.toggle('is-on', scrollY > innerHeight * .6);
    orbitFill.style.strokeDashoffset = (1 - p).toFixed(4);
    orbitE.style.transform = `rotate(${(p * 360).toFixed(1)}deg)`;
  };
  addEventListener('scroll', () => { if (!orbitQueued) { orbitQueued = true; requestAnimationFrame(syncOrbit); } }, { passive: true });
  addEventListener('resize', syncOrbit);
  syncOrbit();
  orbit.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    if (e.detail === 0) document.querySelector('.header .brand')?.focus({ preventScroll: true });
  });
})();
