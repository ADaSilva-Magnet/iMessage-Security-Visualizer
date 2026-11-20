// Small math + canvas helpers shared by the 3D scene and the monitor screens.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1; t = clamp(t);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const fmt = (n) => n.toLocaleString('en-US');

export const UI_FONT = '"Segoe UI", "Segoe UI Variable Text", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO_FONT = '"Cascadia Mono", Consolas, "Lucida Console", "Courier New", monospace';

export function rrPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
export function fillRR(c, x, y, w, h, r, fill) { rrPath(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
export function strokeRR(c, x, y, w, h, r, stroke, lw = 2) { rrPath(c, x, y, w, h, r); c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }

export function text(c, s, x, y, o = {}) {
  const { size = 24, weight = 400, color = '#111', align = 'left', baseline = 'alphabetic', family = UI_FONT, maxWidth, alpha } = o;
  c.save();
  if (alpha !== undefined) c.globalAlpha *= alpha;
  c.font = `${weight} ${size}px ${family}`;
  c.fillStyle = color; c.textAlign = align; c.textBaseline = baseline;
  if (maxWidth) c.fillText(s, x, y, maxWidth); else c.fillText(s, x, y);
  c.restore();
}
export function measure(c, s, size = 24, weight = 400, family = UI_FONT) {
  c.save(); c.font = `${weight} ${size}px ${family}`; const w = c.measureText(s).width; c.restore(); return w;
}
