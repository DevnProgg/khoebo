'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8081';
const ROOT = path.resolve(__dirname, '..');
const PROJECT_DIR = path.join(ROOT, 'project');
const REHEARSAL_DIR = path.join(PROJECT_DIR, 'rehearsal');
const VIDEO_DIR = path.join(ROOT, 'assets', 'raw-segments');
const AUTH_STATE = '/tmp/opencode/khoebo-work/auth-state.json';
const RAW_VIDEO = path.join(ROOT, 'khoebo-raw-recording.webm');
const VIEWPORT = { width: 390, height: 844 };
const RECORD_SIZE = { width: 390, height: 844 };
const MOBILE = { isMobile: true, hasTouch: true };

function log(label, ok, detail) {
  const prefix = ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${label}${detail ? ' :: ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
}

async function ready(page, pause = 1800) {
  await page.waitForFunction(() => {
    const text = document.body && document.body.innerText ? document.body.innerText : '';
    return text.length > 0 && !text.includes('Bundling...') && !text.includes('Getting things ready');
  }, null, { timeout: 60000 });
  await page.waitForTimeout(pause);
}

async function injectOverlays(page) {
  await page.evaluate(() => {
    let cursor = document.getElementById('demo-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'demo-cursor';
      cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#E96B1A" stroke="#201A16" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      cursor.style.cssText = 'position:fixed;z-index:999999;pointer-events:none;width:26px;height:26px;transition:left .12s,top .12s;filter:drop-shadow(1px 2px 2px rgba(0,0,0,.25));left:0;top:0;';
      document.body.appendChild(cursor);
      document.addEventListener('mousemove', event => {
        cursor.style.left = event.clientX + 'px';
        cursor.style.top = event.clientY + 'px';
      });
    }
    let bar = document.getElementById('demo-subtitle');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-subtitle';
      bar.style.cssText = 'position:fixed;left:20px;right:20px;bottom:18px;z-index:999998;text-align:center;padding:10px 16px;background:rgba(32,26,22,.88);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:17px;font-weight:600;letter-spacing:.2px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none;';
      document.body.appendChild(bar);
    }
  });
}

async function showSubtitle(page, text, hold = 700) {
  await page.evaluate(value => {
    const bar = document.getElementById('demo-subtitle');
    if (!bar) return;
    bar.textContent = value;
    bar.style.opacity = value ? '1' : '0';
  }, text);
  if (text && hold) await page.waitForTimeout(hold);
}

async function moveAndClick(page, locator, label, opts = {}) {
  const el = locator.first ? locator.first() : locator;
  const visible = await el.isVisible().catch(() => false);
  if (!visible) {
    console.error(`SKIP ${label}: not visible`);
    return false;
  }
  try {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    const box = await el.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: opts.steps || 10 });
      await page.waitForTimeout(220);
    }
    await el.click({ timeout: opts.timeout || 8000 });
    await page.waitForTimeout(opts.postClickDelay || 700);
    return true;
  } catch (error) {
    console.error(`SKIP ${label}: ${error.message}`);
    return false;
  }
}

async function clickText(page, value, label, opts = {}) {
  const locator = typeof value === 'string' && opts.exact !== false
    ? page.getByText(value, { exact: true })
    : page.getByText(value);
  const count = await locator.count();
  if (!count) {
    console.error(`SKIP ${label}: no matches`);
    return false;
  }
  const indices = opts.first ? [0] : opts.last ? [count - 1] : Array.from({ length: count }, (_, i) => i).reverse();
  for (const index of indices) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      return moveAndClick(page, candidate, label, opts);
    }
  }
  console.error(`SKIP ${label}: no visible matches`);
  return false;
}

async function typeSlowly(page, locator, value, label, delay = 24) {
  const el = locator.first ? locator.first() : locator;
  if (!(await el.isVisible().catch(() => false))) {
    console.error(`SKIP ${label}: not visible`);
    return false;
  }
  await moveAndClick(page, el, label, { postClickDelay: 250 });
  await el.fill('');
  await el.pressSequentially(value, { delay });
  await page.waitForTimeout(400);
  return true;
}

async function hasText(page, value) {
  const text = await page.evaluate(() => document.body.innerText || '');
  return text.includes(value);
}

async function assertText(page, value, label) {
  const ok = await hasText(page, value);
  log(label, ok, ok ? value : `missing "${value}"`);
  return ok;
}

async function gotoApp(page, route, pause = 1800) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await injectOverlays(page);
  await ready(page, pause);
}

async function panElements(page, values) {
  for (const value of values) {
    const locator = page.getByText(value, { exact: false }).last();
    if (!(await locator.isVisible().catch(() => false))) continue;
    const box = await locator.boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + Math.min(box.width / 2, 180), box.y + box.height / 2, { steps: 8 });
    await page.waitForTimeout(420);
  }
}

async function warmup(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, ...MOBILE });
  const page = await context.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await ready(page, 1200);
  await page.locator('input[type="email"]').fill('demo@khoebo.example');
  await page.locator('input[type="password"]').fill('Demo2026!');
  await clickText(page, /^sign in$/i, 'Sign in', { exact: false, postClickDelay: 3500 });
  await ready(page, 2500);
  await clickText(page, /^skip$/i, 'Skip tour', { exact: false, postClickDelay: 600 });
  await assertText(page, 'Hi, Lerato', 'Warmup dashboard');
  await context.storageState({ path: AUTH_STATE });
  console.log('AUTH STATE SAVED:', AUTH_STATE);
  await context.close();
}

async function rehearse(browser) {
  fs.mkdirSync(REHEARSAL_DIR, { recursive: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, storageState: AUTH_STATE, ...MOBILE });
  const page = await context.newPage();
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  await gotoApp(page, '/');
  await assertText(page, 'Hi, Lerato', 'Dashboard greeting');
  await assertText(page, 'MONTH', 'Dashboard revenue period');
  await assertText(page, 'Net profit', 'Dashboard net profit');
  await assertText(page, 'New sale', 'Dashboard new sale action');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '01-dashboard.png') });

  await clickText(page, 'New sale', 'New sale quick action', { postClickDelay: 1400 });
  await assertText(page, 'Tap a product to add it to the cart.', 'Sell screen');
  for (const product of ['Chicken Pie', 'Malva Pudding', 'Iced Coffee']) {
    await clickText(page, product, `Product ${product}`, { exact: true, postClickDelay: 450 });
  }
  await assertText(page, 'Review', 'Review action');
  await clickText(page, 'Review', 'Review order', { postClickDelay: 1000 });
  await assertText(page, 'Review sale', 'Review sale modal');
  await typeSlowly(page, page.getByPlaceholder('Walk-in customer'), 'Demo Customer', 'Customer field', 10);
  await clickText(page, 'Card', 'Card payment', { postClickDelay: 400 });
  await clickText(page, /complete sale/i, 'Complete sale', { exact: false, postClickDelay: 2400 });
  await assertText(page, 'Sale complete', 'Sale confirmation');
  await clickText(page, 'View receipt', 'View receipt', { postClickDelay: 1500 });
  await assertText(page, 'Receipt', 'Receipt screen');
  await assertText(page, 'Paid', 'Receipt paid state');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '02-receipt.png') });

  await gotoApp(page, '/stock');
  await assertText(page, 'Know what you have, at a glance.', 'Stock screen');
  await assertText(page, 'Canvas Apron', 'Stock product');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '03-stock.png') });

  await gotoApp(page, '/reports');
  await assertText(page, 'Reports', 'Reports screen');
  await clickText(page, 'Income', 'Income tab', { postClickDelay: 1000 });
  await assertText(page, 'Net income', 'Income report');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '04-reports.png') });

  await gotoApp(page, '/bookkeeping');
  await assertText(page, 'Bookkeeping', 'Bookkeeping screen');
  await assertText(page, 'Journal entries', 'Bookkeeping journal');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '05-bookkeeping.png') });

  await gotoApp(page, '/analytics');
  await assertText(page, 'Analytics', 'Analytics screen');
  await assertText(page, 'Revenue', 'Analytics revenue');
  await page.screenshot({ path: path.join(REHEARSAL_DIR, '06-analytics.png') });

  await gotoApp(page, '/');
  await assertText(page, 'Keep the momentum', 'Dashboard outro');
  console.log(process.exitCode ? 'REHEARSAL FAILED' : 'REHEARSAL PASSED');
  await context.close();
}

async function record(browser) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    storageState: AUTH_STATE,
    recordVideo: { dir: VIDEO_DIR, size: RECORD_SIZE },
    ...MOBILE
  });
  const page = await context.newPage();
  const video = page.video();
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  await gotoApp(page, '/', 2200);
  await injectOverlays(page);
  await showSubtitle(page, 'One place for every number', 900);
  await panElements(page, ['MONTH', 'Net profit', 'Recent sales', '1 item is running low']);
  await page.waitForTimeout(2200);
  await showSubtitle(page, '');

  await clickText(page, 'New sale', 'New sale quick action', { postClickDelay: 1400 });
  await showSubtitle(page, 'Sell in seconds', 700);
  for (const product of ['Chicken Pie', 'Malva Pudding', 'Iced Coffee']) {
    await clickText(page, product, `Product ${product}`, { exact: true, postClickDelay: 520 });
  }
  await showSubtitle(page, 'Tap. Add. Done.', 700);
  await clickText(page, 'Review', 'Review order', { postClickDelay: 1100 });
  await typeSlowly(page, page.getByPlaceholder('Walk-in customer'), 'Demo Customer', 'Customer field', 20);
  await clickText(page, 'Card', 'Card payment', { postClickDelay: 500 });
  await showSubtitle(page, 'Payment, tax and totals handled', 700);
  await clickText(page, /complete sale/i, 'Complete sale', { exact: false, postClickDelay: 2300 });
  await showSubtitle(page, 'Sale recorded', 700);
  await clickText(page, 'View receipt', 'View receipt', { postClickDelay: 1500 });
  await panElements(page, ['Receipt', 'Paid', 'Demo Customer', 'Card']);
  await page.waitForTimeout(1200);
  await showSubtitle(page, '');

  await gotoApp(page, '/stock', 1800);
  await showSubtitle(page, 'Stock stays visible', 700);
  await panElements(page, ['Products', 'Stock value', 'Low stock', 'Canvas Apron']);
  await page.waitForTimeout(1800);
  await showSubtitle(page, '');

  await gotoApp(page, '/reports', 1800);
  await clickText(page, 'Income', 'Income tab', { postClickDelay: 1100 });
  await showSubtitle(page, 'The books stay balanced', 700);
  await panElements(page, ['Net income', 'Total revenue', 'Total expenses']);
  await page.waitForTimeout(1800);
  await showSubtitle(page, '');

  await gotoApp(page, '/bookkeeping', 1600);
  await showSubtitle(page, 'Every transaction recorded', 700);
  await panElements(page, ['Bookkeeping', 'Entries', 'Journal entries']);
  await page.waitForTimeout(1400);
  await showSubtitle(page, '');

  await gotoApp(page, '/analytics', 1800);
  await showSubtitle(page, 'Know what is working', 700);
  await panElements(page, ['Analytics', 'Revenue', 'Today', '30 days']);
  await page.waitForTimeout(1800);
  await showSubtitle(page, '');

  await gotoApp(page, '/', 1800);
  await showSubtitle(page, 'Business, simplified', 1000);
  await panElements(page, ['Quick actions', 'Keep the momentum']);
  await page.waitForTimeout(1800);
  await showSubtitle(page, '');

  await context.close();
  if (video) {
    const source = await video.path();
    fs.copyFileSync(source, RAW_VIDEO);
    console.log('RAW VIDEO SAVED:', RAW_VIDEO);
  }
}

(async () => {
  fs.mkdirSync(PROJECT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    if (process.argv.includes('--warmup')) await warmup(browser);
    else if (process.argv.includes('--rehearse')) await rehearse(browser);
    else await record(browser);
  } finally {
    await browser.close();
  }
})();
