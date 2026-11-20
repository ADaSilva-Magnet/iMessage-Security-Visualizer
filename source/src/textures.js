// Procedural canvas textures (no image files needed).
import * as THREE from 'three';
import { UI_FONT, MONO_FONT, fillRR, strokeRR, text, measure } from './util.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(cv, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}
// deterministic pseudo-random so every load looks the same
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function backdropTexture() {
  const cv = canvas(1024, 1024), c = cv.getContext('2d');
  const g = c.createRadialGradient(560, 430, 40, 512, 560, 760);
  g.addColorStop(0, '#1b2d4d'); g.addColorStop(0.45, '#0e1a2f'); g.addColorStop(1, '#050913');
  c.fillStyle = g; c.fillRect(0, 0, 1024, 1024);
  return tex(cv);
}

export function floorTexture() {
  const S = 2048, cv = canvas(S, S), c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#16233a'); g.addColorStop(0.55, '#0d1729'); g.addColorStop(1, '#070c17');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.save(); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); c.clip();
  const step = S / 38;
  for (let i = 0; i <= 38; i++) {
    const a = i % 5 === 0 ? 0.11 : 0.045;
    c.strokeStyle = `rgba(120,170,255,${a})`; c.lineWidth = i % 5 === 0 ? 2 : 1;
    c.beginPath(); c.moveTo(i * step, 0); c.lineTo(i * step, S); c.moveTo(0, i * step); c.lineTo(S, i * step); c.stroke();
  }
  c.restore();
  [0.47, 0.32].forEach((r, i) => { c.strokeStyle = `rgba(120,170,255,${i ? 0.08 : 0.14})`; c.lineWidth = 3; c.beginPath(); c.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); c.stroke(); });
  return tex(cv);
}

export function glowTexture() {
  const cv = canvas(256, 256), c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  return tex(cv, { srgb: false });
}

export function dotTexture() {
  const cv = canvas(64, 64), c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return tex(cv, { srgb: false });
}

// Moving stripes for the TLS tunnels (white; tinted by the material).
export function stripeTexture() {
  const cv = canvas(256, 64), c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(0, 0, 256, 64);
  const g = c.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.85)'); g.addColorStop(0.78, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 2) { c.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(x * 0.7)})`; c.fillRect(x, 0, 1, 64); }
  const t = tex(cv, { srgb: false }); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Big floating name plates for the Apple services.
export function signTexture(title, sub, color) {
  const cv = canvas(1024, 256), c = cv.getContext('2d');
  c.clearRect(0, 0, 1024, 256);
  c.shadowColor = color; c.shadowBlur = 26;
  text(c, title, 512, 128, { size: 132, weight: 800, color: '#ffffff', align: 'center' });
  c.shadowBlur = 0;
  text(c, sub, 512, 212, { size: 50, weight: 600, color, align: 'center' });
  return tex(cv);
}

// Short in-world labels on props (sprites), e.g. "SHA-1".
export function chipTexture(label, color = '#ffffff', { bg = 'rgba(5,11,22,0.88)', size = 64, pad = 28 } = {}) {
  const probe = canvas(8, 8).getContext('2d');
  const w = Math.ceil(measure(probe, label, size, 800)) + pad * 2, h = Math.round(size * 1.6);
  const cv = canvas(w, h), c = cv.getContext('2d');
  fillRR(c, 3, 3, w - 6, h - 6, h / 2 - 3, bg);
  strokeRR(c, 3, 3, w - 6, h - 6, h / 2 - 3, color, 5);
  text(c, label, w / 2, h / 2 + size * 0.36, { size, weight: 800, color, align: 'center' });
  const t = tex(cv); t.userData = { aspect: w / h };
  return t;
}

export function checkTexture(ok = true) {
  const cv = canvas(128, 128), c = cv.getContext('2d');
  c.fillStyle = ok ? 'rgba(34,197,94,0.97)' : 'rgba(239,68,68,0.95)'; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (ok) { c.moveTo(36, 66); c.lineTo(56, 86); c.lineTo(94, 44); } else { c.moveTo(40, 40); c.lineTo(88, 88); c.moveTo(88, 40); c.lineTo(40, 88); }
  c.stroke();
  return tex(cv);
}

// Animated "ciphertext": random hex, white on transparent (tinted per device by the material colour).
export function hexTexture(seed = 99) {
  const cv = canvas(512, 256), c = cv.getContext('2d');
  const t = tex(cv, { srgb: false });
  const r = rng(seed);
  t.userData.update = () => {
    c.clearRect(0, 0, 512, 256);
    c.font = `700 40px ${MONO_FONT}`; c.fillStyle = '#ffffff'; c.textBaseline = 'middle';
    for (let row = 0; row < 4; row++) {
      let s = '';
      for (let i = 0; i < 12; i++) s += '0123456789abcdef'[Math.floor(r() * 16)];
      c.globalAlpha = 0.55 + 0.45 * r();
      c.fillText(s.replace(/(.{4})/g, '$1 ').trim(), 24, 38 + row * 60);
    }
    c.globalAlpha = 1;
    t.needsUpdate = true;
  };
  t.userData.update();
  return t;
}

// The message text on the speech bubble.
export function bubbleTextTexture(s) {
  const cv = canvas(512, 160), c = cv.getContext('2d');
  c.clearRect(0, 0, 512, 160);
  text(c, s, 256, 98, { size: 64, weight: 600, color: '#ffffff', align: 'center' });
  return tex(cv);
}

export function photoTexture() {
  const cv = canvas(512, 360), c = cv.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#2c3e8f'); sky.addColorStop(0.45, '#e9737b'); sky.addColorStop(0.62, '#ffc27a'); sky.addColorStop(1, '#ffd9a0');
  c.fillStyle = sky; c.fillRect(0, 0, 512, 360);
  c.fillStyle = '#fff1c4'; c.beginPath(); c.arc(330, 196, 46, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3b2a4f'; c.beginPath(); c.moveTo(0, 250); c.lineTo(110, 150); c.lineTo(190, 225); c.lineTo(280, 140); c.lineTo(400, 240); c.lineTo(512, 180); c.lineTo(512, 360); c.lineTo(0, 360); c.fill();
  c.fillStyle = '#1d1630'; c.beginPath(); c.moveTo(0, 300); c.lineTo(140, 240); c.lineTo(260, 300); c.lineTo(390, 250); c.lineTo(512, 290); c.lineTo(512, 360); c.lineTo(0, 360); c.fill();
  c.fillStyle = 'rgba(255,214,150,0.35)'; c.fillRect(250, 305, 160, 6); c.fillRect(280, 320, 100, 5);
  return tex(cv);
}

export function scrambledTexture() {
  const cv = canvas(512, 360), c = cv.getContext('2d'), r = rng(5);
  c.fillStyle = '#0a1426'; c.fillRect(0, 0, 512, 360);
  for (let y = 0; y < 360; y += 24) for (let x = 0; x < 512; x += 32) {
    const v = r();
    c.fillStyle = v > 0.66 ? `rgba(58,160,255,${0.15 + r() * 0.35})` : v > 0.33 ? `rgba(34,211,238,${0.08 + r() * 0.25})` : `rgba(148,163,184,${0.05 + r() * 0.15})`;
    c.fillRect(x + 1, y + 1, 30, 22);
  }
  c.font = `700 26px ${MONO_FONT}`; c.fillStyle = 'rgba(226,240,255,0.75)';
  for (let row = 0; row < 6; row++) { let s = ''; for (let i = 0; i < 24; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]; c.fillText(s, 22, 44 + row * 56); }
  return tex(cv);
}

// IDS directory record card.
export function recordTexture(who, handle, device, color) {
  const cv = canvas(512, 320), c = cv.getContext('2d');
  fillRR(c, 4, 4, 504, 312, 26, 'rgba(6,14,28,0.96)'); strokeRR(c, 4, 4, 504, 312, 26, color, 6);
  text(c, who, 30, 70, { size: 50, weight: 800, color: '#ffffff' });
  text(c, device, 482, 70, { size: 40, weight: 700, color, align: 'right' });
  text(c, handle, 30, 128, { size: 34, weight: 600, color: '#cbd5e1' });
  const row = (y, label, col) => { fillRR(c, 30, y - 34, 452, 48, 12, 'rgba(255,255,255,0.06)'); c.fillStyle = col; c.beginPath(); c.arc(58, y - 10, 11, 0, Math.PI * 2); c.fill(); text(c, label, 84, y, { size: 32, weight: 600, color: '#e2e8f0' }); };
  row(196, 'Public encryption + signing keys', color);
  row(258, 'APNs address', '#f472b6');
  return tex(cv);
}
export function blankRecordTexture() {
  const cv = canvas(512, 320), c = cv.getContext('2d');
  fillRR(c, 4, 4, 504, 312, 26, 'rgba(10,20,36,0.9)'); strokeRR(c, 4, 4, 504, 312, 26, 'rgba(120,170,255,0.35)', 4);
  [70, 128, 196, 258].forEach((y, i) => fillRR(c, 30, y - 30, [300, 380, 452, 300][i], 30, 10, 'rgba(148,163,184,0.18)'));
  return tex(cv);
}

// Little luggage tag: "APNs address" / metadata.
export function tagTexture(title, sub, color) {
  const cv = canvas(512, 200), c = cv.getContext('2d');
  fillRR(c, 4, 4, 504, 192, 30, 'rgba(241,245,249,0.97)');
  c.fillStyle = color; c.beginPath(); c.arc(56, 100, 26, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(56, 100, 10, 0, Math.PI * 2); c.fill();
  text(c, title, 100, 92, { size: 50, weight: 800, color: '#0f172a' });
  text(c, sub, 100, 150, { size: 36, weight: 600, color: '#475569' });
  return tex(cv);
}

// What the attachment's iMessage carries: key, URI and hash.
export function pointerTexture() {
  const cv = canvas(640, 400), c = cv.getContext('2d');
  fillRR(c, 4, 4, 632, 392, 30, 'rgba(6,14,28,0.96)'); strokeRR(c, 4, 4, 632, 392, 30, '#7dd3fc', 6);
  text(c, 'Attachment details', 34, 66, { size: 44, weight: 800, color: '#ffffff' });
  [['AES key', '256-bit', '#e2e8f0'], ['URI', 'where it is in iCloud', '#7dd3fc'], ['SHA-1 hash', 'of the encrypted file', '#22d3ee']].forEach(([a, b, col], i) => {
    const y = 140 + i * 82;
    fillRR(c, 30, y - 46, 580, 66, 14, 'rgba(255,255,255,0.07)');
    text(c, a, 54, y, { size: 38, weight: 800, color: col });
    text(c, b, 600, y, { size: 32, weight: 600, color: '#94a3b8', align: 'right' });
  });
  return tex(cv);
}

// Seal printed by the ECDSA signature.
export function sealTexture() {
  const cv = canvas(256, 256), c = cv.getContext('2d');
  const g = c.createRadialGradient(110, 100, 10, 128, 128, 128);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#fbbf24'); g.addColorStop(1, '#b7791f');
  c.fillStyle = g; c.beginPath();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, r = i % 2 ? 118 : 126; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,72,10,0.7)'; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, 86, 0, Math.PI * 2); c.stroke();
  text(c, 'SIG', 128, 146, { size: 58, weight: 800, color: '#7c4a03', align: 'center' });
  return tex(cv);
}

export function keyboardTexture() {
  const cv = canvas(1024, 640), c = cv.getContext('2d');
  c.fillStyle = '#9aa3ae'; c.fillRect(0, 0, 1024, 640);
  fillRR(c, 40, 30, 944, 360, 14, '#2a2f37');
  for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) {
    if (r === 5 && k > 3 && k < 10) continue;
    fillRR(c, 52 + k * 66.5, 42 + r * 58, 58, r === 0 ? 30 : 50, 7, '#0f1216');
  }
  fillRR(c, 52 + 4 * 66.5, 42 + 5 * 58, 6 * 66.5 - 8, 50, 7, '#0f1216');
  fillRR(c, 352, 420, 320, 200, 18, '#8d96a1'); strokeRR(c, 352, 420, 320, 200, 18, '#7c8590', 3);
  return tex(cv);
}

export { strokeRR };
