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
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('tech-in')));
    });
    const glitch = el => { if (reduced() || document.hidden) return; el.classList.remove('is-glitching'); void el.offsetWidth; el.classList.add('is-glitching'); };
    const loop = () => { names.forEach(glitch); setTimeout(loop, 7000 + Math.random() * 6000); };
    setTimeout(loop, 2600);
    names.forEach(el => el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') glitch(el); }));
  }
  const frame0 = document.querySelector('.portrait-frame');
  if (frame0) make('div', 'tech-hud', frame0).innerHTML = '<i></i><i></i><i></i><i></i><b>TRACKING · CL-01</b>';
})();
