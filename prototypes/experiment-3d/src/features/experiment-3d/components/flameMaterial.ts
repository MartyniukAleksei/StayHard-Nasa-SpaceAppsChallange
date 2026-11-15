import * as THREE from "three";

// Тонка сферична оболонка полум'я: яскравий лімб (дивимось крізь більше газу на краю),
// прозорий центр, легке «дихання» шумом. Розмір задають дані; вигляд — художній.
const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    return 0.6 * noise(p) + 0.3 * noise(p * 2.1) + 0.1 * noise(p * 4.3);
  }
`;

const VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  ${NOISE}
  void main() {
    vPos = position;
    float wobble = fbm(position * 2.2 + vec3(0.0, uTime * 0.5, uTime * 0.3)) - 0.5;
    vec3 displaced = position + normal * wobble * 0.045;
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uCore;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  ${NOISE}
  void main() {
    float ndv = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - ndv, 3.2);
    float n = fbm(vPos * 3.0 + vec3(uTime * 0.35, -uTime * 0.5, uTime * 0.2));
    float body = 0.02 + 0.05 * n;
    float alpha = (body + rim * (0.55 + 0.45 * n)) * uOpacity;
    vec3 color = mix(uCore, uRim, smoothstep(0.0, 0.8, rim)) * (0.8 + 0.5 * n);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createFlameMaterial(core: string, rim: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uCore: { value: new THREE.Color(core) },
      uRim: { value: new THREE.Color(rim) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
