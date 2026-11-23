// Embed the actual approved component. No site renderer/settings adapter.
import { t } from './i18n.js?v=cd39783d';
const frame = document.getElementById('approved-taskbar');
const tray = frame.querySelector('win11-tray');
const meta = document.querySelector('meta[name="color-scheme"]');
const system = matchMedia('(prefers-color-scheme: dark)');
const theme = () => ['dark','light'].includes(meta.content) ? meta.content : system.matches ? 'dark' : 'light';
frame.dataset.theme = theme();
tray.setAttribute('theme',theme());
const phoneTray=matchMedia('(max-width:760px), (max-height:500px) and (pointer:coarse)');
function fitDpi(){
  const dpi=phoneTray.matches?175:192,scale=String(dpi/96);
  frame.closest('.hero').style.setProperty('--demo-scale',scale);
  document.documentElement.style.setProperty('--demo-scale',scale);
  if(tray.getAttribute('dpi')!==String(dpi))tray.setAttribute('dpi',String(dpi));
  const select=document.getElementById('dpi');
  if(![...select.options].some(option=>option.value===String(dpi)))select.add(new Option(String(dpi),String(dpi)));
  select.value=String(dpi);
}
fitDpi();
phoneTray.addEventListener('change',fitDpi);

// All-or-nothing nav: measure natural widths, never wrap individual links.
const row = document.querySelector('.header-row'), nav = row.querySelector('.nav');
let navFrame = 0;
function fitNav() {
  navFrame = 0;
  nav.hidden = false;
  const style = getComputedStyle(row);
  const children = [...row.children].filter(el => getComputedStyle(el).display !== 'none');
  const gap = parseFloat(style.columnGap) || 0;
  const required = children.reduce((sum,el)=>sum+el.getBoundingClientRect().width,0) + gap*(children.length-1);
  const available = row.clientWidth - parseFloat(style.paddingLeft||0) - parseFloat(style.paddingRight||0);
  nav.hidden = required > available + .5;
}
const queueNav = () => {if (!navFrame) navFrame=requestAnimationFrame(fitNav);};
const navObserver = new ResizeObserver(queueNav);
navObserver.observe(row);
for(const child of row.children) if(child !== nav) navObserver.observe(child);
document.fonts.ready.then(fitNav);
fitNav();

function script(name) {
  return new Promise((resolve,reject)=>{
    const element=document.createElement('script');element.src=`/halobattery-preview/taskbar/${name}`;
    element.onload=resolve;element.onerror=()=>reject(new Error(`Cannot load ${name}`));document.body.append(element);
  });
}
await script('win11-tray.js');
// The component draws its system symbols (chevron, network, sound, bell...) with
// Segoe Fluent Icons, which only Windows has; elsewhere those private-use code
// points render as empty boxes. There, and only there, swap in the matching
// Fluent UI System Icons outlines. The copied component stays byte-identical.
function hasIconFont() {
  const ctx = document.createElement('canvas').getContext('2d');
  const width = font => { ctx.font = `16px ${font}`; return ctx.measureText('\ue701\ue995\ue70e').width; };
  // An installed font changes the width against at least one bare generic family.
  return ['Segoe Fluent Icons', 'Segoe MDL2 Assets'].some(name =>
    ['serif', 'monospace'].some(generic => Math.abs(width(`'${name}',${generic}`) - width(generic)) > 0.5));
}
if (!hasIconFont()) {
  const { TRAY_SYSTEM_ICONS } = await import('./tray-system-icons.js?v=14ef037e');
  const swap = root => root.querySelectorAll('.glyph:not([data-svg])').forEach(span => {
    const paths = TRAY_SYSTEM_ICONS[span.textContent.trim().codePointAt(0)?.toString(16)];
    if (!paths) return;
    span.dataset.svg = '';
    span.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">${paths}</svg>`;
  });
  swap(tray.shadowRoot);
  new MutationObserver(() => swap(tray.shadowRoot)).observe(tray.shadowRoot, { childList: true, subtree: true, characterData: true });
}
// The component's own Windows labels (tooltips, accessible names) in the page language.
// Only attribute values are swapped; the component files stay byte-identical.
const CHROME = new Map([
  ['Show hidden icons', t('Show hidden icons')], ['Hidden icons', t('Hidden icons')],
  ['Network and sound', t('Network and sound')], ['Date and time', t('Date and time')],
  ['Show desktop', t('Show desktop')], ['Input language', t('Input language')],
  ['Wi-Fi: connected', t('Wi-Fi: connected')], ['Wi-Fi: disconnected', t('Wi-Fi: disconnected')],
]);
function localiseChrome(root) {
  for (const el of root.querySelectorAll('[aria-label],[data-tip]')) {
    for (const name of ['aria-label', 'data-tip']) {
      const value = el.getAttribute(name);
      if (value === null) continue;
      const speakers = /^Speakers: (\d+)%$/.exec(value);
      const next = CHROME.get(value) ?? (speakers ? t('Speakers: {volume}%', { volume: speakers[1] }) : null);
      if (next && next !== value) el.setAttribute(name, next);
    }
  }
}
if (document.documentElement.lang !== 'en') {
  localiseChrome(tray.shadowRoot);
  new MutationObserver(() => localiseChrome(tray.shadowRoot)).observe(tray.shadowRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'data-tip'] });
}
// Share the existing overflow flyout material, including its grain, with tips.
// An adopted sheet survives the component's normal innerHTML re-renders.
const materialSheet=new CSSStyleSheet();
materialSheet.replaceSync(`
  .tip {background:var(--tray-flyout);backdrop-filter:blur(30px) saturate(1.25);-webkit-backdrop-filter:blur(30px) saturate(1.25)}
  .tip::before {content:'';position:absolute;inset:0;pointer-events:none;opacity:.025;border-radius:inherit;background-image:var(--tray-material-grain)}
  @media(forced-colors:active) {.tip {background:Canvas;backdrop-filter:none;-webkit-backdrop-filter:none}.tip::before {display:none}}
`);
tray.shadowRoot.adoptedStyleSheets=[...tray.shadowRoot.adoptedStyleSheets,materialSheet];
// Requested responsive priority, applied only to this instance. The copied
// renderer, styles, spacings and animations remain byte-identical.
const originalOverflow = tray.syncPinnedOverflow;
tray.syncPinnedOverflow = function() {
  const root=this.shadowRoot,network=root.querySelector('.control-center'),clock=root.querySelector('.clock');
  if (!network || !clock) return originalOverflow.call(this);
  network.hidden=false;clock.hidden=false;
  root.querySelectorAll('.pinned-icons button').forEach(button=>button.hidden=false);
  const fits=()=>this.offsetWidth*this.scale<=document.documentElement.clientWidth;
  if(!fits()) network.hidden=true;
  if(!fits()) clock.hidden=true;
  originalOverflow.call(this);
};
let responsiveFrame=0;
const queueResponsive=()=>{if(!responsiveFrame) responsiveFrame=requestAnimationFrame(()=>{responsiveFrame=0;tray.syncPinnedOverflow();});};
const responsiveObserver=new ResizeObserver(queueResponsive);
responsiveObserver.observe(frame);responsiveObserver.observe(tray);
await script('embedded-bootstrap.js');
fitDpi();
await script('embedded-loop.js?v=e15326a0');
const hint = frame.querySelector('.approved-taskbar-hint');
let hintFrame = 0;
function fitHint() {
  hintFrame = 0;
  const button = tray.shadowRoot.querySelector('[data-panel="overflow"]');
  if (!button) return;
  hint.toggleAttribute('data-colliding', hint.getBoundingClientRect().right >= button.getBoundingClientRect().left);
}
const queueHint = () => {if (!hintFrame) hintFrame=requestAnimationFrame(fitHint);};
const hintObserver = new ResizeObserver(queueHint);
hintObserver.observe(frame);hintObserver.observe(tray);hintObserver.observe(hint);
document.fonts.ready.then(fitHint);
fitHint();
const syncTheme = () => {
  frame.dataset.theme=theme();
  document.getElementById(theme()).click();
};
syncTheme();
new MutationObserver(syncTheme).observe(meta,{attributes:true,attributeFilter:['content']});
system.addEventListener('change',syncTheme);
// Only navigation crosses the boundary. The site never paints into the tray.
const navigate=id=>document.dispatchEvent(new CustomEvent('site:navigate',{detail:{id}}));
tray.addEventListener('win11:previewaction',event=>{
  if(event.detail.action==='settings')navigate('settings');
  if(event.detail.action==='diagnostics')navigate('add-device');
});
tray.shadowRoot.addEventListener('dblclick',event=>{
  if(!event.target.closest('.pinned-icons [data-halo-device]'))return;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  navigate('settings');
});
