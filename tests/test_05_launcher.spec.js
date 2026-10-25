const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '../launcher');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf' };

// Serve launcher/ over http://app.local (file:// blocks SVG <img> loads in Chromium).
async function open(page, { tizen = true } = {}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route('http://app.local/**', (r) => {
    const f = path.join(APP, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  if (tizen) {
    await page.addInitScript(() => {
      window.__launched = []; window.__exited = false;
      window.tizen = {
        ApplicationControl: function (op) { this.operation = op; },
        tvinputdevice: { registerKeyBatch: () => {} },
        application: {
          launch: (id, ok) => { window.__launched.push('launch:' + id); if (ok) ok(); },
          launchAppControl: (ctl, id, ok) => { window.__launched.push('control:' + id); if (ok) ok(); },
          getCurrentApplication: () => ({ exit: () => { window.__exited = true; } }),
        },
      };
    });
  }
  await page.goto('http://app.local/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}
const key = (page, code) => page.evaluate((c) => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: c, which: c, bubbles: true })), code);

test('CleanFrame-style home renders: clock, controls, centred 5-app glass dock, YouTube focused', async ({ page }) => {
  await open(page);
  await expect(page.locator('#clock')).toHaveText(/^([01]\d|2[0-3]):[0-5]\d$/);
  await expect(page.locator('.u')).toHaveCount(3);
  await expect(page.locator('.tile')).toHaveCount(5);
  await expect(page.locator('.tile .label')).toHaveText(['YouTube', 'Netflix', 'Apple TV', 'FPT Play', 'Spotify']);
  const box = await page.locator('#dock').boundingBox();
  expect(Math.round(box.x + box.width / 2)).toBe(960);
  await expect(page.locator('.tile').nth(0)).toHaveClass(/is-focus/);
  await expect(page.locator('.tile .label').nth(0)).toHaveText('YouTube');
  // Brand icons load (natural size > 0) and the pre-rendered glass is applied.
  const icons = await page.$$eval('.mark img', (imgs) => imgs.map((i) => i.naturalWidth > 0));
  expect(icons.every(Boolean)).toBe(true);
  await expect(page.locator('#matImg')).toHaveAttribute('style', /study-soft\.jpg/);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/launcher_home.png' });
});

test('D-pad moves along the dock and OK opens the focused app via app control', async ({ page }) => {
  await open(page);
  for (let i = 0; i < 4; i++) await key(page, 39);
  await expect(page.locator('.tile').nth(4)).toHaveClass(/is-focus/);
  await key(page, 39); // already at the end: stays
  await expect(page.locator('.tile').nth(4)).toHaveClass(/is-focus/);
  await key(page, 13);
  expect(await page.evaluate(() => window.__launched)).toEqual(['control:rJeHak5zRg.Spotify']);
  await key(page, 13); // repeated OK within 2.5 s is ignored
  expect(await page.evaluate(() => window.__launched).then((l) => l.length)).toBe(1);
});

test('Up reaches the controls with a glass lens; Wallpaper changes photo and glass; Return goes back', async ({ page }) => {
  await open(page);
  const before = await page.locator('#matImg').getAttribute('style');
  await key(page, 38);
  await expect(page.locator('.u').nth(0)).toHaveClass(/is-focus/);
  await expect(page.locator('#lens')).toHaveClass(/is-on/);
  await key(page, 13);
  expect(await page.locator('#matImg').getAttribute('style')).not.toBe(before);
  await key(page, 39);
  await key(page, 13);
  expect(await page.evaluate(() => window.__launched)).toEqual(['control:org.volt.apps']);
  await key(page, 10009);
  await expect(page.locator('.tile').nth(0)).toHaveClass(/is-focus/);
  await expect(page.locator('#lens')).not.toHaveClass(/is-on/);
  expect(await page.evaluate(() => window.__exited)).toBe(false);
});

test('every dock and control app id exists on the TV', async () => {
  const baseline = path.resolve(__dirname, '../backups/applist_baseline.txt');
  test.skip(!fs.existsSync(baseline), 'no local baseline: run scripts/backup_tv.ps1');
  const src = fs.readFileSync(path.join(APP, 'js/config.js'), 'utf8');
  const applist = fs.readFileSync(baseline, 'utf8');
  const ids = [...src.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  expect(ids.length).toBe(7);
  expect(src).not.toMatch(/Internet|Live TV/);
  for (const id of ids) expect(applist).toContain(`'${id}'`);
});

test('runtime code stays ES5 for the Tizen 3.0 WebKit', async () => {
  for (const f of ['js/app.js', 'js/config.js', 'assets/catalog.js']) {
    const code = fs.readFileSync(path.join(APP, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code, f).not.toMatch(/=>|`|\blet\s|\bconst\s|\bclass\s/);
  }
  const css = fs.readFileSync(path.join(APP, 'css/style.css'), 'utf8');
  expect(css).not.toMatch(/var\(--|(^|[;{\s])gap\s*:|(^|[;{\s])inset\s*:|backdrop-filter/);
});

test('when an app opened from the dock closes while Home is hidden, Home brings itself back', async ({ page }) => {
  await page.addInitScript(() => {
    window.__running = ['org.volt.firstscreen', 'AppleTVDoc.AppleTVDock'];
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden });
  });
  await open(page);
  await page.evaluate(() => {
    window.tizen.application.getAppsContext = (ok) => ok(window.__running.map((id) => ({ appId: id })));
    window.tizen.application.getCurrentApplication = () => ({ appInfo: { id: 'AppleTVDoc.AppleTVDock' }, exit: () => {} });
  });
  await key(page, 39); await key(page, 39);          // Apple TV
  await key(page, 13);
  await page.evaluate(() => { window.__running.push('Y6A54cEa22.AppleTV'); window.__hidden = true; });
  await page.waitForTimeout(3500);                    // watcher sees it running
  await page.evaluate(() => { window.__running = window.__running.filter((id) => id !== 'Y6A54cEa22.AppleTV'); });
  await page.waitForTimeout(3500);                    // watcher sees it closed
  const launched = await page.evaluate(() => window.__launched);
  expect(launched).toContain('control:AppleTVDoc.AppleTVDock');
});

test('does not jump back if the user moved on to another app', async ({ page }) => {
  await page.addInitScript(() => {
    window.__running = ['org.volt.firstscreen', 'AppleTVDoc.AppleTVDock'];
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden });
  });
  await open(page);
  await page.evaluate(() => {
    window.tizen.application.getAppsContext = (ok) => ok(window.__running.map((id) => ({ appId: id })));
    window.tizen.application.getCurrentApplication = () => ({ appInfo: { id: 'AppleTVDoc.AppleTVDock' }, exit: () => {} });
  });
  await key(page, 39); await key(page, 39); await key(page, 39);   // FPT Play
  await key(page, 13);
  await page.evaluate(() => { window.__running.push('ZTpEFWgfa9.FPTPlay', 'ZTpEFWgfa9.FPTPlayService'); window.__hidden = true; });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__running.push('7wiJRozgP7.VieOn'); });   // user opened VieON from Smart Hub
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__running = window.__running.filter((id) => id.indexOf('ZTpEFWgfa9') !== 0); });
  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => window.__launched)).not.toContain('control:AppleTVDoc.AppleTVDock');
});

test('slow app start and background services do not cancel the return to Home', async ({ page }) => {
  await page.addInitScript(() => {
    window.__running = ['org.volt.firstscreen', 'AppleTVDoc.AppleTVDock'];
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { get: () => window.__hidden });
  });
  await open(page);
  await page.evaluate(() => {
    window.tizen.application.getAppsContext = (ok) => ok(window.__running.map((id) => ({ appId: id })));
    window.tizen.application.getCurrentApplication = () => ({ appInfo: { id: 'AppleTVDoc.AppleTVDock' }, exit: () => {} });
  });
  await key(page, 39); await key(page, 39); await key(page, 39);   // FPT Play
  await key(page, 13);
  await page.evaluate(() => { window.__running.push('ZTpEFWgfa9.FPTPlay'); });      // process up, screen not yet
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__hidden = true; window.__running.push('rJeHak5zRg.SpotifyService'); });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__running = window.__running.filter((id) => id !== 'ZTpEFWgfa9.FPTPlay'); });
  await page.waitForTimeout(3500);
  expect(await page.evaluate(() => window.__launched)).toContain('control:AppleTVDoc.AppleTVDock');
});

test('clock is 24-hour with leading zeros', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 25, 21, 5));
  await open(page);
  await expect(page.locator('#clock')).toHaveText('21:05');
  await page.clock.setFixedTime(new Date(2026, 9, 26, 7, 3));
  await page.reload();
  await expect(page.locator('#clock')).toHaveText('07:03');
});
