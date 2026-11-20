// Security behaviour test for the shipped visualizer (no test flags; exactly what coworkers open).
// Usage: node sec.mjs <full path to .html> [1|2]   1 = normal open + injected-script/network probes, 2 = booby-trapped link (run separately).
import { createRequire } from 'module';
const require = createRequire('/usr/local/lib/node_modules/docgen-utils/');
const { chromium } = require('playwright');
const file = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/docgen-browsers/chromium-1208/chrome-linux64/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const fileUrl = 'file://' + file;
const part = process.argv[3] || 'all';
async function open(suffix) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const log = { requests: [], errors: [], dialogs: [], failed: [] };
  page.on('request', (r) => log.requests.push(r.url().startsWith(fileUrl) ? '(the HTML file itself)' : r.url().slice(0, 120)));
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => log.failed.push(r.url().slice(0, 60) + ' -> ' + (r.failure()?.errorText || '?')));
  page.on('dialog', async (d) => { log.dialogs.push(d.message()); await d.dismiss(); });
  await page.addInitScript(() => {
    window.__cspv = []; window.__raf = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); };
    document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.effectiveDirective + (e.blockedURI ? ' ' + e.blockedURI.slice(0, 60) : '')));
  });
  await page.goto(fileUrl + suffix, { waitUntil: 'commit', timeout: 120000 });
  const t0 = Date.now();
  while (!(await page.evaluate(() => !!document.querySelector('#loading.done')).catch(() => false))) {
    if (Date.now() - t0 > 200000) throw new Error('timeout waiting for app');
    await page.waitForTimeout(500);
  }
  return { page, log };
}
const state = (page) => page.evaluate(() => ({
  step: document.querySelector('#stepCount')?.textContent, title: document.querySelector('#infoBody h2')?.textContent, hash: location.hash,
  testHooks: typeof window.__viz, webgl: !document.querySelector('#app').classList.contains('nogl'),
  imgsInPage: document.querySelectorAll('img').length, cspViolations: window.__cspv.slice() }));
const screenSig = (page) => page.evaluate(() => { const c = document.querySelector('#insetScreen canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h; });

// 1) Normal open
if (part !== '2') {
  const { page, log } = await open('?q=low');
  console.log('1. normal open:', JSON.stringify(await state(page)));
  { const a = await page.evaluate(() => window.__raf); await page.waitForTimeout(5000); const b = await page.evaluate(() => window.__raf); console.log('   animation frames requested by the app in 5 s:', b - a); }
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500);
  console.log('   after Next  :', JSON.stringify(await state(page)));
  const probe = await page.evaluate(async () => {
    const out = {};
    const s = document.createElement('script'); s.textContent = 'window.__inj1 = 1'; document.body.appendChild(s);
    document.body.insertAdjacentHTML('beforeend', '<img id="probeimg" src="https://example.com/x.png" onerror="window.__inj2 = 1">');
    try { await fetch('https://example.com/'); out.fetch = 'allowed'; } catch (e) { out.fetch = 'failed'; }
    setTimeout('window.__inj3 = 1', 0);
    await new Promise((r) => setTimeout(r, 800));
    out.injectedScriptRan = window.__inj1 === 1; out.injectedHandlerRan = window.__inj2 === 1; out.stringTimerRan = window.__inj3 === 1;
    document.getElementById('probeimg')?.remove();
    out.violationsRecorded = window.__cspv.slice();
    return out;
  });
  console.log('   CSP probes  :', JSON.stringify(probe));
  console.log('   requests    :', JSON.stringify(log.requests), ' blocked/failed:', JSON.stringify(log.failed));
  console.log('   errors      :', JSON.stringify(log.errors.filter((e) => !/Content Security Policy|example\.com|Failed to fetch/.test(e))));
  await page.close();
}
// 2) Booby-trapped link (old test switch + script/HTML in every URL input)
if (part !== '1') {
  const q = encodeURIComponent('<img src=x onerror=alert(1)>'), st = encodeURIComponent('<script>alert(2)</script>'), h = encodeURIComponent('"><img src=x onerror=alert(3)>');
  const { page, log } = await open(`?test=1&q=${q}&step=${st}#${h}`);
  console.log('2. crafted link:', JSON.stringify(await state(page)));
  const a = await page.evaluate(() => window.__raf); await page.waitForTimeout(12000); const b = await page.evaluate(() => window.__raf);
  console.log('   animation frames requested by the app in 12 s:', b - a);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500);
  console.log('   after Next  :', JSON.stringify(await state(page)));
  console.log('   dialogs     :', JSON.stringify(log.dialogs), ' requests:', JSON.stringify(log.requests), ' errors:', JSON.stringify(log.errors));
  await page.close();
}
await browser.close();
