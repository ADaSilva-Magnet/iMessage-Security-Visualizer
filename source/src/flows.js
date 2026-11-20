// Glowing particle streams that show data moving between the devices and Apple's servers.
import * as THREE from 'three';
import { dotTexture } from './textures.js';

const tmp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3(), nrm = new THREE.Vector3(), toCam = new THREE.Vector3();
const col = new THREE.Color();

function bezier(p0, p1, p2, p3, u, out) {
  const v = 1 - u, w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u;
  return out.set(p0.x * w0 + p1.x * w1 + p2.x * w2 + p3.x * w3, p0.y * w0 + p1.y * w1 + p2.y * w2 + p3.y * w3, p0.z * w0 + p1.z * w1 + p2.z * w2 + p3.z * w3);
}

export class Flows {
  constructor(scene, anchors, curves, camera) {
    this.scene = scene; this.anchors = anchors; this.curves = curves; this.camera = camera;
    this.items = new Map(); this.tex = dotTexture();
  }
  key(s) { return s.key || `${s.from || s.via}>${s.to || ''}`; }
  set(specs) {
    const keys = new Set(specs.map((s) => this.key(s)));
    for (const [k, it] of this.items) if (!keys.has(k)) it.target = 0;
    for (const s of specs) {
      const k = this.key(s);
      let it = this.items.get(k);
      if (!it || it.n !== (s.count ?? 36)) {
        if (it) this.dispose(k, it);
        it = this.create(s); this.items.set(k, it);
      }
      it.spec = s; it.target = 1;
      it.mat.size = s.size ?? 0.13;
      col.set(s.color);
      const cols = it.geo.attributes.color.array;
      for (let i = 0; i < it.n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
      it.baseCol = col.clone();
    }
  }
  create(s) {
    const n = s.count ?? 36;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ map: this.tex, size: s.size ?? 0.13, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, vertexColors: true, toneMapped: false, sizeAttenuation: true });
    mat.color.setScalar(s.glow ?? 2.4);
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 15; this.scene.add(pts);
    const offs = Float32Array.from({ length: n }, (_, i) => i / n + (Math.random() - 0.5) * 0.6 / n);
    const jit = Float32Array.from({ length: n * 3 }, () => (Math.random() - 0.5));
    return { pts, geo, mat, n, offs, jit, a: 0, target: 1, phase: Math.random(), spec: s };
  }
  dispose(k, it) { this.scene.remove(it.pts); it.geo.dispose(); it.mat.dispose(); this.items.delete(k); }
  update(dt, stepTime, fade = 1) {
    const camPos = this.camera.position;
    for (const [k, it] of this.items) {
      it.a += (it.target - it.a) * (1 - Math.exp(-dt * 4));
      if (it.target === 0 && it.a < 0.01) { this.dispose(k, it); continue; }
      const s = it.spec;
      const speed = typeof s.speed === 'function' ? s.speed(stepTime) : (s.speed ?? 0.45);
      const alpha = typeof s.alpha === 'function' ? s.alpha(stepTime) : 1;
      it.phase += dt * speed;
      it.mat.opacity = it.a * alpha * fade;
      it.pts.visible = it.mat.opacity > 0.01;
      if (!it.pts.visible) continue;
      let curve = null;
      if (s.via) curve = this.curves[s.via];
      else {
        a.copy(this.anchors[s.from]());
        b.copy(this.anchors[s.to]());
        const lift = s.lift ?? (0.35 + a.distanceTo(b) * 0.25);
        nrm.set(...(s.normal || [0, 0.15, 1])).normalize();
        c1.copy(a).addScaledVector(nrm, lift); c2.copy(b).addScaledVector(nrm, lift);
      }
      const pos = it.geo.attributes.position.array, cols = it.geo.attributes.color.array;
      const spread = s.spread ?? 0.05;
      for (let i = 0; i < it.n; i++) {
        let u = (it.offs[i] + it.phase) % 1; if (u < 0) u += 1;
        const uu = s.reverse ? 1 - u : u;
        if (curve) curve.getPoint(uu, tmp); else bezier(a, c1, c2, b, uu, tmp);
        if (s.toCam) { toCam.copy(camPos).sub(tmp).normalize(); tmp.addScaledVector(toCam, s.toCam); }
        pos[i * 3] = tmp.x + it.jit[i * 3] * spread;
        pos[i * 3 + 1] = tmp.y + it.jit[i * 3 + 1] * spread;
        pos[i * 3 + 2] = tmp.z + it.jit[i * 3 + 2] * spread;
        const f = Math.sin(Math.PI * u);
        cols[i * 3] = it.baseCol.r * f; cols[i * 3 + 1] = it.baseCol.g * f; cols[i * 3 + 2] = it.baseCol.b * f;
      }
      it.geo.attributes.position.needsUpdate = true;
      it.geo.attributes.color.needsUpdate = true;
    }
  }
}
