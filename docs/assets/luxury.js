(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const progress = document.createElement('div');
  progress.className = 'lux-progress'; progress.setAttribute('aria-hidden','true'); document.body.append(progress);
  let scrollQueued = false;
  function updateProgress() { const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,Math.max(0,scrollY/max)):0})`;scrollQueued=false; }
  addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateProgress);}}, {passive:true});
  addEventListener('resize',updateProgress);addEventListener('load',updateProgress);updateProgress();
  const halo=document.createElement('div'),spark=document.createElement('div');halo.className='lux-halo';spark.className='lux-spark';
  [halo,spark].forEach(el=>{el.setAttribute('aria-hidden','true');document.body.append(el);});
  let frame=0,x=0,y=0;
  function hide(){halo.style.opacity='0';spark.style.opacity='0';}
  document.addEventListener('pointermove',e=>{
    if(reduced.matches||!fine.matches||e.pointerType==='touch')return;
    x=e.clientX;y=e.clientY;
    if(!frame)frame=requestAnimationFrame(()=>{halo.style.transform=`translate(${x-180}px,${y-180}px)`;spark.style.transform=`translate(${x+13}px,${y+13}px)`;halo.style.opacity='1';spark.style.opacity='.8';frame=0;});
  },{passive:true});
  document.documentElement.addEventListener('pointerleave',hide);addEventListener('blur',hide);
  reduced.addEventListener('change',hide);fine.addEventListener('change',hide);
  document.querySelectorAll('.directory-card,.project-card,.contact-suite,.collection-photo a').forEach(el=>{
    el.classList.add('lux-spot');
    el.addEventListener('pointermove',e=>{if(reduced.matches||!fine.matches)return;const rect=el.getBoundingClientRect();el.style.setProperty('--spot-x',`${e.clientX-rect.left}px`);el.style.setProperty('--spot-y',`${e.clientY-rect.top}px`);},{passive:true});
  });
  if(!reduced.matches && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('lux-revealed');observer.unobserve(entry.target);}}),{threshold:.08});
    document.querySelectorAll('.collection-photo,.contact-suite,.section-heading,.le-heading,.directory-card').forEach(el=>observer.observe(el));
  }
  document.querySelectorAll('.copy-email').forEach(button=>button.addEventListener('click',async()=>{
    const status=document.querySelector('#copy-status');const zh=document.documentElement.lang.startsWith('zh');
    try {if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(button.dataset.email);status.textContent=(zh?'已复制：':'Copied: ')+button.dataset.email;}
    catch {status.textContent=(zh?'请选中并复制邮箱：':'Please select and copy: ')+button.dataset.email;}
  }));
})();
