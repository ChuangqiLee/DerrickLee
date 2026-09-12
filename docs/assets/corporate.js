(() => {
  const video=document.getElementById('corp-hero-video');
  const button=document.getElementById('corp-motion');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused=false;
  function sync(){if(!video||!button)return;const paused=video.paused;button.setAttribute('aria-pressed',String(paused));button.textContent=document.documentElement.lang.startsWith('zh')?(paused?'播放动态':'暂停动态'):(paused?'Play motion':'Pause motion');}
  if(video){
    video.muted=true;
    if(reduced.matches){video.pause();userPaused=true;}
    video.addEventListener('play',sync);video.addEventListener('pause',sync);video.addEventListener('error',sync);
    button?.addEventListener('click',()=>{if(video.paused){userPaused=false;video.play().catch(sync);}else{userPaused=true;video.pause();}sync();});
    reduced.addEventListener('change',()=>{if(reduced.matches){userPaused=true;video.pause();}sync();});
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting)video.pause();else if(!userPaused&&!reduced.matches)video.play().catch(sync);});},{threshold:.1}).observe(video);
    new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
  }
  const navLinks=[...document.querySelectorAll('.qe-jump a[href^="#"]:not(.corp-nav-brand)')];
  const progress=document.createElement('div');progress.className='corp-nav-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
  let frame=0;
  function update(){frame=0;const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;let current='';navLinks.forEach(a=>{const el=document.querySelector(a.getAttribute('href'));if(el&&el.getBoundingClientRect().top<240)current=a.getAttribute('href');});navLinks.forEach(a=>{a.classList.toggle('is-current',a.getAttribute('href')===current);if(a.getAttribute('href')===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
  addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(update);},{passive:true});addEventListener('resize',update);addEventListener('load',update);update();
})();
