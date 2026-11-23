
const tray=document.querySelector('win11-tray');
const initialSettings=JSON.parse(document.getElementById('tray-defaults').textContent);
initialSettings.theme=document.getElementById('approved-taskbar').dataset.theme;
const basicDeviceKinds=()=>Object.fromEntries(Object.entries(tray.getDeviceKinds()).filter(([kind])=>!['xbox','playstation','nintendo'].includes(kind)));
const initialNames=basicDeviceKinds();
for(const [kind,settings] of Object.entries(initialSettings.deviceStates))tray.setDeviceState(kind,settings);
tray.setPinnedIcons(initialSettings.pinned.map(kind=>({id:'halo-'+kind,label:'HaloBattery - '+initialNames[kind],icon:'halo:'+kind})));
tray.setTrayIcons(Object.keys(initialNames).filter(kind=>!initialSettings.pinned.includes(kind)).map(kind=>({id:'halo-'+kind,label:'HaloBattery - '+initialNames[kind],icon:'halo:'+kind})));
document.body.classList.toggle('light',initialSettings.theme==='light');
document.documentElement.style.setProperty('--demo-scale',String(initialSettings.dpi/96));
document.getElementById('dpi').value=String(initialSettings.dpi);
for(const theme of ['dark','light'])document.getElementById(theme).setAttribute('aria-pressed',String(theme===initialSettings.theme));

for(const theme of ['dark','light'])document.getElementById(theme).onclick=()=>{tray.setAttribute('theme',theme);document.body.classList.toggle('light',theme==='light');for(const t of ['dark','light'])document.getElementById(t).setAttribute('aria-pressed',String(t===theme))};
document.getElementById('dpi').onchange=e=>{const dpi=Number(e.target.value);tray.setAttribute('dpi',String(dpi));document.documentElement.style.setProperty('--demo-scale',String(dpi/96))};
const device=document.getElementById('device-kind'),state=document.getElementById('device-state'),level=document.getElementById('device-level'),percent=document.getElementById('device-percent'),pinned=document.getElementById('device-pinned');
const deviceNames=basicDeviceKinds(),stateNames=tray.getDeviceModes();
for(const [id,name] of Object.entries(deviceNames)){const o=document.createElement('option');o.value=id;o.textContent=name;device.append(o)}
for(const [id,name] of Object.entries(stateNames)){const o=document.createElement('option');o.value=id;o.textContent=name;state.append(o)}
function syncEditor(){const s=tray.getDeviceState(device.value);state.value=s.mode;const value=s.mode==='low'?10:s.mode==='warning'?20:s.mode==='full'?100:['sleeping','paused','unknown_charging'].includes(s.mode)?null:s.level;level.value=value===null?0:value;level.disabled=!['normal','charging'].includes(s.mode);percent.value=value===null?'Unknown':value+'%';pinned.checked=tray.isDevicePinned(device.value);document.getElementById('status').textContent=deviceNames[device.value]+' · '+stateNames[s.mode]+(value===null?'':' · '+value+'%')}
device.onchange=syncEditor;state.onchange=()=>{tray.setDeviceState(device.value,{mode:state.value});syncEditor()};level.oninput=()=>{tray.setDeviceState(device.value,{level:Number(level.value)});syncEditor()};pinned.onchange=()=>{tray.setDevicePinned(device.value,pinned.checked);syncEditor()};
tray.addEventListener('win11:trayclick',e=>{const kind=e.detail.id.replace(/^halo-/,'');if(deviceNames[kind]){device.value=kind;syncEditor()}});
device.value=initialSettings.selectedDevice;
syncEditor();

function mirrorSettings(){const snapshot={theme:tray.getAttribute('theme'),dpi:Number(tray.getAttribute('dpi')),language:tray.getAttribute('language'),selectedDevice:device.value,pinned:[...tray.shadowRoot.querySelectorAll('.pinned-icons [data-halo-kind]')].map(x=>x.dataset.haloKind),deviceStates:Object.fromEntries(Object.keys(deviceNames).map(kind=>[kind,tray.getDeviceState(kind)]))};document.getElementById('live-tray-settings').textContent=JSON.stringify(snapshot)}
for(const event of ['win11:devicechange','win11:devicepinchange','win11:languagechange'])tray.addEventListener(event,()=>queueMicrotask(mirrorSettings));
for(const event of ['change','input','click'])document.body.addEventListener(event,()=>queueMicrotask(mirrorSettings));
mirrorSettings();
