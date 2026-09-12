(() => {
  'use strict';
  const langButton = document.querySelector('#language');
  let lang = 'en';
  try { lang = localStorage.getItem('homepage-language') === 'zh' ? 'zh' : 'en'; } catch {}
  function setLanguage(next) {
    lang = next;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-en][data-zh]').forEach(el => { el.textContent = el.dataset[lang]; });
    if (langButton) {
      langButton.textContent = lang === 'en' ? '中 / EN' : '中文 / EN';
      langButton.setAttribute('aria-label', lang === 'en' ? 'Switch to Chinese' : 'Switch to English');
    }
    try { localStorage.setItem('homepage-language', lang); } catch {}
  }
  setLanguage(lang);
  langButton?.addEventListener('click', () => setLanguage(lang === 'en' ? 'zh' : 'en'));
  const nav = document.querySelector('#navigation');
  const menu = document.querySelector('.menu-toggle');
  function closeMenu() { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', 'Open navigation'); }
  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); menu.focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let visible = 0;
    document.querySelectorAll('.publication').forEach(paper => {
      paper.hidden = !(button.dataset.filter === 'all' || paper.dataset.status === button.dataset.filter || (button.dataset.filter === 'published' && paper.dataset.status === 'accepted'));
      if (!paper.hidden) visible++;
    });
    document.querySelector('#filter-announcement').textContent = lang === 'en' ? `${visible} publications shown` : `显示 ${visible} 篇论文`;
  }));
  if (nav && 'IntersectionObserver' in window) {
    const links = [...nav.querySelectorAll('a')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) links.forEach(link => {
          const active = link.getAttribute('href') === '#' + entry.target.id;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    links.forEach(link => { const section = document.querySelector(link.getAttribute('href')); if (section) observer.observe(section); });
  }
  document.querySelector('#print-cv')?.addEventListener('click', () => window.print());
})();
