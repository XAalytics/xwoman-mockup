// Phone test for the XWoman mockup: real touch taps on iPhone profiles (WebKit, the engine behind every iOS browser)
// and Android profiles (Chrome). Runs a full shopping journey and checks layout on every screen.
// Usage: npm install && npx playwright install webkit && BASE=http://127.0.0.1:8765/ node tools/mobile-e2e.mjs
import { webkit, chromium, devices } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'https://xaalytics.github.io/xwoman-mockup/';
const SHOTS = process.env.SHOTS || '';            // folder for screenshots (optional)
const PHONES = [
  ['iPhone SE', webkit], ['iPhone 15', webkit], ['iPhone 15 Pro Max', webkit],
  ['Pixel 7', chromium], ['Galaxy S24', chromium],
];

let passed = 0;
const failures = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, engine] of PHONES) {
  const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
  const context = await browser.newContext({ ...devices[name], timezoneId: 'America/New_York', locale: 'en-US' });
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(u); return null; };
    try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('xw-region', '"US"'); sessionStorage.setItem('init', '1'); } } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const check = (label, ok, detail = '') => {
    if (ok) passed++; else failures.push(`[${name}] ${label}${detail ? ` (${detail})` : ''}`);
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${!ok && detail ? ` (${detail})` : ''}`);
  };
  const tap = async (sel) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await el.tap(); await wait(400); };
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, '-')}-${n}.png` }); } };
  // Layout rules every screen must meet on a phone
  const layout = async (screen) => {
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const textInputs = [...document.querySelectorAll('input:not([type=radio]):not([type=checkbox]), select')].filter((el) => el.offsetParent);
      const keyTargets = [...document.querySelectorAll('.site-header .icon-btn, .btn, .chip, .size, .size-head button, .text-link, .pdp-designer')]
        .filter((el) => el.offsetParent && getComputedStyle(el).visibility !== 'hidden');
      const tooSmall = keyTargets.filter((el) => {
        const b = el.getBoundingClientRect();
        return b.height < 44 - 0.5;
      }).map((el) => `${(el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 16)}:${Math.round(el.getBoundingClientRect().height)}`);
      return {
        overflow: document.documentElement.scrollWidth - vw,
        smallInputs: textInputs.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length,
        tooSmall,
        chrome: Math.round(document.querySelector('.site-header').getBoundingClientRect().height),
      };
    });
    check(`${screen}: no sideways scrolling`, r.overflow <= 0, `${r.overflow}px`);
    check(`${screen}: form fields ≥ 16px (no iOS zoom)`, r.smallInputs === 0, `${r.smallInputs} small`);
    check(`${screen}: touch targets ≥ 44px`, r.tooSmall.length === 0, r.tooSmall.join(', '));
    return r;
  };

  console.log(`\n${name} (${engine.name()}, ${devices[name].viewport.width}x${devices[name].viewport.height})`);
  try {
    await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
    const home = await layout('home');
    check('header uses ≤ 70px', home.chrome <= 70, `${home.chrome}px`);
    check('hero photo loads', await page.locator('.hero-art img').evaluate((i) => i.complete && i.naturalWidth > 0));
    await shot('1-home');

    await tap('.cat-tile[href="#/shop/formals"]');
    check('category tile opens Formals', (await page.locator('.page-head h1').textContent()) === 'Formals');
    await layout('listing');
    await tap('.grid .card');
    await layout('product page');
    await shot('2-product');
    const addBtn = page.locator('[data-main-add]');
    check('button asks for a size first', (await addBtn.textContent()) === 'Choose a size');
    await tap('[data-main-add]');
    check('tapping without a size highlights sizes', await page.locator('.sizes').evaluate((el) => el.classList.contains('needs-size')));
    await tap('.size[data-size="M"]');
    await tap('[data-main-add]');
    check('bag opens after tapping Add to bag', await page.locator('.sheet.show').isVisible());
    check('bag count is 1', (await page.locator('[data-bag-count]').textContent()) === '1');
    const foot = await page.locator('.sheet-foot .btn').boundingBox();
    const vh = page.viewportSize().height;
    check('Checkout button fully on screen in the bag', foot && foot.y + foot.height <= vh, foot ? `${Math.round(foot.y + foot.height)} > ${vh}` : 'missing');
    await shot('3-bag');
    await tap('.sheet-foot a[href="#/checkout"]');
    await layout('checkout');
    await page.locator('#f-email').fill('amna@example.com');
    await page.locator('#f-phone').fill('+1 555 123 4567');
    await page.locator('#f-name').fill('Amna Khan');
    await page.locator('#f-line1').fill('12 Green Street');
    await page.locator('#f-city').fill('Houston');
    await page.locator('#f-state').fill('TX');
    await page.locator('#f-zip').fill('77002');
    await shot('4-checkout');
    await tap('[data-submit]');
    check('card payment sheet opens', await page.locator('.sheet.show [data-pay]').isVisible());
    const pay = await page.locator('[data-pay]').boundingBox();
    check('Pay button fully on screen', pay && pay.y + pay.height <= vh, pay ? `${Math.round(pay.y + pay.height)} > ${vh}` : 'missing');
    await tap('[data-pay]');
    await page.waitForURL(/#\/confirmed$/, { timeout: 8000 });
    await wait(300);
    check('order confirmed', /^XW-\d{5}$/.test(await page.locator('.facts dd').first().textContent()));
    await layout('confirmation');
    await shot('5-confirmed');
    await tap('.hero-actions a[href^="#/track"]');
    check('tracking timeline shows', (await page.locator('.timeline li').count()) === 5);
    await layout('tracking');

    await page.goto(BASE + '#/p/p03', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(600);
    check('sticky Add to bag bar appears on scroll', await page.locator('.sticky-bar').evaluate((el) => el.classList.contains('show')));
    const fab = await page.locator('.feedback-fab').boundingBox();
    const bar = await page.locator('.sticky-bar').boundingBox();
    check('feedback button sits above the sticky bar', fab && bar && fab.y + fab.height <= bar.y + 1);
    await tap('.feedback-fab');
    check('feedback opens WhatsApp', (await page.evaluate(() => window.__opened[0] || '')).startsWith('https://wa.me/971509786799'));

    await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
    await tap('[data-action="menu"]');
    check('menu opens', await page.locator('.sheet.show .nav-list').isVisible());
    await tap('.sheet.show [data-close]');
    await wait(400);
    check('menu closes', (await page.locator('.sheet').count()) === 0);

    // Admin chat on a phone: PIN, photo from the phone, price + category, approve
    await page.goto(BASE + '#/admin', { waitUntil: 'networkidle' });
    await page.locator('#pin').fill('2026');
    await tap('[data-pin] .btn');
    await layout('admin chat');
    const comp = await page.locator('.composer').boundingBox();
    check('chat composer sits at the bottom of the screen', comp && Math.abs(comp.y + comp.height - vh) <= 2, comp ? `${Math.round(comp.y + comp.height)} vs ${vh}` : 'missing');
    await page.locator('[data-file]').setInputFiles('img/p05.webp');
    await page.waitForFunction(() => document.querySelector('[data-chat-log]').textContent.includes('What is the price'), null, { timeout: 10000 });
    await page.locator('[data-text]').fill('Rs 12,500 formals');
    await page.locator('[data-text]').press('Enter');
    await wait(500);
    await tap('[data-pick="fabric"][data-value="Chiffon"]');
    await tap('[data-pick="designer"][data-value="saira"]');
    await layout('admin draft card');
    await shot('6-admin');
    await tap('[data-draft="approve"]');
    check('admin publishes from a phone', (await page.locator('[data-chat-log]').textContent()).includes('Published in Formals'));

    const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
    const icons = await page.evaluate(async (list) => Promise.all(list.map(async (u) => (await fetch(u)).ok)), ['img/icon-180.png', ...manifest.icons.map((i) => i.src)]);
    check('home-screen app manifest and icons load', manifest.display === 'standalone' && icons.every(Boolean));
  } catch (e) {
    check('journey completed without a script error', false, e.message.split('\n')[0]);
  }
  check('no JavaScript errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
