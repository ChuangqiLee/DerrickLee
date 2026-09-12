(() => {
  const dialog = document.querySelector('.le-lightbox');
  if (!dialog || !dialog.showModal) return;
  const picture = dialog.querySelector('img');
  let trigger;
  document.querySelectorAll('a.le-zoom, .le-archive a').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      trigger = link;
      picture.src = link.href;
      picture.alt = link.querySelector('img')?.alt || '';
      dialog.showModal();
    });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => trigger?.focus());
})();
