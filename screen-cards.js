// Wheel input scrolls content first, pauses briefly at its edge, then can keep
// turning cards without requiring a new gesture. Touch paging stays native.
const cards=[...document.querySelectorAll('.page-card')];
const header=document.querySelector('.site-header');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const nativeTouch=matchMedia('(hover:none) and (pointer:coarse)');
let viewport=innerHeight,headerHeight=65,layoutFrame=0;
let animation=0,motion=null,lockedUntil=0,intent=0,lastWheel=0,lastDirection=0;
let turned=false,wheelTail=false,previousDelta=0,fallingFrom=0,fallingSamples=0,risingSamples=0,tailFloor=Infinity;
const edgeGates=new Map();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const topOf=card=>card.getBoundingClientRect().top+scrollY-headerHeight;
const bounds=card=>{const start=Math.max(0,topOf(card));return {start,end:Math.max(start,start+card.getBoundingClientRect().height-viewport+headerHeight)};};
function activeCard(){
  // The heading visible beneath the header identifies a long group's owner.
  return cards.findLast(card=>topOf(card)<=scrollY+3)??cards[0];
}
function stop(keepNavigationState=false){
  cancelAnimationFrame(animation);animation=0;motion=null;
  if(keepNavigationState!==true)document.documentElement.removeAttribute('data-card-navigation');
}
function animateTo(target,transition=false,anchor=null,duration=580){
  const now=performance.now();
  target=clamp(target,0,document.documentElement.scrollHeight-innerHeight);
  if(reduce.matches||duration<=0){stop();scrollTo({top:target,behavior:'instant'});if(transition)lockedUntil=now+120;return;}
  if(!transition&&motion?.kind==='content') {motion.target=target;return;}
  stop(true);
  // Explicit link and desktop wheel navigation own this animation only.
  document.documentElement.setAttribute('data-card-navigation','');
  motion={kind:transition?'card':'content',from:scrollY,position:scrollY,target,started:now,previous:now,anchor,duration};
  if(transition)lockedUntil=now+duration+120;
  if(transition)edgeGates.clear();
  const step=time=>{
    if(!motion)return;
    const m=motion;
    let y;
    if(m.kind==='card'){
      const p=clamp((time-m.started)/m.duration,0,1);
      // Smooth acceleration and deceleration, no transforms or resampling.
      const eased=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      y=m.from+(m.target-m.from)*eased;
      if(p===1){scrollTo({top:m.target,behavior:'instant'});stop();return;}
    }else{
      y=m.position+(m.target-m.position)*(1-Math.exp(-(time-m.previous)/65));
      if(Math.abs(m.target-y)<.5){scrollTo({top:m.target,behavior:'instant'});stop();return;}
    }
    m.previous=time;m.position=y;scrollTo({top:y,behavior:'instant'});animation=requestAnimationFrame(step);
  };
  animation=requestAnimationFrame(step);
}
function fit(){
  layoutFrame=0;
  const owner=activeCard(),old=bounds(owner),oldY=scrollY;
  const wasAligned=Math.abs(oldY-old.start)<4;
  const navigation=motion?.kind==='card'&&motion.anchor?{anchor:motion.anchor,remaining:motion.duration-(performance.now()-motion.started)}:null;
  stop(Boolean(navigation));
  headerHeight=header.getBoundingClientRect().height;viewport=innerHeight;
  document.documentElement.style.setProperty('--header-h',`${headerHeight}px`);
  for(const card of cards){
    card.removeAttribute('data-compact');
    card.removeAttribute('data-tight');
    card.style.removeProperty('--preview-h');card.style.removeProperty('--preview-scale');
    // Phones keep the natural document layout. Do not refit every section
    // when browser controls change the visible viewport during a swipe.
    if(nativeTouch.matches)continue;
    // Search results are dynamic. Keep this group's top spacing and filter
    // layout constant instead of fitting it again to each result count.
    if(card.dataset.card==='devices'){
      card.setAttribute('data-compact','');card.setAttribute('data-tight','');
      continue;
    }
    if(card.getBoundingClientRect().height>viewport-headerHeight+1)card.setAttribute('data-compact','');
    const fitPreview=()=>{if(card.dataset.card==='settings'){
      card.style.removeProperty('--preview-scale');
      const section=card.querySelector('.settings'),head=card.querySelector('.settings-head'),stage=card.querySelector('.win-stage');
      const s=getComputedStyle(section),h=getComputedStyle(head),p=getComputedStyle(stage);
      const outside=parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+head.offsetHeight+parseFloat(h.marginBottom);
      const stagePadding=parseFloat(p.paddingTop)+parseFloat(p.paddingBottom);
      const available=viewport-headerHeight-outside;
      card.style.setProperty('--preview-h',`${clamp(available-stagePadding,400,680)}px`);
      // For a near fit only, a small proportional reduction of the preview is
      // preferable to adding an almost empty second scroll. Never below 90%.
      const natural=stage.offsetHeight;
      if(available<natural&&available/natural>=.899)card.style.setProperty('--preview-scale',String(Math.max(.9,available/natural)));
    }};
    fitPreview();
    const excess=card.getBoundingClientRect().height-(viewport-headerHeight);
    if(excess>1&&excess<(viewport-headerHeight)*.2){card.setAttribute('data-tight','');fitPreview();}
  }
  // Layout fitting may run while a link or double-click is navigating. Keep
  // that destination and its remaining duration instead of cancelling it.
  if(navigation)animateTo(bounds(navigation.anchor.card)[navigation.anchor.edge],true,navigation.anchor,navigation.remaining);
  else if(wasAligned&&!nativeTouch.matches)scrollTo({top:bounds(owner).start,behavior:'instant'});
}
const queueFit=()=>{if(!layoutFrame)layoutFrame=requestAnimationFrame(fit);};
new ResizeObserver(queueFit).observe(header);
// Dynamic results/expanded details can change a group's height without a resize.
const contentObserver=new ResizeObserver(queueFit);
for(const card of cards)for(const section of card.children)for(const child of section.children) {
  if(child.classList.contains('wrap'))contentObserver.observe(child);
}
addEventListener('resize',queueFit);
document.fonts.ready.then(queueFit);
fit();

function nestedScroller(event,direction){
  for(const node of event.composedPath()){
    if(!(node instanceof Element)||node===document.body)continue;
    // Ranges, selects and horizontally scrollable controls retain their inputs.
    if(node.matches('input[type="range"],select,textarea'))return {control:true};
    const style=getComputedStyle(node);
    if(/auto|scroll/.test(style.overflowY)&&(node.matches('.win-content')||node.scrollHeight>node.clientHeight+1)){
      return {element:node,canScroll:direction>0?node.scrollTop+node.clientHeight<node.scrollHeight-1:node.scrollTop>1};
    }
  }
  return null;
}
function atEdge(owner,direction){
  if(owner.matches('.page-card')){
    const {start,end}=bounds(owner);
    return direction>0?scrollY>=end-2:scrollY<=start+2;
  }
  return direction>0?owner.scrollTop+owner.clientHeight>=owner.scrollHeight-1:owner.scrollTop<=1;
}
function scrollingWithin(owner,direction){
  edgeGates.set(owner,{direction,until:null});
}
function waitAtEdge(owner,direction,now){
  let gate=edgeGates.get(owner);
  if(!gate||gate.direction!==direction){gate={direction,until:null};edgeGates.set(owner,gate);}
  if(gate.until===null)gate.until=now+160;
  return now<gate.until;
}
// Start the pause when scrolling actually arrives, not when a later wheel
// event notices the edge. Continued events never extend this deadline.
addEventListener('scroll',()=>{
  for(const [owner,gate] of edgeGates)if(gate.until===null&&atEdge(owner,gate.direction))gate.until=performance.now()+160;
},{passive:true,capture:true});
function resetWheelTrend(){turned=false;wheelTail=false;previousDelta=0;fallingFrom=0;fallingSamples=0;risingSamples=0;tailFloor=Infinity;}
function resetGesture(){intent=0;lastWheel=0;lastDirection=0;edgeGates.clear();resetWheelTrend();}
function followWheelTrend(magnitude){
  if(wheelTail){
    tailFloor=Math.min(tailFloor,magnitude);
    // A renewed push can start before the event stream goes quiet. A large
    // jump is clear immediately; small pushes need several growing samples
    // above the noise floor so ordinary tail jitter cannot rearm paging.
    if(magnitude-previousDelta>.0001)risingSamples++;
    else if(magnitude<previousDelta)risingSamples=0;
    const largePush=magnitude>=tailFloor+Math.max(4,tailFloor*.35);
    const growingPush=risingSamples>=3&&magnitude>=tailFloor+Math.max(.15,tailFloor*.35);
    if(!largePush&&!growingPush){previousDelta=magnitude;return;}
    resetWheelTrend();intent=0;
  }
  if(previousDelta-magnitude>.0001){
    // One abrupt step down is also common after an initial mouse notch.
    // Measure subsequent decline from its new level, not from that outlier.
    if(magnitude<previousDelta*.5){fallingFrom=magnitude;fallingSamples=0;}
    else{if(!fallingSamples)fallingFrom=previousDelta;fallingSamples++;}
  }else if(magnitude>previousDelta){fallingSamples=0;}
  // Constant wheel input (including a large first notch followed by smaller
  // equal deltas) remains usable. A sustained decline after a card turn is
  // inertia and stays consumed until a gap, reversal or renewed acceleration.
  if(turned&&fallingSamples>=3&&fallingFrom-magnitude>=Math.max(.05,fallingFrom*.08)){
    wheelTail=true;tailFloor=magnitude;risingSamples=0;intent=0;
  }
  previousDelta=magnitude;
}
addEventListener('wheel',event=>{
  // Mobile browsers own both touch inertia and any attached mouse scrolling.
  if(nativeTouch.matches)return;
  const root=document.documentElement;
  if(!root.hasAttribute('data-wheel-paging'))root.setAttribute('data-wheel-paging','');
  if(event.ctrlKey){stop();lockedUntil=0;resetGesture();return;}
  const direction=Math.sign(event.deltaY),now=performance.now();
  if(now-lastWheel>220){intent=0;resetWheelTrend();}
  if(direction!==lastDirection){intent=0;edgeGates.clear();resetWheelTrend();}
  lastWheel=now;lastDirection=direction;
  if(event.defaultPrevented||event.shiftKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY){
    intent=0;return;
  }
  const nested=nestedScroller(event,direction);
  if(nested?.control){intent=0;return;}
  if(nested?.canScroll){
    stop();lockedUntil=0;scrollingWithin(nested.element,direction);intent=0;return;
  }
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport:1);
  followWheelTrend(Math.abs(delta));
  if(reduce.matches){
    stop();lockedUntil=0;
    if(nested){
      event.preventDefault();
      if(!waitAtEdge(nested.element,direction,now))scrollBy({top:delta,behavior:'instant'});
    }
    return;
  }
  event.preventDefault();
  if(wheelTail)return;
  if(now<lockedUntil)return;
  if(nested&&waitAtEdge(nested.element,direction,now)){intent=0;return;}
  const card=activeCard(),{start,end}=bounds(card);
  const position=motion?.kind==='content'?motion.target:scrollY;
  if(direction>0?position<end-2:position>start+2){
    scrollingWithin(card,direction);
    intent=0;animateTo(clamp(position+delta,start,end));return;
  }
  // Wait until the last inner scroll actually arrives at the edge. Its unused
  // delta never becomes a page turn in the same event.
  if(Math.abs(scrollY-position)>2)return;
  if(edgeGates.has(card)&&waitAtEdge(card,direction,now)){intent=0;return;}
  intent+=Math.abs(delta);
  if(intent<48)return;
  intent=0;
  const next=cards[cards.indexOf(card)+direction];
  if(next){
    turned=true;
    animateTo(direction>0?bounds(next).start:bounds(next).end,true,{card:next,edge:direction>0?'start':'end'});
  }
},{passive:false});

// A manual gesture interrupts explicit link navigation, then stays entirely
// native: no touchmove cancellation, snap targets or scroll-chain overrides.
const interrupt=()=>{stop();lockedUntil=0;resetGesture();};
addEventListener('pointerdown',interrupt,{passive:true});
addEventListener('touchstart',interrupt,{passive:true});
addEventListener('keydown',event=>{if(['Tab','PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(event.key)){stop();lockedUntil=0;resetGesture();}});
reduce.addEventListener('change',()=>{stop();lockedUntil=0;resetGesture();});
function sectionTarget(fragment){
  if(typeof fragment!=='string')return null;
  try{return document.getElementById(decodeURIComponent(fragment.replace(/^#/,'')));}
  catch{return null;}
}
function navigateSection(fragment,updateHistory=false){
  const target=sectionTarget(fragment),card=target?.closest('.page-card');
  if(!card)return;
  if(updateHistory&&location.hash!==`#${target.id}`)history.pushState(null,'',`#${target.id}`);
  intent=0;animateTo(bounds(card).start,true,{card,edge:'start'});
}
const followHash=()=>navigateSection(location.hash);
addEventListener('hashchange',followHash);
document.addEventListener('site:navigate',event=>navigateSection(event.detail?.id,true));
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');
  if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const card=sectionTarget(link.hash)?.closest('.page-card');
  if(!card)return;
  event.preventDefault();navigateSection(link.hash,true);
});
addEventListener('popstate',followHash);
// Initial deep links have no outgoing card to animate. Align immediately so
// font/layout fitting cannot cancel an unfinished first navigation.
if(location.hash)requestAnimationFrame(()=>{
  const card=sectionTarget(location.hash)?.closest('.page-card');
  if(card)scrollTo({top:bounds(card).start,behavior:'instant'});
});
