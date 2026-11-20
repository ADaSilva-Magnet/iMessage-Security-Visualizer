// One small "rig" of props per section. The active section's rig plays its timeline (lt = seconds into the
// current loop); a rig that is no longer active fades out where it stopped. Each rig's opening state matches
// the previous section's closing state, so moving forward through the sections reads as one continuous process.
import * as THREE from 'three';
import { V, COLORS, DEV_COLORS, POS } from './palette.js';
import {
  keyProp, cellsProp, bubbleProp, cipherProp, ringProp, lockProp, tokenProp, sealProp, tagProp, capsuleProp, packageProp,
  tileProp, cardProp, orbProp, tunnelProp, checkProp, sprite, chip, sharedTex, glowMat,
} from './props.js';
import * as TX from './textures.js';
import { clamp, lerp, smooth, easeOutBack } from './util.js';
import { T, k01, sm, lane, MESSAGE } from './sync.js';

// ---------------------------------------------------------------- lane layout on the sender's side
// (everything is placed relative to Alex's pedestal, so the stage can be rearranged)
const AX = POS.alex.x, AZ = POS.alex.z;
export const LZ = AZ + 1.4;
export const LY = [4.6, 3.55, 2.5];                // one lane per receiving device: iPhone, iPad, Mac
const CELL = 0.092, PITCH = CELL * 1.12;
const X0 = AX + 2.05;                              // first bit of the key
export const BAR_X = X0 + 7.5 * PITCH;             // centre of the 16-cell key
export const XR = AX + 4.35;                       // HMAC / AES ring
export const XC = AX + 5.45;                       // encrypted text
export const XB = AX + 4.45;                       // locked key, after it slides next to the encrypted text
export const XS = AX + 6.3;                        // hash token -> signature seal
export const XT = AX + 7.15;                       // the device's public key + APNs address (from IDS)
export const CAP_X = AX + 5.335, CAP_LEN = 2.65;   // package capsule around lock + text + seal
const BUB = V(AX + 4.3, 5.5, LZ);                  // the message, as typed
const AKEY = V(AX + 1.75, 5.5, LZ);               // the sender's own public key (an HMAC input)

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const F = (o, f) => { o.userData.f = clamp(f); };
const S = (o, s) => o.scale.setScalar(Math.max(0.001, s));
const P = (o, x, y, z) => o.position.set(x, y, z);
const pop = (k) => Math.max(0.001, easeOutBack(clamp(k)));
function arcTo(out, a, b, u, lift = 1, dz = 0) {
  const v = 1 - u;
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 + lift, cz = (a.z + b.z) / 2 + dz;
  return out.set(a.x * v * v + 2 * cx * v * u + b.x * u * u, a.y * v * v + 2 * cy * v * u + b.y * u * u, a.z * v * v + 2 * cz * v * u + b.z * u * u);
}
// keyframed position track: [[t, Vector3], ...] with smooth segments
function track(out, keys, t) {
  if (t <= keys[0][0]) return out.copy(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return out.copy(a).lerp(b, smooth((t - t0) / (t1 - t0))); }
  }
  return out.copy(keys[keys.length - 1][1]);
}
// move from `from` to the curve start, then ride the curve
function ride(out, from, curve, u, lead = 0.18) {
  if (u < lead) return out.copy(from).lerp(curve.getPoint(0), smooth(u / lead));
  return curve.getPoint((u - lead) / (1 - lead), out);
}
const flick = (time, i, j) => 0.5 + 0.5 * Math.sin(time * (9 + (j % 5)) + j * 2.3 + i * 1.7);

function fadeTree(o, f) {
  const own = o.userData.f;
  const ff = own === undefined ? f : f * own;
  const vis = ff > 0.004;
  o.visible = vis;
  if (!vis) return;
  const m = o.material;
  if (m) { if (Array.isArray(m)) m.forEach((x) => setOp(x, ff)); else setOp(m, ff); }
  for (let i = 0; i < o.children.length; i++) fadeTree(o.children[i], ff);
}
function setOp(m, f) {
  const b = m.userData.base ?? (m.userData.base = m.opacity);
  m.opacity = b * f;
  if (!m.userData.noDepth) m.depthWrite = f > 0.85;
}

export function buildRigs(W) {
  const rigs = {};
  const S0 = sharedTex();
  const tagTex = {
    apns: TX.tagTexture('APNs address', 'where to deliver', '#f472b6'),
    meta: TX.tagTexture('Metadata', 'timestamp · routing', '#64748b'),
  };
  const A = W.anchors, pts = W.pts;
  const wpos = (o) => () => o.getWorldPosition(new THREE.Vector3());
  const anchor = (name, o, off) => { A[name] = off ? () => o.localToWorld(off.clone()) : wpos(o); };
  const rig = (id, build) => {
    const g = new THREE.Group(); g.visible = false; W.scene.add(g);
    const r = { id, g, a: 0, t: 0, fade: 1, run: () => {}, tunnels: [] };
    build(r, g);
    rigs[id] = r;
  };
  const tunnel = (r, g, curve, hex = COLORS.tls, rad = 0.3) => { const m = tunnelProp(curve, hex, rad); g.add(m); r.tunnels.push(m); return m; };
  const laneKey = (g, i) => { const k = keyProp(DEV_COLORS[i], false, 0.72), tg = tagProp(tagTex.apns, 0.25); g.add(k, tg); return { k, tg }; };
  const parkKey = (L, i) => { P(L.k, XT, LY[i] + 0.2, LZ); P(L.tg, XT, LY[i] - 0.25, LZ + 0.06); L.k.rotation.set(0, 0, 0); };
  const bar16 = (g, i) => { const b = cellsProp(16, CELL, 5, DEV_COLORS[i]); g.add(b); return b; };
  const steadyBar = (b, time, glowK = 0.85) => b.userData.cells.forEach((c, j) => { c.position.copy(c.userData.home); S(c, 1); F(c, 1); c.material.emissiveIntensity = glowK + 0.15 * Math.sin(time * 3 + j * 0.4); });
  const hold = (i) => V(POS.apns.x, POS.apns.y + 0.62 - i * 0.62, POS.apns.z + 0.5);   // packages parked in the APNs ring

  // ============================================================== overview
  rig('overview', (r, g) => {
    const b = bubbleProp(MESSAGE); g.add(b); b.rotation.y = 0.25;
    r.run = (t, time) => { P(b, -6.55, 4.85 + 0.07 * Math.sin(time * 1.3), 2.35); F(b, 1); };
    anchor('ov.bubble', b);
  });

  // ============================================================== keys: each device makes two key pairs
  rig('keys', (r, g) => {
    const ks = [keyProp(COLORS.send, false), keyProp(COLORS.send, true), keyProp(COLORS.sign, false), keyProp(COLORS.sign, true)];
    ks.forEach((k) => g.add(k));
    const home = [V(AX + 2.85, 3.6, AZ + 1.2), V(AX + 1.65, 3.6, AZ + 1.2), V(AX + 2.85, 2.5, AZ + 1.2), V(AX + 1.65, 2.5, AZ + 1.2)];
    const lock = sprite(chip('stays on this iPhone', '#e2e8f0'), 0.13); g.add(lock);
    r.run = (t, time) => {
      const src = pts.alexScreen;
      ks.forEach((k, i) => {
        const t0 = 0.3 + i * 0.25, e = k01(t, t0, t0 + 0.9);
        arcTo(tmp, src, home[i], smooth(e), 0.45, 0.2);
        let s = pop(e), f = e > 0 ? 1 : 0;
        if (i % 2 === 1) {
          const b = sm(t, 3.4 + (i === 3 ? 0.25 : 0), 4.6 + (i === 3 ? 0.25 : 0));
          if (b > 0) { tmp.lerp(src, b); s *= 1 - 0.8 * b; f *= 1 - k01(b, 0.7, 1); }
        }
        k.position.copy(tmp); k.position.y += 0.05 * Math.sin(time * 2 + i);
        S(k, s); F(k, f);
        k.rotation.set(0, 0.35 * Math.sin(time * 0.8 + i), 0.12);
      });
      P(lock, AX + 0.9, 4.25, AZ + 0.9); F(lock, sm(t, 4.1, 4.6) * (1 - sm(t, 7.5, 8.0)));
    };
    anchor('keys.encPub', ks[0]); anchor('keys.sigPub', ks[2]); anchor('keys.encPriv', ks[1]);
  });

  // ============================================================== register: public keys + APNs address to IDS
  rig('register', (r, g) => {
    const mk = (hex) => { const s = { enc: keyProp(hex, false, 0.85), sig: keyProp(COLORS.sign, false, 0.85), tag: tagProp(tagTex.apns, 0.27) }; g.add(s.enc, s.sig, s.tag); return s; };
    const sets = [mk(COLORS.send), ...DEV_COLORS.map(mk)];
    const arrive = [T.register.alex, T.register.phone, T.register.pad, T.register.mac];
    const alexHome = [V(AX + 2.85, 3.6, AZ + 1.2), V(AX + 2.85, 2.5, AZ + 1.2), V(AX + 1.9, 3.05, AZ + 1.5)];
    r.run = (t, time) => {
      sets.forEach((s, si) => {
        const t1 = arrive[si], t0 = t1 - 2.5;
        const curve = si === 0 ? W.curves.idsAlex : W.curves.idsDev[si - 1];
        const appear = si === 0 ? 1 : sm(t, t0 - 0.9, t0 - 0.3);
        [s.enc, s.sig, s.tag].forEach((o, j) => {
          const from = si === 0 ? alexHome[j] : tmp2.copy(pts.devTop[si - 1]).add(V(-0.5 + j * 0.5, 0.45, 0.35));
          const uu = clamp((sm(t, t0, t1) - j * 0.07) / (1 - 0.14));
          ride(tmp, from, curve, uu, 0.22);
          o.position.copy(tmp);
          if (uu <= 0) o.position.y += 0.05 * Math.sin(time * 2 + j + si);
          let sc = (si === 0 && j === 2 ? pop(k01(t, 0.1, 0.6)) : si === 0 ? 1 : pop(appear)) * (1 - 0.6 * k01(uu, 0.75, 1));
          if (o.isSprite) { o.scale.set(0.27 * o.userData.aspect * sc, 0.27 * sc, 1); } else S(o, sc);
          F(o, (si === 0 && j === 2 ? k01(t, 0.1, 0.3) : appear) * (1 - k01(uu, 0.9, 1)));
          if (!o.isSprite) o.rotation.set(0, 0.3 * Math.sin(time + j), 0.1);
        });
      });
    };
    sets.forEach((s) => { s.tag.userData.aspect = s.tag.scale.x / s.tag.scale.y; });
    anchor('reg.alex', sets[0].enc); anchor('reg.mac', sets[3].enc);
  });

  // ============================================================== lookup: ask IDS for the recipient's devices
  rig('lookup', (r, g) => {
    const orb = orbProp(COLORS.ids); g.add(orb);
    const sets = DEV_COLORS.map((_, i) => laneKey(g, i));
    sets.forEach((s) => { s.tg.userData.aspect = s.tg.scale.x / s.tg.scale.y; });
    r.run = (t, time) => {
      const L = T.lookup;
      const u = sm(t, L.ask[0], L.ask[1]);
      W.curves.idsAlex.getPoint(u, tmp); orb.position.copy(tmp);
      S(orb, 1 + 0.15 * Math.sin(time * 8)); F(orb, k01(t, L.ask[0] - 0.3, L.ask[0]) * (1 - k01(t, L.ask[1], L.ask[1] + 0.3)));
      sets.forEach((s, i) => {
        const t0 = L.back[0] + i * L.stagger, t1 = L.back[1] + i * L.stagger, e = sm(t, t0, t1);
        const on = t >= t0 ? 1 : 0;
        arcTo(tmp, pts.idsFront, V(XT, LY[i] + 0.2, LZ), e, 1.6, 2.2); s.k.position.copy(tmp);
        arcTo(tmp, pts.idsFront, V(XT, LY[i] - 0.25, LZ + 0.06), clamp(e * 1.04 - 0.04), 1.6, 2.2); s.tg.position.copy(tmp);
        const sc = lerp(0.45, 1, k01(e, 0, 0.4));
        S(s.k, sc); s.tg.scale.set(0.27 * s.tg.userData.aspect * sc, 0.27 * sc, 1);
        F(s.k, on); F(s.tg, on);
        s.k.rotation.set(0, 0.25 * Math.sin(time * 1.2 + i), 0);
      });
    };
    sets.forEach((s, i) => anchor('look.key' + i, s.k));
    anchor('look.orb', orb);
  });

  // ============================================================== msgkey: 88-bit random + 40-bit HMAC = 128-bit key
  rig('msgkey', (r, g) => {
    const bub = bubbleProp(MESSAGE); g.add(bub);
    const ak = keyProp(COLORS.send, false, 0.8); g.add(ak);
    const lanes = DEV_COLORS.map((c, i) => ({ bar: bar16(g, i), ring: (() => { const x = ringProp('HMAC-SHA-256', 0xe2e8f0, 0.34); g.add(x); return x; })(), ...laneKey(g, i) }));
    r.run = (t, time) => {
      const e = sm(t, 0, 0.9);
      arcTo(tmp, pts.alexScreen, BUB, e, 0.5, 0.3); bub.position.copy(tmp); S(bub, lerp(0.3, 1, e)); F(bub, k01(t, 0, 0.15));
      bub.position.y += 0.04 * Math.sin(time * 1.5);
      const ka = sm(t, 0.3, 1.0);
      arcTo(tmp, pts.alexScreen, AKEY, ka, 0.3, 0.2); ak.position.copy(tmp); S(ak, pop(ka)); F(ak, ka > 0 ? 1 : 0);
      ak.rotation.set(0, 0.3 * Math.sin(time), 0.1);
      lanes.forEach((L, i) => {
        const li = lane(t, i), M = T.msgkey;
        parkKey(L, i);
        P(L.bar, BAR_X, LY[i], LZ);
        L.bar.userData.cells.forEach((c, j) => {
          if (j < 11) {
            const a = k01(li, M.rand + j * 0.05, M.rand + j * 0.05 + 0.3);
            c.position.copy(c.userData.home); S(c, pop(a)); F(c, a > 0 ? 1 : 0);
            c.material.emissiveIntensity = li < M.done ? 0.3 + 0.75 * flick(time, i, j) : 0.85;
          } else {
            const t0 = M.attach[0] + (j - 11) * 0.09, a = sm(li, t0, t0 + 0.55);
            c.position.set(XR - BAR_X, 0, 0).lerp(c.userData.home, a);
            S(c, li > t0 ? pop(k01(li, t0, t0 + 0.25)) : 0.001); F(c, li > t0 ? 1 : 0);
            c.material.emissiveIntensity = 1.1;
          }
        });
        const ra = k01(li, M.hmac[0] - 0.3, M.hmac[0]) * (1 - k01(li, M.done - 0.1, M.done + 0.3));
        P(L.ring, XR, LY[i], LZ); S(L.ring, lerp(0.6, 1, ra)); F(L.ring, ra);
        L.ring.userData.spin.rotation.z = time * 1.6;
      });
    };
    anchor('mk.bubble', bub); anchor('mk.akey', ak);
    lanes.forEach((L, i) => { anchor('mk.ring' + i, L.ring); anchor('mk.key' + i, L.k); anchor('mk.bar' + i, L.bar); anchor('mk.rand' + i, L.bar, V(-0.25 - 2 * PITCH, 0, 0)); });
  });

  // ============================================================== encrypt: AES-CTR, one ciphertext per device
  rig('encrypt', (r, g) => {
    const bub = bubbleProp(MESSAGE); g.add(bub);
    const lanes = DEV_COLORS.map((c, i) => {
      const ring = ringProp('AES-CTR', 0x93c5fd, 0.34), copy = bubbleProp(MESSAGE), ci = cipherProp(c, undefined, undefined, i);
      g.add(ring, copy, ci);
      return { bar: bar16(g, i), ring, copy, ci, ...laneKey(g, i) };
    });
    r.run = (t, time) => {
      P(bub, BUB.x, BUB.y + 0.04 * Math.sin(time * 1.5), BUB.z); F(bub, 1 - sm(t, 0.7, 1.3)); S(bub, 1);
      lanes.forEach((L, i) => {
        const li = lane(t, i), E = T.encrypt;
        parkKey(L, i);
        P(L.bar, BAR_X, LY[i], LZ); steadyBar(L.bar, time);
        const ra = k01(li, 0.1, 0.5) * (1 - k01(li, E.pass[1] + 0.5, E.pass[1] + 0.9));
        P(L.ring, XR, LY[i], LZ); S(L.ring, lerp(0.6, 1, ra)); F(L.ring, ra); L.ring.userData.spin.rotation.z = -time * 1.8;
        const u = sm(li, E.pass[0], E.pass[1]);
        const p1 = V(XR, LY[i], LZ), p2 = V(XC, LY[i], LZ);
        if (u < 0.5) arcTo(tmp, BUB, p1, u / 0.5, 0.25, 0.15); else tmp.copy(p1).lerp(p2, (u - 0.5) / 0.5);
        L.copy.position.copy(tmp); S(L.copy, lerp(1, 0.62, k01(u, 0, 0.5)));
        F(L.copy, k01(li, E.pass[0] - 0.35, E.pass[0] - 0.1) * (1 - k01(u, 0.45, 0.6)));
        if (u >= 0.45) L.ci.position.copy(tmp); else L.ci.position.copy(p1);
        S(L.ci, lerp(0.62, 1, k01(u, 0.5, 1))); F(L.ci, k01(u, 0.45, 0.6));
      });
    };
    lanes.forEach((L, i) => { anchor('en.ring' + i, L.ring); anchor('en.ci' + i, L.ci); anchor('en.bar' + i, L.bar); anchor('en.barEnd' + i, L.bar, V(0.85, 0, 0)); });
  });

  // ============================================================== wrap: the message key is locked to each device's public key
  rig('wrap', (r, g) => {
    const lanes = DEV_COLORS.map((c, i) => {
      const ci = cipherProp(c, undefined, undefined, i), lock = lockProp(c);
      g.add(ci, lock);
      return { bar: bar16(g, i), ci, lock, ...laneKey(g, i) };
    });
    r.run = (t, time) => {
      lanes.forEach((L, i) => {
        const li = lane(t, i), Wt = T.wrap;
        P(L.ci, XC, LY[i], LZ);
        P(L.tg, XT, LY[i] - 0.25, LZ + 0.06);
        // lock box appears over the key; the key drops into it
        const a = sm(li, Wt.box[0], Wt.box[0] + 0.45);
        const lx = lerp(BAR_X, XB, sm(li, Wt.slide[0], Wt.slide[1]));
        P(L.lock, lx, LY[i] - 0.02, LZ); S(L.lock, pop(a)); F(L.lock, a > 0.001 ? 1 : 0);
        const closeK = sm(li, Wt.turn[1] - 0.05, Wt.turn[1] + 0.35);
        L.lock.userData.lid.rotation.x = -1.15 * Math.min(a, 1 - closeK);
        L.lock.userData.glow.emissiveIntensity = lerp(0.25, 2.2, sm(li, Wt.turn[1], Wt.turn[1] + 0.5));
        const b = sm(li, Wt.box[0] + 0.35, Wt.box[1]);
        steadyBar(L.bar, time);
        P(L.bar, BAR_X, LY[i] + 0.32 * Math.sin(Math.PI * Math.min(1, b * 1.2)), LZ);
        L.bar.scale.set(lerp(1, 0.2, b), lerp(1, 0.5, b), lerp(1, 0.5, b)); F(L.bar, 1 - k01(b, 0.8, 1));
        // the device's public key flies in, turns and locks the box
        const kf = sm(li, Wt.key[0], Wt.key[1]);
        const dest = tmp2.set(lx, LY[i] - 0.08, LZ + 0.64);
        arcTo(tmp, V(XT, LY[i] + 0.2, LZ), dest, kf, 0.75, 0.5);
        L.k.position.copy(tmp);
        L.k.rotation.set(0, lerp(Math.PI, Math.PI / 2, k01(kf, 0.55, 1)), 0);
        L.k.userData.inner.rotation.x = (Math.PI / 2) * sm(li, Wt.turn[0], Wt.turn[1]);
        S(L.k, 0.72 + 0.1 * (1 - kf)); F(L.k, 1 - k01(li, Wt.turn[1] + 0.25, Wt.turn[1] + 0.7));
      });
    };
    lanes.forEach((L, i) => { anchor('wr.lock' + i, L.lock); anchor('wr.ci' + i, L.ci); anchor('wr.key' + i, L.k); });
  });

  // ============================================================== sign: SHA-1 hash, ECDSA signature with the sender's private signing key
  rig('sign', (r, g) => {
    const lanes = DEV_COLORS.map((c, i) => {
      const ci = cipherProp(c, undefined, undefined, i), lock = lockProp(c), tok = tokenProp('SHA-1'), seal = sealProp(), tg = tagProp(tagTex.apns, 0.27);
      const scan = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.5), glowMat(COLORS.ids, 2.2)); scan.material.userData.base = 1;
      lock.userData.glow.emissiveIntensity = 2.2; lock.userData.lid.rotation.x = 0;
      g.add(ci, lock, tok, seal, tg, scan);
      return { ci, lock, tok, seal, tg, scan };
    });
    const sk = keyProp(COLORS.sign, true, 1); g.add(sk);
    const St = T.sign;
    r.run = (t, time) => {
      lanes.forEach((L, i) => {
        const li = lane(t, i);
        P(L.lock, XB, LY[i] - 0.02, LZ); P(L.ci, XC, LY[i], LZ); P(L.tg, XT, LY[i] - 0.25, LZ + 0.06);
        const su = k01(li, St.scan[0], St.scan[1]);
        P(L.scan, lerp(XB - 0.5, XC + 0.62, smooth(su)), LY[i], LZ + 0.05); F(L.scan, su > 0 && su < 1 ? 1 : 0);
        const tp = k01(li, St.scan[1] - 0.05, St.scan[1] + 0.3);
        const stamped = sm(t, St.stamps[i] - 0.05, St.stamps[i] + 0.15);
        P(L.tok, XS, LY[i], LZ); S(L.tok, pop(tp) * (1 - 0.3 * stamped)); F(L.tok, (tp > 0 ? 1 : 0) * (1 - stamped)); L.tok.rotation.z = time * 0.8;
        P(L.seal, XS, LY[i], LZ + 0.02); S(L.seal, pop(k01(t, St.stamps[i] - 0.02, St.stamps[i] + 0.3))); F(L.seal, t >= St.stamps[i] - 0.02 ? 1 : 0);
      });
      // the gold private signing key visits each lane
      const hov = (i) => V(XS, LY[i] + 0.05, LZ + 0.95), touch = (i) => V(XS, LY[i] + 0.0, LZ + 0.5);
      const keys = [[1.5, pts.alexScreen], [St.stamps[0] - 0.35, hov(0)], [St.stamps[0], touch(0)], [St.stamps[0] + 0.22, hov(0)],
        [St.stamps[1] - 0.3, hov(1)], [St.stamps[1], touch(1)], [St.stamps[1] + 0.22, hov(1)],
        [St.stamps[2] - 0.3, hov(2)], [St.stamps[2], touch(2)], [St.stamps[2] + 0.22, hov(2)], [St.back, pts.alexScreen]];
      track(tmp, keys, t); sk.position.copy(tmp);
      sk.rotation.set(0, lerp(0.1, Math.PI / 2, k01(t, 1.5, St.stamps[0] - 0.4)), 0);
      S(sk, 1 - 0.6 * k01(t, St.back - 0.5, St.back));
      F(sk, k01(t, 1.4, 1.7) * (1 - k01(t, St.back - 0.25, St.back)));
    };
    lanes.forEach((L, i) => { anchor('sg.tok' + i, L.tok); anchor('sg.seal' + i, L.seal); });
    anchor('sg.key', sk);
  });

  // ============================================================== package: one per receiving device
  rig('package', (r, g) => {
    const lanes = DEV_COLORS.map((c, i) => {
      const cap = capsuleProp(c, CAP_LEN), ci = cipherProp(c, undefined, undefined, i), lock = lockProp(c), seal = sealProp(), tg = tagProp(tagTex.apns, 0.27);
      lock.userData.glow.emissiveIntensity = 2.2; lock.userData.lid.rotation.x = 0;
      g.add(cap, ci, lock, seal, tg);
      return { cap, ci, lock, seal, tg };
    });
    const ghosts = [0, 1].map((i) => { const c = capsuleProp(0xe2e8f0, CAP_LEN); g.add(c); return c; });
    r.run = (t, time) => {
      lanes.forEach((L, i) => {
        const li = lane(t, i), e = sm(li, T.package.shell[0], T.package.shell[1]);
        P(L.lock, XB, LY[i] - 0.02, LZ); P(L.ci, XC, LY[i], LZ); P(L.seal, XS, LY[i], LZ + 0.02);
        P(L.cap, CAP_X, LY[i], LZ); L.cap.scale.set(lerp(0.08, 1, e), lerp(0.6, 1, e), lerp(0.6, 1, e)); F(L.cap, e);
        L.cap.userData.bands.forEach((b) => F(b, k01(e, 0.7, 1)));
        P(L.tg, lerp(XT, CAP_X + CAP_LEN / 2 + 0.42, e), LY[i] - 0.25 + 0.5 * e, LZ + 0.06);
      });
      ghosts.forEach((c, i) => {
        const e = sm(t, T.package.ghost[0] + i * 0.3, T.package.ghost[1] + i * 0.3);
        P(c, CAP_X + 0.7 + i * 0.5, LY[i] + 0.55 + i * 0.1, LZ - 1.4 - i * 0.5); S(c, 0.9); F(c, e * 0.55);
      });
    };
    lanes.forEach((L, i) => anchor('pk.cap' + i, L.cap, V(0, 0.5, 0)));
    anchor('pk.ghost', ghosts[1], V(0.8, 0.5, 0));
  });

  // ============================================================== apns: dispatched over forward-secret TLS
  rig('apns', (r, g) => {
    const tun = tunnel(r, g, W.curves.up);
    const pk = DEV_COLORS.map((c, i) => { const p = packageProp(c, tagTex.meta, { len: CAP_LEN, idx: i }); g.add(p); return p; });
    const Ap = T.apns;
    r.run = (t, time) => {
      F(tun, sm(t, Ap.tunnel[0], Ap.tunnel[1]));
      pk.forEach((p, i) => {
        const t0 = Ap.leave + i * Ap.stagger;
        const a = sm(t, t0, t0 + 0.6), u = sm(t, t0 + 0.6, t0 + 0.6 + Ap.ride), d = sm(t, t0 + 0.6 + Ap.ride, t0 + 1.0 + Ap.ride);
        if (u <= 0) tmp.set(CAP_X, LY[i], LZ).lerp(pts.mouth, a);
        else if (d <= 0) W.curves.up.getPoint(u, tmp);
        else tmp.copy(W.curves.up.getPoint(1)).lerp(hold(i), d);
        p.position.copy(tmp);
        S(p, lerp(1, 0.5, a));
        F(p, 1);
        p.rotation.y = 0.25 * Math.sin(Math.PI * u);
      });
    };
    anchor('ap.tunnel', tun, null); A['ap.tunnel'] = () => W.curves.up.getPoint(0.42);
    anchor('ap.meta', pk[0].userData.tag); anchor('ap.pk0', pk[0]);
  });

  // ============================================================== attach: encrypt the photo, upload to iCloud, send its key/URI/hash
  rig('attach', (r, g) => {
    const tile = tileProp(); g.add(tile);
    const k256 = cellsProp(32, 0.062, 0, 0xffffff, 0xe0f2fe); g.add(k256);
    const card = cardProp(); g.add(card);
    const cap = capsuleProp(COLORS.cloud, 1.95, 0.42); g.add(cap);
    const lk = lockProp(COLORS.cloud); lk.userData.glow.emissiveIntensity = 2.0; lk.userData.lid.rotation.x = 0; S(lk, 0.55); cap.add(lk); lk.position.set(-0.55, -0.05, 0.3);
    const se = sealProp(); se.scale.setScalar(0.6); cap.add(se); se.position.set(0.62, 0.05, 0.3);
    const tun = tunnel(r, g, W.curves.up);
    const Q = T.attach, PH = V(AX + 2.6, 4.6, LZ), CARD = V(AX + 3.35, 3.0, LZ);
    r.run = (t, time) => {
      // photo comes out of the phone
      const pe = sm(t, Q.photo[0], Q.photo[1]);
      if (t < Q.up[0]) { arcTo(tmp, pts.alexScreen, PH, pe, 0.4, 0.2); tile.position.copy(tmp); S(tile, lerp(0.3, 1, pe)); }
      else { const u = sm(t, Q.up[0], Q.up[1]); ride(tmp, PH, W.curves.upload, u, 0.1); tile.position.copy(tmp); S(tile, lerp(1, 0.62, u)); }
      F(tile, k01(t, Q.photo[0], Q.photo[0] + 0.2) * (1 - k01(t, Q.up[1] - 0.15, Q.up[1] + 0.2)));
      F(tile.userData.enc, sm(t, Q.enc[0] + 0.3, Q.enc[1]));
      tile.rotation.y = 0.15 * Math.sin(time * 0.9);
      // random 256-bit key sweeps over the photo, then folds into the details card
      const ka = k01(t, Q.key[0], Q.key[1]);
      const sweep = sm(t, Q.enc[0], Q.enc[1]);
      const toCard = sm(t, Q.card[0], Q.card[1]);
      tmp.set(PH.x, PH.y + 0.72 - 1.44 * sweep + 0.72 * k01(t, Q.enc[1], Q.enc[1] + 0.4), PH.z + 0.18).lerp(CARD, toCard);
      k256.position.copy(tmp); k256.scale.setScalar(lerp(1, 0.3, toCard));
      k256.userData.cells.forEach((c, j) => { const a = k01(ka, j / 40, j / 40 + 0.25); S(c, pop(a)); F(c, a > 0 ? 1 : 0); c.material.emissiveIntensity = 0.35 + 0.6 * flick(time, 7, j); });
      F(k256, 1 - k01(toCard, 0.8, 1));
      // details card (key + URI + hash) wrapped like any other iMessage and sent to APNs
      const ce = sm(t, Q.card[0], Q.card[1]);
      const we = sm(t, Q.wrap[0], Q.wrap[1]);
      const ge = sm(t, Q.go[0], Q.go[1]);
      const cardPos = tmp2.copy(CARD);
      if (ge > 0) { const a = k01(ge, 0, 0.2), u = k01(ge, 0.2, 1); if (u <= 0) cardPos.lerp(pts.mouth, smooth(a)); else W.curves.up.getPoint(u, cardPos); }
      card.position.copy(cardPos); S(card, pop(ce) * lerp(1, 0.85, we) * lerp(1, 0.55, k01(ge, 0, 0.2))); F(card, ce > 0 ? 1 : 0);
      cap.position.copy(cardPos); cap.scale.set(lerp(0.1, 1, we), lerp(0.6, 1, we), lerp(0.6, 1, we)); cap.scale.multiplyScalar(lerp(1, 0.55, k01(ge, 0, 0.2)));
      F(cap, we * (1 - k01(ge, 0.92, 1))); F(card, (ce > 0 ? 1 : 0) * (1 - k01(ge, 0.92, 1)));
      F(lk, k01(we, 0.6, 1)); F(se, k01(we, 0.75, 1));
      F(tun, sm(t, Q.wrap[1] - 0.3, Q.go[0]) * (1 - k01(t, Q.go[1], Q.go[1] + 0.4)));
    };
    anchor('at.tile', tile); anchor('at.card', card); anchor('at.cap', cap); anchor('at.k256', k256);
  });

  // ============================================================== deliver: APNs delivers each copy; offline devices are queued
  rig('deliver', (r, g) => {
    const tuns = W.curves.down.map((c) => tunnel(r, g, c, COLORS.tls, 0.26));
    const pk = DEV_COLORS.map((c, i) => { const p = packageProp(c, tagTex.meta, { len: CAP_LEN, idx: i }); g.add(p); return p; });
    const ghosts = DEV_COLORS.map((c) => { const p = capsuleProp(c, CAP_LEN); g.add(p); return p; });
    const clock = new THREE.Group(); g.add(clock);
    const face = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 48), glowMat(0xfbbf24, 1.6)); face.material.userData.base = 1; clock.add(face);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.02), glowMat(0xfbbf24, 1.8)); hand.geometry.translate(0, 0.16, 0); hand.material.userData.base = 1; clock.add(hand);
    const D = T.deliver;
    const Q = () => W.anchors.apnsQueue();
    r.run = (t, time) => {
      F(tuns[0], sm(t, 0.2, 1.0) * (1 - sm(t, D.pad[1] + 0.6, D.pad[1] + 1.4)));
      F(tuns[1], sm(t, 0.2, 1.0) * (1 - sm(t, D.pad[1] + 0.6, D.pad[1] + 1.4)));
      F(tuns[2], sm(t, D.wake, D.wake + 0.5));
      pk.forEach((p, i) => {
        const [a0, a1] = i === 0 ? D.phone : i === 1 ? D.pad : D.mac;
        const u = sm(t, a0, a1), absorb = sm(t, a1, a1 + 0.35);
        const start = i === 2 && t >= D.queue[0] ? tmp2.copy(hold(2)).lerp(Q(), sm(t, D.queue[0], D.queue[1])) : tmp2.copy(hold(i));
        if (u <= 0) tmp.copy(start); else ride(tmp, start, W.curves.down[i], u, 0.12);
        if (absorb > 0) tmp.lerp(pts.devScreen[i], absorb);
        p.position.copy(tmp);
        S(p, 0.5 * (1 - 0.85 * absorb) * (i === 2 && t >= D.queue[0] && u <= 0 ? lerp(1, 0.85, sm(t, D.queue[0], D.queue[1])) : 1));
        F(p, 1 - k01(absorb, 0.6, 1));
        // the copy at APNs is deleted once delivered
        const gpos = i === 2 && t >= D.queue[1] - 0.2 ? Q() : hold(i);
        ghosts[i].position.copy(gpos); S(ghosts[i], i === 2 && t >= D.queue[1] - 0.2 ? 0.42 : 0.5);
        F(ghosts[i], (u > 0 || (i === 2 && t >= D.queue[1])) ? 0.35 * (1 - k01(t, a1, a1 + 0.5)) : 0);
      });
      clock.position.copy(Q()).add(V(0, 0.75, 0.2));
      hand.rotation.z = -time * 2.4;
      F(clock, sm(t, D.queue[1] - 0.1, D.queue[1] + 0.3) * (1 - sm(t, D.mac[0], D.mac[0] + 0.4)));
    };
    pk.forEach((p, i) => anchor('dl.pk' + i, p));
    anchor('dl.clock', clock); A['dl.down1'] = () => W.curves.down[1].getPoint(0.55);
  });

  // ============================================================== unlock: check the signature, unlock the key, decrypt, verify
  rig('unlock', (r, g) => {
    const B = W.parts.rPhone.g.getWorldPosition(new THREE.Vector3()).add(V(-2.75, 0.75, 1.35));
    const pk = packageProp(COLORS.phone, null, { len: CAP_LEN, idx: 0 }); g.add(pk);
    const { lock, cipher, seal } = pk.userData.parts;
    const bub = bubbleProp(MESSAGE); g.add(bub);
    const pub = keyProp(COLORS.sign, false, 0.9); g.add(pub);
    const priv = keyProp(COLORS.phone, true, 0.9); g.add(priv);
    const bar = cellsProp(16, CELL, 5, COLORS.phone); g.add(bar);
    const ring = ringProp('AES-CTR', 0x93c5fd, 0.34); g.add(ring);
    const ok1 = checkProp(0.36), ok2 = checkProp(0.36); g.add(ok1, ok2);
    const U = T.unlock;
    r.run = (t, time) => {
      pk.position.copy(B); S(pk, 1);
      F(pk.userData.shell, 1 - sm(t, U.open[0], U.open[1])); pk.userData.bands.forEach((b) => F(b, 1 - sm(t, U.open[0], U.open[1])));
      const sealW = pk.localToWorld(seal.position.clone()), lockW = pk.localToWorld(lock.position.clone()), ciW = pk.localToWorld(cipher.position.clone());
      // sender's public signing key (from IDS) checks the seal
      const se = sm(t, U.sig[0], U.sig[1]);
      arcTo(tmp, pts.idsFront, tmp2.copy(sealW).add(V(0, 0, 0.5)), se, 2.6, 2.0); pub.position.copy(tmp);
      pub.rotation.set(0, lerp(0, Math.PI / 2, k01(se, 0.6, 1)), 0); S(pub, lerp(0.5, 0.9, se));
      F(pub, k01(t, U.sig[0] - 0.2, U.sig[0]) * (1 - k01(t, U.ok + 0.2, U.ok + 0.6)));
      ok1.position.copy(sealW).add(V(0, 0.46, 0.15)); S(ok1, 0.36 * pop(k01(t, U.ok, U.ok + 0.3))); ok1.scale.y = ok1.scale.x; F(ok1, t >= U.ok ? 1 : 0);
      // the device's own private key unlocks the message key
      const pe = sm(t, U.priv[0], U.priv[1]);
      arcTo(tmp, pts.devScreen[0], tmp2.copy(lockW).add(V(0, -0.08, 0.64)), pe, 0.9, 0.4); priv.position.copy(tmp);
      priv.rotation.set(0, lerp(Math.PI, Math.PI / 2, k01(pe, 0.5, 1)), 0);
      priv.userData.inner.rotation.x = (Math.PI / 2) * sm(t, U.turn[0], U.turn[1]);
      F(priv, k01(t, U.priv[0], U.priv[0] + 0.2) * (1 - k01(t, U.turn[1] + 0.3, U.turn[1] + 0.7)));
      lock.userData.lid.rotation.x = -1.15 * sm(t, U.turn[1] - 0.1, U.turn[1] + 0.3);
      // the 128-bit key comes out and decrypts the text
      const be = sm(t, U.bar[0], U.bar[1]), de = sm(t, U.dec[0], U.dec[1]);
      tmp.copy(lockW).lerp(tmp2.copy(ciW).add(V(0, 0.62, 0.05)), be);
      tmp.y -= 0.62 * de; tmp.z += 0.3 * de;
      bar.position.copy(tmp); bar.scale.setScalar(lerp(0.25, 1, be));
      const chk = sm(t, U.check[0], U.check[1]);
      bar.userData.cells.forEach((c, j) => { c.position.copy(c.userData.home); S(c, 1); F(c, 1); c.material.emissiveIntensity = j >= 11 ? 1.0 + 1.6 * chk * (0.6 + 0.4 * Math.sin(time * 10)) : 0.85; });
      F(bar, k01(t, U.bar[0], U.bar[0] + 0.15) * (1 - k01(t, U.show[0], U.show[0] + 0.4)));
      ring.position.copy(ciW).add(V(0, 0, 0.12)); ring.userData.spin.rotation.z = time * 2; F(ring, k01(t, U.dec[0], U.dec[0] + 0.25) * (1 - k01(t, U.dec[1] - 0.1, U.dec[1] + 0.2)));
      F(cipher, 1 - sm(t, U.dec[0] + 0.3, U.dec[1] - 0.1));
      const ae = sm(t, U.show[0], U.show[1]);
      tmp.copy(ciW).lerp(pts.devScreen[0], ae); bub.position.copy(tmp); S(bub, 0.66 * (1 - 0.6 * ae));
      F(bub, sm(t, U.dec[0] + 0.3, U.dec[1] - 0.1) * (1 - k01(ae, 0.75, 1)));
      ok2.position.copy(bar.position).add(V(0.98, 0.0, 0.15)); S(ok2, 0.36 * pop(k01(t, U.check[1] - 0.2, U.check[1] + 0.1))); ok2.scale.y = ok2.scale.x; F(ok2, (t >= U.check[1] - 0.2 ? 1 : 0) * (1 - k01(t, U.show[0], U.show[0] + 0.4)));
      F(lock, 1 - k01(t, U.show[0], U.show[0] + 0.5)); F(seal, 1 - k01(t, U.show[0], U.show[0] + 0.5));
    };
    anchor('ul.seal', pk, V(0.96, 0, 0)); anchor('ul.lock', pk, V(-0.89, 0, 0)); anchor('ul.text', pk, V(0.11, 0, 0)); anchor('ul.pub', pub); anchor('ul.bar', bar, V(0.7, 0, 0));
  });

  // ============================================================== fetch: download the attachment, check its hash, decrypt
  rig('fetch', (r, g) => {
    const B = W.parts.rPad.g.getWorldPosition(new THREE.Vector3()).add(V(-1.4, 3.3, 1.9));
    const card = cardProp(1.15); g.add(card);
    const tile = tileProp(); g.add(tile);
    const k256 = cellsProp(32, 0.062, 0, 0xffffff, 0xe0f2fe); g.add(k256);
    const scan = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.4), glowMat(COLORS.ids, 2.2)); scan.material.userData.base = 1; g.add(scan);
    const ok = checkProp(0.36); g.add(ok);
    const Fz = T.fetch;
    r.run = (t, time) => {
      const cpos = V(B.x - 0.95, B.y, B.z), tpos = V(B.x + 0.85, B.y, B.z);
      const ce = sm(t, Fz.card[0], Fz.card[1]);
      arcTo(tmp, pts.devScreen[1], cpos, ce, 0.4, 0.2); card.position.copy(tmp); S(card, lerp(0.3, 1, ce)); F(card, k01(t, Fz.card[0], Fz.card[0] + 0.2) * (1 - k01(t, Fz.show[0], Fz.show[0] + 0.5)));
      const de = sm(t, Fz.down[0], Fz.down[1]);
      if (de < 0.85) W.curves.download[1].getPoint(de / 0.85, tmp); else tmp.copy(W.curves.download[1].getPoint(1)).lerp(tpos, (de - 0.85) / 0.15);
      const se = sm(t, Fz.show[0], Fz.show[1]);
      if (se > 0) tmp.lerp(pts.devScreen[1], se);
      tile.position.copy(tmp); S(tile, lerp(0.55, 1, de) * (1 - 0.7 * se)); F(tile, k01(t, Fz.down[0], Fz.down[0] + 0.2) * (1 - k01(se, 0.75, 1)));
      F(tile.userData.enc, 1 - sm(t, Fz.dec[0] + 0.3, Fz.dec[1]));
      const hu = k01(t, Fz.hash[0], Fz.hash[1]);
      scan.position.set(lerp(tpos.x - 0.7, tpos.x + 0.7, smooth(hu)), tpos.y, tpos.z + 0.1); F(scan, hu > 0 && hu < 1 ? 1 : 0);
      ok.position.copy(tpos).add(V(0.72, 0.5, 0.15)); S(ok, 0.36 * pop(k01(t, Fz.ok, Fz.ok + 0.3))); ok.scale.y = ok.scale.x; F(ok, (t >= Fz.ok ? 1 : 0) * (1 - k01(t, Fz.show[0], Fz.show[0] + 0.3)));
      const ke = sm(t, Fz.dec[0], Fz.dec[1]);
      tmp.copy(cpos).add(V(0, -0.62, 0.1)).lerp(tmp2.copy(tpos).add(V(0, -0.1, 0.2)), ke); k256.position.copy(tmp); k256.scale.setScalar(lerp(0.55, 0.62, ke));
      k256.userData.cells.forEach((c) => { S(c, 1); F(c, 1); c.material.emissiveIntensity = 0.8; });
      F(k256, k01(t, Fz.card[1], Fz.card[1] + 0.4) * (1 - k01(t, Fz.dec[1], Fz.dec[1] + 0.4)));
    };
    anchor('ft.card', card); anchor('ft.tile', tile); anchor('ft.ok', ok);
  });

  // ============================================================== together: the whole journey, compressed
  rig('together', (r, g) => {
    const J = T.together;
    const regs = [COLORS.send, ...DEV_COLORS].map((c) => { const a = keyProp(c, false, 0.7), b = keyProp(COLORS.sign, false, 0.7); g.add(a, b); return [a, b]; });
    const orb = orbProp(COLORS.ids); g.add(orb);
    const back = DEV_COLORS.map((c) => { const k = keyProp(c, false, 0.7); g.add(k); return k; });
    const pk = DEV_COLORS.map((c, i) => { const p = packageProp(c, null, { len: CAP_LEN, idx: i }); g.add(p); return p; });
    const up = tunnel(r, g, W.curves.up);
    const downs = W.curves.down.map((c) => tunnel(r, g, c, COLORS.tls, 0.26));
    const oks = DEV_COLORS.map(() => { const c = checkProp(0.4); g.add(c); return c; });
    const near = (i) => V(AX + 2.3, 4.6 - i * 0.62, AZ + 1.0);
    r.run = (t, time) => {
      const src = [pts.alexTop, ...pts.devTop];
      regs.forEach((pair, d) => pair.forEach((k, j) => {
        const t0 = J.reg[0] + d * 0.35 + j * 0.08, u = sm(t, t0, t0 + 1.4);
        const curve = d === 0 ? W.curves.idsAlex : W.curves.idsDev[d - 1];
        ride(tmp, tmp2.copy(src[d]).add(V(-0.25 + j * 0.5, 0.35, 0.3)), curve, u, 0.15); k.position.copy(tmp);
        S(k, 1 - 0.5 * k01(u, 0.7, 1)); F(k, k01(t, t0 - 0.4, t0) * (1 - k01(u, 0.9, 1)));
      }));
      const ou = sm(t, J.look[0], J.look[0] + 1.0);
      W.curves.idsAlex.getPoint(ou, tmp); orb.position.copy(tmp); F(orb, k01(t, J.look[0] - 0.2, J.look[0]) * (1 - k01(t, J.look[0] + 1.0, J.look[0] + 1.2)));
      back.forEach((k, i) => {
        const t0 = J.look[0] + 1.1 + i * 0.2, u = sm(t, t0, t0 + 1.0);
        arcTo(tmp, pts.idsFront, near(i), u, 1.2, 1.5); k.position.copy(tmp);
        F(k, (t >= t0 ? 1 : 0) * (1 - k01(t, J.pack[0] + 0.2, J.pack[0] + 0.6)));
      });
      F(up, sm(t, J.pack[1] - 0.4, J.up[0]) * (1 - sm(t, J.up[1], J.up[1] + 0.5)));
      downs.forEach((d) => F(d, sm(t, J.up[1] - 0.4, J.down[0]) * (1 - sm(t, J.down[1], J.down[1] + 0.5))));
      pk.forEach((p, i) => {
        const pe = sm(t, J.pack[0] + i * 0.2, J.pack[0] + i * 0.2 + 0.7);
        const t0 = J.up[0] + i * 0.35, uu = sm(t, t0, t0 + 2.4), arr = sm(t, t0 + 2.4, t0 + 2.6);
        const d0 = J.down[0] + i * 0.25, du = sm(t, d0, d0 + 2.6), ab = sm(t, d0 + 2.6, d0 + 2.95);
        if (uu <= 0) tmp.copy(near(i));
        else if (du <= 0) { ride(tmp, near(i), W.curves.up, uu, 0.15); if (arr > 0) tmp.lerp(hold(i), arr); }
        else { ride(tmp, hold(i), W.curves.down[i], du, 0.12); if (ab > 0) tmp.lerp(pts.devScreen[i], ab); }
        p.position.copy(tmp);
        S(p, 0.5 * pop(pe) * (1 - 0.85 * ab)); F(p, (pe > 0 ? 1 : 0) * (1 - k01(ab, 0.6, 1)));
      });
      oks.forEach((c, i) => { c.position.copy(pts.devTop[i]).add(V(0, 0.55, 0.2)); const e = k01(t, J.read + i * 0.15, J.read + i * 0.15 + 0.3); S(c, 0.4 * pop(e)); c.scale.y = c.scale.x; F(c, e > 0 ? 1 : 0); });
    };
    anchor('tg.pk0', pk[0]); anchor('tg.orb', orb);
  });

  // ---------------------------------------------------------------- per-frame driver
  let hexT = 0;
  W.updateRigs = (time, dt, ctx) => {
    hexT -= dt; if (hexT <= 0) { hexT = 0.14; S0.hexes.forEach((h) => h.userData.update()); }
    for (const id in rigs) {
      const r = rigs[id];
      const active = !!ctx && ctx.id === id;
      if (active) { r.t = ctx.lt; r.fade = ctx.fade; }
      r.a += ((active ? 1 : 0) - r.a) * (1 - Math.exp(-dt * (active ? 6 : 5)));
      if (!active && r.a < 0.01) { r.a = 0; if (r.g.visible) r.g.visible = false; continue; }
      r.run(r.t, time, dt);
      r.tunnels.forEach((m) => { m.userData.map.offset.x -= dt * 0.55; });
      fadeTree(r.g, r.a * r.fade);
    }
  };
  W.rigs = rigs;
}
