"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

/**
 * Sfondo WebGL "Liquid Metal" (OriginKit, componente reale scaricato via
 * mcp__OriginKit__get_component -- codice originale invariato nel motore
 * dello shader, solo palette e parametri di scena adattati al nostro
 * linguaggio visivo viola->fucsia, vedi docs/librerie-ui.md "Giro 3").
 * Zero dipendenze, pausa da solo fuori schermo/tab nascosta, rispetta
 * prefers-reduced-motion -- va bene anche su mobile.
 *
 * Aggiunta nostra (non nell'originale): un tilt di parallasse + un alone di
 * luce che seguono il mouse sul contenitore. Non tocca MAI il cursore reale
 * -- fa reagire lo sfondo, come richiesto esplicitamente da Gabriel. Prima
 * il tilt era di soli 3 gradi con una transizione da mezzo secondo, quasi
 * impercettibile su uno shader già "vivo" di suo ("lo sfondo è poco
 * reattivo", Giro 4) -- portato a 9 gradi, più scattante (150ms), con in
 * più un alone radiale bianco che segue davvero il punto sotto il cursore.
 */

const MAX_STOPS = 6;
const DPR_CAP = 1.75;

/** Rampa viola->fucsia unica per tutto il sito (Hero + CTA finale) --
 * stessa identità cromatica del resto della landing (violet-600/fuchsia-500
 * già usati su badge/bottoni), qui semplicemente estesa in gamma con un
 * quasi-nero premium e un bagliore pallido per gli specular highlight. */
const PALETTE_DEFAULT = ["#07040d", "#1e0b3d", "#4c1d95", "#7c3aed", "#c026d3", "#fae8ff"];

interface LiquidMetalProps {
  colors?: string[];
  refraction?: number;
  frost?: number;
  voidSize?: number;
  angle?: number;
  twist?: number;
  stretch?: number;
  bands?: number;
  relief?: number;
  scale?: number;
  flow?: number;
  shimmer?: number;
  sweep?: number;
  /** disattiva il tilt di parallasse (usato per varianti più "calme") */
  parallasse?: boolean;
  className?: string;
  style?: CSSProperties;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
#define MAX_STOPS ${MAX_STOPS}
#define TAPS 5
#define FALLOFF 1.75
#define SKEW 0.75
#define GRAIN 0.012

varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec3  uColors[MAX_STOPS];
uniform int   uCount;
uniform float uScale;
uniform float uAngle;
uniform float uPhase;
uniform float uTwist;
uniform float uStretch;
uniform float uFreq;
uniform float uRelief;
uniform float uVoid;
uniform float uVoidFade;
uniform float uGloss;
uniform float uRefract;
uniform float uFrost;
uniform float uHue;
uniform float uSweep;
uniform float uSweepPhase;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec3 ramp(float t) {
    float span = float(uCount - 1);
    if (span < 0.5) {
        vec3 c = vec3(0.0);
        for (int k = 0; k < MAX_STOPS; k++) { if (k == 0) c = uColors[k]; }
        return c;
    }
    float u = min(clamp(t, 0.0, 1.0) * span, span - 1e-4);
    float i = floor(u);
    float fr = u - i;
    fr = fr * fr * (3.0 - 2.0 * fr);
    vec3 a = vec3(0.0), b = vec3(0.0);
    for (int k = 0; k < MAX_STOPS; k++) {
        if (float(k) == i)       a = uColors[k];
        if (float(k) == i + 1.0) b = uColors[k];
    }
    return mix(a, b, fr);
}

float envT(vec2 dir) {
    float directional = 0.5 + 0.5 * (dir.y * 1.3 + dir.x * 0.45);
    float isotropic = clamp(length(dir) * 1.4, 0.0, 1.0);
    return clamp(mix(directional, isotropic, 0.35), 0.0, 1.0);
}

vec3 chroma(vec2 dir, float disp) {
    return vec3(
        ramp(envT(dir * (1.0 + disp))).r,
        ramp(envT(dir)).g,
        ramp(envT(dir * (1.0 - disp))).b
    );
}

float fold(float f) {
    return sin(f + SKEW * sin(f));
}

vec2 fieldAt(vec2 p) {
    p = rot(uAngle) * p;
    float r = length(p);
    p = rot(uTwist * r) * p;
    p.x *= uStretch;
    float d = length(p);
    float h = fold(pow(max(d, 1e-4), FALLOFF) * uFreq - uPhase) * uRelief;
    return vec2(h, d);
}

vec3 hueShift(vec3 c, float a) {
    vec3 k = vec3(0.57735);
    float ca = cos(a);
    return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uAspect;
    vec2 p = uv / max(uScale, 0.01);

    float e = 0.0035 / max(uScale, 0.01);
    vec2 f0 = fieldAt(p);
    float hx = fieldAt(p + vec2(e, 0.0)).x;
    float hy = fieldAt(p + vec2(0.0, e)).x;
    float d = f0.y;
    vec3 n = normalize(vec3(-(hx - f0.x) / e, -(hy - f0.x) / e, 1.0));

    if (uFrost > 0.001) {
        vec2 j = vec2(vnoise(p * 6.0), vnoise(p * 6.0 + 7.3)) - 0.5;
        n = normalize(n + vec3(j * uFrost * 0.25, 0.0));
    }

    vec3 v = vec3(0.0, 0.0, 1.0);
    vec3 r = reflect(-v, n);

    vec3 col = chroma(r.xy, uRefract);
    if (uFrost > 0.001) {
        for (int t = 1; t < TAPS; t++) {
            float a = float(t) * 2.399963;
            vec2 off = vec2(cos(a), sin(a)) * uFrost * 0.5;
            col += chroma(r.xy + off, uRefract);
        }
        col /= float(TAPS);
    }

    float la = 2.35619 + uSweepPhase;
    vec3 l = normalize(vec3(cos(la), sin(la), 0.65));
    vec3 hv = normalize(l + v);
    float shine = mix(6.0, 200.0, 1.0) * (1.0 - 0.70 * uFrost);
    float spec = pow(max(dot(n, hv), 0.0), max(shine, 2.0));
    float beam = 1.0 + uSweep * 0.9 * sin(uSweepPhase * 1.3 + d * 3.0);
    col += spec * 1.0 * 0.55 * max(beam, 0.0);

    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    col += fres * 1.0 * 0.15 * ramp(1.0);

    col = mix(col, col * 0.72 + 0.16, uFrost * 0.30);

    if (abs(uHue) > 0.001) col = hueShift(col, uHue);

    col *= smoothstep(uVoid, uVoid + uVoidFade, d);

    col += (hash21(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * GRAIN;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

let parseCtx: CanvasRenderingContext2D | null | undefined;

function toRGB(css: string): [number, number, number] {
  if (!css) return [0, 0, 0];
  const s = css.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  if (typeof document !== "undefined") {
    if (parseCtx === undefined) parseCtx = document.createElement("canvas").getContext("2d");
    if (parseCtx) {
      parseCtx.fillStyle = "#000000";
      parseCtx.fillStyle = s;
      const out = parseCtx.fillStyle;
      if (typeof out === "string" && out.charAt(0) === "#" && out !== s) return toRGB(out);
    }
  }
  return [0, 0, 0];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function LiquidMetal({
  colors = PALETTE_DEFAULT,
  refraction = 1.2,
  frost = 1.5,
  voidSize = 2,
  angle = -70,
  twist = 2.4,
  stretch = 7,
  bands = 7,
  relief = 9,
  scale = 6.5,
  flow = 6,
  shimmer = 6,
  sweep = 4,
  parallasse = true,
  className = "",
  style,
}: LiquidMetalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const propsRef = useRef({ colors, refraction, frost, voidSize, angle, twist, stretch, bands, relief, scale, flow, shimmer, sweep });
  useEffect(() => {
    propsRef.current = { colors, refraction, frost, voidSize, angle, twist, stretch, bands, relief, scale, flow, shimmer, sweep };
  });

  function alMovimentoMouse(e: MouseEvent<HTMLDivElement>) {
    if (!parallasse || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    // Tilt + un alone di luce che segue il puntatore: reagisce lo sfondo,
    // il cursore del sistema resta invariato. Prima il tilt era di soli 3
    // gradi con una transizione da mezzo secondo -- praticamente
    // impercettibile con uno shader già "vivo" di suo (segnalato da
    // Gabriel, "lo sfondo è poco reattivo"). Alzato a 9 gradi e reso più
    // scattante (150ms), più un alone radiale che illumina davvero il
    // punto sotto il cursore invece di un tilt quasi invisibile.
    wrapRef.current.style.transform = `perspective(1200px) rotateX(${(-ny * 9).toFixed(2)}deg) rotateY(${(nx * 9).toFixed(2)}deg) scale(1.035)`;
    if (glowRef.current) {
      glowRef.current.style.opacity = "1";
      glowRef.current.style.background = `radial-gradient(360px circle at ${((nx + 0.5) * 100).toFixed(1)}% ${((ny + 0.5) * 100).toFixed(1)}%, rgba(255,255,255,0.16), transparent 70%)`;
    }
  }

  function alResetMouse() {
    if (!wrapRef.current) return;
    wrapRef.current.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
    if (glowRef.current) glowRef.current.style.opacity = "0";
  }

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let disposed = false;
    let raf = 0;
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uni: Record<string, WebGLUniformLocation | null> = {};

    let onScreen = true;
    let pageVisible = true;
    let reduceMotion = false;

    let elapsed = 0;
    let phase = 0;
    let shimmerPhase = 0;
    let sweepPhase = 0;
    let lastNow = 0;

    const colorBuf = new Float32Array(MAX_STOPS * 3);

    function init(): boolean {
      const ctx =
        (canvas!.getContext("webgl", { alpha: false, antialias: false, powerPreference: "high-performance" }) as WebGLRenderingContext | null) ||
        (canvas!.getContext("experimental-webgl") as WebGLRenderingContext | null);
      if (!ctx) return false;
      gl = ctx;

      const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const precision = hp && hp.precision > 0 ? "highp" : "mediump";

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, "precision " + precision + " float;\n" + FRAG);
      if (!vs || !fs) return false;

      const prog = gl.createProgram();
      if (!prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, "aPos");
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

      program = prog;
      gl.useProgram(prog);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const names = ["uTime", "uAspect", "uColors[0]", "uCount", "uScale", "uAngle", "uPhase", "uTwist", "uStretch", "uFreq", "uRelief", "uVoid", "uVoidFade", "uGloss", "uRefract", "uFrost", "uHue", "uSweep", "uSweepPhase"];
      uni = {};
      for (const n of names) uni[n] = gl.getUniformLocation(prog, n);

      gl.clearColor(0, 0, 0, 1);
      return true;
    }

    function resize() {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      // Bug reale trovato verificando con Playwright le dimensioni effettive
      // (non solo leggendo il codice): il buffer di disegno veniva
      // dimensionato su `host` (l'inset-0 a piena sezione), ma il <canvas>
      // è renderizzato a schermo alla dimensione di `wrapRef` -- che è
      // apposta più grande del 8% (inset-[-4%] su ogni lato) per avere
      // margine durante il tilt al mouse. Risultato: si disegnava a una
      // risoluzione, poi il browser la ningrandiva dell'8% via CSS --
      // leggermente sfocato ovunque, più visibile su schermi grandi/ad alta
      // densità. Usare la dimensione di `wrap` allinea buffer e resa 1:1.
      const misura = wrapRef.current ?? host!;
      const w = Math.max(1, Math.round(misura.clientWidth * dpr));
      const h = Math.max(1, Math.round(misura.clientHeight * dpr));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw(dt: number) {
      if (!gl || !program) return;
      const p = propsRef.current;

      if (!reduceMotion) {
        elapsed += dt;
        phase += dt * p.flow * 0.12;
        shimmerPhase += dt * 0.18;
        sweepPhase += dt * p.sweep * 0.06;
      }

      const list = (p.colors && p.colors.length ? p.colors : PALETTE_DEFAULT).slice(0, MAX_STOPS);
      colorBuf.fill(0);
      for (let i = 0; i < list.length; i++) {
        const c = toRGB(list[i]);
        colorBuf[i * 3] = c[0];
        colorBuf[i * 3 + 1] = c[1];
        colorBuf[i * 3 + 2] = c[2];
      }

      const zoom = Math.pow(2.4, (p.scale - 5) / 2.5);
      const voidR = p.voidSize * 0.06;

      gl.useProgram(program);
      gl.uniform1f(uni["uTime"], elapsed);
      gl.uniform1f(uni["uAspect"], canvas!.width / Math.max(1, canvas!.height));
      gl.uniform3fv(uni["uColors[0]"], colorBuf);
      gl.uniform1i(uni["uCount"], Math.max(1, list.length));
      gl.uniform1f(uni["uScale"], zoom);
      gl.uniform1f(uni["uAngle"], (p.angle * Math.PI) / 180);
      gl.uniform1f(uni["uPhase"], phase);
      gl.uniform1f(uni["uTwist"], p.twist * 0.35);
      gl.uniform1f(uni["uStretch"], Math.pow(2.2, (p.stretch - 5) / 2.5));
      gl.uniform1f(uni["uFreq"], p.bands * 0.45);
      gl.uniform1f(uni["uRelief"], p.relief * 0.02);
      gl.uniform1f(uni["uVoid"], voidR);
      gl.uniform1f(uni["uVoidFade"], 0.15 + p.voidSize * 0.04);
      gl.uniform1f(uni["uRefract"], p.refraction * 0.022);
      gl.uniform1f(uni["uFrost"], p.frost / 10);
      gl.uniform1f(uni["uHue"], Math.sin(shimmerPhase) * p.shimmer * 0.05);
      gl.uniform1f(uni["uSweep"], p.sweep / 10);
      gl.uniform1f(uni["uSweepPhase"], sweepPhase);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      if (!onScreen || !pageVisible) {
        lastNow = now;
        return;
      }
      const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0;
      lastNow = now;
      resize();
      draw(dt);
    }

    if (!init()) {
      setFailed(true);
      return;
    }

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(host);

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); }, { rootMargin: "128px" })
        : null;
    if (io) io.observe(host);

    const onVisibility = () => { pageVisible = document.visibilityState !== "hidden"; };
    document.addEventListener("visibilitychange", onVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const onMQ = (e: MediaQueryListEvent) => { reduceMotion = e.matches; };
    if (mq.addEventListener) mq.addEventListener("change", onMQ);

    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); };
    const onRestored = () => {
      if (disposed) return;
      lastNow = 0;
      if (init()) raf = requestAnimationFrame(loop);
      else setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    resize();
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (mq.removeEventListener) mq.removeEventListener("change", onMQ);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pointer-events-auto absolute inset-0 overflow-hidden ${className}`}
      style={{ background: "#07040d", ...style }}
      onMouseMove={alMovimentoMouse}
      onMouseLeave={alResetMouse}
    >
      <div ref={wrapRef} className="absolute inset-[-4%] transition-transform duration-150 ease-out will-change-transform">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          style={failed ? { background: "radial-gradient(ellipse at 50% 40%, #4c1d95, #1e0b3d 55%, #07040d 85%)" } : undefined}
        />
      </div>
      {parallasse && (
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-300 ease-out"
          style={{ opacity: 0 }}
        />
      )}
    </div>
  );
}
