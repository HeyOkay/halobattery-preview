import { Digit } from './vendor/number-flow-0.6.2.js';

// NumberFlow 0.6.2 animates an inherited CSS variable and evaluates mod()/clamp()
// on every glyph every frame. Express the same reel as piecewise transforms so
// mobile browsers can composite it. Keep the package's layout, masks and timing.
const spins = new WeakMap();
const nativeDidUpdate = Digit.prototype.didUpdate;
const clamp = value => Math.max(-1, Math.min(1, value));
const mod = (value, length) => ((value % length) + length) % length;
const offset = (number, current, length) => {
  const raw = mod(number - current, length);
  return clamp(raw - length * Math.floor(raw / (length / 2)));
};

export function reelKeyframes(from, to, number, length, centered, width, height) {
  const distance = to - from;
  const wrapsAt = current => Math.abs(mod(number - current, length) - length / 2) < 1e-9;
  // At an endpoint wrap, use the side belonging to the animated interval.
  // Both sides are masked, but tweening between them would flash a stray digit.
  const first = distance && wrapsAt(from) ? Math.sign(distance) : offset(number, from, length);
  const last = distance && wrapsAt(to) ? -Math.sign(distance) : offset(number, to, length);
  const points = [{ offset: 0, y: first }, { offset: 1, y: last }];
  const low = Math.min(from, to), high = Math.max(from, to);
  for (let loop = Math.floor((low - number) / length) - 1; distance && loop <= Math.ceil((high - number) / length); loop++) {
    const center = number + loop * length;
    for (const current of [center - 1, center + 1, center + length / 2]) {
      const progress = (current - from) / distance;
      if (progress <= 0 || progress >= 1) continue;
      if (current === center + length / 2) {
        // A reel wraps only beyond the mask. Duplicate offsets preserve that
        // invisible jump instead of tweening the glyph across the visible row.
        points.push({ offset: progress, y: -Math.sign(distance) }, { offset: progress, y: Math.sign(distance) });
      } else points.push({ offset: progress, y: offset(number, current, length) });
    }
  }
  return points.sort((a, b) => a.offset - b.offset).map(point => ({
    offset: point.offset,
    transform: `translate(${centered ? -width / 2 : 0}px, ${(point.y * height).toFixed(6)}px)`,
  }));
}

export function finishStaticCounterEffects(flow) {
  for (const animation of flow.shadowRoot.getAnimations()) {
    if (!animation.effect.target.classList.contains('number')) continue;
    const frames = animation.effect.getKeyframes();
    if (frames.every(frame => {
      const tracks = Object.entries(frame).filter(([key]) => key.startsWith('--'));
      return tracks.length > 0 && tracks.every(([, value]) => parseFloat(value) === 0);
    })) animation.finish();
  }
}

Digit.prototype.didUpdate = function (parentRect) {
  if (!this.flow.hasAttribute('data-compositor-spin') || this.flow.plugins || this.length < 3) {
    return nativeDidUpdate.call(this, parentRect);
  }
  const delta = this.getDelta();
  if (!delta) return nativeDidUpdate.call(this, parentRect);
  const target = Number(this.el.style.getPropertyValue('--current'));
  const previous = spins.get(this);
  const progress = previous?.reference.effect.getComputedTiming().progress;
  const from = progress == null ? target - delta : previous.from + previous.distance * progress;
  let distance = (target - from) % this.length;
  if (delta > 0 && distance < 0) distance += this.length;
  if (delta < 0 && distance > 0) distance -= this.length;

  // Retain NumberFlow's own horizontal layout work, suppressing only its spin.
  const getDelta = this.getDelta;
  this.getDelta = () => 0;
  try { nativeDidUpdate.call(this, parentRect); }
  finally { this.getDelta = getDelta; }
  // Finishing resolves the package's animation promises; cancellation rejects
  // them. On an interrupted update the old visual position was sampled above.
  previous?.animations.forEach(animation => animation.finish());
  if (!distance) {
    this.el.classList.remove('is-spinning');
    spins.delete(this);
    return;
  }
  this.el.classList.add('is-spinning');
  const timing = this.flow.spinTiming ?? this.flow.transformTiming;
  const { width, height } = this.el.querySelector('.digit__num:not([inert])').getBoundingClientRect();
  const animations = [...this.el.children].flatMap((number, index) => {
    const frames = reelKeyframes(from, from + distance, index, this.length, number.hasAttribute('inert'), width, height);
    // Don't create layers for rows which only wrap outside the visible mask.
    if (!frames.some((frame, i) => i > 0 && frame.offset > frames[i - 1].offset && frame.transform !== frames[i - 1].transform)) return [];
    return [number.animate(frames, { ...timing, composite: 'replace' })];
  });
  if (!animations.length) {
    this.el.classList.remove('is-spinning');
    spins.delete(this);
    return;
  }
  const state = { from, distance, animations, reference: animations[0] };
  spins.set(this, state);
  this.flow.addEventListener('animationsfinish', () => {
    if (spins.get(this) !== state) return;
    this.el.classList.remove('is-spinning');
    spins.delete(this);
  }, { once: true });
};
