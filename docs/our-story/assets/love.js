/* Our Story: unlock, decrypt and render. Everything private arrives AES-GCM encrypted. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const KEY_STORE = 'ourstory.key.v1';
  const DAY = 86400000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.2s-7.8-4.6-9.9-10C.7 7.6 2.9 3.6 6.8 3.6c2.2 0 3.9 1.2 5.2 3 1.3-1.8 3-3 5.2-3 3.9 0 6.1 4 4.7 7.6-2.1 5.4-9.9 10-9.9 10z"/></svg>';
  const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg>';
  const ZH_MONTH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const lock = $('#lock');
  const form = $('#lock-form');
  const pw = $('#pw');
  const err = $('#err');
  const story = $('#story');

  let meta = null;
  let key = null;
  let data = null;
  const byId = new Map();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY_STORE)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY_STORE, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    clear() { try { localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ } },
  };

  /* ---------- crypto ---------- */
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const toB64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };

  async function deriveKey(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.trim().normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(meta.salt), iterations: meta.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
    );
  }

  async function decrypt(k, buf) {
    const u = new Uint8Array(buf);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, k, u.subarray(12));
  }

  async function readManifest(k) {
    const r = await fetch('vault/m.bin', { cache: 'no-cache' });
    if (!r.ok) throw new Error('missing');
    const plain = await decrypt(k, await r.arrayBuffer());
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function readBlob(id) {
    const r = await fetch(`vault/${id}.bin`);
    if (!r.ok) throw new Error(r.status);
    return decrypt(key, await r.arrayBuffer());
  }

  /* The Chinese serif is subset to exactly the characters in the story, so it is encrypted too. */
  function loadStoryFont() {
    if (!data.font || !('FontFace' in window)) return;
    readBlob(data.font)
      .then((buf) => new FontFace('Story Kai', buf, { display: 'swap' }).load())
      .then((face) => { document.fonts.add(face); })
      .catch(() => {});
  }

  /* Encrypted blobs are fetched through a small queue so a long page never floods the network. */
  const blobs = new Map();
  const queue = [];
  let active = 0;
  function blobURL(id, type, urgent) {
    if (!blobs.has(id)) {
      blobs.set(id, new Promise((resolve, reject) => {
        const job = { id, type, resolve, reject };
        if (urgent) queue.unshift(job); else queue.push(job);
        pump();
      }));
    } else if (urgent) {
      const i = queue.findIndex((j) => j.id === id);
      if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
    }
    return blobs.get(id);
  }
  function pump() {
    while (active < 6 && queue.length) {
      const job = queue.shift();
      active += 1;
      readBlob(job.id)
        .then((plain) => job.resolve(URL.createObjectURL(new Blob([plain], { type: job.type }))))
        .catch((e) => { blobs.delete(job.id); job.reject(e); })
        .finally(() => { active -= 1; pump(); });
    }
  }

  /* ---------- lock screen ---------- */
  async function boot() {
    if (!window.crypto || !crypto.subtle) {
      err.textContent = '这个页面需要用 https 打开。';
      return;
    }
    try {
      meta = await (await fetch('vault/meta.json', { cache: 'no-cache' })).json();
    } catch (e) {
      err.textContent = '内容还没准备好，稍后再来。';
      return;
    }
    if (meta.title) { $('#lock-title').innerHTML = `<em>${esc(meta.title)}</em>`; document.title = meta.title; }
    if (meta.subtitle) $('#lock-sub').textContent = meta.subtitle;
    if (meta.hint) { const h = $('#hint'); h.textContent = `提示：${meta.hint}`; h.hidden = false; }

    const saved = store.get();
    if (saved && saved.salt === meta.salt) {
      try {
        key = await crypto.subtle.importKey('raw', fromB64(saved.k), 'AES-GCM', false, ['decrypt']);
        data = await readManifest(key);
        open(true);
        return;
      } catch (e) {
        store.clear();
      }
    }
    key = null;
    document.documentElement.classList.remove('has-key');
    if (finePointer) pw.focus();
  }

  let busy = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (busy || !meta) return;
    const value = pw.value;
    if (!value.trim()) { pw.focus(); return; }
    busy = true;
    err.textContent = '';
    lock.classList.remove('is-wrong');
    lock.classList.add('is-checking');
    try {
      const k = await deriveKey(value);
      data = await readManifest(k);
      key = k;
      if ($('#remember').checked) {
        store.set({ salt: meta.salt, k: toB64(await crypto.subtle.exportKey('raw', k)) });
      }
    } catch (e) {
      lock.classList.remove('is-checking');
      void lock.offsetWidth;
      lock.classList.add('is-wrong');
      err.textContent = '密码不对哦，再想想？';
      pw.select();
      busy = false;
      return;
    }
    pw.blur();
    open(false);
  });

  async function open(remembered) {
    loadStoryFont();
    data.media.forEach((m, i) => { m.i = i; byId.set(m.id, m); });
    render();
    lock.classList.remove('is-checking');
    lock.classList.add('is-open');
    const intro = reduceMotion ? null : prepareIntro();
    await sleep(reduceMotion ? 0 : remembered ? 800 : 1300);
    if (intro) {
      try { await intro.play(); return; } catch (e) { /* fall back to a plain reveal */ }
    }
    showStory();
  }

  function showStory() {
    if (!story.hidden) return;
    story.hidden = false;
    document.body.classList.remove('is-locked');
    document.documentElement.classList.remove('has-key');
    startReveal();
    hero.start();
    setTimeout(() => lock.remove(), 1100);
  }

  /* ---------- helpers ---------- */
  const parseDay = (s) => { const [y, m, d] = s.split('T')[0].split('-').map(Number); return new Date(y, m - 1, d); };
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDate = (s) => (s instanceof Date
    ? `${s.getFullYear()}.${pad2(s.getMonth() + 1)}.${pad2(s.getDate())}`
    : s.slice(0, 10).replace(/-/g, '.'));
  const nf = new Intl.NumberFormat('en-US');
  const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const placeOf = (m) => (m && m.p != null && data.places ? data.places[m.p] : null);
  // A date worked out from file times is only trusted to the month.
  const dateLabel = (m) => (m.dq === 'unknown' ? '' : m.dq === 'approx' ? `约 ${m.date.slice(0, 7).replace('-', '.')}` : fmtDate(m.date));

  function photoButton(m, opts = {}) {
    const ar = (m.w / m.h).toFixed(4);
    const extra = opts.more ? `<span class="more">+${opts.more}</span>` : (m.type === 'video' ? `<span class="play">${PLAY}</span>` : '');
    const kind = m.type === 'video' ? '视频' : '照片';
    const label = m.cap ? esc(m.cap) : m.dq === 'unknown' ? kind : `${dateLabel(m)} 的${kind}`;
    return `<button class="ph" type="button" data-id="${m.id}" data-set="${opts.set || ''}" style="--c:${m.c};--ar:${ar}" aria-label="${label}"><img alt="" decoding="async">${extra}</button>`;
  }

  /* ---------- render ---------- */
  const sets = {};

  function render() {
    const media = data.media;
    const [a, b] = data.names || [];
    const since = data.since ? parseDay(data.since) : null;
    const months = groupByMonth(media);
    sets.all = media.map((m) => m.id);

    let html = '';

    /* hero */
    html += `<section class="hero" id="top">
      <div class="hero-media" id="hero-media" aria-hidden="true"></div>
      <div class="hero-meta" id="hero-meta" aria-hidden="true"></div>
      <div class="hero-inner">
        ${since ? `<p class="kicker reveal">Together since ${fmtDate(data.since)}</p>` : ''}
        <h1 class="names reveal" style="transition-delay:.12s">${a || b ? `<span>${esc(a)}</span><span class="amp">&amp;</span><span>${esc(b)}</span>` : '<span>Us</span>'}</h1>
        ${data.tagline ? `<p class="tagline reveal">${esc(data.tagline)}</p>` : ''}
        ${since ? `<div class="counter reveal" style="transition-delay:.24s" aria-live="off">
          <span class="lbl">我们已经在一起</span>
          <div class="big"><b id="c-days">0</b><span>天</span></div>
          <div class="hms"><span><b id="c-h">00</b>时</span><span><b id="c-m">00</b>分</span><span><b id="c-s">00</b>秒</span></div>
        </div>` : ''}
      </div>
      <a class="scroll-cue" href="#stats">SCROLL<i></i></a>
    </section>`;

    /* stats */
    const together = since ? Math.floor((Date.now() - since) / DAY) : null;
    const next = since ? nextAnniversary(since) : null;
    const places = data.places || [];
    html += `<section class="sec" id="stats"><div class="wrap"><div class="stats reveal">
      ${since ? `<div class="stat"><b>${nf.format(together)}</b><span>天在一起</span><small>DAYS</small></div>` : ''}
      <div class="stat"><b>${nf.format(media.length)}</b><span>张照片和视频</span><small>MOMENTS</small></div>
      ${places.length ? `<div class="stat"><b>${places.length}</b><span>个一起去过的地方</span><small>PLACES</small></div>` : `<div class="stat"><b>${months.length}</b><span>个留下回忆的月份</span><small>MONTHS</small></div>`}
      ${next ? `<div class="stat"><b>${next.days}</b><span>${next.days === 0 ? `今天就是 ${next.n} 周年` : `天后是 ${next.n} 周年`}</span><small>ANNIVERSARY</small></div>` : ''}
    </div></div></section>`;

    /* travel map */
    html += atlasHTML();

    /* timeline */
    const items = timelineItems(months, withAnniversaries(data.milestones || [], since, media), data.chapters || {});
    if (items.length) {
      let lastYear = null;
      let flip = false;
      html += `<section class="sec" id="timeline"><div class="wrap">
        <header class="sec-head reveal"><p class="kicker">Chapters</p><h2>我们的时间线</h2></header>
        <div class="tl"><i class="tl-fill"></i>`;
      for (const it of items) {
        const y = it.date.slice(0, 4);
        if (y !== lastYear) { html += `<div class="tl-year reveal"><span>${y}</span></div>`; lastYear = y; }
        if (it.kind === 'milestone') {
          html += milestoneHTML(it, flip);
          if (it.ms.photo) flip = !flip;
        } else {
          html += chapterHTML(it, flip);
          flip = !flip;
        }
      }
      html += '</div></div></section>';
    }

    /* letter */
    if (data.letter && data.letter.body) {
      const paras = data.letter.body.trim().split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
      html += `<section class="sec letter" id="letter"><div class="paper">
        <svg class="seal" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.2s-7.8-4.6-9.9-10C.7 7.6 2.9 3.6 6.8 3.6c2.2 0 3.9 1.2 5.2 3 1.3-1.8 3-3 5.2-3 3.9 0 6.1 4 4.7 7.6-2.1 5.4-9.9 10-9.9 10z"/></svg>
        <p class="kicker">To you</p>
        <h2>${esc(data.letter.title || '写给你')}</h2>
        <div class="letter-body">${paras}</div>
        ${data.letter.sign ? `<p class="sign">${esc(data.letter.sign)}</p>` : ''}
      </div></section>`;
    }

    /* special days */
    const days = specialDays(since, data.days || []);
    if (days.length) {
      html += `<section class="sec" id="days"><div class="wrap">
        <header class="sec-head reveal"><p class="kicker">Days that matter</p><h2>重要的日子</h2></header>
        <div class="days">${days.map((d) => `<div class="day reveal${d.left === 0 ? ' today' : ''}">
          <div class="label">${esc(d.label)}</div>
          <b>${d.left === 0 ? '今天' : nf.format(d.left)}</b>
          <small>${d.left === 0 ? 'TODAY ♥' : `DAYS · ${fmtDate(d.when)}`}</small>
          ${d.age || d.note ? `<div class="day-note">${[d.age ? `${d.age} 岁` : '', esc(d.note)].filter(Boolean).join(' · ')}</div>` : ''}
        </div>`).join('')}</div>
      </div></section>`;
    }

    /* gallery */
    if (media.length) {
      const years = [...new Set(media.map((m) => m.date.slice(0, 4)))];
      html += `<section class="sec" id="gallery"><div class="wrap">
        <header class="sec-head reveal"><p class="kicker">All of us</p><h2>所有的照片</h2><p class="lead">一共 ${nf.format(media.length)} 个瞬间。点开任意一张，可以左右翻看。</p></header>
        ${years.length > 1 ? `<div class="chips reveal" role="group" aria-label="按年份筛选"><button class="chip" aria-pressed="true" data-year="">全部</button>${years.map((y) => `<button class="chip" aria-pressed="false" data-year="${y}">${y}</button>`).join('')}</div>` : ''}
        <div class="wall" id="wall"></div>
        <div class="wall-more"><button class="btn" id="wall-more" hidden>再看更多</button></div>
      </div></section>`;
    }

    html += `<footer class="foot">
      <h3 class="grad">To be continued</h3>
      <p>${since ? `今天是我们在一起的第 ${nf.format(together + 1)} 天，故事还在继续。` : '故事还在继续。'}</p>
      <div class="heart">${HEART}</div>
      <button class="relock" type="button" id="relock">在这台设备上锁上</button>
    </footer>`;

    story.innerHTML = html;

    if (since) tick(since);
    hero.prepare();
    atlas.setup();
    if (media.length) setupWall();
    $('#relock').addEventListener('click', () => { store.clear(); location.reload(); });
  }

  function groupByMonth(media) {
    const map = new Map();
    for (const m of media) {
      if (m.dq === 'unknown') continue; // no real shooting date: photo wall only
      const k = m.date.slice(0, 7);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(m);
    }
    return [...map].map(([k, list]) => ({ key: k, list }));
  }

  function timelineItems(months, milestones, chapters) {
    // A chapter sorts after every day of its month, so a milestone such as "the day we met" opens its chapter.
    const out = months.map((g) => ({ kind: 'chapter', date: `${g.key}-99`, key: g.key, list: g.list, ch: chapters[g.key] || {} }));
    milestones.forEach((ms) => { if (ms.date) out.push({ kind: 'milestone', date: ms.date, ms }); });
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  }

  function pick(list, n) {
    if (list.length <= n) return list;
    const fav = list.filter((m) => m.fav);
    const rest = list.filter((m) => !m.fav);
    const need = Math.max(0, n - fav.length);
    const spread = [];
    for (let i = 0; i < need; i += 1) spread.push(rest[Math.floor((i * rest.length) / need)]);
    return [...fav.slice(0, n), ...spread].sort((x, y) => x.i - y.i);
  }

  function chapterHTML(it, flip) {
    const [y, mo] = it.key.split('-').map(Number);
    const setName = `m${it.key}`;
    sets[setName] = it.list.map((m) => m.id);
    const shown = pick(it.list, 5);
    const more = it.list.length - shown.length;
    const title = it.ch.title || ZH_MONTH[mo - 1];
    const count = it.list.length;
    const where = [...new Set(it.list.map((m) => m.p).filter((p) => p != null))].map((p) => data.places[p].name);
    return `<article class="tl-item chapter reveal${flip ? ' flip' : ''}">
      <div class="tl-text">
        <div class="tl-date">${y} · ${String(mo).padStart(2, '0')}</div>
        <h3 class="tl-title">${esc(title)}</h3>
        ${where.length ? `<div class="tl-places">${where.map((n) => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
        ${it.ch.text ? `<p class="tl-body">${esc(it.ch.text)}</p>` : ''}
        <div class="tl-count">${count} 个瞬间</div>
      </div>
      <div class="tl-media"><div class="collage n${shown.length}">
        ${shown.map((m, i) => photoButton(m, { set: setName, more: i === shown.length - 1 && more > 0 ? more : 0 })).join('')}
      </div></div>
    </article>`;
  }

  function milestoneHTML(it, flip) {
    const ms = it.ms;
    const m = ms.photo && byId.get(ms.photo);
    return `<article class="tl-item milestone reveal${m ? (flip ? ' flip' : '') : ' solo'}">
      <div class="tl-text">
        <div class="tl-date">${fmtDate(ms.date)}</div>
        <h3 class="tl-title">${esc(ms.title || '')}</h3>
        ${ms.text ? `<p class="tl-body">${esc(ms.text)}</p>` : ''}
      </div>
      ${m ? `<div class="tl-media"><div class="collage n1">${photoButton(m, { set: 'all' })}</div></div>` : ''}
    </article>`;
  }

  function nextAnniversary(since) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let n = today.getFullYear() - since.getFullYear();
    let when = new Date(since.getFullYear() + n, since.getMonth(), since.getDate());
    if (when < today) { n += 1; when = new Date(since.getFullYear() + n, since.getMonth(), since.getDate()); }
    if (n < 1) { n = 1; when = new Date(since.getFullYear() + 1, since.getMonth(), since.getDate()); }
    return { n, when, days: Math.round((when - today) / DAY) };
  }

  function specialDays(since, extra) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out = [];
    if (since) {
      const a = nextAnniversary(since);
      out.push({ label: `在一起 ${a.n} 周年`, when: a.when, left: a.days });
      const dayNo = Math.round((today - since) / DAY) + 1;
      const target = (Math.floor(dayNo / 100) + 1) * 100;
      const when = new Date(since.getTime() + (target - 1) * DAY);
      out.push({ label: `在一起的第 ${nf.format(target)} 天`, when, left: Math.round((when - today) / DAY) });
    }
    for (const d of extra) {
      let when = null;
      let age = null;
      if (d.dates) {
        // Lunar dates arrive already converted, one per year.
        const next = d.dates.find((x) => parseDay(x.d) >= today);
        if (next) { when = parseDay(next.d); age = next.age ?? null; }
      } else if (d.date) {
        const parts = d.date.split('-').map(Number);
        if (parts.length === 2) {
          when = new Date(today.getFullYear(), parts[0] - 1, parts[1]);
          if (when < today) when = new Date(today.getFullYear() + 1, parts[0] - 1, parts[1]);
          if (d.born) age = when.getFullYear() - d.born;
        } else {
          when = new Date(parts[0], parts[1] - 1, parts[2]);
          if (when < today) when = null;
        }
      }
      if (!when) continue;
      out.push({ label: d.label, when, left: Math.round((when - today) / DAY), age, note: d.note || '' });
    }
    return out.sort((x, y) => x.left - y.left);
  }

  /* ---------- live counter ---------- */
  function tick(since) {
    const els = { d: $('#c-days'), h: $('#c-h'), m: $('#c-m'), s: $('#c-s') };
    const pad = (n) => String(n).padStart(2, '0');
    const update = () => {
      let t = Math.max(0, Date.now() - since.getTime());
      const d = Math.floor(t / DAY); t -= d * DAY;
      const h = Math.floor(t / 3600000); t -= h * 3600000;
      const m = Math.floor(t / 60000); t -= m * 60000;
      els.d.textContent = nf.format(d);
      els.h.textContent = pad(h);
      els.m.textContent = pad(m);
      els.s.textContent = pad(Math.floor(t / 1000));
    };
    update();
    setInterval(update, 1000);
  }

  /* ---------- gallery wall ---------- */
  function setupWall() {
    const wall = $('#wall');
    const moreBtn = $('#wall-more');
    const PAGE = 60;
    let list = data.media;
    let shown = 0;
    const more = () => {
      const next = list.slice(shown, shown + PAGE);
      wall.insertAdjacentHTML('beforeend', next.map((m) => photoButton(m, { set: 'wall' })).join(''));
      shown += next.length;
      moreBtn.hidden = shown >= list.length;
      moreBtn.textContent = `再看更多（还有 ${list.length - shown} 张）`;
      observeImages(wall);
    };
    const reset = (year) => {
      list = year ? data.media.filter((m) => m.date.startsWith(year)) : data.media;
      sets.wall = list.map((m) => m.id);
      wall.innerHTML = '';
      shown = 0;
      more();
    };
    moreBtn.addEventListener('click', more);
    story.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
      story.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      reset(chip.dataset.year);
    }));
    reset('');
  }

  /* ---------- lazy images ---------- */
  const imgObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      imgObserver.unobserve(e.target);
      const m = byId.get(e.target.dataset.id);
      const img = e.target.querySelector('img');
      blobURL(m.id, 'image/webp').then((u) => { img.onload = () => img.classList.add('ready'); img.src = u; }).catch(() => {});
    }
  }, { rootMargin: '800px 0px' });
  const observeImages = (root) => root.querySelectorAll('.ph:not([data-seen])').forEach((el) => { el.dataset.seen = '1'; imgObserver.observe(el); });

  /* ---------- reveal + timeline progress ---------- */
  function startReveal() {
    const ro = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    story.querySelectorAll('.reveal, .paper').forEach((el) => ro.observe(el));
    observeImages(story);
    const tl = $('.tl');
    if (tl) {
      const onScroll = () => {
        const r = tl.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
        tl.style.setProperty('--p', p.toFixed(4));
      };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lb');
  const stage = $('#lb-stage');
  let lbSet = [];
  let lbIndex = 0;
  let lastFocus = null;

  story.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.ph');
    if (!btn) return;
    const set = sets[btn.dataset.set] || sets.all;
    openLightbox(set, Math.max(0, set.indexOf(btn.dataset.id)));
  });

  function openLightbox(set, index) {
    lastFocus = document.activeElement;
    lbSet = set;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(index);
    $('#lb-close').focus({ preventScroll: true });
  }
  function closeLightbox() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    stage.querySelectorAll('video').forEach((v) => v.pause());
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function show(i) {
    lbIndex = (i + lbSet.length) % lbSet.length;
    const m = byId.get(lbSet[lbIndex]);
    $('#lb-n').textContent = `${lbIndex + 1} / ${lbSet.length}`;
    $('#lb-date').textContent = [dateLabel(m), placeOf(m) && placeOf(m).name].filter(Boolean).join(' · ');
    $('#lb-text').textContent = m.cap || '';
    stage.innerHTML = '<img alt="" class="ghost">';
    const ghost = stage.querySelector('img');
    blobURL(m.id, 'image/webp', true).then((u) => { if (lbSet[lbIndex] === m.id) ghost.src = u; }).catch(() => {});
    const full = m.type === 'video' ? blobURL(m.v, 'video/mp4', true) : blobURL(m.l, 'image/webp', true);
    full.then((u) => {
      if (lbSet[lbIndex] !== m.id) return;
      if (m.type === 'video') {
        stage.innerHTML = `<video src="${u}" controls playsinline autoplay></video>`;
      } else {
        const img = new Image();
        img.alt = m.cap || '';
        img.onload = () => { if (lbSet[lbIndex] === m.id) stage.replaceChildren(img); };
        img.src = u;
      }
    }).catch(() => {});
    // Warm up the neighbours so swiping feels instant.
    [lbIndex + 1, lbIndex - 1].forEach((j) => {
      const n = byId.get(lbSet[(j + lbSet.length) % lbSet.length]);
      if (n && n.type !== 'video') blobURL(n.l, 'image/webp');
    });
  }
  $('#lb-close').addEventListener('click', closeLightbox);
  $('#lb-prev').addEventListener('click', () => show(lbIndex - 1));
  $('#lb-next').addEventListener('click', () => show(lbIndex + 1));
  addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') show(lbIndex + 1);
    else if (e.key === 'ArrowLeft') show(lbIndex - 1);
  });
  stage.addEventListener('click', (e) => { if (e.target === stage) closeLightbox(); });

  let touch = null;
  let lastTap = 0;
  lb.addEventListener('touchstart', (e) => { const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, at: Date.now() }; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    const quick = Date.now() - touch.at < 250;
    touch = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { show(lbIndex + (dx < 0 ? 1 : -1)); return; }
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { closeLightbox(); return; }
    if (quick && Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.target.closest('.lb-stage')) {
      const now = Date.now();
      if (now - lastTap < 320) { popHeart(); lastTap = 0; } else lastTap = now;
    }
  });
  stage.addEventListener('dblclick', popHeart);
  function popHeart() {
    const h = document.createElement('span');
    h.className = 'pop';
    h.innerHTML = HEART;
    stage.appendChild(h);
    setTimeout(() => h.remove(), 1000);
  }

  /* ---------- anniversaries on the timeline ---------- */
  function withAnniversaries(milestones, since, media) {
    if (!since) return milestones;
    const out = milestones.slice();
    const have = new Set(out.map((ms) => ms.date));
    const today = new Date();
    for (let n = 1; ; n += 1) {
      const d = new Date(since.getFullYear() + n, since.getMonth(), since.getDate());
      if (d > today) break;
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      if (have.has(key)) continue;
      const that = media.filter((m) => m.dq === 'exif' && m.date.startsWith(key));
      const photo = (that.find((m) => m.fav) || that[0] || {}).id || null;
      out.push({ date: key, title: `在一起 ${n} 周年`, text: '', photo });
    }
    return out;
  }

  /* ---------- hero: a slow slideshow of the best photos ---------- */
  const hero = (() => {
    let slides = [];
    let idx = 0;
    let layers = [];
    let timer = 0;
    let started = false;
    let visible = true;
    const HOLD = 6500;

    function choose() {
      const ids = data.hero && data.hero.length ? data.hero : data.cover ? [data.cover] : [];
      const list = ids.map((id) => byId.get(id)).filter(Boolean);
      const wide = innerWidth >= innerHeight;
      // Landscape photos for a wide screen; portrait and square ones for a phone.
      const fit = list.filter((m) => (wide ? m.w / m.h > 1.1 : m.w / m.h <= 1.1));
      slides = fit.length >= 3 ? fit : list;
      if (!slides.length && data.media.length) slides = [data.media[0]];
    }
    function prepare() {
      const box = $('#hero-media');
      if (!box) return;
      layers = [0, 1].map(() => { const img = document.createElement('img'); img.alt = ''; box.appendChild(img); return img; });
      if (!slides.length) choose();
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe($('#top'));
    }
    const first = () => { if (!slides.length) choose(); return slides[0] || null; };
    function meta(m) {
      const el = $('#hero-meta');
      if (!el) return;
      const p = placeOf(m);
      el.classList.remove('on');
      setTimeout(() => {
        el.textContent = [p && (p.en || p.name), dateLabel(m)].filter(Boolean).join(' · ');
        el.classList.toggle('on', !!el.textContent);
      }, 500);
    }
    function showSlide(i) {
      const m = slides[i];
      if (!m) return Promise.resolve();
      return blobURL(m.l, 'image/webp', i === 0).then((u) => new Promise((resolve) => {
        const img = layers[i % 2];
        const other = layers[(i + 1) % 2];
        img.onload = () => {
          img.style.objectPosition = m.h > m.w ? '50% 30%' : '50% 50%';
          img.className = `on kb${i % 4}`;
          other.classList.remove('on');
          meta(m);
          resolve();
        };
        img.src = u;
      })).catch(() => {});
    }
    function loop() {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (visible && !document.hidden && slides.length > 1) {
          idx = (idx + 1) % slides.length;
          await showSlide(idx);
          const next = slides[(idx + 1) % slides.length];
          if (next) blobURL(next.l, 'image/webp');
        }
        loop();
      }, HOLD);
    }
    function start() {
      if (started || !layers.length) return;
      started = true;
      showSlide(0).then(() => {
        if (slides[1]) blobURL(slides[1].l, 'image/webp');
        if (!reduceMotion) loop();
      });
    }
    return { prepare, start, first };
  })();

  /* ---------- opening: the photos gather into a heart, which opens into the cover ---------- */
  const HEART_COLS = 11;
  const HEART_TOP = 12.5;
  const HEART_UNIT = 34 / HEART_COLS;
  const heartPoint = (t) => [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
  const HEART_POLY = Array.from({ length: 160 }, (_, i) => heartPoint((i / 160) * Math.PI * 2));
  function inHeart(x, y) {
    let c = false;
    for (let i = 0, j = HEART_POLY.length - 1; i < HEART_POLY.length; j = i, i += 1) {
      const [x1, y1] = HEART_POLY[i];
      const [x2, y2] = HEART_POLY[j];
      if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
    }
    return c;
  }
  function heartCells() {
    const cells = [];
    for (let r = 0; ; r += 1) {
      const y = HEART_TOP - (r + 0.5) * HEART_UNIT;
      if (y < -17.5) break;
      for (let c = 0; c < HEART_COLS; c += 1) if (inHeart(-17 + (c + 0.5) * HEART_UNIT, y)) cells.push([c, r]);
    }
    return cells;
  }
  function heartMask(rows) {
    const h = rows * HEART_UNIT;
    const d = HEART_POLY.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${(-y).toFixed(2)}`).join('') + 'Z';
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-17 ${-HEART_TOP} 34 ${h.toFixed(3)}' preserveAspectRatio='none'><path d='${d}'/></svg>`)}")`;
  }

  function prepareIntro() {
    const cover = hero.first();
    const coverURL = cover ? blobURL(cover.l, 'image/webp', true) : Promise.reject(new Error('no cover'));
    const spriteURL = data.mosaic ? blobURL(data.mosaic.id, 'image/webp', true) : Promise.reject(new Error('no mosaic'));
    coverURL.catch(() => {});
    spriteURL.catch(() => {});
    return { play: () => playIntro(spriteURL, coverURL, cover) };
  }

  async function playIntro(spriteURL, coverURL, cover) {
    const sprite = await Promise.race([spriteURL, sleep(2600).then(() => null)]).catch(() => null);
    const vw = innerWidth;
    const vh = innerHeight;
    const cells = heartCells();
    const rows = cells.reduce((n, [, r]) => Math.max(n, r + 1), 0);
    const W = Math.min(vw * 0.8, vh * 0.56, 460);
    const step = W / HEART_COLS;
    const H = rows * step;
    const left = (vw - W) / 2;
    const top = Math.max(16, vh * 0.45 - H / 2);

    const el = document.createElement('div');
    el.className = 'intro';
    el.innerHTML = `<div class="intro-heart" style="left:${left}px;top:${top}px;width:${W}px;height:${H}px"></div>
      <div class="intro-cover"><img alt=""></div>
      <div class="intro-cap" style="top:${top + H + 26}px"></div>
      <button class="intro-skip" type="button">跳过</button>`;
    document.body.appendChild(el);
    const heartEl = el.querySelector('.intro-heart');
    const coverEl = el.querySelector('.intro-cover');
    const cap = el.querySelector('.intro-cap');
    lock.classList.add('is-leaving');

    let skipped = false;
    const skip = new Promise((resolve) => {
      el.addEventListener('click', () => { skipped = true; resolve(); }, { once: true });
    });
    const wait = (ms) => Promise.race([sleep(ms), skip]);

    const since = data.since ? parseDay(data.since) : null;
    const days = since ? Math.floor((Date.now() - since) / DAY) + 1 : 0;
    cap.innerHTML = `${since ? `<span class="k">${fmtDate(data.since)} — ${fmtDate(new Date())}</span>` : ''}
      <b>${since ? `第 ${nf.format(days)} 天 · ` : ''}${nf.format(data.media.length)} 个瞬间</b>`;

    let tiles = [];
    if (sprite && data.mosaic) {
      const mos = data.mosaic;
      const srows = Math.ceil(mos.n / mos.cols);
      const order = cells.map((_, i) => i % mos.n).sort(() => Math.random() - 0.5);
      const g = step * 0.06;
      tiles = cells.map(([c, r], i) => {
        const t = document.createElement('i');
        const k = order[i];
        t.className = 'intro-tile';
        t.style.cssText = `left:${c * step + g}px;top:${r * step + g}px;width:${step - 2 * g}px;height:${step - 2 * g}px;`
          + `background-image:url(${sprite});background-size:${mos.cols * 100}% ${srows * 100}%;`
          + `background-position:${((k % mos.cols) / (mos.cols - 1)) * 100}% ${(Math.floor(k / mos.cols) / Math.max(1, srows - 1)) * 100}%`;
        heartEl.appendChild(t);
        return t;
      });
      tiles.forEach((t) => {
        const a = Math.random() * Math.PI * 2;
        const d = Math.max(vw, vh) * (0.5 + Math.random() * 0.5);
        t.animate([
          { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(.3) rotate(${(Math.random() - 0.5) * 120}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.3 },
          { transform: 'none', opacity: 1 },
        ], { duration: 1300, delay: 100 + Math.random() * 700, easing: 'cubic-bezier(.16,.84,.24,1)', fill: 'both' });
      });
      await wait(2000);
      if (!skipped) {
        cap.classList.add('on');
        heartEl.animate([
          { transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.16 }, { transform: 'scale(1)', offset: 0.34 },
          { transform: 'scale(1.045)', offset: 0.52 }, { transform: 'scale(1)' },
        ], { duration: 1000, easing: 'ease-in-out' });
        await wait(1200);
      }
    }

    const url = skipped ? null : await Promise.race([coverURL, sleep(1800).then(() => null)]).catch(() => null);
    if (url && !skipped) {
      const img = coverEl.querySelector('img');
      img.src = url;
      try { await img.decode(); } catch (e) { /* draw anyway */ }
      if (cover && cover.h > cover.w) img.style.objectPosition = '50% 30%';
      const mask = heartMask(rows);
      const setMask = (w, h, x, y) => {
        coverEl.style.webkitMaskImage = mask; coverEl.style.maskImage = mask;
        coverEl.style.webkitMaskSize = `${w}px ${h}px`; coverEl.style.maskSize = `${w}px ${h}px`;
        coverEl.style.webkitMaskPosition = `${x}px ${y}px`; coverEl.style.maskPosition = `${x}px ${y}px`;
      };
      setMask(W, H, left, top);
      coverEl.classList.add('on');
      cap.classList.remove('on');
      await wait(450);
      if (!skipped) {
        // Grow around a point inside the heart until it covers the screen.
        const ax = vw / 2;
        const ay = top + H * 0.42;
        const k = Math.max(vw / (W * 0.42), vh / (H * 0.36)) * 1.25;
        coverEl.classList.add('grow');
        void coverEl.offsetWidth;
        setMask(W * k, H * k, ax - (ax - left) * k, ay - (ay - top) * k);
        tiles.forEach((t) => {
          const r = t.getBoundingClientRect();
          const dx = r.left + r.width / 2 - ax;
          const dy = r.top + r.height / 2 - ay;
          const f = 1.6 + Math.random();
          t.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx * f}px, ${dy * f}px) scale(.6) rotate(${(Math.random() - 0.5) * 90}deg)`, opacity: 0 }],
            { duration: 1100, delay: Math.random() * 150, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
        });
        await wait(1500);
      }
      coverEl.style.webkitMaskImage = 'none';
      coverEl.style.maskImage = 'none';
    }

    showStory();
    await sleep(80);
    el.classList.add('out');
    setTimeout(() => el.remove(), 1000);
  }

  /* ---------- travel map ---------- */
  function placeGroups() {
    const groups = (data.places || []).map((pl, i) => ({ i, pl, list: [] }));
    data.media.forEach((m) => { if (m.p != null && groups[m.p]) groups[m.p].list.push(m); });
    groups.forEach((g) => {
      const dated = g.list.filter((m) => m.dq !== 'unknown');
      g.first = dated.length ? dated[0].date : '9999';
      g.last = dated.length ? dated[dated.length - 1].date : '';
      // Visits more than a week apart count separately.
      g.visits = 0;
      let prev = null;
      dated.forEach((m) => { const t = parseDay(m.date); if (!prev || t - prev > 7 * DAY) g.visits += 1; prev = t; });
    });
    return groups.filter((g) => g.list.length).sort((x, y) => (x.first < y.first ? -1 : 1));
  }

  function atlasHTML() {
    const groups = placeGroups();
    if (!groups.length) return '';
    const range = (g) => {
      if (!g.last) return '';
      const a = g.first.slice(0, 10);
      const b = g.last.slice(0, 10);
      if (g.visits > 1) return `${g.visits} 次 · ${a.slice(0, 7).replace('-', '.')} – ${b.slice(0, 7).replace('-', '.')}`;
      if (a === b) return fmtDate(a);
      return `${fmtDate(a)} – ${a.slice(0, 4) === b.slice(0, 4) ? b.slice(5).replace('-', '.') : fmtDate(b)}`;
    };
    const cards = groups.map((g, n) => {
      sets[`p${g.i}`] = g.list.map((m) => m.id);
      const c = g.list.find((m) => m.fav && m.type === 'photo') || g.list.find((m) => m.type === 'photo') || g.list[0];
      return `<li class="trip" data-p="${g.i}">
        <button class="ph trip-ph" type="button" data-id="${c.id}" data-set="p${g.i}" style="--c:${c.c}" aria-label="${esc(g.pl.name)}的照片"><img alt="" decoding="async"></button>
        <div class="trip-meta">
          <span class="trip-no">${pad2(n + 1)}</span>
          <h3>${esc(g.pl.name)}</h3>
          ${g.pl.en ? `<small>${esc(g.pl.en)}</small>` : ''}
          <p>${range(g)}${range(g) ? ' · ' : ''}${g.list.length} 张</p>
        </div>
      </li>`;
    }).join('');
    return `<section class="sec atlas" id="map"><div class="wrap">
      <header class="sec-head reveal"><p class="kicker">Our map</p><h2>我们一起去过的地方</h2>
        <p class="lead">照片里的定位整理出 ${groups.length} 个地方。左右滑动下面的画册，地图会跟着飞过去；点开照片可以看这一站的全部。</p></header>
      <div class="atlas-map reveal">
        <canvas id="atlas" aria-label="旅行地图"></canvas>
        <div class="atlas-ctl" role="group" aria-label="地图范围">
          <button type="button" data-view="fit" aria-pressed="true">我们的足迹</button>
          <button type="button" data-view="world" aria-pressed="false">全世界</button>
        </div>
        <div class="atlas-now" id="atlas-now" aria-live="polite"></div>
      </div>
      <div class="trips-wrap reveal">
        <button class="trips-nav prev" type="button" aria-label="上一站"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
        <ol class="trips" id="trips">${cards}</ol>
        <button class="trips-nav next" type="button" aria-label="下一站"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
    </div></section>`;
  }

  const atlas = (() => {
    const K = Math.cos((25 * Math.PI) / 180); // horizontal scale of the map projection
    let canvas; let ctx; let W = 0; let H = 0; let dpr = 1;
    let land = null; let bits = null;
    let groups = []; let pins = []; let route = [];
    let view = null; let flight = null; let mode = 'fit'; let active = -1;
    let routeP = 0; let routeStart = 0; let visible = false; let raf = 0; let following = false;

    const P = (lon, lat, v = view) => [W / 2 + (lon - v.lon) * K * v.s, H / 2 - (lat - v.lat) * v.s];

    function fitView(list, pad) {
      const lons = list.map((p) => p.lon);
      const lats = list.map((p) => p.lat);
      const lo0 = Math.min(...lons); const lo1 = Math.max(...lons);
      const la0 = Math.min(...lats); const la1 = Math.max(...lats);
      const s = Math.min((W - pad * 2) / Math.max(1, (lo1 - lo0) * K), (H - pad * 2) / Math.max(1, la1 - la0), 40);
      return { lon: (lo0 + lo1) / 2, lat: (la0 + la1) / 2, s };
    }
    const worldView = () => ({ lon: 100, lat: 18, s: Math.max(W / (360 * K), H / 150) });
    const placeView = (pl) => ({ lon: pl.lon, lat: pl.lat, s: Math.max(16, Math.min(64, Math.min(W, H * 1.3) / 8)) });
    const targetFor = () => (mode === 'world' ? worldView() : mode === 'place' && active >= 0 ? placeView(data.places[active]) : fitView(pins, Math.min(W, H) * 0.14));

    function setup() {
      canvas = $('#atlas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      groups = placeGroups();
      pins = groups.map((g) => ({ ...g.pl, i: g.i, n: g.list.length }));
      // Route: each hop between two places, in the order we first made it. A hop made again
      // (going home and back) is drawn once, always bending the same way.
      const seq = [];
      data.media.filter((m) => m.p != null && m.dq !== 'unknown').forEach((m) => { if (seq[seq.length - 1] !== m.p) seq.push(m.p); });
      const seen = new Set();
      route = [];
      for (let i = 1; i < seq.length; i += 1) {
        const [a, b] = [data.places[seq[i - 1]], data.places[seq[i]]].sort((x, y) => x.lon - y.lon);
        const k = `${a.name}|${b.name}`;
        if (!seen.has(k)) { seen.add(k); route.push([a, b]); }
      }
      // The page is still hidden while this runs, so size the canvas once it is laid out.
      new ResizeObserver(() => { resize(); if (W && !flight) view = targetFor(); kick(); }).observe(canvas);
      new IntersectionObserver((es) => {
        visible = es[0].isIntersecting;
        if (visible) {
          if (!land) loadLand();
          if (!routeStart) routeStart = performance.now() + 400;
          kick();
        }
      }, { rootMargin: '100px 0px' }).observe(canvas);
      canvas.addEventListener('click', onClick);
      document.querySelectorAll('.atlas-ctl button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.view)));
      setupTrips();
    }

    function loadLand() {
      land = { loading: true };
      fetch('assets/land.json').then((r) => r.json()).then((j) => {
        land = j;
        bits = Uint8Array.from(atob(j.bits), (c) => c.charCodeAt(0));
        kick();
      }).catch(() => { land = null; });
    }

    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    function setMode(m, placeIndex) {
      mode = m;
      if (m === 'place') active = placeIndex; else if (m !== 'place') active = -1;
      document.querySelectorAll('.atlas-ctl button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === m)));
      document.querySelectorAll('.trip').forEach((t) => t.classList.toggle('on', Number(t.dataset.p) === active));
      const now = $('#atlas-now');
      if (now) {
        const g = groups.find((x) => x.i === active);
        now.innerHTML = g ? `<b>${esc(g.pl.name)}</b><span>${g.list.length} 张照片</span>` : '';
        now.classList.toggle('on', !!g);
      }
      flyTo(targetFor());
    }

    function flyTo(to) {
      if (!view || !W) { view = to; return; }
      const from = { ...view };
      const dist = Math.hypot((to.lon - from.lon) * K, to.lat - from.lat);
      flight = { from, to, t0: performance.now(), dur: reduceMotion ? 1 : 900 + Math.min(900, dist * 18), dip: Math.min(1.1, dist / 30) };
      kick();
    }

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    function step(now) {
      if (flight) {
        const t = Math.min(1, (now - flight.t0) / flight.dur);
        const e = ease(t);
        const { from, to } = flight;
        const ls = Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e - flight.dip * Math.sin(Math.PI * e);
        view = { lon: from.lon + (to.lon - from.lon) * e, lat: from.lat + (to.lat - from.lat) * e, s: Math.exp(ls) };
        if (t >= 1) { view = to; flight = null; }
      }
      if (routeStart && now > routeStart) routeP = reduceMotion ? 1 : Math.min(1, (now - routeStart) / 3200);
    }

    function kick() {
      if (raf || !visible) return;
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      raf = 0;
      step(now);
      draw(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function drawLand() {
      if (!bits) return;
      const st = land.step;
      const cell = st * view.s; // px between dots vertically
      const stride = Math.max(1, Math.ceil(4.6 / cell));
      const gap = cell * stride;
      const r = Math.max(0.55, Math.min(1.7, gap * 0.2));
      const lonL = view.lon - W / 2 / (K * view.s);
      const lonR = view.lon + W / 2 / (K * view.s);
      const latT = view.lat + H / 2 / view.s;
      const latB = view.lat - H / 2 / view.s;
      const r0 = Math.max(0, Math.floor((land.lat0 - latT) / st / stride) * stride);
      const r1 = Math.min(land.rows - 1, Math.ceil((land.lat0 - latB) / st));
      const c0 = Math.floor((lonL - land.lon0) / st / stride) * stride;
      const c1 = Math.ceil((lonR - land.lon0) / st);
      ctx.beginPath();
      for (let row = r0; row <= r1; row += stride) {
        const lat = land.lat0 - (row + 0.5) * st;
        const y = H / 2 - (lat - view.lat) * view.s;
        const base = row * land.cols;
        for (let c = c0; c <= c1; c += stride) {
          const col = ((c % land.cols) + land.cols) % land.cols;
          const i = base + col;
          if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
          const x = W / 2 + (land.lon0 + (c + 0.5) * st - view.lon) * K * view.s;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = 'rgba(255, 232, 240, .2)';
      ctx.fill();
      // Warm the land around the places we have been.
      ctx.globalCompositeOperation = 'source-atop';
      for (const p of pins) {
        const [x, y] = P(p.lon, p.lat);
        const R = Math.max(26, view.s * 2.2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, 'rgba(255, 125, 156, .95)');
        g.addColorStop(1, 'rgba(255, 125, 156, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - R, y - R, R * 2, R * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function seg(a, b) {
      const [x0, y0] = P(a.lon, a.lat);
      const [x2, y2] = P(b.lon, b.lat);
      const mx = (x0 + x2) / 2; const my = (y0 + y2) / 2;
      const dx = x2 - x0; const dy = y2 - y0;
      return [x0, y0, mx - dy * 0.22, my + dx * 0.22, x2, y2];
    }
    function drawRoute(now) {
      if (!route.length) return;
      const n = route.length;
      const k = routeP * n;
      ctx.save();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = 'rgba(255, 160, 180, .75)';
      ctx.shadowColor = 'rgba(255, 125, 156, .8)';
      ctx.shadowBlur = 6;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i < n && i < k; i += 1) {
        let [x0, y0, cx, cy, x2, y2] = seg(route[i][0], route[i][1]);
        const f = Math.min(1, k - i);
        if (f < 1) { // cut the curve where the drawing has got to
          const ax = x0 + (cx - x0) * f; const ay = y0 + (cy - y0) * f;
          const bx = cx + (x2 - cx) * f; const by = cy + (y2 - cy) * f;
          x2 = ax + (bx - ax) * f; y2 = ay + (by - ay) * f; cx = ax; cy = ay;
        }
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x2, y2);
      }
      ctx.stroke();
      ctx.restore();
      if (routeP >= 1 && !reduceMotion) { // a small light keeps travelling the route
        const T = (now / 1000 / 2.2) % n;
        const i = Math.floor(T);
        const t = T - i;
        const [x0, y0, cx, cy, x2, y2] = seg(route[i][0], route[i][1]);
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x2;
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(255, 240, 245, .95)');
        g.addColorStop(1, 'rgba(255, 125, 156, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 9, y - 9, 18, 18);
      }
    }

    function drawPins(now) {
      const boxes = [];
      const order = pins.slice().sort((a, b) => (a.i === active ? -1 : b.i === active ? 1 : b.n - a.n));
      for (const p of pins) {
        const [x, y] = P(p.lon, p.lat);
        if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
        const on = p.i === active;
        const ph = ((now / 2400) + p.i * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(x, y, (on ? 7 : 4) + ph * (on ? 22 : 14), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 125, 156, ${(on ? 0.7 : 0.45) * (1 - ph)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        const g = ctx.createRadialGradient(x, y, 0, x, y, on ? 18 : 11);
        g.addColorStop(0, 'rgba(255, 125, 156, .75)');
        g.addColorStop(1, 'rgba(255, 125, 156, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 18, y - 18, 36, 36);
        ctx.beginPath();
        ctx.arc(x, y, on ? 4.6 : 3, 0, Math.PI * 2);
        ctx.fillStyle = on ? '#fff' : '#ffe3ea';
        ctx.fill();
      }
      ctx.textBaseline = 'middle';
      for (const p of order) {
        const [x, y] = P(p.lon, p.lat);
        const on = p.i === active;
        ctx.font = `${on ? 600 : 400} ${on ? 16 : 13}px "Story Kai", "UI Kai", "Songti SC", serif`;
        const w = ctx.measureText(p.name).width;
        const h = on ? 20 : 16;
        let bx = x + 9;
        let box = [bx, y - h / 2, w, h];
        const hit = (b) => boxes.some((o) => b[0] < o[0] + o[2] + 4 && b[0] + b[2] + 4 > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1]);
        if (hit(box) || bx + w > W - 4) { bx = x - 9 - w; box = [bx, y - h / 2, w, h]; }
        if ((hit(box) || bx < 4) && !on) continue;
        boxes.push(box);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(11, 9, 16, .85)';
        ctx.strokeText(p.name, bx, y + 1);
        ctx.fillStyle = on ? '#fff' : 'rgba(255, 238, 244, .86)';
        ctx.fillText(p.name, bx, y + 1);
      }
    }

    function draw(now) {
      if (!view || !W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawLand();
      drawRoute(now);
      drawPins(now);
    }

    function onClick(e) {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      let best = null; let bd = 22;
      for (const p of pins) {
        const [px, py] = P(p.lon, p.lat);
        const d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { following = true; select(best.i, true); }
    }

    function select(i, scrollCard) {
      if (i === active && mode === 'place') return;
      setMode('place', i);
      if (scrollCard) {
        const card = document.querySelector(`.trip[data-p="${i}"]`);
        const list = $('#trips');
        if (card && list) list.scrollTo({ left: card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    function setupTrips() {
      const list = $('#trips');
      if (!list) return;
      let tm = 0;
      const pick = () => {
        const mid = list.scrollLeft + list.clientWidth / 2;
        let best = null; let bd = Infinity;
        list.querySelectorAll('.trip').forEach((c) => {
          const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (d < bd) { bd = d; best = c; }
        });
        if (best) select(Number(best.dataset.p), false);
      };
      list.addEventListener('scroll', () => {
        if (!following) return;
        clearTimeout(tm);
        tm = setTimeout(pick, 90);
      }, { passive: true });
      ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => list.addEventListener(ev, () => { following = true; }, { passive: true }));
      const go = (dir) => {
        following = true;
        const cards = [...list.querySelectorAll('.trip')];
        let i = cards.findIndex((c) => Number(c.dataset.p) === active);
        i = i < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, i + dir));
        select(Number(cards[i].dataset.p), true);
      };
      document.querySelector('.trips-nav.prev').addEventListener('click', () => go(-1));
      document.querySelector('.trips-nav.next').addEventListener('click', () => go(1));
      list.addEventListener('mouseover', (e) => {
        const c = e.target.closest('.trip');
        if (c && finePointer) { following = true; select(Number(c.dataset.p), false); }
      });
    }

    return { setup };
  })();

  /* ---------- ambience: starfield, pointer glow, floating hearts ---------- */
  function sky() {
    const canvas = $('#sky');
    const ctx = canvas.getContext('2d');
    let w = 0; let h = 0; let stars = []; let shoot = null; let nextShoot = performance.now() + 4000;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => {
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(260, Math.round((w * h) / 7000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.25,
        p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.4, z: Math.random(),
        warm: Math.random() < 0.18,
      }));
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      const sy = scrollY;
      for (const st of stars) {
        const a = reduceMotion ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(st.p + (t / 1000) * st.s));
        let y = (st.y - sy * (0.03 + st.z * 0.08)) % h; if (y < 0) y += h;
        ctx.globalAlpha = a * (0.4 + st.z * 0.6);
        ctx.fillStyle = st.warm ? '#ffc7b0' : '#fff4f7';
        ctx.beginPath(); ctx.arc(st.x, y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduceMotion) {
        if (!shoot && t > nextShoot) {
          shoot = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.35, vx: -(6 + Math.random() * 4), vy: 2.6 + Math.random() * 2, life: 0 };
        }
        if (shoot) {
          shoot.life += 1; shoot.x += shoot.vx; shoot.y += shoot.vy;
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 14, shoot.y - shoot.vy * 14);
          g.addColorStop(0, 'rgba(255,240,245,.9)'); g.addColorStop(1, 'rgba(255,125,156,0)');
          ctx.globalAlpha = Math.max(0, 1 - shoot.life / 70);
          ctx.strokeStyle = g; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 14, shoot.y - shoot.vy * 14); ctx.stroke();
          if (shoot.life > 70) { shoot = null; nextShoot = t + 7000 + Math.random() * 9000; }
        }
      }
      ctx.globalAlpha = 1;
    };
    let raf = 0;
    const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
    resize();
    addEventListener('resize', () => { resize(); if (reduceMotion) draw(0); });
    if (reduceMotion) { draw(0); addEventListener('scroll', () => draw(0), { passive: true }); return; }
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    });
  }

  function pointerFX() {
    if (!finePointer || reduceMotion) return;
    const glow = $('.glow');
    let x = innerWidth / 2; let y = innerHeight / 2; let gx = x; let gy = y;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; document.body.classList.add('has-pointer'); }, { passive: true });
    const follow = () => {
      gx += (x - gx) * 0.12; gy += (y - gy) * 0.12;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      requestAnimationFrame(follow);
    };
    follow();
    addEventListener('click', (e) => {
      if (document.body.classList.contains('is-locked') || e.target.closest('button, a, input, label, .lb')) return;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i += 1) {
        const h = document.createElement('div');
        h.className = 'float-heart';
        h.innerHTML = HEART;
        h.style.left = `${e.clientX}px`;
        h.style.top = `${e.clientY}px`;
        h.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`);
        h.style.setProperty('--rot', `${(Math.random() - 0.5) * 50}deg`);
        h.style.animationDelay = `${i * 90}ms`;
        h.style.width = h.style.height = `${12 + Math.random() * 12}px`;
        document.body.appendChild(h);
        setTimeout(() => h.remove(), 1700);
      }
    });
  }

  sky();
  pointerFX();
  boot();
})();
