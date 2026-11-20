import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld } from './model.js';
import { CloseupRenderer, DeviceScreens } from './screens.js';
import { STEPS, GROUPS } from './steps.js';
import { Flows } from './flows.js';
import { backdropTexture } from './textures.js';
import { loopInfo } from './sync.js';
import { clamp, lerp, easeInOutCubic } from './util.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ state
const DEF = { idsRecords: 4, idsSeek: 0, idsRiley: 0, idsAlex: 0, cloudBlob: 0, macOn: 1, macBadge: 0, macOnBadge: 0, alert: 0, apnsBusy: 0, fog: 0 };
const RATES = { idsRecords: 5, idsSeek: 6, idsRiley: 5, idsAlex: 5, cloudBlob: 4, macOn: 4, macBadge: 5, macOnBadge: 5, alert: 5, apnsBusy: 3, fog: 2.5 };
const A = { ...DEF, focus: new Set() };

let stepIndex = 0, stepTime = 0, clockNow = 0, loop = { lt: 0, cycle: 0, fade: 1 };
let notesVisible = true, labelsOn = true, insetMode = 'auto', insetBig = false, insetShown = false;
let userMoved = false, swayT = 0, tabOpened = false;

// ------------------------------------------------------------------ UI (works without WebGL)
const closeup = new CloseupRenderer();
$('#insetScreen').appendChild(closeup.canvas);
closeup.canvas.setAttribute('aria-label', 'Close-up of the current step');
const devices = new DeviceScreens();

const chipsEl = $('#chips');
GROUPS.forEach((g, gi) => {
  if (gi) { const s = document.createElement('span'); s.className = 'sep'; chipsEl.appendChild(s); }
  STEPS.forEach((st, i) => {
    if (st.group !== g.id) return;
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.textContent = st.chip; b.dataset.i = i; b.title = `${g.label} — ${st.title}`;
    b.addEventListener('click', () => goTo(i));
    chipsEl.appendChild(b);
  });
});

function specHTML(sp) {
  if (!sp) return '';
  if (sp.rows) return `<div class="rows">${sp.rows.map(([k, v, r]) => `<div><i style="background:var(--${r})"></i><span>${k}</span><em>${v}</em></div>`).join('')}</div>`;
  if (sp.single) return `<div class="spec one"><div class="box rec"><span>${sp.label || 'Key fact'}</span><b>${sp.single}</b>${sp.note ? `<small>${sp.note}</small>` : ''}</div></div>`;
  return `<div class="spec"><div class="box"><span>${sp.minLabel || 'Minimum'}</span><b>${sp.min}</b></div><div class="box rec"><span>${sp.recLabel || 'Recommended'}</span><b>${sp.rec}</b></div></div>`;
}
function renderInfo(st) {
  const g = GROUPS.find((x) => x.id === st.group);
  const L = st.ordered ? 'ol' : 'ul';
  $('#infoBody').innerHTML = `
    <div class="kicker">${st.kicker}</div>
    <h2>${st.title}</h2>
    ${st.badge ? `<div class="badge">${st.badge}</div>` : ''}
    ${st.lead ? `<p class="lead">${st.lead}</p>` : ''}
    ${st.define ? `<div class="define"><p>${st.define.text}</p>${(st.define.pairs || []).map(([c, k, v]) => `<div class="pair"><i style="background:var(--${c})"></i><p><b>${k}</b> ${v}</p></div>`).join('')}</div>` : ''}
    ${specHTML(st.spec)}
    <${L} class="points">${st.points.map((p) => `<li>${p}</li>`).join('')}</${L}>
    ${st.link ? `<div class="link"><span>How it fits together</span>${st.link}</div>` : ''}
    ${st.note ? `<p class="note">${st.note}</p>` : ''}`;
  $('#infoBody').scrollTop = 0;
  $('#groupName').textContent = g ? g.label : '';
  $('#insetCap').textContent = `Close-up · ${st.cap || st.title}`;
}

// ------------------------------------------------------------------ 3D
let renderer, scene, camera, controls, composer, bloom, W, flows;
let gl = false;
const Q = { bloom: true, pr: Math.min(window.devicePixelRatio || 1, 1.75), shadows: true, forced: ['low', 'high'].includes(params.get('q')) };
if (params.get('q') === 'low') { Q.bloom = false; Q.pr = 1; Q.shadows = false; }

function init3D() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer.getContext()) return false;
  renderer.setPixelRatio(Q.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = Q.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('#gl').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = backdropTexture();
  scene.fog = new THREE.FogExp2(0x0b1526, 0);   // thickened on close-up sections so the background recedes
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x1a1410, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 16, 12); key.target.position.set(0, 0, -1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 13, bottom: -12, near: 2, far: 50 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6aa8ff, 1.4); rim.position.set(8, 9, -12); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe2c4, 0.5); fill.position.set(12, 5, 10); scene.add(fill);

  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
  W = buildWorld(scene, devices.canvases);
  flows = new Flows(scene, W.anchors, W.curves, camera);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 3; controls.maxDistance = 55; controls.maxPolarAngle = Math.PI * 0.52;
  controls.screenSpacePanning = true;
  controls.addEventListener('start', () => { userMoved = true; });

  setupComposer();
  return true;
}

function setupComposer() {
  if (!Q.bloom) { composer = null; return; }
  const w = innerWidth, h = innerHeight;
  const rt = new THREE.WebGLRenderTarget(w * Q.pr, h * Q.pr, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Q.pr); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.45, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// ------------------------------------------------------------------ camera
const cam = { flying: false, from: null, to: null, t0: 0, dur: 1.6 };
let viewOffset = 0;
function shotPose(shot, sway = 0) {
  const target = new THREE.Vector3(...shot.target);
  const dir = new THREE.Vector3(...shot.dir).normalize();
  if (sway) dir.applyAxisAngle(UP, sway);
  return { pos: target.clone().addScaledVector(dir, shot.dist), target };
}
function flyTo(shot, instant = false) {
  const to = shotPose(shot);
  userMoved = false; swayT = 0;
  if (instant || !camera) {
    if (!camera) return;
    camera.position.copy(to.pos); controls.target.copy(to.target); camera.lookAt(to.target); cam.flying = false; controls.enabled = true;
    return;
  }
  cam.from = { pos: camera.position.clone(), target: controls.target.clone() };
  cam.to = to; cam.t0 = clockNow;
  cam.dur = clamp(1.1 + cam.from.pos.distanceTo(to.pos) * 0.045, 1.3, 2.4);
  cam.flying = true; controls.enabled = false;
}
const s0 = new THREE.Spherical(), s1 = new THREE.Spherical(), sv = new THREE.Spherical();
function updateCamera(dt) {
  if (cam.flying) {
    const k = easeInOutCubic(clamp((clockNow - cam.t0) / cam.dur));
    const tgt = cam.from.target.clone().lerp(cam.to.target, k);
    s0.setFromVector3(cam.from.pos.clone().sub(cam.from.target));
    s1.setFromVector3(cam.to.pos.clone().sub(cam.to.target));
    let dTh = s1.theta - s0.theta;
    if (dTh > Math.PI) dTh -= Math.PI * 2; if (dTh < -Math.PI) dTh += Math.PI * 2;
    sv.set(lerp(s0.radius, s1.radius, k), lerp(s0.phi, s1.phi, k), s0.theta + dTh * k);
    camera.position.copy(tgt).add(new THREE.Vector3().setFromSpherical(sv));
    controls.target.copy(tgt); camera.lookAt(tgt);
    if (k >= 1) { cam.flying = false; controls.enabled = true; }
  } else if (STEPS[stepIndex].sway && !userMoved) {
    swayT += dt;
    const p = shotPose(STEPS[stepIndex].shot, Math.sin((swayT / 26) * Math.PI * 2) * 0.12);
    camera.position.copy(p.pos); controls.target.copy(p.target);
  }
}
let viewOffsetY = 8, insetShift = 0;
function applyViewOffset(dt) {
  const w = innerWidth, h = innerHeight, narrow = w <= 900;
  const pr = $('#info').getBoundingClientRect();
  const want = notesVisible && !narrow ? pr.width + 18 : 0;
  const k = dt ? 1 - Math.exp(-dt * 6) : 1;
  viewOffset += (want - viewOffset) * k;
  // keep the subject clear of the close-up panel in the bottom-right corner
  const ir = insetShown && !insetBig && !narrow ? $('#inset').getBoundingClientRect() : null;
  insetShift += ((ir ? ir.width * 0.3 : 0) - insetShift) * k;
  const wantY = narrow && notesVisible ? Math.max(8, h / 2 - (62 + pr.top) / 2) : ir ? 8 + ir.height * 0.2 : 8;
  viewOffsetY += (wantY - viewOffsetY) * k;
  camera.aspect = w / h;
  camera.setViewOffset(w, h, -(viewOffset / 2) + insetShift, viewOffsetY, w, h);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ labels
const labelsEl = $('#labels'), svg = $('#leaders');
let labelItems = [];
function buildLabels(st) {
  labelsEl.querySelectorAll('.tag').forEach((n) => n.remove());
  svg.innerHTML = '';
  labelItems = (st.labels || []).map((L) => {
    const el = document.createElement('div'); el.className = 'tag';
    el.innerHTML = '<b></b><small></small>';
    labelsEl.appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '5');
    svg.appendChild(line); svg.appendChild(dot);
    return { L, el, line, dot, last: '', on: 0 };
  });
}
const pv = new THREE.Vector3();
const val = (v, t) => (typeof v === 'function' ? v(t) : v);
function updateLabels() {
  const show = labelsOn && !cam.flying && gl;
  labelsEl.classList.toggle('show', show);
  if (!gl) return;
  const insetRect = insetShown ? $('#inset').getBoundingClientRect() : null;
  const pr = $('#info').getBoundingClientRect();
  const w = innerWidth, h = innerHeight, t = loop.lt;
  const placed = [];
  for (const it of labelItems) {
    const { L } = it;
    const fn = W.anchors[L.at];
    const inWindow = !L.when || (t >= L.when[0] && t <= L.when[1]);
    let vis = !!fn && inWindow && loop.fade > 0.5;
    if (vis) { pv.copy(fn()).project(camera); vis = pv.z < 1 && Math.abs(pv.x) < 1.3 && Math.abs(pv.y) < 1.3; }
    it.el.style.display = vis ? '' : 'none'; it.line.style.display = it.dot.style.display = vis ? '' : 'none';
    if (!vis) continue;
    const x = (pv.x + 1) / 2 * w, y = (1 - pv.y) / 2 * h;
    const tx = val(L.text, t), sub = val(L.sub, t) || '', col = val(L.color, t);
    const key = tx + '|' + sub + '|' + col;
    if (key !== it.last) { it.el.querySelector('b').textContent = tx; it.el.querySelector('small').textContent = sub; it.el.style.setProperty('--c', col); it.line.setAttribute('stroke', col); it.dot.setAttribute('fill', col); it.last = key; }
    const bw = it.el.offsetWidth, bh = it.el.offsetHeight;
    let bx = x + (L.dx || 0) - bw / 2, by = y + (L.dy || 0) - bh / 2;
    const minX = notesVisible && w > 900 ? pr.right + 12 : 8;
    const maxY = (notesVisible && w <= 900 ? pr.top - 8 : h - 100) - bh;
    bx = clamp(bx, minX, w - bw - 8); by = clamp(by, 74, Math.max(74, maxY));
    if (insetRect && bx + bw > insetRect.left - 10 && by + bh > insetRect.top - 26) by = Math.max(74, insetRect.top - bh - 30);
    placed.push({ it, x, y, bx, by, bw, bh, maxY: Math.max(74, maxY) });
  }
  // keep labels from stacking on top of each other
  placed.sort((a, b) => a.by - b.by);
  for (let i = 1; i < placed.length; i++) {
    const B = placed[i];
    for (let j = 0; j < i; j++) {
      const P = placed[j];
      const hit = P.bx < B.bx + B.bw + 6 && B.bx < P.bx + P.bw + 6 && P.by < B.by + B.bh + 6 && B.by < P.by + P.bh + 6;
      if (!hit) continue;
      const down = P.by + P.bh + 8;
      B.by = down <= B.maxY ? down : Math.max(74, P.by - B.bh - 8);
    }
  }
  for (const Pl of placed) {
    const { it, x, y, bx, by, bw, bh } = Pl;
    it.el.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
    const ex = clamp(x, bx, bx + bw), ey = clamp(y, by, by + bh);
    it.line.setAttribute('x1', x); it.line.setAttribute('y1', y); it.line.setAttribute('x2', ex); it.line.setAttribute('y2', ey);
    it.dot.setAttribute('cx', x); it.dot.setAttribute('cy', y);
  }
}

// ------------------------------------------------------------------ close-up panel
let insetCheck = 0;
function updateInset(dt) {
  insetCheck -= dt;
  if (insetCheck > 0) return;
  insetCheck = 0.25;
  let want;
  if (!gl) want = true;
  else if (insetMode === 'on') want = true;
  else if (insetMode === 'off') want = false;
  else if (STEPS[stepIndex].inset === 'hide') want = false;
  else if (innerWidth <= 900 && notesVisible) want = false;
  else want = true;
  if (want !== insetShown) { insetShown = want; $('#inset').classList.toggle('off', !want); }
  // wide shots hide the close-up in auto mode; a small tab still offers it
  $('#insetTab').hidden = !(gl && !insetShown && insetMode === 'auto');
}

// ------------------------------------------------------------------ navigation
function targetsFor(st, t) {
  const s = st.state ? st.state(t) : {};
  return { ...DEF, ...s };
}
function goTo(i, { instant = false } = {}) {
  i = clamp(i, 0, STEPS.length - 1);
  stepIndex = i; stepTime = 0; loop = loopInfo(STEPS[i].id, 0);
  if (tabOpened && gl) { tabOpened = false; insetMode = 'auto'; $('#btnCloseup').textContent = 'Close-up: auto'; insetBig = false; $('#inset').classList.remove('big'); insetCheck = 0; }
  const st = STEPS[i];
  renderInfo(st);
  document.querySelectorAll('.chip').forEach((b) => {
    const bi = +b.dataset.i;
    b.classList.toggle('active', bi === i); b.classList.toggle('done', bi < i);
    if (bi === i) { b.setAttribute('aria-current', 'step'); b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: instant ? 'auto' : 'smooth' }); }
    else b.removeAttribute('aria-current');
  });
  $('#stepCount').textContent = `${i + 1} / ${STEPS.length}`;
  $('#progress').style.width = `${((i + 1) / STEPS.length) * 100}%`;
  $('#btnBack').disabled = i === 0; $('#btnNext').disabled = i === STEPS.length - 1;
  A.focus = new Set(st.focus || []);
  lastScreen = -1; drawScreen();
  if (gl) {
    flows.set(st.flows || []);
    buildLabels(st);
    flyTo(st.shot, instant);
  }
  try { history.replaceState(null, '', '#' + st.id); } catch (e) { /* sandboxed preview */ }
}
const next = () => { if (stepIndex < STEPS.length - 1) goTo(stepIndex + 1); };
const back = () => { if (stepIndex > 0) goTo(stepIndex - 1); };

$('#btnNext').addEventListener('click', next);
$('#btnBack').addEventListener('click', back);
$('#btnNotes').addEventListener('click', () => toggleNotes());
$('#btnReset').addEventListener('click', () => gl && flyTo(STEPS[stepIndex].shot));
$('#btnCloseup').addEventListener('click', () => cycleInset());
$('#btnFull').addEventListener('click', () => toggleFull());
$('#btnHelp').addEventListener('click', () => $('#help').classList.toggle('open'));
$('#helpClose').addEventListener('click', () => $('#help').classList.remove('open'));
$('#inset').addEventListener('click', () => { if (!gl) return; insetBig = !insetBig; $('#inset').classList.toggle('big', insetBig); });
$('#insetTab').addEventListener('click', () => {
  // opens the close-up, enlarged, for this section only
  tabOpened = true; insetMode = 'on'; $('#btnCloseup').textContent = 'Close-up: on';
  insetBig = true; $('#inset').classList.add('big'); insetCheck = 0; updateInset(0);
});

function toggleNotes(v) { notesVisible = v ?? !notesVisible; $('#info').classList.toggle('hidden', !notesVisible); $('#btnNotes').setAttribute('aria-pressed', String(notesVisible)); }
function cycleInset() {
  tabOpened = false;
  insetMode = { auto: 'on', on: 'off', off: 'auto' }[insetMode];
  $('#btnCloseup').textContent = `Close-up: ${insetMode}`;
  insetCheck = 0;
}
function toggleFull() {
  try {
    const p = !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* not allowed here */ }
}
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (k === 'Enter' && e.target.closest && e.target.closest('button')) return;
  if ($('#help').classList.contains('open') && k !== 'Escape' && k !== '?') return;
  if (['ArrowRight', 'PageDown', 'ArrowDown', ' '].includes(k)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp', 'ArrowUp', 'Backspace'].includes(k)) { e.preventDefault(); back(); }
  else if (k === 'Home') goTo(0);
  else if (k === 'End') goTo(STEPS.length - 1);
  else if (k === 'n' || k === 'N') toggleNotes();
  else if (k === 'c' || k === 'C' || k === 'm' || k === 'M') cycleInset();
  else if (k === 'p' || k === 'P') goTo(stepIndex, { instant: true });
  else if (k === 'l' || k === 'L') labelsOn = !labelsOn;
  else if ((k === 'r' || k === 'R') && gl) flyTo(STEPS[stepIndex].shot);
  else if (k === 'f' || k === 'F') toggleFull();
  else if (k === '?') $('#help').classList.toggle('open');
  else if (k === 'Escape') { $('#help').classList.remove('open'); if (insetBig) { insetBig = false; $('#inset').classList.remove('big'); } }
});

// ------------------------------------------------------------------ loop
function tick(dt) {
  clockNow += dt; stepTime += dt;
  const st = STEPS[stepIndex];
  loop = loopInfo(st.id, stepTime);
  const tg = targetsFor(st, loop.lt);
  for (const k in DEF) A[k] += (tg[k] - A[k]) * (1 - Math.exp(-dt * RATES[k]));
  scene.fog.density = 0.03 * A.fog;
  W.update(A, clockNow, dt, { id: st.id, lt: loop.lt, fade: loop.fade });
  updateCamera(dt);
  scene.updateMatrixWorld();
  flows.update(dt, loop.lt, loop.fade);
}
let lastScreen = -1, lastDevices = -1;
function drawScreen() {
  const st = STEPS[stepIndex];
  if (lastScreen < 0 || clockNow - lastScreen >= 1 / 30) {
    lastScreen = clockNow;
    if (insetShown || !gl || lastScreen === 0) closeup.draw(st.id, loop.lt, loop.fade);
  }
  if (gl && (lastDevices < 0 || clockNow - lastDevices >= 1 / 12)) {
    lastDevices = clockNow;
    for (const k of devices.update(st.id, loop.lt)) W.screenTex[k].needsUpdate = true;
  }
}
function render() {
  if (composer) composer.render(); else renderer.render(scene, camera);
}

// adaptive quality: step down if the machine can't keep up (unless ?q= was given)
let perfAcc = 0, perfN = 0, perfStage = 0, warm = 90;
function adapt(dt) {
  if (Q.forced || perfStage >= 2) return;
  if (warm > 0) { warm--; return; }
  perfAcc += dt; perfN++;
  if (perfAcc < 3) return;
  const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
  if (avg > 1 / 28) {
    if (perfStage === 0) { Q.bloom = false; Q.pr = 1; renderer.setPixelRatio(1); setupComposer(); }
    else { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    perfStage++;
  } else perfStage = 2;
}

let last = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (gl) {
    tick(dt);
    applyViewOffset(dt);
    if (controls.enabled) controls.update();
    drawScreen();
    render();
    updateLabels();
    adapt(dt);
  } else {
    clockNow += dt; stepTime += dt; loop = loopInfo(STEPS[stepIndex].id, stepTime); drawScreen();
  }
  updateInset(dt);
}

window.addEventListener('resize', () => {
  if (!gl) return;
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  applyViewOffset(0);
});

// ------------------------------------------------------------------ boot
gl = init3D();
if (!gl) {
  $('#nogl').hidden = false; $('#app').classList.add('nogl');
  insetMode = 'on'; insetBig = true; insetShown = true; $('#inset').classList.add('big'); $('#inset').classList.remove('off');
  $('#btnCloseup').disabled = true; $('#btnReset').disabled = true;
}
const fromHash = STEPS.findIndex((s) => '#' + s.id === location.hash);
const fromParam = STEPS.findIndex((s) => s.id === params.get('step'));
const startAt = fromParam >= 0 ? fromParam : fromHash >= 0 ? fromHash : 0;
if (gl) { insetShown = true; $('#inset').classList.remove('off'); applyViewOffset(0); }
goTo(startAt, { instant: true });
if (gl) {
  // settle the opening state so the first frame is already composed
  for (let i = 0; i < 60; i++) tick(1 / 30);
  goTo(startAt, { instant: true });
}
$('#loading').classList.add('done');
// Test mode is only switched on by the automated screenshot harness (it sets this flag before the page loads); a link cannot turn it on.
const TEST = window.__VIZ_TEST__ === true;
if (!TEST) requestAnimationFrame(frame); else if (gl) render();

// test hooks for the automated screenshot harness only; not defined in normal use
if (TEST) window.__viz = {
  steps: STEPS.map((s) => s.id),
  go(i, settle = 4) {
    goTo(i, { instant: true });
    for (let n = 0; n < settle * 30; n++) tick(1 / 30);
    flyTo(STEPS[i].shot, true);
    if (gl) { insetCheck = 0; updateInset(0); applyViewOffset(0); scene.updateMatrixWorld(); flows.update(0, loop.lt, loop.fade); lastScreen = -1; lastDevices = -1; drawScreen(); render(); updateLabels(); }
  },
  advance(sec) { for (let n = 0; n < sec * 30; n++) tick(1 / 30); applyViewOffset(0); lastScreen = -1; lastDevices = -1; drawScreen(); render(); updateLabels(); },
  nav(i) { goTo(i); },
  ready: true,
  get W() { return W; },
  get quality() { return { bloom: !!composer, pixelRatio: renderer ? renderer.getPixelRatio() : 0, shadows: renderer ? renderer.shadowMap.enabled : false, stage: perfStage }; },
};
