// Story data and timelines shared by the 3D scene, the labels, the device screens and the close-up,
// so all of them tell the same story at the same moment.
import { clamp, smooth } from './util.js';

export const SENDER = { name: 'Alex', phone: '+1 (212) 555-0142', email: 'alex@example.com' };
export const RECIP = { name: 'Riley', phone: '+1 (212) 555-0188', email: 'riley@example.com' };
export const MESSAGE = 'See you at 6?';
export const DEVICES = [
  { key: 'phone', name: "Riley's iPhone", short: 'iPhone', color: '#4ade80' },
  { key: 'pad', name: "Riley's iPad", short: 'iPad', color: '#a78bfa' },
  { key: 'mac', name: "Riley's Mac", short: 'Mac', color: '#fb923c' },
];

// Each section plays its animation (T seconds), holds the end state, fades and replays.
export const TIMING = {
  overview: [0, 0], keys: [6.4, 6], register: [9.6, 6], lookup: [7.2, 6], msgkey: [7.2, 6], encrypt: [5.4, 6],
  wrap: [6.4, 6], sign: [6.4, 6], package: [4.6, 6], apns: [7.0, 5], attach: [10.4, 5], deliver: [10.2, 5],
  unlock: [9.4, 6], fetch: [8.2, 6], together: [17.5, 4],
};
export function loopInfo(id, t) {
  const [T, hold] = TIMING[id] || [0, 0];
  if (!T) return { lt: t, cycle: 0, fade: 1 };
  const L = T + hold, cycle = Math.floor(t / L), lt = t - cycle * L;
  let fade = 1;
  if (lt > L - 0.7) fade = clamp((L - lt) / 0.7);
  if (cycle > 0 && lt < 0.45) fade = Math.min(fade, clamp(lt / 0.45));
  return { lt, cycle, fade };
}

export const k01 = (t, a, b) => clamp((t - a) / (b - a));
export const sm = (t, a, b) => smooth(k01(t, a, b));

// Lanes on the sender's side: one per receiving device (staggered).
export const LANE_STAGGER = 0.42;
export const lane = (t, i) => t - i * LANE_STAGGER;

// Key moments, in seconds from the start of each section.
export const T = {
  register: { alex: 3.0, phone: 4.3, pad: 5.2, mac: 7.9, alert: 8.2 },
  lookup: { ask: [0.5, 2.0], search: [2.0, 3.0], back: [3.1, 5.1], stagger: 0.45 },
  msgkey: { rand: 1.0, hmac: [2.3, 4.0], attach: [4.0, 4.9], done: 5.2 },
  encrypt: { pass: [0.9, 2.6] },
  wrap: { box: [0.3, 1.4], key: [1.5, 2.9], turn: [2.9, 3.4], slide: [4.2, 5.2] },
  sign: { scan: [0.3, 1.4], stamps: [2.3, 3.1, 3.9], back: 4.8 },
  package: { shell: [0.3, 1.8], ghost: [2.4, 3.6] },
  apns: { tunnel: [0.1, 0.9], leave: 0.7, ride: 2.6, stagger: 0.55 },
  attach: { photo: [0.3, 1.1], key: [1.2, 1.9], enc: [2.0, 2.9], up: [3.0, 5.4], card: [5.5, 6.3], wrap: [6.5, 7.3], go: [7.5, 9.8] },
  deliver: { phone: [1.0, 3.5], pad: [1.4, 3.9], queue: [1.6, 2.5], wake: 6.2, mac: [6.6, 9.0] },
  unlock: { open: [0.3, 1.1], sig: [1.2, 2.5], ok: 2.6, priv: [2.9, 4.3], turn: [4.3, 4.7], bar: [4.8, 5.4], dec: [5.4, 6.4], check: [6.5, 7.2], show: [7.4, 8.3], name: 8.4 },
  fetch: { card: [0.2, 1.0], ask: [1.0, 2.0], down: [2.0, 4.2], hash: [4.4, 5.2], ok: 5.25, dec: [5.6, 6.5], show: [6.7, 7.6] },
  together: { reg: [0.3, 2.6], look: [2.8, 5.0], pack: [5.2, 6.6], up: [6.8, 9.8], down: [10.0, 13.6], read: 13.8 },
};

// What each device screen and the close-up should show at time t (used by screens.js).
export function deliverState(t) {
  const D = T.deliver;
  return {
    phone: t >= D.phone[1], pad: t >= D.pad[1], mac: t >= D.mac[1],
    queued: t >= D.queue[1] && t < D.mac[0], macOn: t >= D.wake,
    clock: clamp((t - D.queue[1]) / (D.wake - D.queue[1])),
  };
}
export function unlockState(t) {
  const U = T.unlock;
  return { sig: t >= U.ok, key: t >= U.turn[1], text: t >= U.dec[1] - 0.2, check: t >= U.check[1] - 0.2, shown: t >= U.show[1], named: t >= U.name };
}
export function fetchState(t) {
  const F = T.fetch;
  return { card: t >= F.card[0], asked: t >= F.ask[1], down: t >= F.down[1], hash: t >= F.ok, dec: t >= F.dec[1], shown: t >= F.show[1] };
}
