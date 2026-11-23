// One transform owns automatic motion, dragging and inertia, so switching
// between them never restarts the loop or jumps to a CSS animation position.
export function initMarquee() {
  const host=document.querySelector('.marquee');
  if(!host)return;
  const track=host.querySelector('.marquee-track'),originals=[...track.children];
  const copies=originals.map(item=>{
    const copy=item.cloneNode(true);copy.setAttribute('aria-hidden','true');track.append(copy);return copy;
  });
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let period=0,position=0,velocity=0,visible=false,hovered=false,drag=null;
  let frame=0,previous=0,resumeTimer=0,resumeAt=0;
  const wrap=n=>((n%period)+period)%period;
  const render=()=>{
    if(!period||reduced.matches){track.style.transform='none';return;}
    position=wrap(position);track.style.transform=`translate3d(${-position}px,0,0)`;
  };
  function stop(){cancelAnimationFrame(frame);clearTimeout(resumeTimer);frame=0;resumeTimer=0;previous=0;}
  function wake(){
    if(!visible||drag||reduced.matches||frame)return;
    clearTimeout(resumeTimer);resumeTimer=0;previous=0;frame=requestAnimationFrame(tick);
  }
  function tick(time){
    frame=0;
    if(!visible||drag||reduced.matches)return;
    const dt=previous?Math.min(time-previous,50):0;previous=time;
    if(Math.abs(velocity)>.003){
      const decay=Math.exp(-dt/325);
      position+=velocity*325*(1-decay);velocity*=decay;
    }else{
      velocity=0;
      if(!hovered&&time>=resumeAt)position+=period/48000*dt;
    }
    render();
    if(velocity||(!hovered&&time>=resumeAt))frame=requestAnimationFrame(tick);
    else{
      previous=0;
      if(!hovered)resumeTimer=setTimeout(wake,Math.max(0,resumeAt-time));
    }
  }
  function measure(){
    const old=period;
    period=reduced.matches?0:copies[0].offsetLeft-originals[0].offsetLeft;
    if(old&&period)position=position/old*period;
    render();wake();
  }
  const sizeObserver=new ResizeObserver(measure);sizeObserver.observe(host);sizeObserver.observe(track);
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;host.classList.toggle('is-running',visible);
    if(visible)wake();else{velocity=0;stop();}
  }).observe(host);
  reduced.addEventListener('change',()=>{velocity=0;stop();measure();});
  document.fonts.ready.then(measure);measure();
  host.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')hovered=true;});
  host.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hovered=false;wake();}});
  host.addEventListener('pointerdown',event=>{
    if(reduced.matches||!period||!event.isPrimary||event.button!==0)return;
    stop();velocity=0;
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,start:position,lastX:event.clientX,lastTime:event.timeStamp,moving:false};
    if(event.pointerType==='mouse')host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
    if(!drag.moving){
      if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){drag=null;wake();return;}
      if(Math.abs(dx)<4||Math.abs(dx)<Math.abs(dy))return;
      drag.moving=true;host.setPointerCapture(event.pointerId);host.setAttribute('data-dragging','');
    }
    if(event.cancelable)event.preventDefault();
    const dt=Math.max(1,event.timeStamp-drag.lastTime);
    const sample=Math.max(-2.5,Math.min(2.5,-(event.clientX-drag.lastX)/dt));
    velocity=velocity*.55+sample*.45;
    position=drag.start-dx;drag.lastX=event.clientX;drag.lastTime=event.timeStamp;render();
  });
  function release(event,cancelled=false){
    if(!drag||event.pointerId!==drag.id)return;
    if(cancelled||!drag.moving||event.timeStamp-drag.lastTime>90)velocity=0;
    drag=null;host.removeAttribute('data-dragging');resumeAt=performance.now()+700;
    if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
    wake();
  }
  host.addEventListener('pointerup',event=>release(event));
  host.addEventListener('pointercancel',event=>release(event,true));
  // Touch starts with implicit capture on the SVG beneath the finger. Its
  // bubbling lost-capture event is not the host losing our explicit capture.
  host.addEventListener('lostpointercapture',event=>{if(event.target===host)release(event,true);});
  host.addEventListener('dragstart',event=>event.preventDefault());
  host.addEventListener('wheel',event=>{
    const delta=event.deltaX||(event.shiftKey?event.deltaY:0);
    if(reduced.matches||!period||!delta||(!event.shiftKey&&Math.abs(delta)<Math.abs(event.deltaY))||event.ctrlKey)return;
    event.preventDefault();stop();velocity=0;
    // Trackpads already provide their own momentum; do not add a second coast.
    position+=delta*(event.deltaMode===1?16:1);resumeAt=performance.now()+700;render();wake();
  },{passive:false});
}
