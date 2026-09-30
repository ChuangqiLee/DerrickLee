(() => {
  'use strict';
  const root = document.documentElement;
  const system = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let custom = false;
  try { custom = localStorage.getItem('edition-reduce-motion') === 'true'; } catch {}
  const disabled = () => system.matches || custom;
  const progress = document.createElement('div'); progress.className = 'edition-progress'; progress.setAttribute('aria-hidden','true'); document.body.append(progress);
  const glow = document.createElement('div'), dot = document.createElement('div');
  glow.className = 'edition-light'; dot.className = 'edition-dot';
  [glow,dot].forEach(el=>{el.setAttribute('aria-hidden','true');document.body.append(el);});
  const hide=()=>{glow.style.opacity='0';dot.style.opacity='0';};
  function syncMotion(){
    root.classList.toggle('motion-reduced',disabled()); hide();
    document.querySelectorAll('.edition-motion').forEach(button=>{
      button.setAttribute('aria-pressed',String(disabled()));
      button.textContent=root.lang.startsWith('zh')?(disabled()?'动态已减少':'减少动态效果'):(disabled()?'Motion reduced':'Reduce motion');
      if(system.matches){button.title=root.lang.startsWith('zh')?'遵循系统减少动态设置':'Following system reduced-motion preference';}else button.removeAttribute('title');
    });
    if(disabled())document.querySelectorAll('video[autoplay]').forEach(v=>v.pause());
  }
  document.querySelectorAll('.edition-motion').forEach(button=>button.addEventListener('click',()=>{custom=!custom;try{localStorage.setItem('edition-reduce-motion',String(custom));}catch{}syncMotion();}));
  system.addEventListener('change',syncMotion); fine.addEventListener('change',hide);
  new MutationObserver(syncMotion).observe(root,{attributes:true,attributeFilter:['lang']});syncMotion();
  let scheduled=false;
  function scrollUpdate(){scheduled=false;const max=root.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,Math.max(0,scrollY/max)):0})`;}
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(scrollUpdate);}},{passive:true});
  addEventListener('resize',scrollUpdate);addEventListener('load',scrollUpdate);scrollUpdate();
  let pointerFrame=0,x=0,y=0;
  document.addEventListener('pointermove',e=>{
    if(disabled()||!fine.matches||e.pointerType==='touch')return;
    x=e.clientX;y=e.clientY;
    if(!pointerFrame)pointerFrame=requestAnimationFrame(()=>{
      glow.style.transform=`translate(${x-150}px,${y-150}px)`;dot.style.transform=`translate(${x+15}px,${y+15}px)`;glow.style.opacity='1';dot.style.opacity='.65';pointerFrame=0;
    });
  },{passive:true});
  document.documentElement.addEventListener('pointerleave',hide);addEventListener('blur',hide);
  const visual=document.querySelector('.hero-visual');
  visual?.addEventListener('pointermove',e=>{if(disabled()||!fine.matches)return;const b=visual.getBoundingClientRect();visual.style.setProperty('--orbit-turn',`${-12+(e.clientX-b.left)/b.width*18}deg`);},{passive:true});
  visual?.addEventListener('pointerleave',()=>visual.style.removeProperty('--orbit-turn'));
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){if(!disabled())entry.target.classList.add('edition-arrive');observer.unobserve(entry.target);}}),{threshold:.08});
    document.querySelectorAll('.section-heading,.polish-heading,.collection-photo,.highlight-item,.edition-next,.ev-heading').forEach(el=>observer.observe(el));
  }
  // Existing content never depends on animations or successful scripting to be visible.
  document.querySelectorAll('.copy-email').forEach(button=>button.addEventListener('click',async()=>{
    const status=document.querySelector('#copy-status');if(!status)return;
    try{await navigator.clipboard.writeText(button.dataset.email);status.textContent=(root.lang.startsWith('zh')?'已复制：':'Copied: ')+button.dataset.email;}
    catch{status.textContent=(root.lang.startsWith('zh')?'请选中并复制：':'Please select and copy: ')+button.dataset.email;}
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
})();
