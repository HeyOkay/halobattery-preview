// Strings for the scripts. Each translated page (/halobattery-preview/fr/, /ja/, ...) carries its strings in
// <script type="application/json" id="i18n-strings">, written by tools/i18n.py; the
// English page has none, so every call falls back to the English text it was given.
//   t("{level}%, charging", { level: 65 })
//   tp(count, "{count} match", "{count} matches")       // plural forms per language
const node = document.getElementById("i18n-strings");
const strings = node ? JSON.parse(node.textContent) : {};
export const lang = document.documentElement.lang || "en";
const rules = new Intl.PluralRules(lang);
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function t(key, vars = {}) {
  const v = strings[key];
  return fill(typeof v === "string" ? v : typeof v === "object" && v ? v.other : key, vars);
}

export function tp(count, one, other, vars = {}) {
  const v = strings[other];
  const form = typeof v === "object" && v
    ? v[rules.select(count)] ?? v.other
    : typeof v === "string" ? v : count === 1 ? one : other;
  return fill(form, { count, ...vars });
}

export const nf = new Intl.NumberFormat(lang);

// Plain scripts (the taskbar preview) use the same lookup.
globalThis.hbT = t;
globalThis.hbTp = tp;
