import * as THREE from "three";

// A thin flame sheet wrapped round the sample: bright limb, clear centre, slow noise "breath",
// brighter at the upstream nose, fading toward an open downstream tail. uHole opens the sheet from the
// nose (blowoff starts as a hole at the stagnation region, report p.73). uSoot turns the downstream part
// from the design system's blue to the yellow-orange of a luminous, sooty flame (report p.48, Fig. 1.2).
// The look is illustrative.
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
    float wobble = fbm(position * 2.4 + vec3(-uTime * 0.6, uTime * 0.3, uTime * 0.2)) - 0.5;
    vec3 displaced = position + normal * wobble * 0.05 * smoothstep(0.0, 0.3, position.x);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uHole;
  uniform float uTail;
  uniform float uSoot;
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform vec3 uSootCore;
  uniform vec3 uSootRim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPos;
  ${NOISE}
  void main() {
    float ax = vPos.x; // 0 at the upstream nose, 1 at the downstream end
    if (ax < uHole) discard;
    vec3 nrm = dot(vNormal, vNormal) > 1e-8 ? normalize(vNormal) : vec3(0.0, 0.0, 1.0);
    float ndv = abs(dot(nrm, normalize(vView)));
    float rim = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.6); // clamped: a NaN here would spread through the bloom
    float n = fbm(vPos * 3.0 + vec3(-uTime * 0.7, uTime * 0.25, uTime * 0.2));
    float nose = 1.0 - smoothstep(0.0, 0.45, ax);
    float holeEdge = uHole > 0.0 ? 1.0 - smoothstep(uHole, uHole + 0.12, ax) : 0.0;
    float tail = 1.0 - uTail * smoothstep(0.45, 1.0, ax);
    // the leading edge stays blue; soot glows downstream of it (Fig. 1.2 a, c, d)
    float sootW = uSoot * smoothstep(0.18, 0.7, ax) * (1.0 - 0.6 * holeEdge);
    float body = 0.09 + 0.09 * n + 0.3 * nose + 0.5 * holeEdge + 0.16 * sootW;
    float alpha = (body + rim * (0.7 + 0.5 * n)) * uOpacity * tail;
    float k = clamp(rim + 0.5 * nose + holeEdge, 0.0, 1.0);
    vec3 blue = mix(uCore, uRim, k);
    vec3 yellow = mix(uSootCore, uSootRim, clamp(rim * 0.8 + 0.25 * n, 0.0, 1.0));
    vec3 color = mix(blue, yellow, sootW) * (0.8 + 0.5 * n);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createFlameMaterial(blue: { core: string; rim: string }, soot: { core: string; rim: string }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uHole: { value: 0 },
      uTail: { value: 1 },
      uSoot: { value: 0 },
      uCore: { value: new THREE.Color(blue.core) },
      uRim: { value: new THREE.Color(blue.rim) },
      uSootCore: { value: new THREE.Color(soot.core) },
      uSootRim: { value: new THREE.Color(soot.rim) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Unit flame sheet along +x: nose at x = 0, downstream end at x = 1, largest radius 1.
 * Open: a paraboloid cup (radius = sqrt(x)), like the flames wrapped round a rod tip in Fig. 6.3.
 * Closed: the cup closes again downstream, like the opposed-rod flame in Fig. 1.2(c).
 */
export function createFlameGeometry(closed: boolean): THREE.BufferGeometry {
  const AXIAL = 56;
  const AROUND = 72;
  const radius = (x: number) => Math.sqrt(x) * (closed ? Math.sqrt(Math.max(0, 1 - x * x * x)) : 1);
  let peak = 0;
  for (let i = 0; i <= 200; i++) peak = Math.max(peak, radius(i / 200));

  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= AXIAL; i++) {
    const s = i / AXIAL;
    const x = Math.min(s * s, 0.998); // denser rings near the nose, where the sheet curves most
    const r = radius(x) / peak;
    for (let j = 0; j <= AROUND; j++) {
      const th = (j / AROUND) * Math.PI * 2;
      positions.push(x, r * Math.cos(th), r * Math.sin(th));
    }
  }
  const ring = AROUND + 1;
  for (let i = 0; i < AXIAL; i++) {
    for (let j = 0; j < AROUND; j++) {
      const a = i * ring + j;
      const b = a + ring;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
