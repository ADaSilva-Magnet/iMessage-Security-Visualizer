// 2D drawing: the "Close-up" diagrams (1600 x 900, shown in the corner panel) and the screens of the four
// devices in the 3D scene. Screens are simplified illustrations, not copies of Apple's interface.
import { UI_FONT, MONO_FONT, clamp, lerp, smooth, easeOutBack, rrPath, fillRR, strokeRR, text, measure } from './util.js';
import { T, k01, sm, lane, SENDER, RECIP, MESSAGE, DEVICES, deliverState, unlockState, fetchState } from './sync.js';

const W = 1600, H = 900;
const C = {
  send: '#3aa0ff', ids: '#22d3ee', apns: '#f472b6', cloud: '#7dd3fc', sign: '#fbbf24', tls: '#2dd4bf',
  ink: '#e8eef9', sub: '#9fb0c8', dim: '#64748b', ok: '#22c55e', bad: '#ef4444', panel: 'rgba(255,255,255,0.05)', line: 'rgba(148,163,184,0.28)',
};
const DEV = DEVICES.map((d) => d.color);
const hexr = (seed, n) => { let s = seed >>> 0, o = ''; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; o += '0123456789abcdef'[s >>> 28]; } return o; };

// ------------------------------------------------------------------ shared drawing helpers
function bg(c) {
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#081329'); g.addColorStop(1, '#0d2142');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const blob = (x, y, r, col) => { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); };
  blob(1250, 300, 520, 'rgba(56,140,255,0.20)'); blob(250, 820, 480, 'rgba(34,211,238,0.10)');
}
function title(c, s, sub) {
  text(c, 'CLOSE-UP', 64, 72, { size: 24, weight: 800, color: C.ids });
  text(c, s, 64, 124, { size: 50, weight: 800, color: C.ink });
  if (sub) text(c, sub, 64, 168, { size: 28, color: C.sub });
}
function panel(c, x, y, w, h, stroke = C.line, fill = C.panel, r = 22) { fillRR(c, x, y, w, h, r, fill); strokeRR(c, x, y, w, h, r, stroke, 2.5); }
function mark(c, x, y, r, ok = true) {
  c.save(); c.fillStyle = ok ? C.ok : C.bad; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = r * 0.28; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (ok) { c.moveTo(x - r * 0.45, y + r * 0.02); c.lineTo(x - r * 0.1, y + r * 0.38); c.lineTo(x + r * 0.5, y - r * 0.35); }
  else { c.moveTo(x - r * 0.38, y - r * 0.38); c.lineTo(x + r * 0.38, y + r * 0.38); c.moveTo(x + r * 0.38, y - r * 0.38); c.lineTo(x - r * 0.38, y + r * 0.38); }
  c.stroke(); c.restore();
}
function pill(c, s, x, y, col, { size = 26, h = 44, fill, align = 'left', fg } = {}) {
  const w = measure(c, s, size, 800) + 30, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  fillRR(c, x0, y, w, h, h / 2, fill || col + '33'); strokeRR(c, x0, y, w, h, h / 2, col, 2.5);
  text(c, s, x0 + w / 2, y + h / 2 + size * 0.36, { size, weight: 800, color: fg || col, align: 'center' });
  return w;
}
function keyIcon(c, x, y, s, col, priv = false) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = s * 0.13; c.lineCap = 'round';
  c.beginPath(); c.arc(-s * 0.32, 0, s * 0.22, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(-s * 0.1, 0); c.lineTo(s * 0.5, 0); c.moveTo(s * 0.38, 0); c.lineTo(s * 0.38, s * 0.2); c.moveTo(s * 0.24, 0); c.lineTo(s * 0.24, s * 0.15); c.stroke();
  if (priv) { fillRR(c, -s * 0.44, -s * 0.05, s * 0.24, s * 0.2, 3, col); c.lineWidth = s * 0.06; c.beginPath(); c.arc(-s * 0.32, -s * 0.05, s * 0.07, Math.PI, 0); c.stroke(); }
  c.restore();
}
function lockIcon(c, x, y, s, col, open = false) {
  c.save(); c.strokeStyle = col; c.lineWidth = s * 0.12; c.beginPath();
  c.arc(x, y - s * 0.12, s * 0.24, Math.PI, open ? Math.PI * 1.75 : Math.PI * 2); if (!open) c.lineTo(x + s * 0.24, y + s * 0.05); c.moveTo(x - s * 0.24, y - s * 0.12); c.lineTo(x - s * 0.24, y + s * 0.05); c.stroke();
  fillRR(c, x - s * 0.36, y, s * 0.72, s * 0.5, s * 0.1, col); c.fillStyle = '#0b1220'; c.beginPath(); c.arc(x, y + s * 0.22, s * 0.07, 0, Math.PI * 2); c.fill();
  c.restore();
}
function devIcon(c, kind, x, y, s, col) {
  c.save(); c.strokeStyle = col; c.lineWidth = s * 0.07;
  if (kind === 'phone') { strokeRR(c, x - s * 0.24, y - s * 0.45, s * 0.48, s * 0.9, s * 0.1, col, s * 0.07); fillRR(c, x - s * 0.08, y - s * 0.38, s * 0.16, s * 0.05, 3, col); }
  else if (kind === 'pad') { strokeRR(c, x - s * 0.46, y - s * 0.33, s * 0.92, s * 0.66, s * 0.08, col, s * 0.07); }
  else { strokeRR(c, x - s * 0.4, y - s * 0.36, s * 0.8, s * 0.52, s * 0.05, col, s * 0.07); fillRR(c, x - s * 0.5, y + s * 0.2, s, s * 0.1, 4, col); }
  c.restore();
}
function cloudIcon(c, x, y, s, col) {
  c.save(); c.fillStyle = col; c.beginPath();
  c.arc(x - s * 0.22, y + s * 0.06, s * 0.2, 0, Math.PI * 2); c.arc(x + s * 0.02, y - s * 0.08, s * 0.27, 0, Math.PI * 2); c.arc(x + s * 0.27, y + s * 0.07, s * 0.19, 0, Math.PI * 2); c.fill();
  c.fillRect(x - s * 0.22, y + s * 0.06, s * 0.5, s * 0.2); c.restore();
}
function dirIcon(c, x, y, s, col) {
  c.save(); for (let i = 0; i < 3; i++) { fillRR(c, x - s * 0.38, y - s * 0.38 + i * s * 0.27, s * 0.76, s * 0.2, 5, i === 1 ? col : col + '77'); }
  c.restore();
}
function relayIcon(c, x, y, s, col) {
  c.save(); c.strokeStyle = col; c.lineWidth = s * 0.08; c.beginPath(); c.arc(x, y, s * 0.36, 0, Math.PI * 2); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, s * 0.13, 0, Math.PI * 2); c.fill();
  c.lineWidth = s * 0.04; c.beginPath(); c.ellipse(x, y, s * 0.24, s * 0.1, 0.6, 0, Math.PI * 2); c.stroke(); c.restore();
}
function pkgIcon(c, x, y, s, col) {
  fillRR(c, x - s * 0.5, y - s * 0.22, s, s * 0.44, s * 0.22, 'rgba(156,200,255,0.16)'); strokeRR(c, x - s * 0.5, y - s * 0.22, s, s * 0.44, s * 0.22, col, 3);
  fillRR(c, x - s * 0.36, y - s * 0.1, s * 0.2, s * 0.2, 4, col); fillRR(c, x - s * 0.1, y - s * 0.1, s * 0.26, s * 0.2, 4, '#1e293b'); c.fillStyle = C.sign; c.beginPath(); c.arc(x + s * 0.3, y, s * 0.09, 0, Math.PI * 2); c.fill();
}
// byte boxes; fn(i) -> { fill, stroke, label, alpha }
function bytes(c, x, y, n, bw, bh, gap, fn) {
  for (let i = 0; i < n; i++) {
    const o = fn(i); if (!o) continue;
    c.save(); c.globalAlpha *= o.alpha ?? 1;
    fillRR(c, x + i * (bw + gap), y, bw, bh, 8, o.fill); if (o.stroke) strokeRR(c, x + i * (bw + gap), y, bw, bh, 8, o.stroke, 2.5);
    if (o.label) text(c, o.label, x + i * (bw + gap) + bw / 2, y + bh / 2 + 10, { size: 28, weight: 700, color: o.fg || '#0b1220', align: 'center', family: MONO_FONT });
    c.restore();
  }
}
function brace(c, x0, x1, y, label, col, up = false) {
  c.save(); c.strokeStyle = col; c.lineWidth = 3; c.beginPath();
  const d = up ? -14 : 14; c.moveTo(x0, y); c.lineTo(x0, y + d); c.lineTo(x1, y + d); c.lineTo(x1, y); c.moveTo((x0 + x1) / 2, y + d); c.lineTo((x0 + x1) / 2, y + d * 2); c.stroke(); c.restore();
  text(c, label, (x0 + x1) / 2, y + (up ? -40 : 66), { size: 28, weight: 800, color: col, align: 'center' });
}
function chev(c, x, y, col = C.dim, s = 22) { c.save(); c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - s * 0.35, y - s * 0.6); c.lineTo(x + s * 0.35, y); c.lineTo(x - s * 0.35, y + s * 0.6); c.stroke(); c.restore(); }
function stage(c, x, y, w, h, head, sub, col, on, draw) {
  c.save(); c.globalAlpha *= on ? 1 : 0.38;
  panel(c, x, y, w, h, on ? col : C.line, on ? col + '1f' : C.panel);
  if (draw) draw(x + w / 2, y + 64);
  text(c, head, x + w / 2, y + 140, { size: 30, weight: 800, color: on ? '#ffffff' : C.sub, align: 'center', maxWidth: w - 24 });
  if (sub) text(c, sub, x + w / 2, y + 180, { size: 23, color: C.sub, align: 'center', maxWidth: w - 24 });
  c.restore();
}

// ------------------------------------------------------------------ close-up screens
function cOverview(c, t) {
  title(c, 'Who does what', 'Five players — and only the two ends can read the message');
  const cards = [
    ['phone', "Alex's iPhone", 'Sender', 'Encrypts the message separately for each receiving device', C.send],
    ['dir', 'IDS', 'Apple Identity Service', 'Directory of public keys and APNs addresses', C.ids],
    ['relay', 'APNs', 'Apple Push Notification service', 'Relays the encrypted messages', C.apns],
    ['cloud', 'iCloud', 'Attachments', 'Holds encrypted photos and long messages', C.cloud],
    ['devs', "Riley's devices", 'Recipient', 'Each device decrypts its own copy', DEV[0]],
  ];
  const hi = Math.floor(t / 1.8) % cards.length, cw = 276, gap = 20, x0 = (W - (cw * 5 + gap * 4)) / 2;
  cards.forEach(([k, name, role, what, col], i) => {
    const x = x0 + i * (cw + gap), y = 230, on = i === hi;
    panel(c, x, y, cw, 420, on ? col : C.line, on ? col + '22' : C.panel);
    const cx = x + cw / 2, cy = y + 100;
    if (k === 'phone') devIcon(c, 'phone', cx, cy, 110, col);
    else if (k === 'dir') dirIcon(c, cx, cy, 110, col);
    else if (k === 'relay') relayIcon(c, cx, cy, 120, col);
    else if (k === 'cloud') cloudIcon(c, cx, cy, 150, col);
    else { devIcon(c, 'phone', cx - 70, cy + 6, 70, DEV[0]); devIcon(c, 'pad', cx, cy + 4, 80, DEV[1]); devIcon(c, 'mac', cx + 78, cy + 4, 80, DEV[2]); }
    text(c, name, cx, y + 210, { size: 34, weight: 800, color: '#fff', align: 'center' });
    text(c, role, cx, y + 248, { size: 22, weight: 700, color: col, align: 'center', maxWidth: cw - 20 });
    wrapText(c, what, cx, y + 300, cw - 36, 26, 34, C.sub, 'center');
  });
  fillRR(c, 64, 700, W - 128, 130, 22, 'rgba(34,197,94,0.12)'); strokeRR(c, 64, 700, W - 128, 130, 22, 'rgba(34,197,94,0.55)', 2.5);
  lockIcon(c, 130, 752, 64, '#4ade80');
  text(c, 'End-to-end encrypted', 190, 756, { size: 36, weight: 800, color: '#bbf7d0' });
  text(c, 'Only the sender and receiver can access messages and attachments. Apple can\'t decrypt the data.', 190, 800, { size: 27, color: '#dcfce7' });
}
function wrapText(c, s, x, y, maxW, size, lh, color, align = 'left', weight = 500) {
  const words = s.split(' '); let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (measure(c, test, size, weight) > maxW && line) { text(c, line, x, yy, { size, color, align, weight }); line = w; yy += lh; } else line = test;
  }
  if (line) text(c, line, x, yy, { size, color, align, weight });
  return yy;
}

function cKeys(c, t) {
  title(c, 'Turning on iMessage', 'Two asymmetric key pairs: each is a public key and a matching private key');
  const PAIRS = [
    ['Encryption key pair', 'Keeps messages private', C.send, 140, ['locks data for this device', 'the only key that unlocks it']],
    ['Signing key pair', 'Proves who sent a message', C.sign, 820, ['checks this device\'s signatures', 'signs what this device sends']],
  ];
  PAIRS.forEach(([name, job, col, x, does], ci) => {
    const a = sm(t, 0.3 + ci * 0.4, 0.9 + ci * 0.4);
    c.save(); c.globalAlpha = a;
    panel(c, x, 200, 640, 590, col, col + '14');
    text(c, name, x + 320, 258, { size: 38, weight: 800, color: '#fff', align: 'center' });
    text(c, job, x + 320, 300, { size: 27, weight: 700, color: col, align: 'center' });
    [['Public key', 'sent to IDS', false], ['Private key', 'stays on the device', true]].forEach(([k, where, priv], ri) => {
      const y = 330 + ri * 220, on = !priv || t > 3.4;
      fillRR(c, x + 30, y, 580, 200, 18, 'rgba(255,255,255,0.06)');
      keyIcon(c, x + 120, y + 100, 110, col, priv);
      text(c, k, x + 215, y + 62, { size: 34, weight: 800, color: '#fff' });
      c.save(); c.globalAlpha *= priv ? lerp(0.35, 1, sm(t, 3.4, 4.2)) : 1;
      text(c, where, x + 215, y + 106, { size: 25, weight: 700, color: priv ? '#fde68a' : '#a5f3fc' });
      c.restore();
      text(c, does[ri], x + 215, y + 150, { size: 24, weight: 600, color: '#e2e8f0', maxWidth: 380 });
      if (priv && on) lockIcon(c, x + 572, y + 40, 40, '#fde68a');
    });
    c.restore();
  });
  text(c, 'Every device does this: Alex\'s iPhone, and each of Riley\'s iPhone, iPad and Mac.', W / 2, 850, { size: 28, color: C.sub, align: 'center' });
}

function cRegister(c, t) {
  title(c, 'The IDS directory', 'Phone number or email → each device\'s public keys and APNs address');
  const x = 64, y = 210, w = 1080, cols = [x + 24, x + 420, x + 600, x + 860];
  panel(c, x, y, w, 590);
  ['Phone number / email', 'Device', 'Public keys', 'APNs address'].forEach((s, i) => text(c, s, cols[i], y + 54, { size: 24, weight: 800, color: C.dim }));
  const rows = [[SENDER.phone, "Alex's iPhone", C.send, T.register.alex], [RECIP.phone, "Riley's iPhone", DEV[0], T.register.phone], [RECIP.email, "Riley's iPad", DEV[1], T.register.pad], [RECIP.email, "Riley's Mac", DEV[2], T.register.mac]];
  rows.forEach(([h, d, col, ta], i) => {
    const a = sm(t, ta - 0.2, ta + 0.4); if (a <= 0) return;
    const ry = y + 86 + i * 120;
    c.save(); c.globalAlpha = a;
    fillRR(c, x + 12, ry, w - 24, 104, 14, i === 3 && t < ta + 3 ? col + '2a' : 'rgba(255,255,255,0.05)');
    text(c, h, cols[0], ry + 62, { size: 30, weight: 700, color: '#fff', family: MONO_FONT });
    text(c, d, cols[1], ry + 62, { size: 28, weight: 700, color: col });
    keyIcon(c, cols[2] + 30, ry + 52, 56, col); keyIcon(c, cols[2] + 110, ry + 52, 56, C.sign);
    fillRR(c, cols[3], ry + 30, 150, 44, 10, 'rgba(244,114,182,0.2)'); text(c, 'APNs ✓', cols[3] + 75, ry + 61, { size: 24, weight: 800, color: C.apns, align: 'center' });
    if (i === 3) pill(c, 'NEW', x + w - 110, ry + 30, '#fbbf24', { size: 22, h: 40 });
    c.restore();
  });
  const rx = 1176, rw = 360;
  panel(c, rx, y, rw, 290);
  text(c, 'How addresses are verified', rx + 24, y + 52, { size: 26, weight: 800, color: '#fff' });
  text(c, 'Email address', rx + 24, y + 112, { size: 26, weight: 800, color: C.ids });
  text(c, 'confirmation link', rx + 24, y + 148, { size: 24, color: C.sub });
  text(c, 'Phone number', rx + 24, y + 206, { size: 26, weight: 800, color: C.ids });
  text(c, 'carrier network and SIM', rx + 24, y + 242, { size: 24, color: C.sub });
  const al = sm(t, T.register.alert, T.register.alert + 0.5);
  c.save(); c.globalAlpha = 0.35 + 0.65 * al;
  panel(c, rx, y + 310, rw, 280, al > 0.5 ? '#fbbf24' : C.line, al > 0.5 ? 'rgba(251,191,36,0.12)' : C.panel);
  text(c, 'Alert on every device', rx + 24, y + 362, { size: 26, weight: 800, color: '#fde68a' });
  wrapText(c, 'All of the user\'s registered devices show an alert when a new device, phone number or email address is added.', rx + 24, y + 404, rw - 48, 23, 32, '#e2e8f0');
  c.restore();
}

function cLookup(c, t) {
  title(c, 'Who is Riley?', 'The sender\'s device asks IDS about every device the recipient has');
  const L = T.lookup;
  const typed = 'Riley'.slice(0, Math.floor(clamp(t / 0.5) * 5));
  // stage 1: address
  panel(c, 64, 220, 440, 560);
  text(c, '1  Address', 94, 276, { size: 30, weight: 800, color: '#fff' });
  fillRR(c, 94, 310, 380, 70, 14, 'rgba(255,255,255,0.08)');
  text(c, 'To:', 116, 356, { size: 30, weight: 700, color: C.sub });
  text(c, typed, 176, 356, { size: 30, weight: 800, color: t > L.back[1] + 0.9 ? C.send : '#fff' });
  const ca = sm(t, 0.4, 1.0);
  c.save(); c.globalAlpha = ca;
  text(c, 'A name? Contacts first:', 94, 430, { size: 24, weight: 700, color: C.sub });
  [[RECIP.phone, 'phone'], [RECIP.email, 'email']].forEach(([s, k], i) => { fillRR(c, 94, 452 + i * 78, 380, 64, 12, 'rgba(58,160,255,0.14)'); text(c, s, 116, 494 + i * 78, { size: 27, weight: 700, color: '#dbeafe', family: MONO_FONT }); });
  c.restore();
  text(c, 'Entering a phone number or email skips this step.', 94, 740, { size: 21, color: C.dim, maxWidth: 390 });
  chev(c, 535, 500);
  // stage 2: ask IDS
  const asking = t >= L.ask[0], answered = t >= L.back[0];
  stage(c, 566, 330, 300, 340, '2  Ask IDS', answered ? 'answer received' : asking ? 'looking up…' : '', C.ids, asking, (x, y) => dirIcon(c, x, y + 20, 90, C.ids));
  chev(c, 897, 500);
  // stage 3: answer
  panel(c, 928, 220, 608, 560, answered ? C.ids : C.line);
  text(c, '3  IDS returns, for each device', 958, 276, { size: 30, weight: 800, color: '#fff' });
  DEVICES.forEach((d, i) => {
    const a = sm(t, L.back[0] + i * L.stagger, L.back[0] + i * L.stagger + 0.6); if (a <= 0) return;
    const y = 312 + i * 146;
    c.save(); c.globalAlpha = a;
    fillRR(c, 958, y, 548, 126, 16, d.color + '1f'); strokeRR(c, 958, y, 548, 126, 16, d.color, 2.5);
    devIcon(c, d.key === 'phone' ? 'phone' : d.key, 1010, y + 63, 70, d.color);
    text(c, d.name, 1070, y + 52, { size: 30, weight: 800, color: '#fff' });
    keyIcon(c, 1094, y + 92, 44, d.color); keyIcon(c, 1150, y + 92, 44, C.sign);
    text(c, 'public keys', 1186, y + 100, { size: 23, weight: 600, color: C.sub });
    fillRR(c, 1330, y + 70, 150, 40, 10, 'rgba(244,114,182,0.2)'); text(c, 'APNs address', 1405, y + 98, { size: 20, weight: 800, color: C.apns, align: 'center' });
    c.restore();
  });
}

function keyStrip(c, x, y, i, t, { bw = 62, bh = 62, gap = 8, done = true, show40 = 1, flickT = 0, labels = true } = {}) {
  const r = hexr(17 + i * 31, 32), col = DEV[i];
  const lab = (s) => (labels ? s : '');
  bytes(c, x, y, 16, bw, bh, gap, (j) => {
    if (j < 11) return { fill: '#e2e8f0', label: lab(done ? r.slice(j * 2, j * 2 + 2) : hexr(Math.floor(flickT * 12) + j * 7 + i, 2)) };
    const a = clamp(show40 * 5 - (j - 11)); if (a <= 0) return { fill: 'rgba(255,255,255,0.05)', stroke: col + '66' };
    return { fill: col, label: lab(r.slice(j * 2, j * 2 + 2)), alpha: a };
  });
}
function cMsgkey(c, t) {
  title(c, 'A fresh 128-bit key for each device', 'Built from two parts, separately for every receiving device');
  const M = T.msgkey, bw = 62, gap = 8, x = 64;
  DEVICES.forEach((d, i) => {
    const li = lane(t, i), y = 256 + i * 132;
    const show = k01(li, M.rand, M.rand + 0.6);
    c.save(); c.globalAlpha = show;
    text(c, d.name, x, y - 16, { size: 26, weight: 800, color: d.color });
    keyStrip(c, x, y, i, t, { done: li > M.done, show40: k01(li, M.attach[0], M.attach[1]), flickT: t });
    c.restore();
  });
  const bx0 = x, bx1 = x + 11 * (bw + gap) - gap, bx2 = x + 16 * (bw + gap) - gap;
  brace(c, bx0, bx1 - 4, 600, '88-bit random value', '#e2e8f0');
  brace(c, bx1 + 4, bx2, 600, '40-bit value', DEV[0]);
  const done = k01(t, M.done, M.done + 0.5);
  c.save(); c.globalAlpha = 0.35 + 0.65 * done;
  fillRR(c, bx0, 712, bx2 - bx0, 86, 18, 'rgba(58,160,255,0.16)'); strokeRR(c, bx0, 712, bx2 - bx0, 86, 18, C.send, 2.5);
  text(c, '88 + 40 bits = 128-bit AES key, one per receiving device', (bx0 + bx2) / 2, 766, { size: 30, weight: 800, color: '#fff', align: 'center' });
  c.restore();
  // HMAC panel
  const px = 1210, py = 200, pw = 330;
  const on = t > M.hmac[0] - 0.2;
  panel(c, px, py, pw, 620, on ? '#e2e8f0' : C.line);
  text(c, 'HMAC-SHA-256', px + pw / 2, py + 54, { size: 32, weight: 800, color: '#fff', align: 'center' });
  text(c, 'key', px + 24, py + 106, { size: 22, weight: 800, color: C.dim });
  fillRR(c, px + 24, py + 120, pw - 48, 54, 12, 'rgba(226,232,240,0.16)'); text(c, '88-bit random value', px + 40, py + 156, { size: 24, weight: 700, color: '#e2e8f0' });
  text(c, 'derived from', px + 24, py + 222, { size: 22, weight: 800, color: C.dim });
  [["sender's public key", C.send], ["receiver's public key", DEV[0]], [`plaintext "${MESSAGE}"`, '#93c5fd']].forEach(([s, col], i) => {
    fillRR(c, px + 24, py + 236 + i * 66, pw - 48, 54, 12, col + '26'); text(c, s, px + 40, py + 272 + i * 66, { size: 22, weight: 700, color: col, maxWidth: pw - 70 });
  });
  text(c, '↓', px + pw / 2, py + 470, { size: 36, weight: 800, color: C.sub, align: 'center' });
  fillRR(c, px + 24, py + 490, pw - 48, 54, 12, DEV[0]); text(c, '40-bit value', px + pw / 2, py + 526, { size: 26, weight: 800, color: '#0b1220', align: 'center' });
  text(c, 'later checks the decrypted text', px + pw / 2, py + 586, { size: 20, color: C.sub, align: 'center' });
}

function cEncrypt(c, t) {
  title(c, 'AES in Counter (CTR) mode', 'Each device\'s 128-bit key encrypts the message');
  const chars = MESSAGE.split(''), n = chars.length, bw = 76, gap = 10, x0 = 250, E = T.encrypt;
  const prog = clamp((t - E.pass[0]) / (E.pass[1] - E.pass[0] + 0.6));
  const done = Math.floor(prog * n + 0.001);
  const rows = [['Plaintext', 240], ['Keystream', 380], ['Ciphertext', 520]];
  rows.forEach(([s, y]) => text(c, s, x0 - 22, y + 46, { size: 26, weight: 800, color: C.sub, align: 'right' }));
  const ks = hexr(5, n * 2), ct = hexr(77, n * 2);
  bytes(c, x0, 240, n, bw, 70, gap, (j) => ({ fill: '#1d8cf8', label: chars[j] === ' ' ? '␣' : chars[j], fg: '#fff' }));
  bytes(c, x0, 380, n, bw, 70, gap, (j) => ({ fill: j < done + 1 && prog > 0 ? 'rgba(147,197,253,0.85)' : 'rgba(255,255,255,0.06)', label: j < done + 1 && prog > 0 ? ks.slice(j * 2, j * 2 + 2) : '', stroke: 'rgba(147,197,253,0.4)' }));
  bytes(c, x0, 520, n, bw, 70, gap, (j) => ({ fill: j < done ? DEV[0] : 'rgba(255,255,255,0.06)', label: j < done ? ct.slice(j * 2, j * 2 + 2) : '', stroke: DEV[0] + '66' }));
  text(c, 'XOR', x0 + n * (bw + gap) + 14, 470, { size: 26, weight: 800, color: '#93c5fd' });
  text(c, 'keystream = AES(128-bit key, counter)', x0, 640, { size: 26, color: C.sub });
  // three different ciphertexts
  panel(c, 64, 680, W - 128, 160);
  text(c, 'Same message, different key per device → three different ciphertexts', 94, 728, { size: 27, weight: 800, color: '#fff' });
  DEVICES.forEach((d, i) => {
    const a = k01(lane(t, i), E.pass[1] - 0.3, E.pass[1] + 0.2);
    c.save(); c.globalAlpha = 0.25 + 0.75 * a;
    text(c, d.short, 94 + i * 480, 790, { size: 25, weight: 800, color: d.color });
    text(c, hexr(300 + i * 91, 16), 94 + i * 480 + 100, 790, { size: 25, weight: 700, color: '#e2e8f0', family: MONO_FONT });
    c.restore();
  });
}

function cWrap(c, t) {
  title(c, 'Locking the message key', 'Encrypted to the public key of the receiving device');
  const Wt = T.wrap;
  DEVICES.forEach((d, i) => {
    const li = lane(t, i), y = 230 + i * 160, locked = li > Wt.turn[1];
    panel(c, 64, y, 1060, 136, locked ? d.color : C.line, locked ? d.color + '14' : C.panel);
    keyStrip(c, 94, y + 34, i, t, { bw: 20, bh: 50, gap: 4, labels: false });
    text(c, `${d.short} · 128-bit key`, 94, y + 116, { size: 21, weight: 700, color: C.sub });
    chev(c, 508, y + 60);
    fillRR(c, 536, y + 20, 290, 96, 14, 'rgba(255,255,255,0.07)');
    text(c, 'RSA-OAEP or ECIES', 681, y + 56, { size: 25, weight: 800, color: '#fff', align: 'center' });
    keyIcon(c, 578, y + 88, 34, d.color); text(c, `${d.short}'s public key`, 604, y + 95, { size: 20, weight: 700, color: d.color });
    chev(c, 852, y + 60);
    lockIcon(c, 906, y + 46, 66, locked ? d.color : '#475569', !locked);
    text(c, locked ? 'locked' : '…', 954, y + 72, { size: 26, weight: 800, color: locked ? '#fff' : C.dim });
  });
  const px = 1160, pw = 376;
  panel(c, px, 230, pw, 600);
  text(c, 'Who can open it?', px + 24, 284, { size: 28, weight: 800, color: '#fff' });
  wrapText(c, 'Only the device holding the matching private key — that is, the device it was encrypted for.', px + 24, 330, pw - 48, 24, 34, C.sub);
  text(c, 'Algorithm', px + 24, 520, { size: 28, weight: 800, color: '#fff' });
  wrapText(c, 'RSA-OAEP. On iPhone with iOS 13 or later and iPad with iPadOS 13.1 or later, devices may use ECIES instead.', px + 24, 566, pw - 48, 24, 34, C.sub);
}

function cSign(c, t) {
  title(c, 'Hash, then sign', 'Proves which device sent it and that it hasn\'t been changed');
  const St = T.sign, scanned = t > St.scan[1], signed = t > St.stamps[0];
  const y = 270, h = 330;
  panel(c, 64, y, 360, h, C.line);
  text(c, 'Encrypted text', 244, y + 70, { size: 28, weight: 800, color: '#fff', align: 'center' });
  fillRR(c, 104, y + 90, 280, 66, 12, DEV[0] + '33'); text(c, hexr(8, 14), 244, y + 134, { size: 24, weight: 700, color: '#e2e8f0', align: 'center', family: MONO_FONT });
  text(c, '+', 244, y + 200, { size: 40, weight: 800, color: C.sub, align: 'center' });
  text(c, 'Encrypted key', 244, y + 250, { size: 28, weight: 800, color: '#fff', align: 'center' });
  lockIcon(c, 244, y + 270, 46, DEV[0]);
  chev(c, 452, y + h / 2);
  stage(c, 480, y + 20, 260, 290, 'SHA-1', 'hash of both', C.ids, t > St.scan[0], (x, yy) => { c.save(); c.fillStyle = C.ids; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.lineTo(x + Math.cos(a) * 44, yy + 10 + Math.sin(a) * 44); } c.closePath(); c.fill(); c.restore(); });
  chev(c, 768, y + h / 2);
  panel(c, 796, y + 20, 300, 290, scanned ? C.ids : C.line);
  text(c, 'Hash', 946, y + 80, { size: 28, weight: 800, color: '#fff', align: 'center' });
  const hh = hexr(4242, 40);
  for (let r = 0; r < 4; r++) text(c, scanned ? hh.slice(r * 10, r * 10 + 10) : '··········', 946, y + 140 + r * 40, { size: 26, weight: 700, color: scanned ? '#a5f3fc' : C.dim, align: 'center', family: MONO_FONT });
  chev(c, 1124, y + h / 2);
  stage(c, 1152, y + 20, 384, 290, 'ECDSA signature', "with Alex's private signing key", C.sign, signed, (x, yy) => { keyIcon(c, x - 40, yy + 12, 70, C.sign, true); c.save(); c.fillStyle = C.sign; c.beginPath(); c.arc(x + 70, yy + 12, 34, 0, Math.PI * 2); c.fill(); c.restore(); text(c, 'SIG', x + 70, yy + 21, { size: 22, weight: 800, color: '#7c4a03', align: 'center' }); });
  panel(c, 64, 650, W - 128, 170);
  text(c, 'On arrival, the recipient\'s device checks the signature with Alex\'s public signing key from IDS.', 94, 712, { size: 27, weight: 700, color: '#fff' });
  text(c, 'Done once per receiving device — each package gets its own signature.', 94, 760, { size: 25, color: C.sub });
}

function cPackage(c, t) {
  title(c, 'One package per receiving device', 'What Alex\'s iPhone sends for each of Riley\'s devices');
  const x = 64, y = 230, w = 980, h = 300;
  fillRR(c, x, y, w, h, 150, 'rgba(156,200,255,0.10)'); strokeRR(c, x, y, w, h, 150, DEV[0], 4);
  const parts = [['Encrypted message text', 'AES-CTR', DEV[0]], ['Encrypted message key', 'RSA-OAEP or ECIES', DEV[0]], ["Sender's digital signature", 'ECDSA over a SHA-1 hash', C.sign]];
  parts.forEach(([a, b, col], i) => {
    const px = x + 110 + i * 270, e = sm(t, 0.2 + i * 0.25, 0.7 + i * 0.25);
    c.save(); c.globalAlpha = e;
    fillRR(c, px, y + 60, 240, 180, 18, col + '22'); strokeRR(c, px, y + 60, 240, 180, 18, col, 2.5);
    wrapText(c, a, px + 120, y + 128, 210, 26, 32, '#fff', 'center', 800);
    text(c, b, px + 120, y + 218, { size: 20, weight: 700, color: col, align: 'center', maxWidth: 220 });
    c.restore();
  });
  panel(c, 1080, 230, 456, 300);
  text(c, '× 3', 1308, 330, { size: 80, weight: 800, color: '#fff', align: 'center' });
  DEVICES.forEach((d, i) => pill(c, d.short, 1110 + i * 140, 410, d.color, { size: 24 }));
  text(c, 'one per receiving device', 1308, 506, { size: 24, color: C.sub, align: 'center' });
  const g = sm(t, T.package.ghost[0], T.package.ghost[1]);
  c.save(); c.globalAlpha = 0.35 + 0.65 * g;
  panel(c, 64, 570, W - 128, 250, '#e2e8f0', 'rgba(226,232,240,0.06)');
  text(c, 'Group conversations', 94, 630, { size: 30, weight: 800, color: '#fff' });
  text(c, 'This process is repeated for each recipient and their devices.', 94, 676, { size: 26, color: C.sub });
  let px = 94;
  [['Riley', 3, DEV[0]], ['Sam', 2, '#e2e8f0']].forEach(([n, k, col]) => {
    text(c, n, px, 760, { size: 26, weight: 800, color: col });
    for (let j = 0; j < k; j++) pkgIcon(c, px + 150 + j * 120, 750, 100, col);
    px += 150 + k * 120 + 60;
  });
  text(c, '= 5 packages', px + 10, 762, { size: 30, weight: 800, color: '#fff' });
  c.restore();
}

function cApns(c, t) {
  title(c, 'On the way to APNs', 'Inside a forward-secret TLS channel');
  const y = 230;
  const tg = c.createLinearGradient(0, y, 0, y + 220); tg.addColorStop(0, 'rgba(45,212,191,0.22)'); tg.addColorStop(1, 'rgba(45,212,191,0.06)');
  fillRR(c, 64, y, W - 128, 220, 110, tg); strokeRR(c, 64, y, W - 128, 220, 110, C.tls, 3);
  text(c, 'TLS (forward secret)', 140, y + 44, { size: 24, weight: 800, color: C.tls });
  const px = 240 + ((t * 120) % 520);
  fillRR(c, px, y + 64, 520, 112, 56, 'rgba(156,200,255,0.18)'); strokeRR(c, px, y + 64, 520, 112, 56, DEV[0], 3);
  text(c, 'end-to-end encrypted', px + 290, y + 132, { size: 26, weight: 800, color: '#fff', align: 'center' });
  lockIcon(c, px + 70, y + 104, 46, DEV[0]);
  fillRR(c, px + 540, y + 76, 300, 88, 16, '#f1f5f9'); text(c, 'Metadata', px + 690, y + 112, { size: 26, weight: 800, color: '#0f172a', align: 'center' }); text(c, 'timestamp · routing', px + 690, y + 146, { size: 21, weight: 600, color: '#475569', align: 'center' });
  const cols = [[64, 'Metadata — not encrypted', 'APNs can read it', C.sign, [['Timestamp', true], ['APNs routing information', true]]], [820, 'End-to-end encrypted', 'APNs can\'t read it', '#4ade80', [['Message text', false], ['Message key', false], ['Attachment details', false]]]];
  cols.forEach(([x, head, sub, col, items]) => {
    panel(c, x, 490, 716, 330, col);
    text(c, head, x + 30, 546, { size: 30, weight: 800, color: col });
    text(c, sub, x + 30, 584, { size: 23, weight: 700, color: C.sub });
    items.forEach(([s, readable], i) => {
      mark(c, x + 56, 640 + i * 58, 21, readable);
      text(c, s, x + 96, 650 + i * 58, { size: 27, weight: 700, color: '#fff' });
    });
  });
  text(c, 'Both travel to APNs inside the forward-secret TLS channel.', W / 2, 866, { size: 24, weight: 600, color: C.sub, align: 'center' });
}

function cAttach(c, t) {
  title(c, 'Too big for APNs? Use iCloud', 'Long messages and attachments such as photos');
  const Q = T.attach;
  panel(c, 64, 210, W - 128, 190);
  text(c, 'APNs relays messages up to 4 or 16 KB, depending on the iOS or iPadOS version', 94, 262, { size: 27, weight: 800, color: '#fff' });
  const gx = 94, gw = W - 188;
  fillRR(c, gx, 296, gw, 34, 17, 'rgba(255,255,255,0.08)'); fillRR(c, gx, 296, 40, 34, 17, C.apns); text(c, '16 KB', gx + 52, 322, { size: 22, weight: 800, color: C.apns });
  const pf = sm(t, Q.photo[0], Q.photo[1]);
  fillRR(c, gx, 344, Math.max(34, gw * pf), 34, 17, '#f59e0b'); text(c, 'a photo: megabytes (example)', gx + 14, 370, { size: 22, weight: 800, color: '#1f1300' });
  const st = [
    ['Photo', 'from the sender', '#f59e0b', Q.photo[0], (x, y) => { fillRR(c, x - 46, y - 30, 92, 66, 8, '#e9737b'); c.fillStyle = '#3b2a4f'; c.beginPath(); c.moveTo(x - 46, y + 36); c.lineTo(x - 10, y); c.lineTo(x + 16, y + 20); c.lineTo(x + 46, y - 6); c.lineTo(x + 46, y + 36); c.fill(); }],
    ['AES-CTR', 'random 256-bit key', '#e2e8f0', Q.enc[0], (x, y) => keyIcon(c, x, y, 90, '#e2e8f0')],
    ['Upload', 'encrypted, to iCloud', C.cloud, Q.up[0], (x, y) => cloudIcon(c, x, y, 120, C.cloud)],
    ['iMessage', 'carries key · URI · hash', C.send, Q.card[0], (x, y) => { fillRR(c, x - 50, y - 32, 100, 64, 10, C.send); text(c, 'key URI #', x, y + 9, { size: 18, weight: 800, color: '#fff', align: 'center' }); }],
    ['Normal encryption', 'like any iMessage', '#4ade80', Q.wrap[0], (x, y) => lockIcon(c, x, y - 10, 80, '#4ade80')],
  ];
  const sw = 262, gap = 30;
  st.forEach(([a, b, col, ta, draw], i) => {
    const x = 64 + i * (sw + gap);
    stage(c, x, 440, sw, 230, a, b, col, t >= ta, draw);
    if (i < st.length - 1) chev(c, x + sw + gap / 2, 555);
  });
  panel(c, 64, 700, W - 128, 130);
  text(c, 'iCloud holds only the encrypted attachment.', 94, 752, { size: 27, weight: 800, color: '#fff' });
  text(c, 'The key to open it travels inside the end-to-end encrypted iMessage.', 94, 796, { size: 25, color: C.sub });
}

function cDeliver(c, t) {
  title(c, 'APNs delivery', 'Each device gets its own copy');
  const s = deliverState(t), D = T.deliver;
  const x = 64, y = 210, w = 1000;
  panel(c, x, y, w, 520);
  ['Device', 'Status'].forEach((h, i) => text(c, h, x + 30 + i * 330, y + 52, { size: 24, weight: 800, color: C.dim }));
  DEVICES.forEach((d, i) => {
    const ry = y + 80 + i * 140;
    fillRR(c, x + 16, ry, w - 32, 120, 16, 'rgba(255,255,255,0.05)');
    devIcon(c, d.key, x + 70, ry + 60, 70, d.color);
    text(c, d.name, x + 120, ry + 70, { size: 28, weight: 800, color: '#fff' });
    let label, col;
    if (s[d.key]) { label = 'Delivered · deleted from APNs'; col = '#4ade80'; }
    else if (i === 2 && !s.macOn && t >= D.queue[0]) { label = 'Offline · queued'; col = '#fbbf24'; }
    else if (i === 2 && s.macOn && t < D.mac[1]) { label = 'Online · delivering…'; col = C.tls; }
    else if (t >= (i === 0 ? D.phone[0] : i === 1 ? D.pad[0] : D.queue[0])) { label = 'Delivering…'; col = C.tls; }
    else { label = 'Waiting at APNs'; col = C.sub; }
    pill(c, label, x + 360, ry + 38, col, { size: 25 });
    if (i === 2 && s.queued) { const cx = x + w - 90, cy = ry + 60; c.save(); c.strokeStyle = '#fbbf24'; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.clock); c.stroke(); c.restore(); }
  });
  const px = 1100, pw = 436;
  panel(c, px, y, pw, 520, '#fbbf24', 'rgba(251,191,36,0.08)');
  text(c, 'Offline devices', px + 28, y + 60, { size: 30, weight: 800, color: '#fde68a' });
  wrapText(c, 'Unlike other APNs notifications, iMessage messages are queued for delivery to offline devices.', px + 28, y + 110, pw - 56, 25, 36, '#e2e8f0');
  text(c, 'Up to 30 days', px + 28, y + 330, { size: 44, weight: 800, color: '#fff' });
  text(c, 'stored on Apple servers', px + 28, y + 372, { size: 25, color: C.sub });
  panel(c, 64, 760, W - 128, 80);
  text(c, 'As with all push notifications, the message is deleted from APNs when it\'s delivered.', 94, 810, { size: 26, weight: 700, color: '#fff' });
}

function cUnlock(c, t) {
  title(c, "On Riley's iPhone", 'Checks and decryption, before the message appears');
  const s = unlockState(t);
  const items = [
    [s.sig, 'Signature checked', "with Alex's public signing key from IDS", C.sign],
    [s.key, 'Message key unlocked', "with this iPhone's own private key", DEV[0]],
    [s.text, 'Text decrypted', 'AES-CTR with the 128-bit key', '#93c5fd'],
    [s.check, '40-bit value verified', 'the decrypted text is intact', DEV[0]],
    [s.named, 'Sender matched to Contacts', `${SENDER.phone} → ${SENDER.name}`, C.send],
  ];
  items.forEach(([on, a, b, col], i) => {
    const y = 210 + i * 124;
    c.save(); c.globalAlpha = on ? 1 : 0.4;
    panel(c, 64, y, 1000, 108, on ? col : C.line, on ? col + '14' : C.panel);
    if (on) mark(c, 120, y + 54, 28, true); else { c.strokeStyle = C.dim; c.lineWidth = 4; c.beginPath(); c.arc(120, y + 54, 26, 0, Math.PI * 2); c.stroke(); }
    text(c, `${i + 1}. ${a}`, 172, y + 48, { size: 30, weight: 800, color: '#fff' });
    text(c, b, 172, y + 86, { size: 24, color: C.sub });
    c.restore();
  });
  // phone mock
  const px = 1180, py = 200, pw = 300, ph = 620;
  fillRR(c, px, py, pw, ph, 46, '#1f2430'); fillRR(c, px + 12, py + 12, pw - 24, ph - 24, 36, '#000');
  fillRR(c, px + pw / 2 - 50, py + 26, 100, 26, 13, '#111');
  const who = s.named ? SENDER.name : SENDER.phone;
  c.fillStyle = '#334155'; c.beginPath(); c.arc(px + pw / 2, py + 110, 34, 0, Math.PI * 2); c.fill();
  text(c, s.named ? 'A' : '#', px + pw / 2, py + 122, { size: 32, weight: 800, color: '#fff', align: 'center' });
  text(c, who, px + pw / 2, py + 176, { size: s.named ? 28 : 20, weight: 700, color: '#fff', align: 'center' });
  if (s.shown) { fillRR(c, px + 30, py + 260, 220, 60, 26, '#3a3a3c'); text(c, MESSAGE, px + 140, py + 298, { size: 24, weight: 600, color: '#fff', align: 'center' }); }
}

function cFetch(c, t) {
  title(c, 'Fetching the attachment', "On Riley's iPad — every receiving device does the same");
  const s = fetchState(t);
  const st = [
    ['Details', 'key · URI · hash, from the iMessage', C.send, s.card, (x, y) => { fillRR(c, x - 54, y - 32, 108, 64, 10, C.send); text(c, 'key URI #', x, y + 9, { size: 18, weight: 800, color: '#fff', align: 'center' }); }],
    ['Download', 'the URI locates it in iCloud', C.cloud, s.asked, (x, y) => cloudIcon(c, x, y, 120, C.cloud)],
    ['Check', 'SHA-1 hash matches', C.ids, s.hash, (x, y) => (s.hash ? mark(c, x, y, 38, true) : dirIcon(c, x, y, 80, C.ids))],
    ['Decrypt', 'AES-CTR with the 256-bit key', '#e2e8f0', s.dec, (x, y) => keyIcon(c, x, y, 90, '#e2e8f0')],
    ['Show', 'the photo appears', '#f59e0b', s.shown, (x, y) => { fillRR(c, x - 46, y - 30, 92, 66, 8, '#e9737b'); c.fillStyle = '#3b2a4f'; c.beginPath(); c.moveTo(x - 46, y + 36); c.lineTo(x - 10, y); c.lineTo(x + 16, y + 20); c.lineTo(x + 46, y - 6); c.lineTo(x + 46, y + 36); c.fill(); }],
  ];
  const sw = 262, gap = 30;
  st.forEach(([a, b, col, on, draw], i) => { const x = 64 + i * (sw + gap); stage(c, x, 250, sw, 250, a, b, col, on, draw); if (i < st.length - 1) chev(c, x + sw + gap / 2, 375); });
  panel(c, 64, 560, W - 128, 260);
  text(c, 'Why the attachment stays private', 94, 618, { size: 30, weight: 800, color: '#fff' });
  wrapText(c, 'iCloud stores the attachment encrypted. Its 256-bit key only reaches the recipient\'s devices inside the end-to-end encrypted iMessage, so only those devices can decrypt it.', 94, 668, W - 200, 26, 38, C.sub);
}

function cTogether(c, t) {
  title(c, 'The whole journey', 'Step by step, from Alex to every one of Riley\'s devices');
  const J = T.together;
  const st = [
    ['Register', 'public keys + APNs address → IDS', C.ids, J.reg[0]],
    ['Look up', "IDS returns Riley's devices", C.ids, J.look[0]],
    ['Encrypt & sign', 'one package per device', C.send, J.pack[0]],
    ['Send', 'to APNs over TLS', C.tls, J.up[0]],
    ['Deliver', 'each device gets its copy', C.apns, J.down[0]],
    ['Read', 'check, decrypt, display', DEV[0], J.read],
  ];
  const sw = 230, gap = 26;
  st.forEach(([a, b, col, ta], i) => {
    const x = 64 + i * (sw + gap), next = i < st.length - 1 ? st[i + 1][3] : 99;
    const on = t >= ta, cur = on && t < next;
    c.save(); c.globalAlpha = on ? 1 : 0.4;
    panel(c, x, 220, sw, 260, cur ? col : C.line, cur ? col + '26' : C.panel);
    c.fillStyle = col; c.beginPath(); c.arc(x + sw / 2, 290, 34, 0, Math.PI * 2); c.fill();
    text(c, String(i + 1), x + sw / 2, 302, { size: 34, weight: 800, color: '#0b1220', align: 'center' });
    text(c, a, x + sw / 2, 370, { size: 30, weight: 800, color: '#fff', align: 'center' });
    wrapText(c, b, x + sw / 2, 412, sw - 30, 22, 30, C.sub, 'center');
    c.restore();
    if (i < st.length - 1) chev(c, x + sw + gap / 2, 350);
  });
  const facts = [['Only the endpoints can read it', 'Apple can\'t decrypt the data'], ['Metadata isn\'t encrypted', 'timestamp, APNs routing information'], ['Queued for offline devices', 'up to 30 days on Apple servers'], ['New-device alerts', 'on all registered devices']];
  facts.forEach(([a, b], i) => {
    const x = 64 + (i % 2) * 744, y = 530 + Math.floor(i / 2) * 150;
    panel(c, x, y, 728, 130);
    text(c, a, x + 30, y + 56, { size: 28, weight: 800, color: '#fff' });
    text(c, b, x + 30, y + 98, { size: 24, color: C.sub });
  });
}

const CLOSEUPS = {
  overview: cOverview, keys: cKeys, register: cRegister, lookup: cLookup, msgkey: cMsgkey, encrypt: cEncrypt, wrap: cWrap,
  sign: cSign, package: cPackage, apns: cApns, attach: cAttach, deliver: cDeliver, unlock: cUnlock, fetch: cFetch, together: cTogether,
};

export class CloseupRenderer {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
  }
  draw(id, t, fade = 1) {
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    bg(c);
    c.save(); c.globalAlpha = 0.25 + 0.75 * fade;
    (CLOSEUPS[id] || cOverview)(c, t);
    c.restore();
  }
}

// ------------------------------------------------------------------ device screens
const SIZES = { alex: [540, 1170], rPhone: [540, 1170], rPad: [1180, 820], rMac: [1280, 800] };

function statusBar(c, w, s = 1) {
  text(c, '9:41', 44 * s, 52 * s, { size: 30 * s, weight: 700, color: '#fff' });
  fillRR(c, w - 92 * s, 30 * s, 52 * s, 24 * s, 7 * s, 'rgba(255,255,255,0.9)'); fillRR(c, w - 38 * s, 37 * s, 5 * s, 10 * s, 2, 'rgba(255,255,255,0.9)');
}
function island(c, w) { fillRR(c, w / 2 - 70, 18, 140, 40, 20, '#000'); }
function wallpaper(c, w, h, hue = 0) {
  const g = c.createLinearGradient(0, 0, w, h);
  const sets = [['#1e3a8a', '#7c3aed', '#0b1220'], ['#064e3b', '#0e7490', '#0b1220'], ['#7c2d12', '#be185d', '#1e1b4b']][hue];
  g.addColorStop(0, sets[0]); g.addColorStop(0.55, sets[1]); g.addColorStop(1, sets[2]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function bubble(c, x, y, maxW, s, me, { size = 30, photo = false } = {}) {
  if (photo) {
    const w = maxW * 0.62, h = w * 0.7, bx = me ? x + maxW - w : x;
    c.save(); rrPath(c, bx, y, w, h, 22); c.clip();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c3e8f'); g.addColorStop(0.5, '#e9737b'); g.addColorStop(1, '#ffd9a0');
    c.fillStyle = g; c.fillRect(bx, y, w, h);
    c.fillStyle = '#3b2a4f'; c.beginPath(); c.moveTo(bx, y + h * 0.75); c.lineTo(bx + w * 0.3, y + h * 0.45); c.lineTo(bx + w * 0.55, y + h * 0.65); c.lineTo(bx + w * 0.8, y + h * 0.4); c.lineTo(bx + w, y + h * 0.6); c.lineTo(bx + w, y + h); c.lineTo(bx, y + h); c.fill();
    c.restore();
    return h;
  }
  const tw = measure(c, s, size, 500), w = Math.min(maxW, tw + size * 1.4), h = size * 2.1, bx = me ? x + maxW - w : x;
  fillRR(c, bx, y, w, h, h / 2, me ? '#1d8cf8' : '#3a3a3c');
  text(c, s, bx + size * 0.7, y + h / 2 + size * 0.36, { size, weight: 500, color: '#fff' });
  return h;
}
// conversation: { who, bubbles: [{ me, s, photo, status }], compose: { s, photo, caret } }
function convo(c, w, h, o, { top = 0, side = 0, s = 1 } = {}) {
  const x0 = side, cw = w - side;
  c.fillStyle = '#000'; c.fillRect(x0, top, cw, h - top);
  // header
  c.fillStyle = 'rgba(28,28,30,0.96)'; c.fillRect(x0, top, cw, 190 * s);
  c.fillStyle = '#4b5563'; c.beginPath(); c.arc(x0 + cw / 2, top + 74 * s, 42 * s, 0, Math.PI * 2); c.fill();
  text(c, o.initial || o.who[0], x0 + cw / 2, top + 88 * s, { size: 38 * s, weight: 700, color: '#fff', align: 'center' });
  text(c, o.who, x0 + cw / 2, top + 150 * s, { size: (o.who.length > 12 ? 24 : 30) * s, weight: 600, color: '#fff', align: 'center' });
  if (!side) { c.strokeStyle = '#3aa0ff'; c.lineWidth = 5 * s; c.beginPath(); c.moveTo(x0 + 40 * s, top + 60 * s); c.lineTo(x0 + 24 * s, top + 76 * s); c.lineTo(x0 + 40 * s, top + 92 * s); c.stroke(); }
  text(c, 'iMessage', x0 + cw / 2, top + 230 * s, { size: 20 * s, weight: 600, color: '#8e8e93', align: 'center' });
  let y = top + 260 * s;
  const pad = 26 * s, mw = cw - pad * 2;
  for (const b of o.bubbles || []) {
    const bh = bubble(c, x0 + pad, y, mw * 0.82 + (b.me ? mw * 0.18 : 0), b.s || '', b.me, { size: 30 * s, photo: b.photo });
    if (b.me && !b.photo) { /* aligned right by bubble() */ }
    y += bh + 12 * s;
    if (b.status) { text(c, b.status, x0 + cw - pad, y + 18 * s, { size: 20 * s, weight: 600, color: '#8e8e93', align: 'right' }); y += 34 * s; }
    if (b.note) { text(c, b.note, x0 + pad + 10 * s, y + 18 * s, { size: 20 * s, weight: 600, color: '#8e8e93' }); y += 34 * s; }
  }
  // compose bar
  const cy = h - 120 * s;
  c.fillStyle = '#000'; c.fillRect(x0, cy - 10 * s, cw, 130 * s);
  c.fillStyle = '#2c2c2e'; c.beginPath(); c.arc(x0 + 50 * s, cy + 36 * s, 26 * s, 0, Math.PI * 2); c.fill();
  text(c, '+', x0 + 50 * s, cy + 47 * s, { size: 34 * s, weight: 400, color: '#c7c7cc', align: 'center' });
  strokeRR(c, x0 + 92 * s, cy + 8 * s, cw - 120 * s, 58 * s, 29 * s, '#3a3a3c', 2.5 * s);
  const comp = o.compose || {};
  if (comp.photo) { const g = c.createLinearGradient(0, cy, 0, cy + 50 * s); g.addColorStop(0, '#e9737b'); g.addColorStop(1, '#ffd9a0'); fillRR(c, x0 + 106 * s, cy + 14 * s, 64 * s, 46 * s, 8 * s, g); }
  if (comp.s) text(c, comp.s, x0 + (comp.photo ? 186 : 114) * s, cy + 46 * s, { size: 28 * s, color: '#fff' });
  else if (!comp.photo) text(c, 'iMessage', x0 + 114 * s, cy + 46 * s, { size: 28 * s, color: '#636366' });
  if (comp.s || comp.photo) { c.fillStyle = '#1d8cf8'; c.beginPath(); c.arc(x0 + cw - 58 * s, cy + 37 * s, 22 * s, 0, Math.PI * 2); c.fill(); text(c, '↑', x0 + cw - 58 * s, cy + 47 * s, { size: 28 * s, weight: 800, color: '#fff', align: 'center' }); }
}
function lockScreen(c, w, h, { hue = 0, notes = [], s = 1, date = 'Friday, November 20' } = {}) {
  wallpaper(c, w, h, hue);
  text(c, date, w / 2, 190 * s, { size: 30 * s, weight: 600, color: 'rgba(255,255,255,0.85)', align: 'center' });
  text(c, '9:41', w / 2, 330 * s, { size: 150 * s, weight: 700, color: 'rgba(255,255,255,0.92)', align: 'center' });
  notes.forEach((n, i) => {
    const y = h * 0.5 + i * 150 * s, x = 26 * s, nw = w - 52 * s;
    c.save(); c.globalAlpha = n.a ?? 1;
    fillRR(c, x, y, nw, 130 * s, 28 * s, n.warn ? 'rgba(66,52,20,0.92)' : 'rgba(30,41,59,0.88)');
    fillRR(c, x + 22 * s, y + 24 * s, 52 * s, 52 * s, 12 * s, n.warn ? '#fbbf24' : '#22c55e');
    text(c, n.app || 'iMessage', x + 92 * s, y + 46 * s, { size: 22 * s, weight: 700, color: 'rgba(255,255,255,0.75)' });
    text(c, n.title, x + 92 * s, y + 82 * s, { size: 27 * s, weight: 800, color: '#fff', maxWidth: nw - 110 * s });
    if (n.body) text(c, n.body, x + 92 * s, y + 114 * s, { size: 24 * s, weight: 500, color: 'rgba(255,255,255,0.85)', maxWidth: nw - 110 * s });
    c.restore();
  });
}
function settings(c, w, h, on) {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  text(c, '‹ Settings', 26, 120, { size: 30, weight: 500, color: '#3aa0ff' });
  text(c, 'Messages', 26, 200, { size: 54, weight: 800, color: '#fff' });
  fillRR(c, 22, 240, w - 44, 104, 22, '#1c1c1e');
  text(c, 'iMessage', 50, 304, { size: 32, weight: 500, color: '#fff' });
  const tx = w - 150, ty = 268, k = clamp(on);
  fillRR(c, tx, ty, 102, 58, 29, k > 0.5 ? '#34c759' : '#39393d');
  c.fillStyle = '#fff'; c.beginPath(); c.arc(tx + 29 + 44 * k, ty + 29, 25, 0, Math.PI * 2); c.fill();
  text(c, 'Turn on to send and receive iMessages', 30, 386, { size: 22, color: '#8e8e93' });
  text(c, 'on this device.', 30, 414, { size: 22, color: '#8e8e93' });
  c.save(); c.globalAlpha = k;
  fillRR(c, 22, 456, w - 44, 104, 22, '#1c1c1e');
  text(c, 'Send & Receive', 50, 520, { size: 30, weight: 500, color: '#fff' });
  text(c, '2 addresses ›', w - 50, 520, { size: 26, color: '#8e8e93', align: 'right' });
  text(c, SENDER.phone, 30, 610, { size: 24, color: '#8e8e93' });
  text(c, SENDER.email, 30, 644, { size: 24, color: '#8e8e93' });
  c.restore();
}
function compose(c, w, h, to, blue, sugg) {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  text(c, 'New iMessage', w / 2, 120, { size: 32, weight: 700, color: '#fff', align: 'center' });
  text(c, 'Cancel', w - 30, 120, { size: 28, color: '#3aa0ff', align: 'right' });
  c.fillStyle = '#1c1c1e'; c.fillRect(0, 160, w, 76);
  text(c, 'To:', 30, 210, { size: 28, color: '#8e8e93' });
  if (blue) pillRaw(c, to, 86, 172, '#1d8cf8'); else text(c, to, 86, 210, { size: 28, weight: 600, color: '#fff' });
  if (sugg) {
    [['Riley', RECIP.phone], ['Riley', RECIP.email]].forEach(([n, v], i) => { const y = 270 + i * 110; text(c, n, 30, y + 40, { size: 30, weight: 700, color: '#fff' }); text(c, v, 30, y + 78, { size: 24, color: '#8e8e93' }); c.fillStyle = '#2c2c2e'; c.fillRect(30, y + 100, w - 30, 1); });
  }
}
function pillRaw(c, s, x, y, col) { const w = measure(c, s, 28, 600) + 30; fillRR(c, x, y, w, 52, 26, col); text(c, s, x + 15, y + 36, { size: 28, weight: 600, color: '#fff' }); }

function padMessages(c, w, h, o) {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  const sw = 380;
  c.fillStyle = '#111113'; c.fillRect(0, 0, sw, h);
  text(c, 'Messages', 28, 86, { size: 40, weight: 800, color: '#fff' });
  const rows = [[o.who || 'Alex', o.preview || '', true], ['Sam', 'Thanks!', false], ['Jordan', 'On my way', false]];
  rows.forEach(([n, p, sel], i) => {
    const y = 120 + i * 104;
    if (sel && o.who) fillRR(c, 10, y, sw - 20, 94, 16, '#1d8cf8');
    c.fillStyle = '#4b5563'; c.beginPath(); c.arc(56, y + 47, 30, 0, Math.PI * 2); c.fill();
    text(c, n[0], 56, y + 57, { size: 26, weight: 700, color: '#fff', align: 'center' });
    text(c, n, 100, y + 40, { size: 24, weight: 700, color: '#fff', maxWidth: sw - 120 });
    text(c, p, 100, y + 72, { size: 20, color: sel && o.who ? '#dbeafe' : '#8e8e93', maxWidth: sw - 120 });
  });
  if (o.who) convo(c, w, h, o, { side: sw, s: 0.85 });
  else { text(c, 'No conversation selected', sw + (w - sw) / 2, h / 2, { size: 28, color: '#636366', align: 'center' }); }
}
function macDesktop(c, w, h, o) {
  wallpaper(c, w, h, 2);
  c.fillStyle = 'rgba(20,20,24,0.55)'; c.fillRect(0, 0, w, 34);
  text(c, 'Messages   File   Edit   View', 22, 24, { size: 18, weight: 600, color: '#fff' });
  text(c, 'Fri 9:41 AM', w - 20, 24, { size: 18, weight: 600, color: '#fff', align: 'right' });
  const x = 150, y = 70, ww = 980, hh = 620;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 30; fillRR(c, x, y, ww, hh, 18, '#000'); c.restore();
  c.save(); rrPath(c, x, y, ww, hh, 18); c.clip(); c.translate(x, y);
  if (o.convo) padMessages(c, ww, hh, o.convo); else { c.fillStyle = '#111'; c.fillRect(0, 0, ww, hh); text(c, 'Messages', ww / 2, hh / 2 - 20, { size: 40, weight: 800, color: '#fff', align: 'center' }); text(c, o.line || 'iMessage is on', ww / 2, hh / 2 + 30, { size: 24, color: '#8e8e93', align: 'center' }); }
  c.restore();
  ['#ef4444', '#f59e0b', '#22c55e'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x + 24 + i * 24, y + 22, 7, 0, Math.PI * 2); c.fill(); });
  fillRR(c, w / 2 - 230, h - 70, 460, 60, 18, 'rgba(255,255,255,0.18)');
  ['#22c55e', '#3aa0ff', '#f59e0b', '#a78bfa', '#ef4444', '#64748b'].forEach((col, i) => fillRR(c, w / 2 - 205 + i * 70, h - 62, 46, 46, 12, col));
  if (o.note) { const n = o.note; c.save(); c.globalAlpha = n.a ?? 1; fillRR(c, w - 430, 50, 410, 110, 20, 'rgba(40,44,52,0.95)'); fillRR(c, w - 410, 72, 52, 52, 12, '#22c55e'); text(c, n.title, w - 344, 92, { size: 24, weight: 800, color: '#fff', maxWidth: 310 }); text(c, n.body || '', w - 344, 128, { size: 21, color: '#cbd5e1', maxWidth: 310 }); c.restore(); }
}

// What each screen shows in each section.
function screenPlan(id, t) {
  const sent = { me: true, s: MESSAGE }, photoMe = { me: true, photo: true };
  const prior = { me: false, s: 'Dinner tonight?' };
  const alexConvo = (bubbles, compose) => ({ k: 'convo', o: { who: RECIP.name, bubbles: [prior, ...bubbles], compose } });
  const rConvo = (named, bubbles) => ({ who: named ? SENDER.name : SENDER.phone, initial: named ? 'A' : '#', bubbles: [{ me: true, s: 'Dinner tonight?' }, ...bubbles], preview: (bubbles[bubbles.length - 1] || {}).s || 'Photo' });
  const plan = { alex: null, rPhone: null, rPad: null, rMac: null };
  const lockP = (notes = []) => ({ k: 'lock', o: { hue: 0, notes } });
  const lockD = (notes = []) => ({ k: 'lock', o: { hue: 1, notes } });
  const macIdle = { k: 'mac', o: { line: 'iMessage is on · riley@example.com' } };
  const D = T.deliver;
  switch (id) {
    case 'overview':
      plan.alex = alexConvo([{ ...sent, status: 'Delivered' }]);
      plan.rPhone = lockP([{ title: SENDER.name, body: MESSAGE }]);
      plan.rPad = { k: 'pad', o: rConvo(true, [{ me: false, s: MESSAGE }]) };
      plan.rMac = { k: 'mac', o: { convo: rConvo(true, [{ me: false, s: MESSAGE }]) } };
      break;
    case 'keys':
      plan.alex = { k: 'settings', o: { on: clamp((t - 0.1) / 0.4) } };
      plan.rPhone = lockP(); plan.rPad = lockD(); plan.rMac = macIdle; break;
    case 'register': {
      plan.alex = { k: 'settings', o: { on: 1 } };
      const al = clamp((t - T.register.alert) / 0.4);
      const note = al > 0 ? [{ title: 'New device added', body: "Riley's Mac now uses iMessage", app: 'Apple Account', warn: true, a: al }] : [];
      plan.rPhone = lockP(note); plan.rPad = lockD(note);
      plan.rMac = { k: 'mac', o: { line: t < T.register.mac ? 'Turning on iMessage…' : 'iMessage is on · riley@example.com' } }; break;
    }
    case 'lookup': {
      const typed = 'Riley'.slice(0, Math.floor(clamp(t / 0.5) * 5));
      plan.alex = { k: 'compose', o: { to: typed, blue: t > T.lookup.back[1] + 0.9, sugg: t > 0.5 && t < T.lookup.back[1] + 0.9 } };
      plan.rPhone = lockP(); plan.rPad = lockD(); plan.rMac = macIdle; break;
    }
    case 'msgkey': case 'encrypt': case 'wrap': case 'sign': case 'package': {
      const n = id === 'msgkey' ? Math.floor(clamp(t / 0.8) * MESSAGE.length) : MESSAGE.length;
      plan.alex = alexConvo([], { s: MESSAGE.slice(0, n) });
      plan.rPhone = lockP(); plan.rPad = lockD(); plan.rMac = macIdle; break;
    }
    case 'apns':
      plan.alex = t < T.apns.leave ? alexConvo([], { s: MESSAGE }) : alexConvo([{ ...sent, status: 'Sending…' }], {});
      plan.rPhone = lockP(); plan.rPad = lockD(); plan.rMac = macIdle; break;
    case 'attach':
      plan.alex = t < T.attach.go[0] ? alexConvo([{ ...sent }], { photo: t > T.attach.photo[0] }) : alexConvo([{ ...sent }, { ...photoMe, status: 'Sending…' }], {});
      plan.rPhone = lockP(); plan.rPad = lockD(); plan.rMac = macIdle; break;
    case 'deliver': {
      const s = deliverState(t);
      plan.alex = alexConvo([{ ...sent }, { ...photoMe, status: s.phone ? 'Delivered' : 'Sending…' }], {});
      plan.rPhone = lockP(s.phone ? [{ title: 'iMessage', body: 'New message' }] : []);
      plan.rPad = lockD(s.pad ? [{ title: 'iMessage', body: 'New message' }] : []);
      plan.rMac = { k: 'mac', o: { line: 'iMessage is on · riley@example.com', note: s.mac ? { title: 'iMessage', body: 'New message' } : null } }; break;
    }
    case 'unlock': {
      const s = unlockState(t);
      plan.alex = alexConvo([{ ...sent }, { ...photoMe, status: 'Delivered' }], {});
      const b = s.shown ? [{ me: false, s: MESSAGE }] : [];
      plan.rPhone = { k: 'convo', o: rConvo(s.named, b) };
      plan.rPad = { k: 'pad', o: rConvo(s.named, b) };
      plan.rMac = { k: 'mac', o: { convo: rConvo(s.named, b) } }; break;
    }
    case 'fetch': {
      const s = fetchState(t);
      plan.alex = alexConvo([{ ...sent }, { ...photoMe, status: 'Delivered' }], {});
      const b = [{ me: false, s: MESSAGE }, s.shown ? { me: false, photo: true } : { me: false, s: 'Downloading photo…' }];
      plan.rPhone = { k: 'convo', o: rConvo(true, b) };
      plan.rPad = { k: 'pad', o: rConvo(true, b) };
      plan.rMac = { k: 'mac', o: { convo: rConvo(true, b) } }; break;
    }
    case 'together': default: {
      const read = t >= T.together.read;
      plan.alex = alexConvo(t >= T.together.pack[0] ? [{ ...sent, status: read ? 'Delivered' : 'Sending…' }] : [], t >= T.together.pack[0] ? {} : { s: MESSAGE });
      const b = read ? [{ me: false, s: MESSAGE }] : [];
      plan.rPhone = read ? { k: 'convo', o: rConvo(true, b) } : lockP();
      plan.rPad = read ? { k: 'pad', o: rConvo(true, b) } : lockD();
      plan.rMac = { k: 'mac', o: read ? { convo: rConvo(true, b) } : { line: 'iMessage is on · riley@example.com' } };
    }
  }
  return plan;
}

export class DeviceScreens {
  constructor() {
    this.canvases = {}; this.ctx = {}; this.sig = {};
    for (const k in SIZES) { const cv = document.createElement('canvas'); cv.width = SIZES[k][0]; cv.height = SIZES[k][1]; this.canvases[k] = cv; this.ctx[k] = cv.getContext('2d'); this.sig[k] = ''; }
  }
  // Redraws only the screens whose content changed; returns the keys that changed.
  update(id, t) {
    const plan = screenPlan(id, t), changed = [];
    for (const k in plan) {
      const p = plan[k]; if (!p) continue;
      const sig = JSON.stringify(p);
      if (sig === this.sig[k]) continue;
      this.sig[k] = sig; changed.push(k);
      const c = this.ctx[k], [w, h] = SIZES[k];
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, w, h);
      if (p.k === 'convo') { convo(c, w, h, p.o); statusBar(c, w); island(c, w); }
      else if (p.k === 'lock') { lockScreen(c, w, h, p.o); statusBar(c, w); island(c, w); }
      else if (p.k === 'settings') { settings(c, w, h, p.o.on); statusBar(c, w); island(c, w); }
      else if (p.k === 'compose') { compose(c, w, h, p.o.to, p.o.blue, p.o.sugg); statusBar(c, w); island(c, w); }
      else if (p.k === 'pad') { padMessages(c, w, h, p.o); }
      else if (p.k === 'mac') { macDesktop(c, w, h, p.o); }
      if (k === 'rPad' && p.k === 'lock') { /* iPad lock screen uses the landscape layout */ }
    }
    return changed;
  }
}
