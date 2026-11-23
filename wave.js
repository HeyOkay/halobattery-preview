// Hero background: a slow, silky glass ribbon rendered with WebGL.
// Resolution-independent replacement for the static wallpaper, which stays
// underneath as the fallback (no WebGL, shader error, or before the first frame).

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uDark;
uniform vec3  uView;   // x/y offset of the composition, zoom

const float PI = 3.14159265;

// One glass ribbon: a flat strip that drifts and twists about its own length.
// Shading treats it as a real surface (normal from the twist plus a slight curl
// across the width), so edge-on folds light up instead of pinching to nothing.
// soft: 0 = in focus; < 0 = depth of field varies along the ribbon.
// Returns premultiplied colour + alpha.
vec4 ribbon(vec2 p, float t, float seed, float W, float tilt, float off, float soft, float dark) {
  float x = p.x;
  if (soft < 0.0) soft = 0.9 * smoothstep(-0.2, 0.9, sin(x * 1.1 - 1.2 + t * 0.05));

  float k1 = 1.9, k2 = 3.4;
  float a1 = x * k1 + t * 0.12 + seed;
  float a2 = x * k2 - t * 0.11 + seed * 1.7;
  float c  = 0.17 * sin(a1) + 0.035 * sin(a2) + tilt * x + off;           // centre line
  float dc = 0.17 * k1 * cos(a1) + 0.035 * k2 * cos(a2) + tilt;            // its slope

  // The ribbon rolls but never goes fully edge-on: its tilt swings between face-on and
  // about 74 degrees, so the width breathes instead of pinching to a knot.
  float phi = x * 0.7 + t * 0.07 + seed * 2.3;
  float theta = 1.29 * sin(phi);                                           // signed tilt, smooth
  float open = cos(theta);                                                 // 0.28 .. 1
  float w = W * open;                                                      // projected half-width
  float aw = w;
  float px = uRes.y / uView.z;                                             // pixels per unit

  float s = (p.y - c) / w;                                                 // -1..1 across
  float sc = clamp(s, -1.0, 1.0);
  // distances are vertical; scale by the nearer edge's slope to get the perpendicular
  // distance, so diagonal edges stay as smooth as flat ones
  float dw = -W * sin(theta) * 1.29 * cos(phi) * 0.7;
  float edgeSlope = dc + sign(s) * dw;
  float perp = inversesqrt(1.0 + edgeSlope * edgeSlope);
  float inside = clamp((1.0 - abs(s)) * aw * px * perp / (1.0 + soft * 3.0) + 0.5, 0.0, 1.0);

  float ph = theta + sc * 0.9;                                             // curl across the width
  vec3 n = normalize(vec3(dc * sin(ph), -sin(ph), cos(ph)));
  vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = abs(dot(n, L));
  float spec = pow(abs(dot(n, H)), 22.0);
  float spine = pow(abs(dot(n, H)), 320.0);                               // the crisp highlight along the crest
  float fres = pow(1.0 - abs(n.z), 2.2);

  float rimPx = (1.0 - abs(sc)) * aw * px * perp;
  float rim = exp(-pow(rimPx / (3.0 + soft * 10.0), 2.0)) * inside * 0.75;
  float strands = 1.0;

  vec3 mint = vec3(0.835, 0.918, 0.886);
  vec3 lime = vec3(0.718, 0.902, 0.553);
  // faint thin-film tint on the grazing edges, the way real glass splits light
  vec3 iri = 0.5 + 0.5 * cos(2.0 * PI * (fres * 1.3 + sc * 0.25 + vec3(0.0, 0.33, 0.67)));
  vec3 col; float a;
  if (dark > 0.5) {
    vec3 deep = vec3(0.16, 0.26, 0.22);
    col = mix(deep, mix(mint, lime, 0.35), diff) * strands;
    col = mix(col, vec3(0.97, 1.0, 0.94), clamp(spec * 1.2 + fres * 0.5 + spine, 0.0, 1.0));
    a = inside * (0.08 + 0.32 * diff * diff + 0.45 * fres + 0.6 * spec + 0.9 * spine * (1.0 - soft * 0.6));
    a += rim * (0.30 + 0.50 * fres);
    col = mix(col, vec3(0.93, 1.0, 0.86), rim);
    col = mix(col, iri, fres * 0.16);
  } else {
    vec3 sageD = vec3(0.36, 0.54, 0.43);
    vec3 sageL = vec3(0.80, 0.90, 0.84);
    col = mix(sageD, sageL, diff) * strands;
    col = mix(col, vec3(1.0), clamp(spec * 1.2 + spine, 0.0, 1.0));
    a = inside * (0.05 + 0.22 * (1.0 - diff) + 0.35 * fres + 0.5 * spec + 0.8 * spine);
    a += rim * (0.22 + 0.35 * fres);
    col = mix(col, vec3(0.30, 0.50, 0.37), rim * 0.8);
    col = mix(col, iri * 0.7, fres * 0.10);
  }
  // atmosphere: a tight and a wide glow around the glass
  float dist = max(abs(p.y - c) - aw, 0.0) * inversesqrt(1.0 + dc * dc);   // centre slope only: no seams
  // the halo gets its own fixed colour: the surface colour flips with the twist and would leave seams
  float halo = (exp(-dist * 16.0) * 0.08 + exp(-dist * 3.5) * 0.06) * (1.0 - inside) * (dark > 0.5 ? 1.0 : 0.6);
  vec3 haloCol = dark > 0.5 ? mix(mint, lime, 0.4) : vec3(0.55, 0.70, 0.60);
  a = clamp(a * (1.0 - soft * 0.4), 0.0, 1.0);
  vec4 glass = vec4(col * a, a);
  return glass + vec4(haloCol * halo, halo) * (1.0 - a);
}

vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

float hash(vec2 q) { return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uView.z - uView.xy;
  float t = uTime;
  vec4 acc = vec4(0.0);
  // a faint, out-of-focus ribbon far behind, then one large glass sheet in front
  // warm ambient light behind the glass, so it does not float in a flat void
  float cy = 0.17 * sin(p.x * 1.9 + t * 0.12) + 0.26 * p.x - 0.02;
  float amb = exp(-pow((p.y - cy) * 2.6, 2.0)) * exp(-pow(p.x * 0.9, 2.0));
  vec3 ambCol = uDark > 0.5 ? vec3(0.42, 0.50, 0.36) : vec3(0.62, 0.74, 0.62);
  acc = vec4(ambCol, 1.0) * amb * (uDark > 0.5 ? 0.16 : 0.10);
  acc = over(ribbon(p, t * 0.6, 3.3, 0.085, 0.10,  0.24, 1.6, uDark) * 0.6, acc);
  acc = over(ribbon(p, t,       0.0, 0.250, 0.26, -0.02, -1.0, uDark), acc);
  // half-step dither so the soft halos do not band on 8-bit displays
  acc.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * acc.a;
  gl_FragColor = acc;
}`;

export function startWave(host, { isDark, reduceMotion }) {
  const canvas = document.createElement("canvas");
  canvas.className = "hero-wave";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: "low-power" });
  if (!gl) return null;
  // Without a GPU the shader runs on the CPU and blocks the page; the static
  // wallpaper underneath is the better choice there. ?wave forces it (tests).
  const force = new URLSearchParams(location.search).has("wave");
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  if (!force && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn("wave disabled:", e);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uDark = gl.getUniformLocation(prog, "uDark");
  const uView = gl.getUniformLocation(prog, "uView");

  host.append(canvas);

  // start at a phase with a good composition behind the hero copy
  const T0 = 48.0;
  let elapsed = 0, last = 0, raf = 0, shown = false;
  let visible = true, busy = false;
  // Frame budget, measured as the real interval between frames (a GPU that
  // cannot keep up stretches it as surely as a slow CPU): halve the resolution
  // first, and if that is still too slow, settle on a still frame.
  let scale = 1, still = false, deltas = [];

  const resize = () => {
    // the ribbon is soft; extra density costs fill-rate for no visible gain
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(1, Math.round(host.clientWidth * dpr));
    const h = Math.max(1, Math.round(host.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const draw = () => {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, T0 + elapsed);
    gl.uniform1f(uDark, isDark() ? 1 : 0);
    // landscape: lift the ribbon up and right, clear of the headline;
    // portrait: zoom out and drop it below the copy, where the scrim is thin
    const aspect = canvas.width / canvas.height;
    if (aspect < 0.9) gl.uniform3f(uView, 0.0, -0.30, 1.9);
    else gl.uniform3f(uView, 0.10, 0.07, 1.0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; requestAnimationFrame(() => canvas.classList.add("is-ready")); }
  };

  const running = () => visible && !busy && !still && !document.hidden && !reduceMotion.matches;
  const frame = (now) => {
    raf = 0;
    if (!running()) { last = 0; host.dataset.wave = "paused"; return; }
    host.dataset.wave = "running";
    if (last) {
      const dt = now - last;
      elapsed += Math.min(dt, 100) / 1000;
      if (!force && deltas.length < 60) {
        deltas.push(dt);
        if (deltas.length === 60) {
          const median = deltas.sort((x, y) => x - y)[30];
          if (median > 24) {                      // below ~40 fps
            if (scale === 1) { scale = 0.5; deltas = []; }
            else { still = true; host.dataset.wave = "still"; return; }
          }
        }
      }
    }
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const play = () => {
    if (reduceMotion.matches || still) { draw(); return; }      // one still frame
    if (running() && !raf) raf = requestAnimationFrame(frame);
  };

  // Animate only while the hero is mostly on screen: once the visitor has
  // scrolled on to the controls below, the last frame stays as it is and the
  // GPU is left to the page.
  new IntersectionObserver(([e]) => {
    visible = e.intersectionRatio >= 0.5;
    play();
  }, { threshold: [0, 0.5, 1] }).observe(host);
  // and never compete with a drag on a slider or a held pointer anywhere
  addEventListener("pointerdown", () => { busy = true; }, { passive: true });
  const release = () => { if (busy) { busy = false; last = 0; play(); } };
  addEventListener("pointerup", release, { passive: true });
  addEventListener("pointercancel", release, { passive: true });
  addEventListener("blur", release);
  document.addEventListener("visibilitychange", play);
  reduceMotion.addEventListener("change", play);
  new ResizeObserver(() => { if (reduceMotion.matches || still || !raf) draw(); }).observe(host);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; canvas.remove(); });

  play();
  return { redraw: draw, seek: (s) => { elapsed = s; draw(); } };
}
