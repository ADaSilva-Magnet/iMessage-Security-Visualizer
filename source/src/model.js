// The stage: the sender's iPhone (left), the recipient's iPhone, iPad and Mac (right) and Apple's servers
// (IDS, APNs, iCloud) floating at the back. Units are arbitrary (an iPhone is about 3.3 tall).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { slab, face, sprite, chip, sharedTex } from './props.js';
import { V, COLORS, DEV_COLORS, POS } from './palette.js';
import { buildRigs } from './rigs.js';
import { clamp, lerp } from './util.js';

export { COLORS, DEV_COLORS, POS };
const PED_H = 0.3;

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.03, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
const cyl = (rt, rb, h, s = 32) => new THREE.CylinderGeometry(rt, rb, h, s);

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}
const glow = (hex, k = 1.8) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

function materials() {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  return {
    floor: S({ map: TX.floorTexture(), roughness: 0.62, metalness: 0.25 }),
    ped: S({ color: 0x161c26, roughness: 0.38, metalness: 0.7 }),
    pedTop: S({ color: 0x1c2430, roughness: 0.5, metalness: 0.45 }),
    titanium: S({ color: 0x3a414c, roughness: 0.3, metalness: 0.88 }),
    titaniumDark: S({ color: 0x23282f, roughness: 0.34, metalness: 0.85 }),
    alu: S({ color: 0xb9c1cb, roughness: 0.3, metalness: 0.9 }),
    gun: S({ color: 0x252c37, roughness: 0.32, metalness: 0.85 }),
    glassBlack: S({ color: 0x040507, roughness: 0.08, metalness: 0.3 }),
    lens: S({ color: 0x07090c, roughness: 0.1, metalness: 0.6 }),
    stand: S({ color: 0x2a313c, roughness: 0.35, metalness: 0.8 }),
    trim: S({ color: 0x07090d, roughness: 0.45, metalness: 0.3 }),
  };
}

// ---------------------------------------------------------------- brackets that frame the part being discussed
function makeBrackets(size, color) {
  const sx0 = size.x + 0.16, sy0 = size.y + 0.16, sz0 = size.z + 0.16;
  const L = Math.min(sx0, sy0, Math.max(sz0, 0.6)) * 0.28 + 0.1, t = 0.025;
  const geos = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * sx0 / 2, cy = sy * sy0 / 2, cz = sz * sz0 / 2;
    const gx = new THREE.BoxGeometry(L, t, t); gx.translate(cx - sx * L / 2, cy, cz); geos.push(gx);
    const gy = new THREE.BoxGeometry(t, L, t); gy.translate(cx, cy - sy * L / 2, cz); geos.push(gy);
    const gz = new THREE.BoxGeometry(t, t, Math.min(L, sz0 * 0.45)); gz.translate(cx, cy, cz - sz * Math.min(L, sz0 * 0.45) / 2); geos.push(gz);
  }
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  m.renderOrder = 20; m.visible = false; m.castShadow = false;
  return m;
}
function addFocus(W, key, parent, b3, color) {
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  b3.getSize(size); b3.getCenter(center);
  const br = makeBrackets(size, color);
  br.position.copy(center); parent.add(br);
  W.focus[key] = { mesh: br, a: 0 };
}

// ---------------------------------------------------------------- devices
function phoneModel(M, screenTex) {
  const g = new THREE.Group();
  const w = 1.62, h = 3.34, d = 0.17, r = 0.27;
  mesh(slab(w, h, d, r, 0.045, 14), M.titanium, 0, 0, 0, g);
  mesh(face(w - 0.05, h - 0.05, r - 0.03), M.glassBlack, 0, 0, d / 2 + 0.002, g, { cast: false });
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }); scrMat.color.setScalar(0.92);
  const scr = mesh(face(w - 0.15, h - 0.15, r - 0.08), scrMat, 0, 0, d / 2 + 0.005, g, { cast: false, receive: false });
  const cam = new THREE.Group(); cam.position.set(-w / 2 + 0.43, h / 2 - 0.43, -d / 2 - 0.02); g.add(cam);
  mesh(slab(0.68, 0.68, 0.05, 0.17, 0.015), M.titaniumDark, 0, 0, 0, cam);
  [[-0.15, 0.15], [-0.15, -0.15], [0.15, 0]].forEach(([x, y]) => mesh(cyl(0.11, 0.11, 0.05, 28).rotateX(Math.PI / 2), M.lens, x, y, -0.03, cam));
  mesh(rbox(0.04, 0.46, 0.07, 0.02), M.titanium, w / 2 + 0.01, 0.6, 0, g);
  mesh(rbox(0.04, 0.3, 0.07, 0.02), M.titanium, -w / 2 - 0.01, 0.75, 0, g);
  mesh(rbox(0.04, 0.3, 0.07, 0.02), M.titanium, -w / 2 - 0.01, 0.35, 0, g);
  return { g, scr, scrMat, w, h, d };
}
function padModel(M, screenTex) {
  const g = new THREE.Group();
  const w = 3.1, h = 2.16, d = 0.1, r = 0.2;
  mesh(slab(w, h, d, r, 0.03, 12), M.titanium, 0, 0, 0, g);
  mesh(face(w - 0.04, h - 0.04, r - 0.02), M.glassBlack, 0, 0, d / 2 + 0.002, g, { cast: false });
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }); scrMat.color.setScalar(0.92);
  const scr = mesh(face(w - 0.2, h - 0.2, 0.08), scrMat, 0, 0, d / 2 + 0.005, g, { cast: false, receive: false });
  mesh(slab(0.5, 0.5, 0.04, 0.12, 0.012), M.titaniumDark, -w / 2 + 0.38, h / 2 - 0.38, -d / 2 - 0.012, g);
  return { g, scr, scrMat, w, h, d };
}
function macModel(M, screenTex) {
  const g = new THREE.Group();
  const w = 3.3, dep = 2.25;
  const base = mesh(slab(w, dep, 0.1, 0.13, 0.03), M.alu, 0, 0.05, 0, g); base.rotation.x = -Math.PI / 2;
  const deck = mesh(new THREE.PlaneGeometry(w - 0.16, dep - 0.16), new THREE.MeshStandardMaterial({ map: TX.keyboardTexture(), roughness: 0.5, metalness: 0.5 }), 0, 0.101, 0, g, { cast: false });
  deck.rotation.x = -Math.PI / 2;
  const lid = new THREE.Group(); lid.position.set(0, 0.1, -dep / 2 + 0.03); lid.rotation.x = -0.26; g.add(lid);
  const lh = 2.18;
  mesh(slab(w, lh, 0.06, 0.13, 0.02), M.alu, 0, lh / 2, -0.03, lid);
  mesh(face(w - 0.05, lh - 0.05, 0.11), M.glassBlack, 0, lh / 2, 0.002, lid, { cast: false });
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }); scrMat.color.setScalar(0.92);
  const scr = mesh(face(3.08, 1.925, 0.05), scrMat, 0, lh / 2 + 0.05, 0.005, lid, { cast: false, receive: false });
  return { g, scr, scrMat, lid, w, h: lh };
}

// A small stand the iPhone/iPad leans on; tilt: radians back from vertical.
function standFor(M, parent, w, h, tilt) {
  const s = new THREE.Group(); parent.add(s);
  mesh(rbox(w * 0.7, 0.07, 0.9, 0.03), M.stand, 0, 0.035, 0.05, s);
  mesh(rbox(w * 0.7, 0.1, 0.12, 0.03), M.stand, 0, 0.1, 0.34, s);
  const back = mesh(rbox(w * 0.42, h * 0.55, 0.07, 0.03), M.stand, 0, 0.07 + h * 0.27 * Math.cos(tilt), 0.1 - h * 0.27 * Math.sin(tilt) - 0.12, s);
  back.rotation.x = -tilt;
  return s;
}

function buildFloor(W) {
  const { M, scene } = W;
  const f = mesh(new THREE.CircleGeometry(20, 128), M.floor, 0, 0, -1.5, scene, { cast: false });
  f.rotation.x = -Math.PI / 2;
  // light pools under the two pedestals
  const S = sharedTex();
  [[POS.alex, COLORS.send, 6.5], [POS.riley, 0x7dd3fc, 9.0]].forEach(([p, col, s]) => {
    const m = mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: S.glow, color: new THREE.Color(col).multiplyScalar(0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), p.x, 0.012, p.z, scene, { cast: false, receive: false });
    m.rotation.x = -Math.PI / 2;
  });
}

function pedestal(W, p, r, hex) {
  const { M, scene } = W;
  const g = new THREE.Group(); g.position.copy(p); scene.add(g);
  mesh(cyl(r, r + 0.12, PED_H, 72), M.ped, 0, PED_H / 2, 0, g);
  mesh(cyl(r - 0.05, r - 0.05, 0.02, 72), M.pedTop, 0, PED_H + 0.005, 0, g, { cast: false });
  mesh(new THREE.TorusGeometry(r + 0.02, 0.03, 8, 120).rotateX(Math.PI / 2), glow(hex, 1.6), 0, PED_H - 0.01, 0, g, { cast: false, receive: false });
  return g;
}

function nameplate(W, p, title, sub, hex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: TX.signTexture(title, sub, '#' + new THREE.Color(hex).getHexString()), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }));
  m.position.copy(p); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; W.scene.add(m);
  return m;
}

function buildAlex(W, tex) {
  const { M } = W;
  const ped = pedestal(W, POS.alex, 2.1, COLORS.send);
  const holder = new THREE.Group(); holder.position.set(0, PED_H, 0.1); holder.rotation.y = 0.34; ped.add(holder);
  const ph = phoneModel(M, tex); holder.add(ph.g);
  const tilt = 0.13;
  ph.g.rotation.x = -tilt; ph.g.position.set(0, 0.12 + (ph.h / 2) * Math.cos(tilt), 0.15);
  standFor(M, holder, ph.w, ph.h, tilt);
  W.parts.alex = ph; W.parts.alexHolder = holder;
  nameplate(W, V(POS.alex.x, 0.02, POS.alex.z + 2.75), 'Alex', 'SENDER', COLORS.send);
  addFocus(W, 'alex', ph.g, new THREE.Box3(V(-ph.w / 2, -ph.h / 2, -0.12), V(ph.w / 2, ph.h / 2, 0.12)), COLORS.send);
}

function buildRiley(W, tex) {
  const { M } = W;
  const ped = pedestal(W, POS.riley, 3.2, 0x7dd3fc);
  // iPhone (front-left), iPad (middle), Mac (right-back)
  const h1 = new THREE.Group(); h1.position.set(-1.95, PED_H, 1.2); h1.rotation.y = -0.36; ped.add(h1);
  const ph = phoneModel(M, tex.rPhone); h1.add(ph.g);
  const tilt = 0.13; ph.g.rotation.x = -tilt; ph.g.position.set(0, 0.12 + (ph.h / 2) * Math.cos(tilt), 0.15);
  standFor(M, h1, ph.w, ph.h, tilt);
  const h2 = new THREE.Group(); h2.position.set(0.3, PED_H, 0.25); h2.rotation.y = -0.3; ped.add(h2);
  const pd = padModel(M, tex.rPad); h2.add(pd.g);
  const t2 = 0.2; pd.g.rotation.x = -t2; pd.g.position.set(0, 0.14 + (pd.h / 2) * Math.cos(t2), 0.2);
  standFor(M, h2, pd.w * 0.8, pd.h, t2);
  const h3 = new THREE.Group(); h3.position.set(2.05, PED_H, -0.95); h3.rotation.y = -0.55; ped.add(h3);
  const mc = macModel(M, tex.rMac); h3.add(mc.g);
  W.parts.rPhone = ph; W.parts.rPad = pd; W.parts.rMac = mc; W.parts.rDevices = [ph, pd, mc];
  nameplate(W, V(POS.riley.x - 0.4, 0.02, POS.riley.z + 4.1), 'Riley', 'RECIPIENT · 3 DEVICES', 0x7dd3fc);
  addFocus(W, 'rPhone', ph.g, new THREE.Box3(V(-ph.w / 2, -ph.h / 2, -0.12), V(ph.w / 2, ph.h / 2, 0.12)), COLORS.phone);
  addFocus(W, 'rPad', pd.g, new THREE.Box3(V(-pd.w / 2, -pd.h / 2, -0.1), V(pd.w / 2, pd.h / 2, 0.1)), COLORS.pad);
  addFocus(W, 'rMac', mc.g, new THREE.Box3(V(-mc.w / 2, 0, -1.4), V(mc.w / 2, 2.3, 1.15)), COLORS.mac);
  // offline / online badge over the Mac
  const off = sprite(chip('Offline', '#94a3b8'), 0.36); off.position.set(0, 2.85, -0.5); mc.g.add(off);
  const on = sprite(chip('Online', '#4ade80'), 0.36); on.position.set(0, 2.85, -0.5); mc.g.add(on);
  W.parts.macBadges = [off, on];
  // "new device" alert badges over the iPhone and iPad
  W.parts.alerts = [ph, pd].map((d) => { const s = sprite(chip('New device added', '#fbbf24'), 0.3); s.position.set(0, d.h / 2 + 0.38, 0.1); d.g.add(s); return s; });
}

// ---------------------------------------------------------------- Apple services
function buildIDS(W) {
  const { M, scene } = W;
  const g = new THREE.Group(); g.position.copy(POS.ids); scene.add(g);
  mesh(cyl(1.85, 1.98, 0.24, 72), M.gun, 0, 0.12, 0, g);
  const ring = glow(COLORS.ids, 2.0);
  mesh(new THREE.TorusGeometry(1.87, 0.035, 8, 120).rotateX(Math.PI / 2), ring, 0, 0.25, 0, g, { cast: false });
  mesh(cyl(0.3, 0.3, 2.75, 24), M.gun, 0, 1.6, 0, g);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ddcff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(1.63, 1.63, 2.72, 72, 1, true), glass, 0, 1.6, 0, g, { cast: false, receive: false }).renderOrder = 5;
  mesh(cyl(1.85, 1.85, 0.2, 72), M.gun, 0, 3.05, 0, g);
  mesh(new THREE.TorusGeometry(1.87, 0.035, 8, 120).rotateX(Math.PI / 2), ring, 0, 2.94, 0, g, { cast: false });
  // the directory: record cards on a carousel (2 tiers x 7)
  const car = new THREE.Group(); car.position.y = 0.25; g.add(car);
  const blank = TX.blankRecordTexture();
  const recs = [
    { tier: 0, slot: 0, t: TX.recordTexture('Alex', '+1 (212) 555-0142', 'iPhone', '#3aa0ff') },
    { tier: 1, slot: 0, t: TX.recordTexture('Riley', '+1 (212) 555-0188', 'iPhone', '#4ade80') },
    { tier: 1, slot: 1, t: TX.recordTexture('Riley', 'riley@example.com', 'iPad', '#a78bfa') },
    { tier: 1, slot: 6, t: TX.recordTexture('Riley', 'riley@example.com', 'Mac', '#fb923c') },
  ];
  W.parts.idsCards = [];
  for (let tier = 0; tier < 2; tier++) for (let s = 0; s < 7; s++) {
    const a = (s / 7) * Math.PI * 2;
    const holder = new THREE.Group(); holder.rotation.y = a; car.add(holder);
    const rec = recs.findIndex((r) => r.tier === tier && r.slot === s);
    const mat = new THREE.MeshBasicMaterial({ map: rec >= 0 ? recs[rec].t : blank, transparent: true, toneMapped: false, opacity: rec >= 0 ? 0 : 0.55, depthWrite: false });
    mat.color.setScalar(rec >= 0 ? 1.05 : 0.8);
    const card = mesh(new THREE.PlaneGeometry(0.92, 0.575), mat, 0, 0.95 + tier * 0.95, 1.12, holder, { cast: false, receive: false });
    card.renderOrder = 6;
    if (rec >= 0) W.parts.idsCards[rec] = card;
  }
  W.parts.idsCar = car; W.idsAngle = 0;
  const sign = mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: TX.signTexture('IDS', 'Apple Identity Service', '#22d3ee'), transparent: true, depthWrite: false, toneMapped: false }), 0, 3.75, 0.2, g, { cast: false, receive: false });
  sign.renderOrder = 7;
  W.parts.ids = g;
  addFocus(W, 'ids', g, new THREE.Box3(V(-1.95, 0, -1.95), V(1.95, 3.2, 1.95)), COLORS.ids);
}

function buildAPNs(W) {
  const { M, scene } = W;
  const g = new THREE.Group(); g.position.copy(POS.apns); scene.add(g);
  mesh(new THREE.TorusGeometry(1.72, 0.17, 24, 120), M.gun, 0, 0, 0, g);
  mesh(new THREE.TorusGeometry(1.5, 0.045, 12, 120), glow(COLORS.apns, 1.7), 0, 0, 0, g, { cast: false });
  const core = mesh(new THREE.SphereGeometry(0.34, 32, 16), glow(COLORS.apns, 2.2), 0, 0, 0, g, { cast: false });
  const halo = sprite(sharedTex().glow, 2.4, { color: new THREE.Color(COLORS.apns).multiplyScalar(0.5) });
  halo.material.blending = THREE.AdditiveBlending; halo.renderOrder = 3; g.add(halo);
  const orbits = [0.62, 0.86].map((r, i) => { const o = mesh(new THREE.TorusGeometry(r, 0.016, 8, 72), glow(COLORS.apns, 1.3), 0, 0, 0, g, { cast: false }); o.rotation.set(i ? 1.1 : 0.4, i ? 0.3 : 1.0, 0); return o; });
  for (let i = 0; i < 4; i++) { const sp = mesh(cyl(0.025, 0.025, 1.05, 8), M.gun, 0, 0, 0, g); const a = (i / 4) * Math.PI * 2 + Math.PI / 4; sp.position.set(Math.cos(a) * 1.0, Math.sin(a) * 1.0, -0.05); sp.rotation.z = a - Math.PI / 2; }
  // dock underneath with three queue pads
  const dock = new THREE.Group(); dock.position.set(0, -2.35, 0.2); g.add(dock);
  mesh(rbox(3.6, 0.16, 1.5, 0.06), M.gun, 0, 0, 0, dock);
  mesh(box(3.5, 0.025, 0.02), glow(COLORS.apns, 1.3), 0, 0.03, 0.75, dock, { cast: false });
  W.parts.queuePads = [-1.15, 0, 1.15].map((x) => { const m = mesh(new THREE.RingGeometry(0.3, 0.36, 40).rotateX(-Math.PI / 2), glow(COLORS.apns, 0.9), x, 0.085, 0.1, dock, { cast: false }); return m; });
  mesh(cyl(0.1, 0.12, 0.62, 16), M.gun, 0, -2.0, 0.0, g);
  const sign = mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: TX.signTexture('APNs', 'Apple Push Notification service', '#f472b6'), transparent: true, depthWrite: false, toneMapped: false }), 0, 2.45, 0.1, g, { cast: false, receive: false });
  sign.renderOrder = 7;
  W.parts.apns = g; W.parts.apnsCore = core; W.parts.apnsOrbits = orbits; W.parts.apnsHalo = halo; W.parts.apnsDock = dock;
  addFocus(W, 'apns', g, new THREE.Box3(V(-1.95, -2.5, -0.4), V(1.95, 1.95, 0.4)), COLORS.apns);
}

function buildCloud(W) {
  const { scene } = W;
  const g = new THREE.Group(); g.position.copy(POS.cloud); scene.add(g);
  const parts = [[-1.3, -0.18, 0, 0.78], [-0.52, 0.28, 0.05, 1.0], [0.5, 0.42, 0, 1.06], [1.36, -0.04, 0, 0.8], [0.1, -0.32, 0.12, 0.86], [-0.92, -0.38, 0.06, 0.7], [0.9, -0.38, 0.06, 0.72]];
  const geo = mergeGeometries(parts.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 40, 24).translate(x, y, z)));
  geo.scale(1, 1, 0.58);
  mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8295b6, roughness: 0.85, metalness: 0.0, emissive: 0x1f3561, emissiveIntensity: 0.4 }), 0, 0, 0, g, { cast: true, receive: false });
  // storage bay on the front where the encrypted attachment sits
  const bay = new THREE.Group(); bay.position.set(0.05, -0.3, 0.68); g.add(bay);
  mesh(slab(1.5, 0.84, 0.12, 0.12, 0.03), W.M.trim, 0, 0, 0, bay, { cast: false });
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 0.84)), new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.cloud).multiplyScalar(1.6), toneMapped: false }));
  frame.position.z = 0.065; bay.add(frame);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.62), new THREE.MeshBasicMaterial({ map: sharedTex().scrambled, transparent: true, opacity: 0, toneMapped: false }));
  blob.position.z = 0.066; blob.renderOrder = 6; bay.add(blob);
  const lock = sprite(chip('encrypted', '#7dd3fc'), 0.2); lock.position.set(0, -0.56, 0.12); bay.add(lock);
  W.parts.cloudBlob = [blob, lock];
  const sign = mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: TX.signTexture('iCloud', 'Encrypted attachments', '#7dd3fc'), transparent: true, depthWrite: false, toneMapped: false }), 0, 1.75, 0.2, g, { cast: false, receive: false });
  sign.renderOrder = 7;
  W.parts.cloud = g; W.parts.cloudBay = bay;
  addFocus(W, 'cloud', g, new THREE.Box3(V(-2.2, -1.05, -0.7), V(2.3, 1.55, 0.85)), COLORS.cloud);
}

// ---------------------------------------------------------------- anchors and flight paths
function buildPaths(W) {
  const P = W.parts, wp = (o, v) => o.localToWorld(v.clone());
  W.scene.updateMatrixWorld(true);
  const A = W.anchors;
  const alexTop = wp(P.alex.g, V(0, P.alex.h / 2 + 0.2, 0));
  const devTop = P.rDevices.map((d, i) => (i < 2 ? wp(d.g, V(0, d.h / 2 + 0.2, 0)) : wp(d.lid, V(0, d.h + 0.2, 0))));
  const devScreen = P.rDevices.map((d, i) => (i < 2 ? wp(d.g, V(0, 0, 0.4)) : wp(d.lid, V(0, d.h / 2 + 0.05, 0.4))));
  const idsFront = W.parts.ids.localToWorld(V(0, 1.75, 1.75));
  const apnsC = POS.apns.clone().add(V(0, 0, 0.35));
  const bay = P.cloudBay.localToWorld(V(0, 0, 0.12));
  Object.assign(W.pts, { alexTop, devTop, devScreen, idsFront, apnsC, bay, alexScreen: wp(P.alex.g, V(0, 0.2, 0.35)) });

  A.alex = () => alexTop; A.alexScreen = () => W.pts.alexScreen;
  A.rPhone = () => devTop[0]; A.rPad = () => devTop[1]; A.rMac = () => devTop[2];
  A.riley = () => V(POS.riley.x - 0.3, 3.6, POS.riley.z + 0.9);
  A.ids = () => W.parts.ids.localToWorld(V(0, 3.2, 1.6));
  A.idsCards = () => idsFront;
  A.apns = () => POS.apns.clone().add(V(0, 1.75, 0.2));
  A.apnsQueue = () => P.apnsDock.localToWorld(V(1.15, 0.5, 0.1));
  A.cloud = () => POS.cloud.clone().add(V(0, 1.2, 0.4));
  A.cloudBay = () => bay;

  const C = (pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const mid = (a, b, k, lift, dz = 0) => a.clone().lerp(b, k).add(V(0, lift, dz));
  const mouth = alexTop.clone().add(V(0.7, 0.6, 0.1));
  W.pts.mouth = mouth;
  const apnsFront = apnsC.clone().add(V(0, 0.1, 2.4));
  W.curves.up = C([mouth, mid(mouth, apnsFront, 0.3, 2.6, 0.4), mid(mouth, apnsFront, 0.72, 2.0), apnsFront, apnsC]);
  W.curves.down = devTop.map((t, i) => { const out = apnsC.clone().add(V(0.5 + i * 0.3, -0.2, 2.3)); return C([apnsC, out, mid(out, t, 0.5, 1.6 + i * 0.25), t.clone().add(V(-0.2, 1.4, 0.35)), t.clone().add(V(0, 0.35, 0.1))]); });
  W.curves.idsAlex = C([alexTop.clone().add(V(0, 0.3, 0)), mid(alexTop, idsFront, 0.5, 2.0, 0.6), idsFront]);
  W.curves.idsDev = devTop.map((t, i) => C([t.clone().add(V(0, 0.4, 0)), mid(t, idsFront, 0.25, 3.4 + i * 0.3, 1.2), V(-1.0, 10.4 + i * 0.2, -4.6), mid(t, idsFront, 0.85, 1.6, 0.4), idsFront]));
  W.curves.upload = C([alexTop.clone().add(V(0.5, 0.6, 0.3)), mid(alexTop, bay, 0.3, 4.6, 0.8), mid(alexTop, bay, 0.66, 4.8, 0.6), bay.clone().add(V(-0.4, 0.9, 1.6)), bay]);
  W.curves.download = devTop.map((t) => C([bay, bay.clone().add(V(0.2, -0.3, 1.4)), mid(bay, t, 0.55, 1.3, 0.5), t.clone().add(V(-0.4, 1.4, 0.6))]));
  W.curves.down.forEach((c, i) => { W.curves['down' + i] = c; });
  W.curves.download.forEach((c, i) => { W.curves['dl' + i] = c; });
}

// ---------------------------------------------------------------- build + update
export function buildWorld(scene, screenCanvases) {
  const M = materials();
  const W = { scene, M, parts: {}, focus: {}, anchors: {}, curves: {}, pts: {}, screenTex: {} };
  for (const k in screenCanvases) {
    const t = new THREE.CanvasTexture(screenCanvases[k]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    W.screenTex[k] = t;
  }
  buildFloor(W);
  buildAlex(W, W.screenTex.alex);
  buildRiley(W, W.screenTex);
  buildIDS(W);
  buildAPNs(W);
  buildCloud(W);
  buildPaths(W);
  buildRigs(W);
  W.update = (A, time, dt, ctx) => update(W, A, time, dt, ctx);
  return W;
}

function update(W, A, time, dt, ctx) {
  const P = W.parts;
  const k = (rate) => 1 - Math.exp(-dt * rate);

  // IDS: carousel spins slowly, or turns its Alex/Riley records to the front while they are in use
  if (A.idsSeek > 0.5) { const tgt = Math.round(W.idsAngle / (Math.PI * 2)) * Math.PI * 2; W.idsAngle += (tgt - W.idsAngle) * k(2.2); }
  else W.idsAngle += dt * 0.16;
  P.idsCar.rotation.y = W.idsAngle;
  P.idsCards.forEach((c, i) => {
    const vis = clamp(A.idsRecords - i);
    c.material.opacity = vis;
    c.visible = vis > 0.01;
    const hi = i > 0 ? A.idsRiley : A.idsAlex;
    c.scale.setScalar(1 + 0.12 * hi * (0.7 + 0.3 * Math.sin(time * 5)));
    c.material.color.setScalar(1.05 + 0.6 * hi);
  });

  // APNs: pulsing core and orbiting rings
  const pulse = 1 + 0.08 * Math.sin(time * 3.2) + 0.12 * A.apnsBusy;
  P.apnsCore.scale.setScalar(pulse);
  P.apnsHalo.material.opacity = 0.65 + 0.35 * A.apnsBusy;
  P.apnsOrbits[0].rotation.z += dt * 0.9; P.apnsOrbits[1].rotation.y += dt * 0.7;

  // iCloud: the encrypted attachment in the storage bay
  P.cloudBlob.forEach((m) => { m.material.opacity = A.cloudBlob; m.visible = A.cloudBlob > 0.01; });

  // Mac goes offline in the delivery section
  P.rMac.scrMat.color.setScalar(lerp(0.06, 0.92, A.macOn));
  P.macBadges[0].material.opacity = A.macBadge * (1 - A.macOn); P.macBadges[0].visible = P.macBadges[0].material.opacity > 0.01;
  P.macBadges[1].material.opacity = A.macBadge * A.macOn * A.macOnBadge; P.macBadges[1].visible = P.macBadges[1].material.opacity > 0.01;
  P.alerts.forEach((s) => { s.material.opacity = A.alert; s.visible = A.alert > 0.01; s.position.y = s.userData.y0 ?? (s.userData.y0 = s.position.y); s.position.y = s.userData.y0 + 0.05 * Math.sin(time * 4); });

  // per-section props
  W.updateRigs(time, dt, ctx);

  // focus brackets
  for (const key in W.focus) {
    const f = W.focus[key];
    const want = A.focus.has(key) ? 1 : 0;
    f.a += (want - f.a) * k(5);
    f.mesh.visible = f.a > 0.01;
    f.mesh.material.opacity = f.a * (0.75 + 0.25 * Math.sin(time * 3));
    f.mesh.scale.setScalar(1 + 0.15 * (1 - f.a));
  }
}
