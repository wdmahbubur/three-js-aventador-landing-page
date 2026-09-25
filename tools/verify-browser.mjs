/** Real Chromium + WebGL integration checks, never a mock renderer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { checkUiFoundation } from './check-ui-browser.mjs';
const port = 3177, base = `http://127.0.0.1:${port}`, output = path.resolve('public/diagnostics');
await fs.mkdir(output, { recursive: true });
const checks = [], runtimeErrors = [], requestsFailed = [];
const report = { passed: false, renderedInBrowser: false, renderer: 'Chromium / software WebGL', checks, runtimeErrors, requestsFailed };
let browser, server, page;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, passed, detail) {
  checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) });
  if (!passed) throw new Error(name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
}
const state = page => page.evaluate(() => window.__REVUELTO__.getState());
async function seek(page, progress) {
  await page.evaluate(p => window.__REVUELTO__.seek(p), progress);
  await page.waitForFunction(p => Math.abs(window.__REVUELTO__.getState().progress - p) < (p === 0 || p === 1 ? .000001 : .001), { timeout: 30000 }, progress);
  await pause(900);
}
const screenshot = (page, name) => page.screenshot({ path: path.join(output, `${name}.webp`), type: 'webp', quality: 82 });
try {
  report.optimization = JSON.parse(await fs.readFile('public/models/optimized/manifest.json', 'utf8'));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '', available = false;
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { serverLog = (serverLog + data.toString()).slice(-8000); });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) { available = true; break; } } catch {}
    if (server.exitCode !== null) break;
    await pause(500);
  }
  check('Production server starts', available, available ? undefined : serverLog);
  browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || await chromium.executablePath(), args: [...chromium.args, '--enable-unsafe-swiftshader'], headless: 'shell', defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 180000 });
  page = await browser.newPage();
  page.on('pageerror', error => runtimeErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') runtimeErrors.push(message.text()); });
  page.on('requestfailed', request => requestsFailed.push({ url: request.url(), failure: request.failure()?.errorText }));
  await page.goto(base + '/?debug', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__REVUELTO__?.getState().ready || window.__REVUELTO__?.getState().engineError, { timeout: 180000 });
  const opening = await state(page);
  check('Actual compressed model loads', opening.ready && opening.optimizedModel, opening);
  check('Car has independent assembly parts', opening.parts > 20, opening.parts);
  check('Empty opening has zero visible car parts', opening.visibleParts === 0);
  await pause(1800);
  const idleA = await state(page); await pause(450);
  check('GPU sleeps when the opening is idle', (await state(page)).renderCount - idleA.renderCount <= 1);
  await screenshot(page, 'premium-opening');
  await seek(page, .7);
  const partial = await state(page);
  check('Scroll produces a partially assembled car', partial.visibleParts > 0 && partial.assembledParts < partial.parts);
  await screenshot(page, 'premium-assembly');
  await seek(page, 1);
  const reveal = await state(page);
  check('All real parts assemble at the end', reveal.visibleParts === reveal.parts && reveal.assembledParts === reveal.parts);
  check('Projected headlights are preserved', reveal.headlights?.count === 2 && reveal.headlights.strength > .99, reveal.headlights);
  await screenshot(page, 'premium-desktop');
  report.renderedInBrowser = true; report.reveal = reveal;
  await page.click('[data-action="lights"]');
  check('Headlight toggle disables the beam', (await state(page)).headlights.strength === 0);
  await page.click('[data-action="lights"]');
  await page.click('[data-mode-tab="customize"]');
  await page.click('[data-finish="arancio"]');
  check('Paint finish switches', (await state(page)).finish === 'arancio');
  await page.click('[data-finish="rosso"]');
  await page.click('[data-mode-tab="explore"]');
  await page.click('[data-action="explode"]');
  await page.waitForFunction(() => window.__REVUELTO__.getState().exploded > .99, { timeout: 30000 });
  check('Exploded view switches off headlight projection', (await state(page)).headlights.strength < .01);
  await page.click('[data-action="explode"]');
  await page.waitForFunction(() => window.__REVUELTO__.getState().exploded < .001, { timeout: 30000 });
  await page.click('[data-action="inspect"]');
  check('360-degree inspection enables', (await state(page)).inspect);
  const camera = (await state(page)).camera;
  await page.focus('canvas'); await page.keyboard.press('ArrowLeft'); await pause(500);
  check('Keyboard rotates the camera', JSON.stringify((await state(page)).camera) !== JSON.stringify(camera));
  await page.keyboard.press('Escape');
  check('Escape exits inspection', !(await state(page)).inspect);
  await page.$eval('canvas', el => el.blur());
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.select('select[data-quality]', 'eco'); await pause(300);
  check('Eco caps renderer resolution', (await state(page)).pixelRatio <= 1);
  await page.select('select[data-quality]', 'high'); await pause(300);
  check('High quality is an explicit user choice', (await state(page)).pixelRatio === 2);
  await page.select('select[data-quality]', 'auto');
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await seek(page, 1);
    check(`No horizontal overflow at ${width}×${height}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`Controls fit the viewport at ${width}×${height}`, await page.$eval('[data-reveal-controls]', el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
    if (width === 390) await screenshot(page, 'premium-mobile');
  }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await checkUiFoundation({ page, check, screenshot, state, seek, pause });
  await seek(page, 0);
  check('Reverse scrolling returns to an empty stage', (await state(page)).visibleParts === 0);
  // Exercise the real navigation and wait for observer delivery, not an arbitrary sleep.
  await page.click('.header-nav a[href="#design"]');
  await page.waitForFunction(() => window.__REVUELTO__.getState().active === false, { timeout: 30000 });
  check('Renderer pauses outside the 3D section', (await state(page)).active === false);
  await pause(900); await screenshot(page, 'premium-design');
  const awayA = (await state(page)).renderCount; await pause(450);
  check('No GPU frames are produced offscreen', (await state(page)).renderCount === awayA);
  await page.$eval('[data-action="credits"]', el => el.click());
  check('Credits remain accessible', await page.$eval('dialog', el => el.open));
  await page.keyboard.press('Escape');
  check('Escape dismisses credits', !(await page.$eval('dialog', el => el.open)));
  const reduced = await browser.newPage();
  await reduced.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await reduced.goto(base + '/?debug', { waitUntil: 'domcontentloaded' });
  await reduced.waitForFunction(() => window.__REVUELTO__?.getState().ready, { timeout: 180000 });
  check('Reduced motion shows the fully assembled car', (await state(reduced)).progress === 1 && (await state(reduced)).reduced);
  await reduced.close();
  const saver = await browser.newPage();
  await saver.evaluateOnNewDocument(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' }, configurable: true }));
  const downloads = [];
  saver.on('request', request => { if (request.url().endsWith('.glb')) downloads.push(request.url()); });
  await saver.goto(base + '/?debug', { waitUntil: 'domcontentloaded' });
  await saver.waitForFunction(() => document.querySelector('.experience')?.dataset.engine === 'deferred');
  await pause(600);
  check('Data Saver does not auto-download the model', downloads.length === 0);
  await saver.click('[data-action="retry"]');
  await saver.waitForFunction(() => window.__REVUELTO__?.getState().ready, { timeout: 180000 });
  check('Data Saver allows explicit opt-in to 3D', downloads.length === 1);
  await saver.close();
  check('No uncaught JavaScript or shader errors', runtimeErrors.length === 0, runtimeErrors);
  check('All page assets load', requestsFailed.length === 0, requestsFailed);
  report.passed = true;
} catch (error) {
  report.error = error.stack || String(error);
  if (page) try {
    report.failureState = await state(page);
    report.failureLayout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollY, hidden: document.hidden, explodedPressed: document.querySelector('[data-action="explode"]').getAttribute('aria-pressed'), track: document.querySelector('.assembly-track').getBoundingClientRect().toJSON() }));
    await screenshot(page, 'premium-failure');
  } catch {}
  console.error('Browser verification failed:', report.error);
} finally {
  if (browser) await browser.close().catch(() => {});
  server?.kill('SIGTERM');
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'premium.json'), JSON.stringify(report, null, 2));
  console.log(`Browser checks: ${checks.filter(item => item.passed).length}/${checks.length}, passed=${report.passed}`);
  if (!report.passed && process.env.VERCEL_ENV !== 'preview') process.exitCode = 1;
}
