"use client";

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
uniform vec4 u_scene;
uniform vec4 u_shape;
uniform vec4 u_surface;
uniform vec4 u_finish;
uniform vec4 u_transform;
uniform vec4 u_space;
uniform vec4 u_cursor;

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#define u_seed u_transform.x
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_offset u_space.xy

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

vec3 mixColour(vec3 a, vec3 b, float t) {
  return mix(a, b, t);
}

vec3 palette(float x) {
  float count = max(u_colorCount - 1.0, 1.0);
  float scaled = clamp(x, 0.0, 1.0) * count;
  vec3 color = u_colors[0];
  for (int i = 0; i < 7; i++) {
    if (float(i) < count) {
      color = mixColour(
        color,
        u_colors[i + 1],
        smoothstep(0.0, 1.0, clamp(scaled - float(i), 0.0, 1.0))
      );
    }
  }
  return color;
}

vec3 shade(vec2 uv, vec2 p, float time) {
  float y = uv.y
    + sin(uv.x * (3.0 + u_intensity * 9.0) + time * 0.8) * 0.08
    + (fbm(p * 2.0 + time * 0.1) - 0.5) * u_intensity * 0.6;
  return palette(y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);

  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;

  if (abs(u_rotate) > 0.0001) {
    float cosine = cos(u_rotate);
    float sine = sin(u_rotate);
    p = mat2(cosine, -sine, sine, cosine) * p;
  }

  p += u_offset;
  p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  p += u_warp * (vec2(
    fbm(p * u_detail + u_seed),
    fbm(p * u_detail + vec2(5.2, 1.3))
  ) - 0.5);

  vec3 color;
  if (u_blur > 0.0) {
    float edge = u_blur;
    vec2 offset = vec2(edge) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
    color = shade(uv, p, u_time) * 0.36;
    color += shade(uv + vec2(offset.x, 0.0), p + vec2(edge, 0.0), u_time) * 0.16;
    color += shade(uv - vec2(offset.x, 0.0), p - vec2(edge, 0.0), u_time) * 0.16;
    color += shade(uv + vec2(0.0, offset.y), p + vec2(0.0, edge), u_time) * 0.16;
    color += shade(uv - vec2(0.0, offset.y), p - vec2(0.0, edge), u_time) * 0.16;
  } else {
    color = shade(uv, p, u_time);
  }

  if (abs(u_contrast - 1.0) > 0.0001) {
    color = (color - 0.5) * u_contrast + 0.5;
  }

  if (abs(u_saturation - 1.0) > 0.0001) {
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luminance), color, u_saturation);
  }

  color += u_brightness;

  if (u_vignette > 0.0001) {
    float distanceFromCenter = length(screenUv - 0.5) * 1.41421356;
    color *= 1.0 - u_vignette * smoothstep(0.35, 1.0, distanceFromCenter);
  }

  color += (grainHash(gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

const UNIFORMS = {
  colors: [
    [0.015, 0.015, 0.015],
    [0.08, 0.08, 0.08],
    [0.18, 0.18, 0.18],
    [0.32, 0.32, 0.32],
    [0.5, 0.5, 0.5],
    [0.7, 0.7, 0.7],
    [0.88, 0.88, 0.88],
    [1, 1, 1],
  ],
  colorCount: 8,
  scale: 1.85,
  intensity: 0.52,
  warp: 0.06,
  detail: 1.5,
  contrast: 1.08,
  brightness: 0.025,
  saturation: 0,
  vignette: 0.12,
  blur: 0.012,
  seed: 4012,
  rotate: 5.65,
  offsetX: 0.11,
  offsetY: -0.19,
  drift: 0.116,
  timeScale: -0.727,
};

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERT);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const scene = gl.getUniformLocation(program, "u_scene");
    const shape = gl.getUniformLocation(program, "u_shape");
    const surface = gl.getUniformLocation(program, "u_surface");
    const finish = gl.getUniformLocation(program, "u_finish");
    const transform = gl.getUniformLocation(program, "u_transform");
    const space = gl.getUniformLocation(program, "u_space");
    const colors = gl.getUniformLocation(program, "u_colors");

    gl.uniform3fv(colors, new Float32Array(UNIFORMS.colors.flat()));
    gl.uniform4f(shape, UNIFORMS.scale, UNIFORMS.intensity, 0, UNIFORMS.warp);
    gl.uniform4f(
      surface,
      UNIFORMS.detail,
      UNIFORMS.contrast,
      UNIFORMS.brightness,
      UNIFORMS.saturation,
    );
    gl.uniform4f(finish, 0, UNIFORMS.vignette, UNIFORMS.blur, 0.035);
    gl.uniform4f(transform, UNIFORMS.seed, UNIFORMS.rotate, UNIFORMS.drift, 0);
    gl.uniform4f(space, UNIFORMS.offsetX, UNIFORMS.offsetY, 0, 0);

    let frame = 0;
    let disposed = false;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now: number) => {
      if (disposed) return;
      resize();
      gl.uniform4f(
        scene,
        canvas.width,
        canvas.height,
        ((now - start) / 1000) * UNIFORMS.timeScale,
        UNIFORMS.colorCount,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = window.requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
