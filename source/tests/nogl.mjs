// No-3D fallback test. Usage: node nogl.mjs <full path to .html> <folder for nogl.png>
import { createRequire } from 'module';
const require = createRequire('/usr/local/lib/node_modules/docgen-utils/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/docgen-browsers/chromium-1208/chrome-linux64/chrome', args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + process.argv[2] + '', { waitUntil: 'commit', timeout: 120000 });
for (const t0 = Date.now(); !(await page.evaluate(() => !!document.querySelector('#loading.done')).catch(() => false));) { if (Date.now() - t0 > 120000) throw new Error('timeout'); await page.waitForTimeout(500); }
await page.click('#btnNext'); await page.click('#btnNext'); await page.click('#btnNext'); await page.click('#btnNext');
await page.waitForTimeout(400);
const st = await page.evaluate(() => ({ nogl: !document.querySelector('#nogl').hidden, step: document.querySelector('#stepCount').textContent, title: document.querySelector('#infoBody h2').textContent, inset: !document.querySelector('#inset').classList.contains('off') }));
console.log(JSON.stringify(st), 'errors:', JSON.stringify(errs));
await page.screenshot({ path: process.argv[3] + '/nogl.png' });
await browser.close();
