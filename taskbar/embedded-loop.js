/* Automatic tooltip tour based on the owner's 12.63-second reference video.
   Runs only in this independent copy. No cursor simulation or pointer movement. */
(() => {
  'use strict';
  // halobattery.app/app.js: initTray cycle=3200ms.
  // halobattery.app/styles.css: .w-tip opacity transition=200ms.
  const STEP_MS = 3200, APPEAR_DELAY_MS = 350, FADE_MS = 200, GAP_MS = 150;
  // Website demo names, original preview levels (headset explicitly set to 25%).
  // Runtime estimates are illustrative; the host application is not changed.
  // Page language (tools/i18n.py); the English text is the fallback.
  const t = globalThis.hbT ?? ((s, v = {}) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)));
  const tp = globalThis.hbTp ?? ((n, one, other) => t(n === 1 ? one : other, {count: n}));
  const items = [
    {kind: 'mouse', name: 'Razer DeathAdder V4 Pro', mode: 'full', level: 100, description: '100%', forecast: tp(5, 'about {count} day of use left', 'about {count} days of use left')},
    {kind: 'keyboard', name: 'ATK V75X', mode: 'charging', level: 65, description: t('{level}%, charging', {level: 65}), forecast: ''},
    {kind: 'headset', name: 'Razer BlackShark V2 Pro', mode: 'normal', level: 25, description: '25%', forecast: tp(31, 'about {count} h of use left', 'about {count} h of use left')},
    {kind: 'gamepad', name: 'DualSense Wireless Controller', mode: 'low', level: 10, description: '10%', forecast: t('less than 1 h of use left')},
  ];
  const sleep = (ms, signal) => new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const finish = value => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(value); };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', abort, {once: true});
  });

  Promise.all([customElements.whenDefined('win11-tray'), document.fonts.ready]).then(() => {
    const tray = document.querySelector('win11-tray');
    const requestedTheme = new URLSearchParams(location.search).get('theme');
    if (['dark', 'light'].includes(requestedTheme)) {
      tray.setAttribute('theme', requestedTheme);
      document.body.classList.toggle('light', requestedTheme === 'light');
      for (const theme of ['dark', 'light']) document.getElementById(theme).setAttribute('aria-pressed', String(theme === requestedTheme));
    }
    const root = tray.shadowRoot;
    const controls = document.querySelector('#taskbar-bootstrap .controls');
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.textContent = 'Pause preview';
    toggle.setAttribute('aria-label', 'Pause automatic device preview');
    controls.append(toggle);
    document.querySelector('#taskbar-bootstrap [data-prototype-title]').textContent = 'HaloBattery tray preview';
    document.querySelector('#taskbar-bootstrap [data-prototype-description]').textContent = 'An automatic tour of device states. Switch the theme or DPI to preview the same Windows tray in different settings.';
    const visited = [];
    const report = document.createElement('script');
    report.type = 'application/json'; report.id = 'tray-loop-state';
    document.body.append(report);
    let paused = false, disposed = false, index = 0, controller = null, tooltip = null;
    let menu = null, menuOpen = false, nativePanelOpen = false, menuOwner = null, menuTrigger = null;
    let phase = 'loading', hoveredKind = null;
    const persist = () => { report.textContent = JSON.stringify({index, device: items[index].kind, phase, paused, visited, cursor: 'native', theme: tray.getAttribute('theme')}); };
    const buttons = () => [...root.querySelectorAll('[data-halo-device]')];
    const clearSelection = () => buttons().forEach(button => button.removeAttribute('data-preview-active'));
    const mount = () => {
      const existing = root.querySelector('.auto-preview-tip');
      if (existing) { tooltip = existing; return; }
      const style = document.createElement('style');
      style.textContent = `
        .language{display:none!important}
        .tray-button[data-preview-active]:before{background-color:var(--tray-hover);border-color:var(--tray-stroke-top) var(--tray-stroke-bottom) var(--tray-stroke-bottom)}
        .auto-preview-tip{display:block!important;opacity:0;transition:opacity ${FADE_MS}ms ease;will-change:opacity;visibility:hidden;pointer-events:none}
        .auto-preview-tip[data-visible]{opacity:1;visibility:visible}
        .auto-preview-tip[data-leaving]{opacity:0;visibility:visible}
        .hb-context{--menu-bg:rgba(32,32,32,.60);--menu-ink:#f2f2f2;--menu-muted:rgba(242,242,242,.60);--menu-hover:#ffffff1a;--menu-border:#ffffff33;
          display:none;position:absolute;bottom:56px;z-index:10;min-width:230px;width:max-content;padding:4px 0;border-radius:8px;
          color:var(--menu-ink);background:var(--menu-bg);border:1px solid var(--menu-border);backdrop-filter:blur(30px) saturate(1.25);
          box-shadow:0 8px 20px #0003,0 0 2px #0002;font:13px/18px 'Segoe UI Variable Text','Segoe UI Variable','Segoe UI',sans-serif;
          opacity:0;transition:opacity 120ms ease;overflow-y:auto;scrollbar-width:thin}
        :host([theme=light]) .hb-context{--menu-bg:rgba(243,243,243,.60);--menu-ink:#1a1a1a;--menu-muted:rgba(26,26,26,.60);--menu-hover:#00000012;--menu-border:#00000026}
        .hb-context[data-open]{display:block;opacity:1}
        @starting-style{.hb-context[data-open]{opacity:0}}
        .hb-context-head{padding:8px 18px 8px 36px;max-width:330px;white-space:normal;overflow-wrap:anywhere}
        .hb-context-title{font-weight:400;margin-bottom:2px}
        .hb-context-detail{color:var(--menu-muted);white-space:pre-line}
        .hb-context button{display:block;margin:1px 4px;width:calc(100% - 8px);border:0;border-radius:4px;padding:6px 10px 6px 32px;
          color:inherit;background:transparent;font:inherit;text-align:left;cursor:default;white-space:nowrap}
        .hb-context button:first-of-type{font-weight:600}
        .hb-context button:hover,.hb-context button:focus-visible{background:var(--menu-hover);outline:0}
        .hb-context button:active{opacity:.75}
        .tip.auto-preview-tip{white-space:pre-line;overflow-wrap:anywhere}
        @media(prefers-reduced-motion:reduce){.auto-preview-tip{transition:none}}
      `;
      tooltip = document.createElement('div');
      tooltip.className = 'tip auto-preview-tip';
      // A visual demo must not announce repeating tooltips to screen readers.
      tooltip.setAttribute('aria-hidden', 'true');
      menu = document.createElement('div');
      menu.className = 'hb-context'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', t('HaloBattery device menu'));
      menu.innerHTML = '<div class="hb-context-head"><div class="hb-context-title"></div><div class="hb-context-detail"></div></div><button type="button" role="menuitem" data-action="settings">' + t('Settings') + '</button><button type="button" role="menuitem" data-action="refresh">' + t('Refresh now') + '</button><button type="button" role="menuitem" data-action="diagnostics">' + t('Diagnostics') + '</button><button type="button" role="menuitem" data-action="exit">' + t('Exit (v{version})', {version: '1.18.0'}) + '</button>';
      menu.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        const owner = menuOwner;
        closeMenu();
        tray.dispatchEvent(new CustomEvent('win11:previewaction', {detail: {action, device: owner?.kind}, bubbles: true, composed: true}));
      });
      root.append(style, tooltip, menu);
    };
    // Pinned devices share the tour tooltip; overflow icons retain native tips.
    const nativeShowTip = tray.showTip.bind(tray);
    tray.showTip = button => { if (tray.panel === 'overflow') nativeShowTip(button); };
    tray.hideTip();
    const applyItem = () => {
      const item = items[index];
      clearSelection();
      const button = root.querySelector(`.pinned-icons [data-halo-device="${item.kind}"]`);
      if (!button || !button.getClientRects().length) return false;
      button.setAttribute('data-preview-active', '');
      tooltip.textContent = `${item.name}: ${item.description}${item.forecast ? '\n' + item.forecast : ''}`;
      const box = button.getBoundingClientRect(), host = tray.getBoundingClientRect(), scale = tray.scale;
      tooltip.style.maxWidth = `${Math.min(320, innerWidth / scale - 16)}px`;
      tooltip.style.bottom = '60px';
      const width = tooltip.offsetWidth * scale;
      const x = Math.max(8, Math.min(innerWidth - width - 8, box.left + box.width / 2 - width / 2));
      tooltip.style.left = `${(x - host.left) / scale}px`;
      return true;
    };
    const stop = () => {
      controller?.abort(); controller = null;
      tooltip?.removeAttribute('data-visible'); tooltip?.removeAttribute('data-leaving');
      clearSelection(); phase = 'paused'; persist();
    };
    const run = async () => {
      stop();
      if (disposed || paused || menuOpen || nativePanelOpen || document.hidden) return;
      mount();
      if (hoveredKind) {
        index = items.findIndex(item => item.kind === hoveredKind);
        if (applyItem()) { tooltip.setAttribute('data-visible', ''); phase = 'hover'; persist(); }
        return;
      }
      const own = new AbortController(); controller = own;
      const signal = own.signal;
      while (!signal.aborted) {
        phase = 'entering';
        if (!applyItem()) { if (!await sleep(200, signal)) break; continue; }
        persist();
        if (!await sleep(APPEAR_DELAY_MS, signal)) break;
        tooltip.removeAttribute('data-leaving'); tooltip.setAttribute('data-visible', '');
        phase = 'visible'; visited.push(items[index].kind);
        if (visited.length > 24) visited.shift();
        persist();
        document.dispatchEvent(new CustomEvent('tray-preview-step', {detail: {kind: items[index].kind}}));
        if (!await sleep(STEP_MS - APPEAR_DELAY_MS - FADE_MS - GAP_MS, signal)) break;
        tooltip.setAttribute('data-leaving', ''); tooltip.removeAttribute('data-visible');
        phase = 'leaving'; persist();
        if (!await sleep(FADE_MS, signal)) break;
        tooltip.removeAttribute('data-leaving'); clearSelection();
        if (!await sleep(GAP_MS, signal)) break;
        index = (index + 1) % items.length;
      }
    };
    const positionMenu = () => {
      if (!menuOpen || !menuTrigger?.isConnected) return;
      const rect = menuTrigger.getBoundingClientRect(), host = tray.getBoundingClientRect(), scale = tray.scale;
      menu.style.maxWidth = `${Math.max(120, innerWidth / scale - 16)}px`;
      menu.style.minWidth = `${Math.min(230, innerWidth / scale - 16)}px`;
      menu.style.maxHeight = `${Math.max(60, innerHeight / scale - 64)}px`;
      const width = menu.offsetWidth * scale;
      const x = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
      menu.style.left = `${(x - host.left) / scale}px`;
    };
    const closeMenu = (returnFocus = false) => {
      if (!menuOpen) return;
      menuOpen = false; menu?.removeAttribute('data-open');
      if (returnFocus && menuTrigger?.isConnected) menuTrigger.focus({preventScroll: true});
      run();
    };
    const openMenu = (button, event) => {
      const owner = items.find(item => item.kind === button.dataset.haloDevice);
      if (!owner) return;
      event.preventDefault(); stop(); menuOpen = true; tray.close(false, false); mount();
      menuOpen = true; menuOwner = owner; menuTrigger = button;
      index = items.indexOf(owner);
      clearSelection(); button.setAttribute('data-preview-active', '');
      menu.querySelector('.hb-context-title').textContent = owner.name;
      menu.querySelector('.hb-context-detail').textContent = `${owner.description}${owner.forecast ? '\n' + owner.forecast : ''}`;
      menu.setAttribute('data-open', ''); positionMenu();
      menu.querySelector('button').focus({preventScroll: true});
      phase = 'menu'; persist();
    };
    const menuEvent = event => {
      const button = event.target.closest('.pinned-icons [data-halo-device]');
      if (button) openMenu(button, event);
    };
    root.addEventListener('click', menuEvent);
    root.addEventListener('contextmenu', menuEvent);
    root.addEventListener('pointerover', event => {
      const button = event.target.closest('.pinned-icons [data-halo-device]');
      if (!button || button.contains(event.relatedTarget)) return;
      hoveredKind = button.dataset.haloDevice; run();
    });
    root.addEventListener('pointerout', event => {
      const button = event.target.closest('.pinned-icons [data-halo-device]');
      if (!button || button.contains(event.relatedTarget)) return;
      hoveredKind = null; run();
    });
    const outsideMenu = event => { if (menuOpen && !event.composedPath().includes(menu) && !event.composedPath().includes(menuTrigger)) closeMenu(); };
    document.addEventListener('pointerdown', outsideMenu, true);
    const menuKeys = event => {
      if (!menuOpen) return;
      const choices = [...menu.querySelectorAll('button')], current = choices.indexOf(root.activeElement);
      if (event.key === 'Escape') {event.preventDefault(); closeMenu(true);}
      if (event.key === 'Tab') closeMenu();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
        choices[next].focus({preventScroll: true});
      }
    };
    document.addEventListener('keydown', menuKeys, true);
    const nativePanel = event => {
      nativePanelOpen = Boolean(event.detail.panel);
      if (nativePanelOpen) stop(); else run();
    };
    tray.addEventListener('win11:panelchange', nativePanel);
    for (const item of items) tray.setDeviceState(item.kind, {mode: item.mode, level: item.level});
    const names = tray.getDeviceKinds();
    tray.setPinnedIcons(items.map(item => ({id: `halo-${item.kind}`, label: `HaloBattery - ${item.name}`, icon: `halo:${item.kind}`})));
    tray.setTrayIcons(Object.keys(names).filter(kind => !items.some(item => item.kind === kind) && !['xbox', 'playstation', 'nintendo'].includes(kind)).map(kind => ({id: `halo-${kind}`, label: `HaloBattery - ${names[kind]}`, icon: `halo:${kind}`})));
    mount();
    if (typeof syncEditor === 'function') syncEditor();
    if (typeof mirrorSettings === 'function') mirrorSettings();
    const observer = new MutationObserver(() => {
      if (!root.querySelector('.auto-preview-tip')) { menuOpen = false; mount(); run(); }
    });
    observer.observe(root, {childList: true});
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.textContent = paused ? 'Play preview' : 'Pause preview';
      toggle.setAttribute('aria-label', paused ? 'Play automatic device preview' : 'Pause automatic device preview');
      if (paused) stop(); else run();
    });
    const visibility = () => { if (document.hidden) stop(); else run(); };
    const resize = () => { if (tooltip?.hasAttribute('data-visible')) applyItem(); if (menuOpen) positionMenu(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize);
    const attrs = new MutationObserver(() => { if (menuOpen) positionMenu(); else if (!paused && !document.hidden) run(); });
    attrs.observe(tray, {attributes: true, attributeFilter: ['theme', 'dpi']});
    window.addEventListener('pagehide', () => {
      disposed = true; stop(); observer.disconnect(); attrs.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', resize);
      document.removeEventListener('pointerdown', outsideMenu, true);
      document.removeEventListener('keydown', menuKeys, true);
      tray.removeEventListener('win11:panelchange', nativePanel);
    }, {once: true});
    run();
  });
})();
