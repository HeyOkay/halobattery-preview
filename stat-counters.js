import { canAnimate } from './vendor/number-flow-0.6.2.js';

// NumberFlow owns the digit animation; a visit only schedules its 0 -> target
// update. Snapshot data stays independent of the displayed rolling digits.
export function initStatCounters(format, reduceMotion) {
  const counters = new Map();
  const groups = [...document.querySelectorAll('.stats')].map(element => {
    const group = { element, counters: [], played: false, frame: 0 };
    for (const element of group.element.querySelectorAll('.stat-n[data-gh]')) {
      const target = Number(element.textContent.replace(/\D/g, ''));
      const fallback = document.createElement('span');
      fallback.className = 'stat-value';
      const flow = document.createElement('number-flow');
      flow.setAttribute('aria-hidden', 'true');
      flow.locales = format.resolvedOptions().locale;
      flow.format = { maximumFractionDigits: 0 };
      // Retain NumberFlow's own spring, direction and character fades. The
      // reference does not add a continuous plugin, easing or whole-text blur.
      element.replaceChildren(fallback, flow);
      const counter = { element, fallback, flow, target, group, digits: 0 };
      counters.set(element, counter);
      group.counters.push(counter);
      flow.addEventListener('animationsstart', () => {
        element.dataset.counting = '';
      });
      flow.addEventListener('animationsfinish', () => clear(counter));
    }
    return group;
  });
  function clear(counter) {
    delete counter.element.dataset.counting;
  }
  function reserve(counter) {
    const value = format.format(counter.target);
    counter.element.dataset.countWidth = value;
    counter.fallback.textContent = value;
    const digits = String(counter.target).length;
    const changed = counter.digits !== digits;
    if (changed) {
      counter.digits = digits;
      // Render the same columns at zero and at the final value. NumberFlow
      // can then roll vertically without inserting digits from the left.
      counter.flow.format = { maximumFractionDigits: 0, minimumIntegerDigits: digits };
    }
    return changed;
  }
  function finish(group) {
    cancelAnimationFrame(group.frame);
    group.frame = 0;
    for (const counter of group.counters) {
      counter.flow.animated = false;
      counter.flow.update(counter.target);
      clear(counter);
    }
  }
  function start(group) {
    group.played = true;
    if (!canAnimate || reduceMotion.matches || document.hidden) { finish(group); return; }
    for (const counter of group.counters) {
      counter.flow.animated = false;
      counter.flow.update(0);
      clear(counter);
    }
    group.frame = requestAnimationFrame(() => {
      group.frame = 0;
      for (const counter of group.counters) {
        counter.flow.animated = true;
        counter.flow.update(counter.target);
      }
    });
  }
  for (const group of groups) {
    group.counters.forEach(reserve);
    finish(group);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const group = groups.find(group => group.element === entry.target);
      if (!entry.isIntersecting) {
        group.played = false;
        finish(group);
      } else if (entry.intersectionRatio >= .2 && !group.played) start(group);
    }
  }, { threshold: [0, .2] });
  groups.forEach(group => observer.observe(group.element));
  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) groups.forEach(finish);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) groups.forEach(finish);
  });
  return (element, target) => {
    if (!Number.isSafeInteger(target) || target < 0) return;
    const counter = counters.get(element);
    if (!counter) { element.textContent = format.format(target); return; }
    if (counter.target === target) return;
    counter.target = target;
    const digitsChanged = reserve(counter);
    if (digitsChanged) {
      // A late snapshot may cross a power of ten. Rebase its columns without
      // animating their insertion; the next visit rolls the full new width.
      counter.flow.animated = false;
      counter.flow.update(counter.group.frame ? 0 : target);
      clear(counter);
      return;
    }
    // A pending visit frame uses the latest target. Snapshot changes only keep
    // rolling if a visible visit is already animating.
    if (!counter.group.frame) {
      counter.flow.animated = counter.element.hasAttribute('data-counting') && !reduceMotion.matches && !document.hidden;
      counter.flow.update(target);
    }
  };
}
