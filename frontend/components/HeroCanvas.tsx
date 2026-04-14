'use client'

import { useEffect, useRef } from 'react'

/* ─────────────────────────────────────────────────────────────────
   VERTEX SHADER
───────────────────────────────────────────────────────────────── */
const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/* ─────────────────────────────────────────────────────────────────
   FRAGMENT SHADER — Light Caustics

   Technique: layered travelling sine waves at 3 angles.
   Taking the abs() + sharpening creates the characteristic
   bright-vein / dark-pool pattern of caustic light through water.

   Perfectly suited for an invitation platform:
   • Reads as "crystal", "glass", "celebration light"
   • Structured and geometric, never organic/biological
   • Cursor interaction = touching the water surface
   • Chromatic aberration on hover = light prism / luxury
───────────────────────────────────────────────────────────────── */
const FRAG = `
precision highp float;

uniform float u_time;
uniform vec2  u_res;
uniform vec2  u_mouse;   /* normalised 0-1, y-down */
uniform float u_hover;   /* 0-1, eased on JS side  */

/* ── Caustic helper ─────────────────────────────────────────── */
/* Projects UV onto a direction, runs a sine wave, sharpens it  */
float causticLayer(vec2 uv, vec2 dir, float freq, float speed, float t) {
  float wave = sin(dot(uv, dir) * freq + t * speed);
  /* Sharpen: bring the bright veins into focus */
  return pow(abs(wave), 2.8);
}

/* ── Single-colour sample at a given UV ─────────────────────── */
float sample(vec2 uv, float t, float distort) {
  /* Cursor warp — ripple from pointer position */
  vec2  mDelta = uv - u_mouse;
  float mDist  = length(mDelta * vec2(u_res.x/u_res.y, 1.0));
  float mWarp  = u_hover * 0.18 * smoothstep(0.65, 0.0, mDist);
  vec2  warped = uv + mDelta * mWarp;

  /* Three wave directions — 0°, 60°, 120° — creates mesh */
  vec2 d0 = vec2( 1.000,  0.000);
  vec2 d1 = vec2( 0.500,  0.866);
  vec2 d2 = vec2(-0.500,  0.866);

  float base = mix(2.8, 1.4, distort);   /* freq drops on hover → longer wavelength */
  float spd  = mix(0.30, 0.30, distort); /* speed unchanged */

  float c0 = causticLayer(warped, d0, base,        spd,        t);
  float c1 = causticLayer(warped, d1, base * 1.31, spd * 0.82, t * 0.94);
  float c2 = causticLayer(warped, d2, base * 0.79, spd * 1.17, t * 1.07);

  /* Multiply layers — dark where any wave is dark (caustic pools) */
  return c0 * c1 * c2;
}

void main() {
  vec2 uv  = gl_FragCoord.xy / u_res;
  vec2 uvF = vec2(uv.x, 1.0 - uv.y);  /* flip Y: WebGL↔CSS */

  /* Aspect-correct coordinates centered at 0 */
  float asp = u_res.x / u_res.y;
  vec2  uvA = (uvF - 0.5) * vec2(asp, 1.0);

  float t = u_time * 0.18;

  /* ── Chromatic aberration — splits R/G/B slightly ──────────── */
  float ca = mix(0.004, 0.042, u_hover);

  float lR = sample(uvA + vec2( ca, 0.0), t, u_hover);
  float lG = sample(uvA,                  t, u_hover);
  float lB = sample(uvA + vec2(-ca, 0.0), t, u_hover);

  /* ── Colour mapping — Geet palette ─────────────────────────── */
  /* Base: #0B3D2E bottle green                                */
  vec3 dark = vec3(0.043, 0.239, 0.180);   /* #0B3D2E          */
  /* Vein: #D4A017 deep gold — wax seal / gold foil            */
  vec3 gold = vec3(0.831, 0.627, 0.090);   /* #D4A017          */
  /* Teal accent for cursor glow only                          */
  vec3 teal = vec3(0.129, 0.502, 0.518);   /* #218085          */

  /* Each channel mapped independently → subtle colour shift   */
  vec3 col;
  /* Deeper contrast on hover — sharp darks, bright gold veins */
  float sharpness = mix(2.0, 1.1, u_hover);  /* lower exponent = more area lit */
  float boost     = mix(1.0, 2.4, u_hover);  /* veins flare brighter           */
  col.r = mix(dark.r * mix(0.45, 0.2, u_hover), gold.r, pow(lR, sharpness) * 0.32 * boost);
  col.g = mix(dark.g * mix(0.45, 0.2, u_hover), gold.g, pow(lG, sharpness) * 0.26 * boost);
  col.b = mix(dark.b * mix(0.45, 0.2, u_hover), gold.b, pow(lB, sharpness) * 0.20 * boost);

  /* ── Cursor proximity glow ─────────────────────────────────── */
  float mDist = length((uvF - u_mouse) * vec2(asp, 1.0));
  float glow  = u_hover * smoothstep(0.38, 0.0, mDist) * 0.12;
  col += teal * glow;

  /* ── Subtle vignette — darkens corners, focuses centre ─────── */
  float vig = smoothstep(0.0, 0.70, 1.0 - length((uvF - 0.5) * 1.32));
  col = col * (0.45 + 0.55 * vig);

  gl_FragColor = vec4(col, 1.0);
}
`

/* ── WebGL helpers ────────────────────────────────────────────── */
function mkShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}
function mkProgram(gl: WebGLRenderingContext) {
  const p = gl.createProgram()!
  gl.attachShader(p, mkShader(gl, gl.VERTEX_SHADER,   VERT))
  gl.attachShader(p, mkShader(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(p)
  return p
}

/* ── Component ───────────────────────────────────────────────── */
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const prog = mkProgram(gl)
    gl.useProgram(prog)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),
      gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uTime  = gl.getUniformLocation(prog, 'u_time')
    const uRes   = gl.getUniformLocation(prog, 'u_res')
    const uMouse = gl.getUniformLocation(prog, 'u_mouse')
    const uHover = gl.getUniformLocation(prog, 'u_hover')

    let mouse    = { x: 0.5, y: 0.5 }
    let hoverTgt = 0
    let hoverVal = 0
    let raf      = 0
    const t0     = performance.now()

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2)
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const section = canvas.parentElement!
    const onMove  = (e: MouseEvent) => {
      const r = section.getBoundingClientRect()
      mouse = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    }
    const onEnter = () => { hoverTgt = 1 }
    const onLeave = () => { hoverTgt = 0 }
    section.addEventListener('mousemove',  onMove,  { passive: true })
    section.addEventListener('mouseenter', onEnter, { passive: true })
    section.addEventListener('mouseleave', onLeave, { passive: true })

    const draw = () => {
      raf = requestAnimationFrame(draw)
      hoverVal += (hoverTgt - hoverVal) * 0.035
      const t = (performance.now() - t0) / 1000
      gl.uniform1f(uTime,  t)
      gl.uniform2f(uRes,   canvas.width, canvas.height)
      gl.uniform2f(uMouse, mouse.x, mouse.y)
      gl.uniform1f(uHover, hoverVal)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      section.removeEventListener('mousemove',  onMove)
      section.removeEventListener('mouseenter', onEnter)
      section.removeEventListener('mouseleave', onLeave)
      gl.deleteBuffer(quad)
      gl.deleteProgram(prog)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  )
}
