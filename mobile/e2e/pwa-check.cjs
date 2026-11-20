const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, test } = require('node:test');
const { chromium, devices } = require('playwright');

const BASE = process.env.PWA_BASE_URL || 'http://127.0.0.1:8000';
const TEST_DIST = process.env.PWA_TEST_DIST || '/tmp/opencode/khoebo-work/pwa-test-dist';
const EMAIL = process.env.PWA_EMAIL || 'demo@khoebo.example';
const PASSWORD = process.env.PWA_PASSWORD || 'Demo2026!';

let browser;

after(async () => {
  await browser?.close();
});

function pngSize(buffer) {
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

async function newContext(options) {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser.newContext(options);
}

async function login(page) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 20000 });
}

async function dismissOnboarding(page) {
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.count()) await skip.click();
}

async function dispatchInstallPrompt(page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', {
      value: () => {
        window.__pwaPromptCalled = true;
        return Promise.resolve();
      },
    });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
}

test('manifest and PWA icons are served with valid metadata', async () => {
  const manifestResponse = await fetch(`${BASE}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, 'Khoebo');
  assert.equal(manifest.short_name, 'Khoebo');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#E96B1A');
  assert.equal(manifest.background_color, '#FFFFFF');

  for (const [name, expected] of [
    ['icon-192.png', [192, 192]],
    ['icon-512.png', [512, 512]],
    ['icon-maskable-512.png', [512, 512]],
    ['apple-touch-icon.png', [180, 180]],
    ['favicon.png', [48, 48]],
  ]) {
    const response = await fetch(`${BASE}/icons/${name}`);
    assert.equal(response.status, 200, name);
    assert.deepEqual(pngSize(Buffer.from(await response.arrayBuffer())), expected, name);
  }
});

test('service worker registers and controls the exported app', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.match(scope, /\/$/);
  await context.close();
});

test('offline navigation shows the branded fallback', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto(`${BASE}/offline-check`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=/offline/i');
  await context.close();
});

test('cached resources never include API responses', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });
  assert.equal(cached.some((url) => url.includes('/api/')), false);
  await context.close();
});

test('install invitation waits for engagement and uses the native prompt only on click', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', {
      value: () => {
        window.__pwaPromptCalled = true;
        return Promise.resolve();
      },
    });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  await page.waitForTimeout(1500);
  assert.equal(await page.getByText('Take Khoebo with you.').count(), 0);

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 20000 });
  await page.waitForTimeout(31000);

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', {
      value: () => {
        window.__pwaPromptCalled = true;
        return Promise.resolve();
      },
    });
    Object.defineProperty(event, 'userChoice', {
      value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  await page.getByText('Take Khoebo with you.').waitFor({ timeout: 5000 });
  await page.getByText('Install Khoebo', { exact: true }).click();
  assert.equal(await page.evaluate(() => window.__pwaPromptCalled === true), true);
  assert.equal(await page.getByText(/installed successfully/i).count(), 0);
  await context.close();
});

test('iOS Safari users get manual Add to Home Screen guidance', async () => {
  const context = await newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await page.waitForTimeout(31000);

  await page.getByText('Install Khoebo on your iPhone').waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('Tap the Share button in your browser.').count(), 1);
  assert.equal(await page.getByText('Select Add to Home Screen.').count(), 1);
  assert.equal(await page.getByText('Tap Add to complete installation.').count(), 1);
  assert.equal(await page.getByText('Take Khoebo with you.').count(), 0);
  await context.close();
});

test('dismissal is remembered for seven days', async () => {
  const context = await newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('khoebo_install_dismissed_at', String(Date.now()));
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await page.waitForTimeout(31000);
  await dispatchInstallPrompt(page);
  await page.waitForTimeout(1000);
  assert.equal(await page.getByText('Take Khoebo with you.').count(), 0);
  await context.close();
});

test('installed mode does not show installation invitations', async () => {
  const context = await newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true });
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await page.waitForTimeout(31000);
  await dispatchInstallPrompt(page);
  await page.waitForTimeout(1000);
  assert.equal(await page.getByText('Take Khoebo with you.').count(), 0);
  await context.close();
});

test('settings offers a manual install entry', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await dismissOnboarding(page);
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Settings', { exact: true }).first().waitFor({ timeout: 10000 });
  await dispatchInstallPrompt(page);
  await page.getByText('Install Khoebo', { exact: true }).first().click();
  await page.getByText('Take Khoebo with you.').waitFor({ timeout: 5000 });
  await context.close();
});

test('update banner activates the waiting service worker on user action', async () => {
  const swPath = path.join(TEST_DIST, 'sw.js');
  const original = fs.readFileSync(swPath, 'utf8');
  const context = await newContext();
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    fs.writeFileSync(swPath, original.replace('khoebo-shell-v1', 'khoebo-shell-v2'));
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });

    await page.getByText('Update available').waitFor({ timeout: 10000 });
    await page.getByText('Refresh', { exact: true }).click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  } finally {
    fs.writeFileSync(swPath, original);
    await context.close();
  }
});

test('authenticated routes survive a full refresh', async () => {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await login(page);
  await page.goto(`${BASE}/settings/personal`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  assert.equal(new URL(page.url()).pathname, '/settings/personal');
  assert.equal(await page.locator('input[type="email"]').count(), 0);
  await context.close();
});
