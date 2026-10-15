/* Tech edition — ambient particle network, target-tracking cursor, click bursts,
   text decrypt, glitch and card spotlight. Everything is decorative: content
   stays fully visible and usable when this script fails or motion is reduced. */
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
  const CYAN = '77,226,255', VIOLET = '143,123,255', PINK = '255,95,210';
  const make = (tag, cls, parent = body) => { const el = document.createElement(tag); el.className = cls; el.setAttribute('aria-hidden', 'true'); parent.append(el); return el; };

  /* ---------- Canvases */
  const bg = make('canvas', 'tech-bg'), fx = make('canvas', 'tech-fx');
  make('div', 'tech-scan');
  const bctx = bg.getContext('2d'), fctx = fx.getContext('2d');
  let W = 0, H = 0;
  function resize() {
    W = innerWidth; H = innerHeight;
    for (const c of [bg, fx]) { c.width = W * DPR; c.height = H * DPR; }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  /* Particle network (background) */
  let nodes = [];
  function seed() {
    const target = Math.round(Math.min(fine() ? 90 : 38, (W * H) / (fine() ? 15000 : 22000)));
    nodes = Array.from({ length: target }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
      r: Math.random() * 1.4 + .6, hue: Math.random() < .7 ? CYAN : VIOLET
    }));
  }
  const mouse = { x: -9999, y: -9999, active: false };
  function drawNetwork(step) {
    bctx.clearRect(0, 0, W, H);
    const link = 130, link2 = link * link, reach = 190, reach2 = reach * reach;
    for (const n of nodes) {
      if (step) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
        if (mouse.active) {
          const dx = mouse.x - n.x, dy = mouse.y - n.y, d2 = dx * dx + dy * dy;
          if (d2 < reach2 && d2 > 400) { n.x += dx * .0035; n.y += dy * .0035; }
        }
      }
    }
    bctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < link2) {
          bctx.strokeStyle = `rgba(${CYAN},${(1 - d2 / link2) * .16})`;
          bctx.beginPath(); bctx.moveTo(a.x, a.y); bctx.lineTo(b.x, b.y); bctx.stroke();
        }
      }
      if (mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          bctx.strokeStyle = `rgba(${CYAN},${(1 - d2 / reach2) * .5})`;
          bctx.beginPath(); bctx.moveTo(a.x, a.y); bctx.lineTo(mouse.x, mouse.y); bctx.stroke();
        }
      }
      bctx.fillStyle = `rgba(${a.hue},.75)`;
      bctx.beginPath(); bctx.arc(a.x, a.y, a.r, 0, 6.283); bctx.fill();
    }
  }

  /* Trail + click bursts (foreground) */
  const trail = [], sparks = [], rings = [];
  function burst(x, y, light) {
    rings.push({ x, y, r: 4, life: 1, c: CYAN }, { x, y, r: 2, life: 1.25, c: VIOLET });
    if (light) return;
    const count = 22;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 6.283 + Math.random() * .3, s = 2 + Math.random() * 4.5;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: [CYAN, VIOLET, PINK][i % 3], sz: Math.random() * 2 + 1 });
    }
  }
  function drawFx() {
    fctx.clearRect(0, 0, W, H);
    // trail
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].life -= .05; if (trail[i].life <= 0) trail.splice(i, 1); }
    if (trail.length > 1) {
      fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i - 1], q = trail[i], t = q.life;
        fctx.strokeStyle = `rgba(${i / trail.length > .5 ? CYAN : VIOLET},${t * .55})`;
        fctx.lineWidth = t * 3;
        fctx.shadowColor = `rgba(${CYAN},${t})`; fctx.shadowBlur = 10 * t;
        fctx.beginPath(); fctx.moveTo(p.x, p.y); fctx.lineTo(q.x, q.y); fctx.stroke();
      }
      fctx.shadowBlur = 0;
    }
    // rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.r += (70 - r.r) * .12; r.life -= .035;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      fctx.strokeStyle = `rgba(${r.c},${Math.min(1, r.life) * .9})`; fctx.lineWidth = 1.5;
      fctx.beginPath(); fctx.arc(r.x, r.y, r.r, 0, 6.283); fctx.stroke();
    }
    // sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vx *= .92; s.vy *= .92; s.life -= .028;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      fctx.fillStyle = `rgba(${s.c},${s.life})`;
      fctx.shadowColor = `rgba(${s.c},1)`; fctx.shadowBlur = 8;
      fctx.fillRect(s.x - s.sz / 2, s.y - s.sz / 2, s.sz, s.sz);
    }
    fctx.shadowBlur = 0;
    return trail.length || rings.length || sparks.length;
  }

  /* ---------- Cursor: dot, lagging ring that locks onto targets, crosshair + readout */
  const dot = make('div', 'tech-dot'), ring = make('div', 'tech-ring'), cross = make('div', 'tech-cross'), readout = make('div', 'tech-readout');
  for (let i = 0; i < 4; i++) ring.append(document.createElement('i'));
  const ringPos = { x: -100, y: -100, w: 38, h: 38 };
  let lockEl = null;
  const TARGETS = 'a,button,[role=button],summary,label[for],.directory-card,.project-card,.contact-suite,.collection-photo a,video';
  const pad = n => String(Math.max(0, Math.round(n))).padStart(4, '0');
  function cursorEnabled() { return fine() && !reduced(); }
  function syncCursorClass() { root.classList.toggle('tech-cursor-on', cursorEnabled() && mouse.active); }

  function updateCursor() {
    let tx, ty, tw, th;
    if (lockEl && lockEl.isConnected) {
      const b = lockEl.getBoundingClientRect();
      if (b.width > 0 && b.width < W * .9 && b.height < H * .8) { tx = b.left - 6; ty = b.top - 6; tw = b.width + 12; th = b.height + 12; }
    }
    if (tx === undefined) { tw = 38; th = 38; tx = mouse.x - 19; ty = mouse.y - 19; }
    const k = lockEl ? .3 : .2;
    ringPos.x += (tx - ringPos.x) * k; ringPos.y += (ty - ringPos.y) * k;
    ringPos.w += (tw - ringPos.w) * .3; ringPos.h += (th - ringPos.h) * .3;
    ring.style.transform = `translate(${ringPos.x}px,${ringPos.y}px)`;
    ring.style.width = ringPos.w + 'px'; ring.style.height = ringPos.h + 'px';
    dot.style.transform = `translate(${mouse.x}px,${mouse.y}px)`;
    cross.style.setProperty('--cx', mouse.x + 'px'); cross.style.setProperty('--cy', mouse.y + 'px');
    const rx = Math.min(mouse.x + 22, W - 150), ry = Math.min(mouse.y + 20, H - 34);
    readout.style.transform = `translate(${rx}px,${ry}px)`;
  }
  function setReadout() {
    const tag = lockEl ? (lockEl.matches('a') ? 'LINK' : lockEl.matches('button,[role=button]') ? 'ACTION' : lockEl.matches('video') ? 'MEDIA' : 'NODE') : 'TRACK';
    readout.innerHTML = `${lockEl ? '◉ LOCK' : '◎'} ${tag}<br><span>X ${pad(mouse.x)} · Y ${pad(mouse.y)}</span>`;
  }

  /* ---------- Main loop (runs only while there is something to animate) */
  let running = false, last = 0;
  function frame(t) {
    if (document.hidden) { running = false; return; }
    const step = !reduced();
    if (step || t - last > 1000) { drawNetwork(step); last = t; }
    const busy = drawFx();
    if (cursorEnabled() && mouse.active) { updateCursor(); setReadout(); }
    if (step || busy) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (!mouse.active) { mouse.active = true; ringPos.x = mouse.x - 19; ringPos.y = mouse.y - 19; syncCursorClass(); }
    if (cursorEnabled()) { trail.push({ x: mouse.x, y: mouse.y, life: 1 }); if (trail.length > 24) trail.shift(); }
    lockEl = cursorEnabled() ? e.target.closest?.(TARGETS) || null : null;
    ring.classList.toggle('is-lock', !!lockEl);
    kick();
  }, { passive: true });
  root.addEventListener('pointerleave', () => { mouse.active = false; trail.length = 0; syncCursorClass(); });
  addEventListener('blur', () => { mouse.active = false; syncCursorClass(); });
  addEventListener('pointerdown', e => {
    ring.classList.add('is-down');
    if (reduced()) return;
    burst(e.clientX, e.clientY, e.pointerType === 'touch' || !fine());
    kick();
  }, { passive: true });
  addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });
  addEventListener('resize', () => { resize(); kick(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  const onMotionChange = () => { syncCursorClass(); kick(); };
  reduceQ.addEventListener?.('change', onMotionChange); fineQ.addEventListener?.('change', () => { seed(); onMotionChange(); });
  new MutationObserver(onMotionChange).observe(root, { attributes: true, attributeFilter: ['class'] });
  resize(); kick();

  /* ---------- Card spotlight */
  const SPOT = '.directory-card,.project-card,.contact-suite,.highlight-item,.databank-card,.equipment-card,.qe-service,.project,.hospital-city,.education,.research-metrics,.neuroboost-feature,.cv-entry';
  document.addEventListener('pointermove', e => {
    const card = e.target.closest?.(SPOT); if (!card) return;
    const b = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - b.left}px`); card.style.setProperty('--my', `${e.clientY - b.top}px`);
  }, { passive: true });

  /* ---------- Magnetic buttons */
  document.querySelectorAll('.button,.directory-arrow,.language').forEach(el => {
    el.addEventListener('pointermove', e => {
      if (!cursorEnabled()) return;
      const b = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - b.left - b.width / 2) * .18}px,${(e.clientY - b.top - b.height / 2) * .25}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  /* ---------- Text decrypt (leaf elements only; cancelled on language switch) */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ABCDEFXYZ';
  const active = new Map();
  function scramble(el) {
    if (reduced() || active.has(el)) return;
    const final = el.textContent; if (!final.trim() || final.length > 70) return;
    let f = 0; const total = 18;
    const tick = () => {
      if (!active.has(el)) return;
      f++;
      const reveal = Math.floor((f / total) * final.length);
      el.textContent = final.split('').map((ch, i) => i < reveal || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
      if (f < total) active.set(el, requestAnimationFrame(tick)); else { el.textContent = final; active.delete(el); }
    };
    el.dataset.techFinal = final;
    active.set(el, requestAnimationFrame(tick));
  }
  new MutationObserver(() => {
    // main.js rewrites data-en/data-zh text on language switch; stop any decrypt in flight so it never writes stale text.
    active.forEach((id, el) => {
      cancelAnimationFrame(id);
      if (!el.hasAttribute('data-en')) el.textContent = el.dataset.techFinal;
    });
    active.clear();
  }).observe(root, { attributes: true, attributeFilter: ['lang'] });
  const leaf = el => el.children.length === 0;
  const decryptTargets = [...document.querySelectorAll('.eyebrow span,.eyebrow,.le-kicker,.corp-eyebrow,.qe-kicker,.section-heading h2,.polish-heading h2,main h2,.directory-card h3,.nav-wrap nav a')].filter(leaf);
  const uniq = [...new Set(decryptTargets)];
  uniq.forEach(el => el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') scramble(el); }));

  /* ---------- Reveal + flicker on scroll */
  if ('IntersectionObserver' in window && !reduced()) {
    const labels = document.querySelectorAll('.eyebrow,.le-kicker,.corp-eyebrow,.qe-kicker');
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      if (el.matches('.eyebrow,.le-kicker,.corp-eyebrow,.qe-kicker')) {
        el.classList.add('tech-flicker');
        el.querySelectorAll('span').forEach(s => { if (leaf(s)) scramble(s); });
        if (leaf(el)) scramble(el);
      }
      io.unobserve(el);
    }), { threshold: .3 });
    labels.forEach(el => io.observe(el));
  }

  /* ---------- Hero: glitch name + HUD corners on portrait */
  const names = document.querySelectorAll('.name-first,.name-last');
  names.forEach(el => { el.classList.add('tech-glitch'); el.dataset.text = el.textContent; });
  if (names.length) {
    const glitch = () => {
      if (!reduced() && !document.hidden) names.forEach(el => { el.classList.remove('is-glitching'); void el.offsetWidth; el.classList.add('is-glitching'); });
      setTimeout(glitch, 3500 + Math.random() * 4000);
    };
    setTimeout(glitch, 1200);
    names.forEach(el => el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !reduced()) { el.classList.remove('is-glitching'); void el.offsetWidth; el.classList.add('is-glitching'); } }));
  }
  const frameEl = document.querySelector('.portrait-frame');
  if (frameEl) {
    const hud = make('div', 'tech-hud', frameEl);
    hud.innerHTML = '<i></i><i></i><i></i><i></i><b>ID · CL-01</b>';
  }
})();
