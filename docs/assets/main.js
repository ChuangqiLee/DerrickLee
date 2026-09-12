(() => {
  'use strict';
  // Compatibility with bookmarks to the previous single-page homepage.
  const legacyRoutes = {
    news: 'news.html', research: 'research.html', publications: 'publications.html',
    experience: 'experience.html', company: 'company.html', life: 'life.html',
    contact: 'contact.html', 'neuroboost-software': 'company.html',
    paperorchestrator: 'publications.html', 'k12-teaching-agent': 'publications.html',
    'skybound-magic': 'publications.html', 'learning-engagement': 'publications.html',
    'geometry-survey': 'publications.html', protoflow: 'publications.html', eloss: 'publications.html'
  };
  const fragment = window.location.hash.slice(1);
  if (document.body.classList.contains('home-page') && legacyRoutes[fragment]) {
    window.location.replace(legacyRoutes[fragment] + window.location.hash);
    return;
  }
  const langButton = document.querySelector('#language');
  const nav = document.querySelector('#navigation');
  const menu = document.querySelector('.menu-toggle');
  let lang = 'en';
  try { lang = localStorage.getItem('homepage-language') === 'zh' ? 'zh' : 'en'; } catch {}
  function syncMenuLabel() {
    const open = menu?.getAttribute('aria-expanded') === 'true';
    menu?.setAttribute('aria-label', lang === 'zh' ? (open ? '关闭导航' : '打开导航') : (open ? 'Close navigation' : 'Open navigation'));
  }
  function setLanguage(next) {
    lang = next;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-en][data-zh]').forEach(el => { el.textContent = el.dataset[lang]; });
    if (langButton) {
      langButton.textContent = lang === 'en' ? '中 / EN' : '中文 / EN';
      langButton.setAttribute('aria-label', lang === 'en' ? 'Switch to Chinese' : 'Switch to English');
    }
    syncMenuLabel();
    try { localStorage.setItem('homepage-language', lang); } catch {}
  }
  setLanguage(lang);
  langButton?.addEventListener('click', () => setLanguage(lang === 'en' ? 'zh' : 'en'));
  function closeMenu() {
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    syncMenuLabel();
  }
  menu?.addEventListener('click', () => {
    if (!nav) return;
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    syncMenuLabel();
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); menu?.focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
  window.matchMedia?.('(min-width: 1001px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  const filters = document.querySelectorAll('[data-filter]');
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let visible = 0;
    document.querySelectorAll('.publication').forEach(paper => {
      paper.hidden = !(button.dataset.filter === 'all' || paper.dataset.status === button.dataset.filter || (button.dataset.filter === 'published' && paper.dataset.status === 'accepted'));
      if (!paper.hidden) visible++;
    });
    const announcement = document.querySelector('#filter-announcement');
    if (announcement) announcement.textContent = lang === 'en' ? `${visible} publications shown` : `显示 ${visible} 篇论文`;
  }));
  document.querySelector('#print-cv')?.addEventListener('click', () => window.print());
})();
