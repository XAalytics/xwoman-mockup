// End-to-end test for the XWoman mockup. Drives real Chrome through every shopper journey and asserts results.
// Usage: npm install && BASE=http://127.0.0.1:8765/ node tools/e2e.mjs
//        (BASE defaults to the live GitHub Pages site; CHROME_PATH overrides the Chrome location)
import puppeteer from 'puppeteer-core';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'https://xaalytics.github.io/xwoman-mockup/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };
const DESKTOP = { width: 1440, height: 900 };

let passed = 0;
const failures = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(name, viewport, fn, { region = 'UK', blockStorage = false } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), `xw-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument((r, block) => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return null; };
    if (!location.protocol.startsWith('http')) return; // Chrome's initial about:blank has no storage access
    if (block) {
      Storage.prototype.setItem = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
      Storage.prototype.getItem = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    } else if (!sessionStorage.getItem('xw-e2e-init')) {
      localStorage.clear();
      localStorage.setItem('xw-region', JSON.stringify(r));
      sessionStorage.setItem('xw-e2e-init', '1');
    }
  }, region, blockStorage);
  await page.setViewport(viewport);
  const t = {
    page,
    async go(hash) { await page.goto(BASE + hash, { waitUntil: 'networkidle0' }); await wait(150); },
    async click(sel) {
      await page.waitForSelector(sel, { visible: true, timeout: 5000 });
      await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }));
      await wait(120);
      await page.click(sel);
      await wait(350);
    },
    text: (sel) => page.$eval(sel, (el) => el.textContent.trim()),
    count: (sel) => page.$$eval(sel, (els) => els.length),
    visible: (sel) => page.$eval(sel, (el) => !!(el.offsetWidth || el.offsetHeight) && getComputedStyle(el).visibility !== 'hidden').catch(() => false),
    bag: () => page.$eval('[data-bag-count]', (el) => (el.hidden ? 0 : Number(el.textContent))),
    check(label, ok, detail = '') {
      if (ok) passed++;
      else failures.push(`[${name}] ${label}${detail ? ` (${detail})` : ''}`);
      console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${!ok && detail ? ` (${detail})` : ''}`);
    },
  };
  console.log(`\n${name}`);
  try { await fn(t); } catch (e) { t.check('journey completed without a script error', false, e.message.split('\n')[0]); }
  t.check('no JavaScript errors in the page', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ---------------- Journeys ----------------

await session('Home and navigation (phone)', PHONE, async (t) => {
  await t.go('#/');
  t.check('hero image loads', await t.page.$eval('.hero-art img', (i) => i.complete && i.naturalWidth > 0));
  t.check('4 category tiles', (await t.count('.cat-tile')) === 4);
  t.check('8 products in New in', (await t.count('.grid .card')) === 8);
  t.check('header shows the region', (await t.text('[data-region-code]')).startsWith('UK'));
  const powered = await t.page.$eval('.powered', (p) => ({ text: p.textContent.trim(), href: p.querySelector('a').href, target: p.querySelector('a').target }));
  t.check('footer says Powered by XAalytics.com and links to it', powered.text === 'Powered by XAalytics.com' && powered.href === 'https://xaalytics.com/' && powered.target === '_blank', JSON.stringify(powered));
  t.check('no preview banner at the top', !(await t.page.$('.mock-banner')));
  await t.click('[data-action="menu"]');
  t.check('menu opens', await t.visible('.sheet.show .nav-list'));
  await t.click('.nav-list a[href="#/shop/pret"]');
  t.check('menu link goes to Pret', t.page.url().endsWith('#/shop/pret') && (await t.text('.page-head h1')) === 'Pret');
});

await session('Browse, filter and sort (desktop)', DESKTOP, async (t) => {
  await t.go('#/shop');
  t.check('all 12 pieces listed', (await t.count('.grid .card')) === 12);
  for (const [cat, n] of [['unstitched', 3], ['pret', 4], ['formals', 4], ['bridal', 1]]) {
    await t.go(`#/shop/${cat}`);
    t.check(`${cat} shows ${n}`, (await t.count('.grid .card')) === n);
  }
  await t.go('#/shop');
  await t.click('[data-action="filters"]');
  await t.click('.sheet [data-f="fabric"][data-v="Lawn"]');
  t.check('filter button previews the count', (await t.text('[data-apply]')) === 'Show 1 piece');
  await t.click('[data-apply]');
  t.check('fabric filter applies', (await t.count('.grid .card')) === 1);
  await t.click('[data-action="filters"]');
  await t.click('[data-clear]');
  await t.click('[data-apply]');
  t.check('clearing filters restores all', (await t.count('.grid .card')) === 12);
  await t.page.select('[data-sort]', 'low');
  await wait(300);
  const prices = await t.page.$$eval('.card-price', (els) => els.map((e) => Number(e.firstChild.textContent.replace(/[^\d]/g, ''))));
  t.check('sort by price low to high', prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.join(','));
  await t.go('#/shop?designer=ranghar');
  t.check('designer link filters to that designer', (await t.text('.page-head h1')) === 'Rang Ghar' && (await t.count('.grid .card')) === 3);
});

await session('Product page and bag (desktop)', DESKTOP, async (t) => {
  await t.go('#/p/p04');
  t.check('duty message for UK', (await t.text('.duty')).includes('Duties and taxes included'));
  t.check('button asks for a size before one is chosen', (await t.text('[data-main-add]')) === 'Choose a size');
  await t.click('[data-main-add]');
  t.check('clicking without a size highlights the sizes', await t.page.$eval('.sizes', (el) => el.classList.contains('needs-size')));
  t.check('size message shown', await t.visible('[data-size-error]'));
  t.check('nothing added without a size', (await t.bag()) === 0);
  await t.click('.size[data-size="M"]');
  t.check('button changes to Add to bag', (await t.text('[data-main-add]')) === 'Add to bag');
  await t.click('[data-main-add]');
  t.check('bag drawer opens', await t.visible('.sheet.show'));
  t.check('1 line in the bag', (await t.count('.sheet .line')) === 1);
  t.check('bag count shows 1', (await t.bag()) === 1);
  await t.click('.sheet [data-qty="0"][data-d="1"]');
  t.check('quantity + updates count', (await t.bag()) === 2);
  await t.click('.sheet [data-qty="0"][data-d="-1"]');
  t.check('quantity − updates count', (await t.bag()) === 1);
  await t.click('.sheet [data-remove="0"]');
  t.check('remove empties the bag', (await t.bag()) === 0 && (await t.visible('.sheet .empty')));
  await t.page.keyboard.press('Escape');
  await wait(400);
  t.check('Escape closes the drawer', !(await t.page.$('.sheet')));
  await t.go('#/p/p03');
  t.check('unstitched needs no size', (await t.text('[data-main-add]')) === 'Add to bag');
  await t.click('[data-main-add]');
  t.check('unstitched piece added', (await t.bag()) === 1);
  await t.page.keyboard.press('Escape');
  await wait(400);
  await t.go('#/p/p01');
  await t.click('[data-action="size-guide"]');
  const inch = await t.page.$eval('.chart tbody td', (td) => td.textContent);
  await t.click('[data-unit="cm"]');
  const cm = await t.page.$eval('.chart tbody td', (td) => td.textContent);
  t.check('size guide converts inches to cm', inch === '32' && cm === '81', `${inch} -> ${cm}`);
});

await session('Sticky add-to-bag bar (phone)', PHONE, async (t) => {
  await t.go('#/p/p05');
  await t.click('.size[data-size="S"]');
  await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(500);
  t.check('sticky bar appears after scrolling', await t.page.$eval('.sticky-bar', (el) => el.classList.contains('show')));
  await t.page.click('.sticky-bar .btn');
  await wait(500);
  t.check('sticky bar adds to bag', (await t.bag()) === 1 && (await t.visible('.sheet.show')));
});

await session('Card checkout, confirmation and tracking (phone, UK)', PHONE, async (t) => {
  await t.go('#/p/p01');
  await t.click('.size[data-size="L"]');
  await t.click('[data-main-add]');
  await t.click('.sheet-foot a[href="#/checkout"]');
  t.check('checkout page opens', (await t.text('.checkout h1')) === 'Checkout');
  t.check('no sideways scrolling', await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  t.check('cash on delivery disabled outside Pakistan', await t.page.$eval('input[value="cod"]', (i) => i.disabled));
  await t.click('[data-submit]');
  const errs = await t.count('.field.invalid');
  t.check('empty form shows field errors', errs >= 5, `${errs} errors`);
  await t.page.type('#f-email', 'amna@example.com');
  await t.page.type('#f-phone', '+44 7700 900123');
  await t.page.type('#f-name', 'Amna Khan');
  await t.page.type('#f-line1', '12 Green Street');
  await t.page.type('#f-city', 'Birmingham');
  await t.page.type('#f-zip', 'B1 1AA');
  await t.click('[data-submit]');
  t.check('card payment sheet opens', await t.visible('.sheet.show [data-pay]'));
  await t.click('[data-pay]');
  await t.page.waitForFunction(() => location.hash === '#/confirmed', { timeout: 6000 });
  await wait(300);
  const orderNo = await t.page.$eval('.facts dd', (el) => el.textContent);
  t.check('confirmation shows an order number', /^XW-\d{5}$/.test(orderNo), orderNo);
  t.check('confirmation greets the shopper', (await t.text('.confirm h1')) === 'Thank you, Amna');
  t.check('bag is emptied after ordering', (await t.bag()) === 0);
  await t.click('.hero-actions a[href^="#/track"]');
  t.check('tracking shows 5 steps', (await t.count('.timeline li')) === 5);
  t.check('tracking matches the order', (await t.text('[data-result] h2')) === `Order ${orderNo}`);
});

await session('Cash on delivery (phone, Pakistan)', PHONE, async (t) => {
  await t.go('#/p/p11');
  t.check('prices in rupees', (await t.text('.price')).startsWith('Rs '));
  await t.click('.size[data-size="M"]');
  await t.click('[data-main-add]');
  await t.click('.sheet-foot a[href="#/checkout"]');
  t.check('cash on delivery available', await t.page.$eval('input[value="cod"]', (i) => !i.disabled));
  await t.click('.option input[value="cod"]');
  t.check('button switches to Place order', (await t.text('[data-submit]')) === 'Place order');
  await t.page.type('#f-email', 'sana@example.com');
  await t.page.type('#f-phone', '+92 300 1234567');
  await t.page.type('#f-name', 'Sana Ali');
  await t.page.type('#f-line1', '5 Main Boulevard');
  await t.page.type('#f-city', 'Lahore');
  await t.page.type('#f-state', 'Punjab');
  await t.click('[data-submit]');
  await t.page.waitForFunction(() => location.hash === '#/confirmed', { timeout: 6000 });
  await wait(300);
  t.check('COD order shows amount to pay on delivery', (await t.page.$$eval('.facts dt', (d) => d.map((x) => x.textContent))).includes('To pay on delivery'));
  await t.go('#/p/p02');
  await t.click('.size[data-size="M"]');
  await t.click('[data-main-add]');
  await t.click('.sheet-foot a[href="#/checkout"]');
  t.check('COD blocked above the cap', await t.page.$eval('input[value="cod"]', (i) => i.disabled));
}, { region: 'PK' });

await session('Region switch and feedback (desktop)', DESKTOP, async (t) => {
  await t.go('#/p/p06');
  await t.click('[data-action="region"]');
  await t.click('.sheet [data-region="ROW"]');
  t.check('rest of world shows duties payable on delivery', (await t.text('.duty')).includes('may be charged'));
  await t.click('[data-action="region"]');
  await t.click('.sheet [data-region="PK"]');
  t.check('switching to Pakistan shows rupees', (await t.text('.price')).startsWith('Rs '));
  await t.click('.feedback-fab');
  const url = await t.page.evaluate(() => window.__opened[0] || '');
  t.check('feedback opens WhatsApp to the right number', url.startsWith('https://wa.me/971509786799?text='), url.slice(0, 40));
  t.check('feedback message names the screen', decodeURIComponent(url).includes('Product page (Sage linen co-ord)'));
});

await session('Bag works when browser storage is blocked (phone)', PHONE, async (t) => {
  await t.go('#/p/p04');
  await t.click('.size[data-size="M"]');
  await t.click('[data-main-add]');
  t.check('bag drawer opens without storage', await t.visible('.sheet.show'));
  t.check('bag count shows 1 without storage', (await t.bag()) === 1);
}, { blockStorage: true });

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log(failures.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
