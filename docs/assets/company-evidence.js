(() => {
  'use strict';
  const viewer=document.querySelector('#evidence-viewer');
  let opener;
  if(viewer?.showModal){
    document.querySelectorAll('button[data-atlas]').forEach(button=>button.addEventListener('click',()=>{
      opener=button;
      const display=viewer.querySelector('.ev-atlas');
      display.style.setProperty('--atlas-x',button.style.getPropertyValue('--atlas-x'));
      display.style.setProperty('--atlas-y',button.style.getPropertyValue('--atlas-y'));
      viewer.querySelector('.ev-atlas-frame').setAttribute('aria-label',button.getAttribute('aria-label'));
      viewer.querySelector('#evidence-caption').textContent=button.getAttribute('aria-label');
      viewer.showModal();
    }));
    viewer.querySelector('.evidence-close').addEventListener('click',()=>viewer.close());
    viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
    viewer.addEventListener('close',()=>opener?.focus());
  }
  const input=document.querySelector('#hospital-search');
  const status=document.querySelector('#hospital-search-status');
  const cities=[...document.querySelectorAll('.hospital-city')];
  const text=new Map(cities.map(city=>[city,[...city.querySelectorAll('[data-en][data-zh]')].map(el=>el.dataset.en+' '+el.dataset.zh).join(' ').toLowerCase()]));
  function filter(){
    const q=(input?.value||'').trim().toLowerCase();let n=0;
    cities.forEach(city=>{city.hidden=!text.get(city).includes(q);if(!city.hidden)n++;});
    if(status)status.textContent=document.documentElement.lang.startsWith('zh')?`显示 ${n} / ${cities.length} 个城市`:`Showing ${n} of ${cities.length} cities`;
  }
  input?.addEventListener('input',filter);
  document.querySelectorAll('.ev-map-node').forEach(node=>node.addEventListener('click',e=>{
    e.preventDefault();if(input)input.value='';filter();
    const target=document.getElementById('hospital-'+node.dataset.city);if(!target)return;
    cities.forEach(city=>city.classList.toggle('is-selected',city===target));
    history.replaceState(null,'','#'+target.id);
    target.focus({preventScroll:true});target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }));
  new MutationObserver(filter).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});filter();
})();
