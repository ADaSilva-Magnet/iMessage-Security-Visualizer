// Navigation test. Usage: node live.mjs <full path to .html>
//   Opens ?q=low#msgkey, then arrow keys, Page Up, a section button, Back and End. Expects no errors.
import { createRequire } from 'module';
const require = createRequire('/usr/local/lib/node_modules/docgen-utils/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/docgen-browsers/chromium-1208/chrome-linux64/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + process.argv[2] + '?q=low#msgkey', { waitUntil: 'commit', timeout: 120000 });
for (const t0 = Date.now(); !(await page.evaluate(() => !!(document.querySelector('#loading.done') && (!window.__VIZ_TEST__ || (window.__viz && window.__viz.ready)))).catch(() => false));) { if (Date.now() - t0 > 200000) throw new Error('timeout'); await page.waitForTimeout(500); }
const read = () => page.evaluate(() => ({ step: document.querySelector('#stepCount').textContent, title: document.querySelector('#infoBody h2').textContent, hash: location.hash }));
console.log('deep link:', JSON.stringify(await read()));
await page.waitForTimeout(6000);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(4000);
console.log('after → :', JSON.stringify(await read()));
await page.keyboard.press('PageUp'); await page.waitForTimeout(3000);
console.log('after PgUp:', JSON.stringify(await read()));
await page.evaluate(() => [...document.querySelectorAll('.chip')].find((b) => b.textContent === 'Unlock').click()); await page.waitForTimeout(5000);
console.log('chip Unlock:', JSON.stringify(await read()));
await page.evaluate(() => document.querySelector('#btnBack').click()); await page.waitForTimeout(3000);
console.log('Back button:', JSON.stringify(await read()));
await page.keyboard.press('End'); await page.waitForTimeout(4000);
console.log('End:', JSON.stringify(await read()), 'next disabled:', await page.evaluate(() => document.querySelector('#btnNext').disabled));
console.log('errors:', JSON.stringify(errs));
await browser.close();
