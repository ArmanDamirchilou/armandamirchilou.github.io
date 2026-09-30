import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * The living wallpaper behind the glass: slow, flowing colour, like a phone's
 * lock screen. Glass only reads as glass when there's something moving behind
 * it, and this is that something.
 *
 * Plain WebGL, one fragment shader, drawn at a fraction of the screen's
 * resolution (it's all soft gradients, so nobody can tell) and paused while
 * the tab is hidden. `energy` (0..1, e.g. the twin's voice level) makes it
 * swell; reduced motion gets a single still frame.
 */

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform float energy;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
uniform vec3 c4;

// Cheap value noise + fbm, enough for soft ribbons of colour.
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float s = t * 0.045;

  // Domain warping: the colour field is pushed around by another noise field,
  // which is what gives it the slow, liquid drift.
  vec2 q = vec2(fbm(p * 1.3 + s), fbm(p * 1.3 - s + 3.1));
  vec2 r = vec2(fbm(p * 1.7 + q * 2.2 + s * 1.3 + 1.7), fbm(p * 1.7 + q * 2.2 - s * 0.9 + 9.2));
  float f = fbm(p * 1.2 + r * 1.8);

  vec3 col = mix(c1, c2, smoothstep(0.25, 0.75, f));
  col = mix(col, c3, smoothstep(0.45, 0.95, r.x) * 0.9);
  col = mix(col, c4, smoothstep(0.55, 1.0, q.y) * 0.6);

  // Keep it a night sky, not a rave: dark at the edges, a glow in the middle
  // that grows while the twin speaks.
  float vign = smoothstep(1.25, 0.15, length(p * vec2(0.9, 1.1)));
  float glow = 0.55 + 0.45 * energy;
  col *= (0.28 + 0.72 * vign) * glow;
  col += (hash(uv * res + t) - 0.5) * 0.018; // a little grain, kills banding
  gl_FragColor = vec4(col, 1.0);
}
`;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const AURORA_PALETTE = ['#140a12', '#7a1d2e', '#3d2a8c', '#0f6e7a'];

export function Aurora({
  className = 'aurora',
  palette = AURORA_PALETTE,
  energy,
  scale = 0.35,
}: {
  className?: string;
  palette?: string[];
  energy?: MutableRefObject<number>;
  /** Render resolution relative to CSS pixels. */
  scale?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) {
      canvas.classList.add('is-fallback');
      return;
    }

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.classList.add('is-fallback');
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u('res');
    const uT = u('t');
    const uEnergy = u('energy');
    ['c1', 'c2', 'c3', 'c4'].forEach((n, i) => gl.uniform3fv(u(n), hex(palette[i] ?? palette[0])));

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let smoothed = 0;
    const start = performance.now() - 40_000; // start mid-flow, not from a blank seed
    const frame = (now: number) => {
      smoothed += ((energy?.current ?? 0) - smoothed) * 0.08;
      gl.uniform1f(uT, (now - start) / 1000);
      gl.uniform1f(uEnergy, Math.min(1, smoothed));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [palette, energy, scale]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
