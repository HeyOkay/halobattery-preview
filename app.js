// Halo Battery website. Native modules with self-hosted NumberFlow counters.
import { startWave } from "./wave.js?v=e8037ca5";
import { initMarquee } from "./marquee.js?v=91279595";
import { t, tp, nf } from "./i18n.js?v=cd39783d";
import { initStatCounters } from "./stat-counters.js?v=a51d8dd9";
import { initAvatarGroup } from "./avatar-group.js?v=3314f3be";
const REPO = "HeyOkay/HaloBattery";
const SPRITE = "/halobattery-preview/assets/icons.svg?v=a5afeeda";   // absolute: the page may live at /fr/, /ja/ ...
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const setStatCount = initStatCounters(nf, reduceMotion);

/* ------------------------------------------------------------------ ring rules
   Same thresholds as the app (halo/icons.py arc_color): red at or below
   max(low, 10), amber up to 10 points above that, green while charging. */
function ringState({ level, low = 20, charging = false, asleep = false }) {
  if (asleep) return "asleep";
  if (charging) return "charging";
  const thr = Math.max(low, 10);
  if (level <= thr) return "red";
  if (level <= thr + 10) return "amber";
  return "neutral";
}

/* ------------------------------------------------------------------ icon preferences
   The Settings preview further down edits these; every ring on the page follows. */
const prefs = { style: "outline", ring: "thin", content: "pictogram", fallback: true,
                animation: true, timeleft: true, theme: "auto", low: 20 };
const prefListeners = new Set();
function setPrefs(patch) {
  Object.assign(prefs, patch);
  prefListeners.forEach((fn) => fn());
}

// app kind (Settings → Pictogram) -> Lucide glyph, as in halo/icon_artwork.py
const PICTO = { mouse: "mouse", keyboard: "keyboard", microphone: "mic", headset: "headphones",
  speaker: "speaker", webcam: "webcam", health: "heart-pulse", smart_home: "house", watch: "watch",
  display: "tv-minimal", tracker: "radar", phone: "smartphone", gamepad: "gamepad-2", bluetooth: "bluetooth" };

function ringMarkup() {
  return `<circle class="ring-track" cx="32" cy="32" r="29.5"/>
    <circle class="ring-arc" cx="32" cy="32" r="29.5" pathLength="100" transform="rotate(-90 32 32)"/>
    <use class="ring-glyph" href="#t-mouse" width="64" height="64"/>
    <text class="ring-pct" x="32" y="32" text-anchor="middle" dominant-baseline="central"></text>`;
}

// Same geometry as halo/icons.py render(): outer radius 31.5 of 64, the stroke
// grows inward (thin 4, classic 6.5); the pictogram placement is baked into
// each #t-/#f- symbol by tools/build_tray_glyphs.py, so it always fills 0..64.
function paintRing(svg, { level, low = prefs.low, charging = false, asleep = false, glyph = "mouse", brand = "default" }) {
  if (!svg.querySelector(".ring-arc")) svg.innerHTML = ringMarkup();
  // rings written in the HTML (the hero tray) start without the number; add it once
  if (!svg.querySelector(".ring-pct")) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("class", "ring-pct");
    Object.entries({ x: 32, y: 32, "text-anchor": "middle", "dominant-baseline": "central" }).forEach(([k, v]) => t.setAttribute(k, v));
    svg.append(t);
  }
  const state = ringState({ level, low, charging, asleep });
  svg.classList.toggle("is-red", state === "red");
  svg.classList.toggle("is-amber", state === "amber");
  svg.classList.toggle("is-charging", state === "charging");
  svg.classList.toggle("is-asleep", state === "asleep");
  svg.classList.toggle("is-full", level >= 100);
  svg.classList.toggle("show-pct", prefs.content === "percent");
  svg.classList.toggle("ring-only", prefs.content === "ring");
  svg.classList.toggle("no-anim", !prefs.animation);
  svg.style.setProperty("--lvl", level <= 0 ? 0 : Math.max(level, 2));

  const w = prefs.ring === "classic" ? 6.5 : 4;
  svg.querySelectorAll(".ring-track, .ring-arc").forEach((c) => {
    c.setAttribute("r", 31.5 - w / 2);
    c.style.strokeWidth = w;
  });

  const use = svg.querySelector(".ring-glyph");
  if (glyph === "gamepad-2" && brand !== "default") {
    // controller logos are solid marks, drawn a little smaller than the pictograms
    use.setAttribute("href", `${SPRITE}#b-${brand}`);
    Object.entries({ x: 14, y: 14, width: 36, height: 36 }).forEach(([k, v]) => use.setAttribute(k, v));
  } else {
    use.setAttribute("href", `#${prefs.style === "filled" ? "f" : "t"}-${glyph}`);
    Object.entries({ x: 0, y: 0, width: 64, height: 64 }).forEach(([k, v]) => use.setAttribute(k, v));
  }

  // the number fills 40 x 30 of the 64-unit icon; "100" shrinks instead of touching the ring
  const text = svg.querySelector(".ring-pct");
  if (text && text.textContent !== String(level)) {
    text.textContent = String(level);
    text.style.fontSize = "";
  }
  if (text && prefs.content === "percent" && !text.style.fontSize) {
    const base = 42;
    text.style.fontSize = `${base}px`;
    const width = text.getComputedTextLength();
    if (width) text.style.fontSize = `${Math.min(base, (base * 40) / width).toFixed(1)}px`;
    else text.style.fontSize = "";
  }
  return state;
}

/* ------------------------------------------------------------------ theme toggle
   Two states: follow the system, or the opposite of it (stored). */
function initTheme() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const sys = matchMedia("(prefers-color-scheme: dark)");
  const rendered = () => (meta.content === "light dark" ? (sys.matches ? "dark" : "light") : meta.content);
  const apply = (value) => {
    meta.content = value ?? "light dark";
  };
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = rendered() === "dark" ? "light" : "dark";
      const systemScheme = sys.matches ? "dark" : "light";
      const next = target === systemScheme ? null : target;
      try { next ? localStorage.setItem("color-scheme", next) : localStorage.removeItem("color-scheme"); } catch {}
      const r = btn.getBoundingClientRect();
      const root = document.documentElement;
      root.style.setProperty("--vt-x", `${r.left + r.width / 2}px`);
      root.style.setProperty("--vt-y", `${r.top + r.height / 2}px`);
      root.style.setProperty("--vt-r", `${Math.hypot(innerWidth, innerHeight)}px`);
      if (document.startViewTransition && !reduceMotion.matches) {
        document.startViewTransition(() => apply(next));
      } else {
        apply(next);
      }
    });
  });
  addEventListener("storage", (e) => {
    if (e.key === "color-scheme") apply(e.newValue);
  });
}

/* ------------------------------------------------------------------ hero wallpaper
   The static wallpaper is the fallback; the WebGL ribbon fades in over it. */
function initWave() {
  const host = document.querySelector(".hero-wall");
  if (!host) return;
  const meta = document.querySelector('meta[name="color-scheme"]');
  const sys = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (meta.content === "light dark" ? sys.matches : meta.content === "dark");
  const start = () => {
    let wave = null;
    try { wave = startWave(host, { isDark, reduceMotion }); } catch (e) { console.warn("wave disabled:", e); }
    if (!wave) return;
    // repaint on theme switch even when the animation is paused
    new MutationObserver(() => wave.redraw()).observe(meta, { attributes: true, attributeFilter: ["content"] });
    sys.addEventListener("change", () => wave.redraw());
  };
  // after the page has loaded, so the shader never competes with the first paint
  const later = () => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
}

/* ------------------------------------------------------------------ sticky header hairline */
function initHeader() {
  const header = document.querySelector(".site-header");
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px";
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => header.classList.toggle("is-stuck", !e.isIntersecting)).observe(sentinel);
}

/* ------------------------------------------------------------------ hero tray
   The four demo devices are the model the Settings preview edits. */
const trayDevices = [];
const trayListeners = new Set();
const trayChanged = () => trayListeners.forEach((fn) => fn());

function deviceGlyph(d) {
  return d.pictogram === "auto" ? d.kind : PICTO[d.pictogram];
}
function deviceLow(d) {
  if (d.low === "default") return prefs.low;
  return d.low === "off" ? 0 : Number(d.low);
}
function deviceDetail(d) {
  if (d.charging) return t("{level}%, charging", { level: d.level });
  return prefs.timeleft && d.left ? `${d.level}%, ${d.left}` : `${d.level}%`;
}
function paintDevice(svg, d) {
  return paintRing(svg, { level: d.level, low: deviceLow(d), charging: d.charging, glyph: deviceGlyph(d), brand: d.brand });
}

function initTray() {
  // The site's lower Settings/lab keep their own demonstration model.
  // The approved taskbar has an independent renderer and owns all its behaviour.
  const template = document.getElementById("site-demo-devices");
  [...template.content.querySelectorAll("[data-device]")].forEach((el,i) => trayDevices.push({
    key:`dev-${i}`,el,ring:el.querySelector(".ring"),name:el.dataset.name,autoName:el.dataset.name,
    level:Number(el.dataset.level),kind:el.dataset.kind,charging:el.hasAttribute("data-charging"),
    left:el.dataset.left??"",shown:true,pictogram:"auto",brand:"default",low:"default",
  }));
}

/* ------------------------------------------------------------------ ring lab */
function initLab() {
  const form = document.querySelector("[data-lab]");
  if (!form) return;
  const big = document.querySelector("[data-lab-ring]");
  const minis = [...document.querySelectorAll("[data-lab-mini]")];
  const legend = [...document.querySelectorAll("[data-legend] li")];
  const outLevel = form.querySelector('[data-out="level"]');
  const pct = form.elements.pct;
  const kindNames = { mouse: t("Mouse"), keyboard: t("Keyboard"), headphones: t("Headset"), "gamepad-2": t("Controller") };

  const update = () => {
    const fd = new FormData(form);
    const s = {
      level: Number(fd.get("level")),
      low: prefs.low,
      charging: fd.has("charging"),
      asleep: fd.has("asleep"),
      glyph: fd.get("kind"),
    };
    const state = paintRing(big, s);
    minis.forEach((m) => paintRing(m, s));
    outLevel.textContent = `${s.level}%`;
    pct.checked = prefs.content === "percent";
    legend.forEach((li) => li.classList.toggle("is-on", li.dataset.state === state));
    const v = { device: kindNames[s.glyph], level: s.level };
    const words = {
      neutral: () => t("{device} at {level}%", v),
      amber: () => t("{device} at {level}%, close to the alert level", v),
      red: () => t("{device} at {level}%, at or below the alert level", v),
      charging: () => t("{device} at {level}%, charging", v),
      asleep: () => t("{device} at {level}%, asleep", v),
    };
    big.setAttribute("aria-label", words[state]());
  };
  // the alert level (Settings → Notifications) and the percentage switch are shared with the Settings window
  form.addEventListener("input", (e) => {
    if (e.target === pct) return setPrefs({ content: pct.checked ? "percent" : "pictogram" });
    update();
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  prefListeners.add(update);
  update();
}

/* ------------------------------------------------------------------ settings window preview
   A faithful copy of the pre-release WinUI settings (ui/HaloBattery.Settings):
   same pages, cards, labels and order. Changes apply immediately, like the app. */
const PROVIDERS = [t("8BitDo controllers"), t("AJAZZ mice"), t("Alienware Pro Wireless keyboard"), t("AM Infinity 8K (Angry Miao)"),
  t("ASUS ROG / TUF mice, keyboards and headsets"), t("Astro A50"), t("ATK V75X keyboard"), t("ATK X1 Nearlink mice"),
  t("AULA F87 Pro V2C keyboards"), t("Audeze Maxwell"), t("Corsair headsets"), t("DAREU mice"), t("DJI Mic Mini 2"),
  t("Endgame Gear 4K mice (XM2w / OP1w)"), t("EWEADN / 前行者 mice"), t("Finalmouse UltralightX"), t("G-Wolves mice"),
  t("Glorious Model O Wireless"), t("HyperX Cloud II Wireless"), t("HyperX Cloud III Wireless, Cloud II Core Wireless"),
  t("HyperX Pulsefire mice"), t("Inphic / Attack Shark mice"), t("Jabra headsets (Link 380 / 390 dongle)"), t("JBL Quantum"),
  t("Keychron"), t("LAMZU mice"), t("Lofree keyboards, AULA V9 mice"), t("Logitech"), t("MCHOSE mice"), t("MonsGeek keyboards"),
  t("Nintendo Switch controllers"), t("NVIDIA SHIELD controllers"), t("NZXT mice"), t("Plantronics headsets (BT600 adapter)"),
  t("PlayStation controllers"), t("Pulsar / ATK VXE / Redragon mice"), t("Rapoo mice and keyboards"), t("Razer mice and headsets"),
  t("Skullcandy headsets"), t("Sony INZONE H9"), t("Steam Controller (2025)"), t("SteelSeries"), t("Turtle Beach headsets"),
  t("URX Core75"), t("VAXEE mice"), t("WLmouse"), t("Xbox-compatible controllers")];

function initSettings() {
  const win = document.querySelector("[data-win]");
  if (!win) return;
  const section = document.getElementById("settings");
  const tabs = [...win.querySelectorAll('[role="tab"]')];
  const panels = [...win.querySelectorAll("[data-panel]")];
  const f = win.elements;
  let selected = trayDevices[1] ?? trayDevices[0];

  const go = (page, focus = false) => {
    const nav = tabs[0].parentElement;
    tabs.forEach((t) => {
      const on = t.dataset.page === page;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus({ preventScroll: true });
      // narrow screens: the tabs scroll sideways, keep the current one in view
      if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: t.offsetLeft - (nav.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
    });
    const panel = panels.find((p) => p.dataset.panel === page);
    // Hide the outgoing page before measuring the incoming page. Otherwise a
    // backwards tab change lays out two full-height pages and briefly shows a
    // scrollbar, even though the new page alone fits the window.
    panels.forEach((p) => { if (p !== panel) p.hidden = true; });
    if (panel?.hidden) {
      panel.hidden = false;
      panel.classList.remove("is-entering");
      void panel.offsetWidth;
      panel.classList.add("is-entering");
    }
  };
  tabs.forEach((t) => t.addEventListener("click", () => go(t.dataset.page)));
  win.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); go(tabs[(i + step + tabs.length) % tabs.length].dataset.page, true); }
    if (e.key === "Home") { e.preventDefault(); go(tabs[0].dataset.page, true); }
    if (e.key === "End") { e.preventDefault(); go(tabs.at(-1).dataset.page, true); }
  });

  // toggles show On / Off beside the switch, like SettingToggle
  const syncToggle = (input) => { input.closest(".wt").querySelector(".wt-state").textContent = input.checked ? t("On") : t("Off"); };
  win.querySelectorAll(".wt input").forEach(syncToggle);

  // device page
  const select = win.querySelector("[data-dev-select]");
  select.innerHTML = trayDevices.map((d) => `<option value="${d.key}"></option>`).join("");
  const devRing = win.querySelector("[data-dev-ring]");
  const devTitle = win.querySelector("[data-dev-title]");
  const devState = win.querySelector("[data-dev-state]");
  const brandCard = win.querySelector("[data-brand-card]");
  const fallbackCard = win.querySelector("[data-fallback-card]");
  const prefRings = [...win.querySelectorAll("[data-pref-ring]")];

  const fillDevice = () => {
    [...select.options].forEach((o, i) => {
      const d = trayDevices[i];
      o.textContent = d.shown ? d.name : `${d.name} - ${t("Hidden devices")}`;
    });
    select.value = selected.key;
    if (document.activeElement !== f.name) f.name.value = selected.name;
    f.shown.checked = selected.shown;
    f.pictogram.value = selected.pictogram;
    f.brand.value = selected.brand;
    f.devlow.options[0].textContent = prefs.low ? t("Default ({level}%)", { level: prefs.low }) : t("Default (off)");
    f.devlow.value = selected.low;
    brandCard.hidden = deviceGlyph(selected) !== "gamepad-2";
    devTitle.textContent = selected.name;
    devState.textContent = `${t("Connected")} · ${deviceDetail(selected)}`;
    paintDevice(devRing, selected);
    prefRings.forEach((r) => paintDevice(r, selected));
    win.querySelectorAll(".wt input").forEach(syncToggle);
  };
  const fillPrefs = () => {
    f.content.value = prefs.content;
    f.style.value = prefs.style;
    f.ring.value = prefs.ring;
    f.theme.value = prefs.theme;
    f.low.value = prefs.low ? String(prefs.low) : "off";
    f.animation.checked = prefs.animation;
    f.timeleft.checked = prefs.timeleft;
    f.fallback.checked = prefs.fallback;
    fallbackCard.hidden = prefs.content !== "percent";
    fillDevice();
  };
  prefListeners.add(fillPrefs);
  trayListeners.add(fillDevice);

  win.addEventListener("submit", (e) => e.preventDefault());
  win.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches(".wt input")) syncToggle(t);
    switch (t.name) {
      case "device": selected = trayDevices.find((d) => d.key === t.value); fillDevice(); return;
      case "shown": selected.shown = t.checked; break;
      case "pictogram": selected.pictogram = t.value; if (deviceGlyph(selected) !== "gamepad-2") selected.brand = "default"; break;
      case "brand": selected.brand = t.value; break;
      case "devlow": selected.low = t.value; break;
      case "name": selected.name = t.value.trim() || selected.autoName; break;
      case "content": case "style": case "ring": case "theme":
        return setPrefs({ [t.name]: t.value });
      case "low": return setPrefs({ low: t.value === "off" ? 0 : Number(t.value) });
      case "animation": case "timeleft": case "fallback":
        return setPrefs({ [t.name]: t.checked });
      default: return;
    }
    trayChanged();
  });
  // the name applies while typing, as in the app's name box
  f.name.addEventListener("input", () => { selected.name = f.name.value.trim() || selected.autoName; trayChanged(); });
  win.querySelector("[data-reset-name]").addEventListener("click", () => {
    selected.name = selected.autoName;
    f.name.value = selected.name;
    trayChanged();
  });

  const providers = win.querySelector("[data-providers]");
  providers.innerHTML = PROVIDERS.map((p, i) =>
    `<li><span>${p}</span><label class="wt"><span class="wt-state" aria-hidden="true">${t("On")}</span><input type="checkbox" switch name="provider-${i}" aria-label="${p}" checked></label></li>`).join("");

  fillPrefs();
}

/* ------------------------------------------------------------------ vendor apps strike-through
   Replay on entry, reset only after leaving the viewport completely. */
function initStruck() {
  const list = document.querySelector("[data-struck]");
  if (!list) return;
  const lines = [...list.querySelectorAll('s')];
  let alignFrame = 0;
  const align = () => {
    alignFrame = 0;
    const dpr = devicePixelRatio || 1;
    const height = Math.max(1, Math.round(3 * dpr)) / dpr;
    // Align in document coordinates so every line has the same physical-pixel
    // coverage. Fractional font line heights otherwise make equal strokes look
    // alternately heavier and lighter when the scaleX animation finishes.
    const positions = lines.map(line => {
      const rect = line.getBoundingClientRect(), top = rect.top + scrollY;
      return Math.round((top + rect.height * .54) * dpr) / dpr - top;
    });
    lines.forEach((line, i) => {
      line.style.setProperty('--strike-y', `${positions[i]}px`);
      line.style.setProperty('--strike-height', `${height}px`);
    });
  };
  const queueAlign = () => { if (!alignFrame) alignFrame = requestAnimationFrame(align); };
  new ResizeObserver(queueAlign).observe(list);
  addEventListener('resize', queueAlign);
  document.fonts.ready.then(queueAlign);
  align();
  if (reduceMotion.matches || !("IntersectionObserver" in window)) { list.classList.add("is-struck"); return; }
  list.classList.add("will-strike");
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) list.classList.remove("is-struck");
    else if (e.intersectionRatio >= .6) list.classList.add("is-struck");
  }, { threshold: [0, 0.6] });
  io.observe(list);
}

/* ------------------------------------------------------------------ devices */
const KIND_ICON = { mouse: "mouse", keyboard: "keyboard", headset: "headphones", controller: "gamepad-2", other: "bluetooth" };
const STATUS = {
  verified: { text: t("Confirmed on hardware"), cls: "is-verified" },
  unconfirmed: { text: t("Not confirmed on hardware"), cls: "" },
};

async function initDevices() {
  const list = document.querySelector("[data-dev-list]");
  if (!list) return;
  const q = document.getElementById("dev-q");
  const kinds = document.querySelector("[data-dev-kinds]");
  const verifiedOnly = document.querySelector("[data-dev-verified-only]");
  const count = document.querySelector("[data-dev-count]");
  const empty = document.querySelector("[data-dev-empty]");
  const emptyQ = document.querySelector("[data-dev-empty-q]");
  const more = document.querySelector("[data-dev-more]");
  const PAGE = 12;
  let expanded = false;

  list.innerHTML = Array.from({ length: 6 }, () => '<li class="dev dev-skel" aria-hidden="true"><span class="dev-ico"></span><span class="dev-name">&nbsp;</span><span class="dev-meta">&nbsp;</span></li>').join("");

  let devices;
  try {
    const res = await fetch("/halobattery-preview/data/devices.json");
    if (!res.ok) throw new Error(res.status);
    devices = await res.json();
  } catch {
    list.innerHTML = "";
    count.innerHTML = `${t("The list could not be loaded.")} <a href="https://github.com/HeyOkay/HaloBattery/blob/main/docs/devices.md">${t("Read it on GitHub.")}</a>`;
    return;
  }
  document.querySelector("[data-dev-total]").textContent = devices.length;
  document.querySelector("[data-dev-verified]").textContent = devices.filter((d) => d.status === "verified").length;

  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  devices.forEach((d) => (d._q = norm(`${d.name} ${d.conn}`)));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const render = () => {
    const terms = norm(q.value).split(" ").filter(Boolean);
    const kind = kinds.querySelector("input:checked").value;
    const hits = devices.filter((d) =>
      (kind === "all" || d.kind === kind) &&
      (!verifiedOnly.checked || d.status === "verified") &&
      terms.every((t) => d._q.includes(t)));
    const shown = expanded || terms.length ? hits : hits.slice(0, PAGE);
    list.innerHTML = shown.map((d) => {
      const st = STATUS[d.status];
      return `<li class="dev">
        <span class="dev-ico"><svg class="ico" aria-hidden="true"><use href="${SPRITE}#i-${KIND_ICON[d.kind]}"/></svg></span>
        <span class="dev-name">${esc(d.name)}</span>
        <span class="dev-meta">${d.conn ? `<span>${esc(d.conn)}</span>` : ""}<span class="dev-status ${st.cls}">${d.status === "verified" ? `<svg class="ico" aria-hidden="true"><use href="${SPRITE}#i-check"/></svg>` : ""}${st.text}</span></span>
      </li>`;
    }).join("");
    count.textContent = hits.length === devices.length && shown.length < hits.length
      ? t("Showing {shown} of {total}", { shown: shown.length, total: hits.length })
      : tp(hits.length, "{count} match", "{count} matches");
    empty.hidden = hits.length > 0;
    emptyQ.textContent = q.value.trim() || t("this filter");
    more.hidden = shown.length >= hits.length;
    more.textContent = t("Show all {count}", { count: hits.length });
  };
  q.addEventListener("input", render);
  kinds.addEventListener("change", render);
  verifiedOnly.addEventListener("change", render);
  more.addEventListener("click", () => { expanded = true; render(); });
  render();
}

/* ------------------------------------------------------------------ GitHub data
   data/github.json is a same-origin snapshot written by tools/build_github.py
   (run on deploy or from cron). Static values in the HTML are the fallback. */
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
const setAll = (sel, fn) => document.querySelectorAll(`[data-gh="${sel}"]`).forEach(fn);

async function initGitHub() {
  const res = await fetch("/halobattery-preview/data/github.json");
  if (!res.ok) return;
  const gh = await res.json();
  setAll("stars", (el) => setStatCount(el, gh.stars));
  setAll("forks", (el) => setStatCount(el, gh.forks));
  setAll("downloads", (el) => setStatCount(el, gh.downloads));
  setAll("version", (el) => (el.textContent = gh.version));
  setAll("version-plain", (el) => (el.textContent = gh.version.replace(/^v/, "")));
  document.querySelector(".gh-pill")?.setAttribute("aria-label", t("Halo Battery on GitHub, {stars} stars", { stars: nf.format(gh.stars) }));
  const { setup, zip, sums } = gh.assets ?? {};
  if (setup) {
    setAll("setup-href", (el) => (el.href = setup.url));
    setAll("setup-name", (el) => (el.textContent = setup.name));
    setAll("setup-size", (el) => (el.textContent = mb(setup.size)));
  }
  if (zip) {
    setAll("zip-href", (el) => (el.href = zip.url));
    setAll("zip-name", (el) => (el.textContent = zip.name));
    setAll("zip-size", (el) => (el.textContent = mb(zip.size)));
  }
  if (sums) setAll("sums-href", (el) => (el.href = sums.url));
  // each pre-release build is its own immutable release; link the newest one
  if (gh.prerelease?.url) setAll("pre-href", (el) => (el.href = gh.prerelease.url));

  const box = document.querySelector('[data-gh="avatars"]');
  if (box) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    box.innerHTML = (gh.contributors ?? []).map((p) =>
      `<li><a href="${esc(p.url)}" title="${esc(p.login)}"><img src="${esc(new URL(p.avatar, location.origin + "/").pathname)}" alt="${esc(p.login)}" width="36" height="36" loading="lazy" decoding="async"></a></li>`).join("");
    if (box.children.length) initAvatarGroup(box);
    else box.remove();
  }
}

/* ------------------------------------------------------------------ language
   The server sends "/" to the visitor's browser language (/halobattery-preview/fr/, /ja/ ...). Choosing a
   language here stores it in the hb_lang cookie, which the server honours from then on. */
function initLanguage() {
  for (const link of document.querySelectorAll("a[data-lang]")) {
    link.addEventListener("click", () => {
      document.cookie = `hb_lang=${link.dataset.lang}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    });
  }
  const menu = document.querySelector("[data-lang-switch]");
  if (!menu) return;
  document.addEventListener("click", (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); }
  });
}

/* ------------------------------------------------------------------ boot */
initLanguage();
initTheme();
initHeader();
initTray();
initWave();
initLab();
initSettings();
initStruck();
initMarquee();
initDevices();
initGitHub().catch(() => {});
