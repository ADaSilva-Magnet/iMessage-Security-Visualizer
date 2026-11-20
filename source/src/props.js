// Small animated 3D props used by the step-by-step scenes: keys, message bubble, key bits, cipher blocks,
// lock box, hash token, signature seal, package capsule, tags and tunnels. Every prop gets its own materials
// (transparent from the start) so each one can fade on its own.
import * as THREE from 'three';
import * as TX from './textures.js';

import { V } from './palette.js';
export { V };

let shared = null;
export function sharedTex() {
  if (shared) return shared;
  shared = {
    hexes: [11, 22, 33, 44].map((k) => TX.hexTexture(k)), stripe: TX.stripeTexture(), glow: TX.glowTexture(), seal: TX.sealTexture(),
    photo: TX.photoTexture(), scrambled: TX.scrambledTexture(), pointer: TX.pointerTexture(),
    check: TX.checkTexture(true), bubble: null, chips: {},
  };
  return shared;
}
export function chip(label, color) {
  const S = sharedTex(), k = label + color;
  return S.chips[k] || (S.chips[k] = TX.chipTexture(label, color));
}

const std = (o) => { const m = new THREE.MeshStandardMaterial({ transparent: true, ...o }); m.userData.base = m.opacity; return m; };
const basic = (o) => { const m = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, ...o }); m.userData.base = m.opacity; return m; };
export const glowMat = (hex, k = 1.6) => basic({ color: new THREE.Color(hex).multiplyScalar(k) });
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = false; parent.add(m); return m;
}
export function sprite(map, h, { color = 0xffffff, depthTest = true, aspect } = {}) {
  const mat = new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, depthTest, toneMapped: false });
  mat.userData.base = 1;
  const s = new THREE.Sprite(mat);
  const a = aspect ?? map.userData?.aspect ?? (map.image ? map.image.width / map.image.height : 1);
  s.scale.set(h * a, h, 1); s.renderOrder = 30;
  return s;
}

// ---------------------------------------------------------------- rounded shapes
export function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
// rounded-rectangle slab centred on the origin (w x h, d deep, front face toward +z)
export function slab(w, h, d, r, bevel = 0.02, curve = 10) {
  const b = Math.min(bevel, d / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, r - b), { depth: Math.max(1e-4, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: curve });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
// flat rounded rectangle with 0..1 UVs (screens, cards)
export function face(w, h, r) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), 16);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

// ---------------------------------------------------------------- key
// Points along +x (bow at -x, teeth at +x). Public keys glow; private keys are solid metal with a lock badge.
export function keyProp(hex, priv = false, s = 1) {
  const g = new THREE.Group();
  const k = new THREE.Group(); g.add(k);          // inner group: twist about the shaft (x) without changing the heading
  const c = new THREE.Color(hex);
  const mat = priv
    ? std({ color: c.clone().multiplyScalar(0.62), metalness: 0.85, roughness: 0.3, emissive: c, emissiveIntensity: 0.35 })
    : std({ color: 0x0b0f16, metalness: 0.3, roughness: 0.35, emissive: c, emissiveIntensity: 1.35 });
  add(k, new THREE.TorusGeometry(0.17 * s, 0.055 * s, 12, 32), mat, -0.29 * s, 0, 0);
  add(k, new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.6 * s, 12).rotateZ(Math.PI / 2), mat, 0.12 * s, 0, 0);
  add(k, new THREE.BoxGeometry(0.06 * s, 0.17 * s, 0.07 * s), mat, 0.33 * s, -0.08 * s, 0);
  add(k, new THREE.BoxGeometry(0.06 * s, 0.12 * s, 0.07 * s), mat, 0.2 * s, -0.06 * s, 0);
  if (priv) {
    const lm = std({ color: 0x0b0f16, metalness: 0.4, roughness: 0.4, emissive: c, emissiveIntensity: 0.7 });
    add(k, new THREE.BoxGeometry(0.15 * s, 0.11 * s, 0.07 * s), lm, -0.29 * s, -0.025 * s, 0);
    add(k, new THREE.TorusGeometry(0.045 * s, 0.014 * s, 8, 16, Math.PI), lm, -0.29 * s, 0.03 * s, 0);
  } else {
    const halo = sprite(sharedTex().glow, 0.75 * s, { color: c.clone().multiplyScalar(0.4) });
    halo.material.blending = THREE.AdditiveBlending; halo.position.set(-0.05 * s, 0, -0.05); halo.renderOrder = 4; g.add(halo);
  }
  g.userData.inner = k; g.userData.kind = 'key';
  return g;
}

// ---------------------------------------------------------------- key bits (16 cells = 128-bit, 32 = 256-bit)
export function cellsProp(n, size, tailCount = 0, tailHex = 0xffffff, headHex = 0xdbeafe) {
  const g = new THREE.Group(); g.userData.cells = [];
  const pitch = size * 1.12, x0 = -((n - 1) * pitch) / 2;
  const geo = new THREE.BoxGeometry(size, size, size);
  for (let j = 0; j < n; j++) {
    const tail = j >= n - tailCount;
    const m = std({ color: 0x0b0f16, metalness: 0.2, roughness: 0.4, emissive: new THREE.Color(tail ? tailHex : headHex), emissiveIntensity: 0.8 });
    const cell = add(g, geo, m, x0 + j * pitch, 0, 0);
    cell.userData.home = cell.position.clone();
    g.userData.cells.push(cell);
  }
  g.userData.pitch = pitch; g.userData.len = n * pitch;
  return g;
}

// ---------------------------------------------------------------- message bubble ("See you at 6?")
function bubbleShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r - 0.05, y);
  s.quadraticCurveTo(x + w + 0.02, y - 0.06, x + w + 0.1, y - 0.07);       // tail
  s.quadraticCurveTo(x + w - 0.01, y + 0.03, x + w, y + r * 0.8);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export function bubbleProp(text, hex = 0x1d8cf8) {
  const g = new THREE.Group();
  const S = sharedTex();
  if (!S.bubble) S.bubble = TX.bubbleTextTexture(text);
  const w = 1.6, h = 0.5;
  const geo = new THREE.ExtrudeGeometry(bubbleShape(w, h, 0.22), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 12 });
  geo.translate(0, 0, -0.03);
  add(g, geo, std({ color: hex, metalness: 0.15, roughness: 0.35, emissive: new THREE.Color(hex), emissiveIntensity: 0.45 }));
  const t = add(g, new THREE.PlaneGeometry(1.6, 0.5), basic({ map: S.bubble }), 0, 0, 0.062);
  t.renderOrder = 6;
  return g;
}

// ---------------------------------------------------------------- encrypted text block
export function cipherProp(hex, w = 1.05, h = 0.5, idx = 3) {
  const g = new THREE.Group();
  const S = sharedTex();
  add(g, slab(w, h, 0.16, 0.08, 0.02), std({ color: 0x0a1222, metalness: 0.5, roughness: 0.4 }));
  const c = new THREE.Color(hex);
  const front = add(g, new THREE.PlaneGeometry(w - 0.08, h - 0.08), basic({ map: S.hexes[idx] || S.hexes[3], color: c.clone().multiplyScalar(1.15) }), 0, 0, 0.082);
  front.renderOrder = 6;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.01, h + 0.01, 0.17)), new THREE.LineBasicMaterial({ color: c.clone().multiplyScalar(1.6), transparent: true, toneMapped: false }));
  edge.material.userData.base = 1; g.add(edge);
  return g;
}

// ---------------------------------------------------------------- processing ring (HMAC-SHA-256, AES-CTR, SHA-1)
export function ringProp(label, hex, r = 0.36) {
  const g = new THREE.Group();
  const spin = new THREE.Group(); g.add(spin);
  add(spin, new THREE.TorusGeometry(r, 0.028, 10, 48), glowMat(hex, 1.2));
  add(spin, new THREE.TorusGeometry(r * 0.78, 0.011, 8, 48, Math.PI * 1.6), glowMat(hex, 0.8));
  const s = sprite(chip(label, '#' + new THREE.Color(hex).getHexString()), 0.14);
  s.position.set(0, r + 0.2, 0); g.add(s);
  g.userData.spin = spin;
  return g;
}

// ---------------------------------------------------------------- lock box for the message key
export function lockProp(hex) {
  const g = new THREE.Group();
  const c = new THREE.Color(hex);
  const body = std({ color: 0x1b2230, metalness: 0.75, roughness: 0.32 });
  add(g, slab(0.66, 0.4, 0.34, 0.05, 0.02), body, 0, -0.03, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.17, -0.17); g.add(lid);
  add(lid, slab(0.68, 0.08, 0.36, 0.03, 0.015), body, 0, 0.04, 0.18);
  const glow = std({ color: 0x0b0f16, metalness: 0.3, roughness: 0.4, emissive: c, emissiveIntensity: 0.25 });
  add(g, new THREE.BoxGeometry(0.62, 0.03, 0.005), glow, 0, 0.08, 0.172);
  const pad = new THREE.Group(); pad.position.set(0, -0.06, 0.19); g.add(pad);
  add(pad, slab(0.2, 0.16, 0.06, 0.03, 0.01), glow);
  const shackle = add(pad, new THREE.TorusGeometry(0.06, 0.018, 8, 20, Math.PI), glow, 0, 0.08, 0);
  g.userData = { lid, glow, shackle };
  return g;
}

// ---------------------------------------------------------------- SHA-1 hash token and ECDSA seal
export function tokenProp(label = 'SHA-1') {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.24, 0.24, 0.07, 6).rotateX(Math.PI / 2), std({ color: 0x0b0f16, metalness: 0.3, roughness: 0.4, emissive: 0x22d3ee, emissiveIntensity: 0.75 }));
  const s = sprite(chip(label, '#67e8f9'), 0.17); s.position.set(0, 0, 0.1); g.add(s);
  return g;
}
export function sealProp() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.25, 0.25, 0.06, 40).rotateX(Math.PI / 2), std({ color: 0xb7791f, metalness: 0.9, roughness: 0.3, emissive: 0x7a4a00, emissiveIntensity: 0.4 }));
  const f = add(g, new THREE.CircleGeometry(0.245, 40), basic({ map: sharedTex().seal }), 0, 0, 0.032);
  f.renderOrder = 6;
  return g;
}

// ---------------------------------------------------------------- tags (APNs address / metadata)
export function tagProp(map, h = 0.32) {
  const s = sprite(map, h); s.renderOrder = 31; return s;
}

// ---------------------------------------------------------------- the package: encrypted text + encrypted key + signature
export function capsuleProp(hex, len = 2.6, r = 0.46) {
  const g = new THREE.Group();
  const c = new THREE.Color(hex);
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 10, 28).rotateZ(Math.PI / 2),
    std({ color: 0x9cc8ff, metalness: 0.1, roughness: 0.08, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  shell.material.userData.noDepth = true; shell.renderOrder = 8; g.add(shell);
  const bands = [];
  [-1, 1].forEach((sx) => { bands.push(add(g, new THREE.TorusGeometry(r * 1.005, 0.022, 8, 40).rotateY(Math.PI / 2), glowMat(c, 1.6), sx * (len / 2 - r * 0.9), 0, 0)); });
  g.userData = { shell, bands, len, r };
  return g;
}
export function packageProp(hex, tagMap, { len = 2.6, idx = 3 } = {}) {
  const g = capsuleProp(hex, len);
  const inner = new THREE.Group(); g.add(inner);
  const lock = lockProp(hex); lock.position.set(-0.89, 0, 0); lock.userData.glow.emissiveIntensity = 2.2; inner.add(lock);
  lock.userData.lid.rotation.x = 0;
  const ci = cipherProp(hex, undefined, undefined, idx); ci.position.set(0.11, 0, 0); inner.add(ci);
  const se = sealProp(); se.position.set(0.96, 0, 0.02); inner.add(se);
  g.userData.inner = inner; g.userData.parts = { lock, cipher: ci, seal: se };
  if (tagMap) { const t = tagProp(tagMap, 0.3); t.position.set(len / 2 + 0.4, 0.3, 0); g.add(t); g.userData.tag = t; }
  return g;
}

// ---------------------------------------------------------------- photo / encrypted photo / attachment details card
export function tileProp(w = 1.2, h = 0.84) {
  const g = new THREE.Group(), S = sharedTex();
  add(g, slab(w + 0.08, h + 0.08, 0.06, 0.05, 0.015), std({ color: 0xe8eef7, metalness: 0.1, roughness: 0.5 }));
  const photo = add(g, new THREE.PlaneGeometry(w, h), basic({ map: S.photo }), 0, 0, 0.033);
  const enc = add(g, new THREE.PlaneGeometry(w, h), basic({ map: S.scrambled }), 0, 0, 0.034);
  photo.renderOrder = 6; enc.renderOrder = 7;
  g.userData = { photo, enc };
  return g;
}
export function cardProp(w = 1.25) {
  const g = new THREE.Group();
  const p = add(g, new THREE.PlaneGeometry(w, w * 0.625), basic({ map: sharedTex().pointer }));
  p.renderOrder = 6;
  return g;
}

// ---------------------------------------------------------------- a request "ping" orb
export function orbProp(hex) {
  const g = new THREE.Group();
  add(g, new THREE.SphereGeometry(0.14, 24, 12), glowMat(hex, 2.2));
  const h = sprite(sharedTex().glow, 0.8, { color: new THREE.Color(hex).multiplyScalar(0.8) }); h.material.blending = THREE.AdditiveBlending; g.add(h);
  return g;
}

// ---------------------------------------------------------------- glowing tunnel along a curve (forward-secret TLS)
export function tunnelProp(curve, hex, r = 0.3, geoCache = null) {
  const S = sharedTex();
  const geo = geoCache || new THREE.TubeGeometry(curve, 140, r, 18, false);
  const map = S.stripe.clone(); map.needsUpdate = true;
  map.repeat.set(Math.max(2, Math.round(curve.getLength() / 3.2)), 1);
  const m = new THREE.Mesh(geo, basic({ map, color: new THREE.Color(hex).multiplyScalar(0.8), opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.material.userData.noDepth = true; m.renderOrder = 9;
  const shell = new THREE.Mesh(geo, basic({ color: new THREE.Color(hex).multiplyScalar(0.35), opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  shell.material.userData.noDepth = true; shell.renderOrder = 9; shell.scale.setScalar(1.0); m.add(shell);
  m.userData.map = map;
  return m;
}

export function checkProp(h = 0.42) { const s = sprite(sharedTex().check, h, { depthTest: false }); s.renderOrder = 40; return s; }
