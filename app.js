/* XWoman storefront mockup: hash-routed single page, no build step. */
(() => {
  'use strict';

  // ---------- State ----------
  // Private modes, embedded viewers and some in-app browsers block localStorage. Keep an in-memory copy so the
  // bag, region and last order still work for the visit; localStorage only adds persistence when available.
  const memory = new Map();
  const store = {
    get(key, fallback) {
      if (memory.has(key)) return memory.get(key);
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      memory.set(key, value);
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };
  const state = {
    region: store.get('xw-region', guessRegion()),
    cart: store.get('xw-cart', []),
    filters: { designer: [], size: [], fabric: [], colour: [], price: [], fast: false },
    sort: 'featured',
    screen: 'Home',
  };

  store.get('xw-admin-products', []).forEach((p) => PRODUCTS.unshift(p));

  function guessRegion() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Karachi') return 'PK';
    if (/^Asia\/(Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat)$/.test(tz)) return 'AE';
    if (tz === 'Europe/London') return 'UK';
    if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)$/.test(tz)) return 'CA';
    if (tz.startsWith('Australia/')) return 'AU';
    if (tz.startsWith('America/')) return 'US';
    return 'ROW';
  }

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (id) => PRODUCTS.find((p) => p.id === id);
  const region = () => REGIONS[state.region];

  // Market price in PKR (a Shopify market price adjustment): international margin, plus duties in DDP markets.
  function priceIn(pricePkr, code = state.region) {
    const r = REGIONS[code];
    if (code === 'PK') return pricePkr;
    const factor = (1 + PRICING.fxBuffer) * (1 + PRICING.markup) + (r.ddp ? r.duty : 0);
    return Math.ceil((pricePkr * factor) / 500) * 500 - 10; // e.g. Rs 24,990
  }
  const price = (p) => priceIn(p.pricePkr);
  // Everything is charged in PKR; outside Pakistan an approximate local amount is shown next to it.
  const money = (amount) => `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
  function approx(amount, code = state.region) {
    const r = REGIONS[code];
    if (!r.local) return '';
    const [sym, rate] = r.local;
    return `≈ ${sym}${Math.round((amount / PRICING.fx) * rate).toLocaleString('en-GB')}`;
  }

  function dispatchDays(p) {
    if (p.madeToOrder) return [p.madeToOrder, p.madeToOrder + 5];
    const lead = DESIGNERS[p.designer].lead;
    return [lead, lead + PRICING.hubDays];
  }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
  function dateRange(a, b) {
    const da = addDays(a), db = addDays(b);
    const day = (d) => d.getDate();
    const mon = (d) => d.toLocaleString('en-GB', { month: 'short' });
    return da.getMonth() === db.getMonth() ? `${day(da)}–${day(db)} ${mon(db)}` : `${day(da)} ${mon(da)} – ${day(db)} ${mon(db)}`;
  }
  function deliveryRange(p) {
    const [d0, d1] = dispatchDays(p);
    const [t0, t1] = region().transit;
    return dateRange(d0 + t0, d1 + t1);
  }

  function img(id, alt, { small = false, eager = false, name = '', swatch = '#EEE8E3' } = {}) {
    if (typeof IMAGES_READY !== 'undefined' && IMAGES_READY.has(id)) {
      const src = small ? `img/${id}-400.webp` : `img/${id}.webp`;
      return `<img src="${src}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="768" height="960">`;
    }
    const light = isLight(swatch) ? ' light' : '';
    return `<div class="ph${light}" style="--sw:${swatch}" role="img" aria-label="${esc(alt)} (photo coming)"><span>${esc(name)}</span></div>`;
  }
  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
  }
  const productImg = (p, i = 0, opts = {}) => (p.imageData && i === 0
    ? `<img src="${p.imageData}" alt="${esc(`${p.name} by ${DESIGNERS[p.designer].name}`)}" decoding="async" width="768" height="960">`
    : img(p.images[i], `${p.name} by ${DESIGNERS[p.designer].name}`, { name: p.name, swatch: p.swatch, ...opts }));

  function toast(msg) {
    const t = $('.toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  const archLine = `<svg class="arch-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M0,100 L0,36 C0,20 20,12 36,7.5 C44,5 48.5,3 50,0 C51.5,3 56,5 64,7.5 C80,12 100,20 100,36 L100,100"/></svg>`;
  const arch = (inner, line = true) => `<div class="arch">${line ? archLine : ''}<div class="arch-img">${inner}</div></div>`;

  const icons = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    duty: '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M8 13h20l-2 17H10L8 13Z"/><path d="M13 13v-2a5 5 0 0 1 10 0v2"/><path d="M13.5 21.5l3 3 6-6"/></svg>',
    calendar: '<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="6" y="9" width="24" height="21" rx="1"/><path d="M6 15h24M12 6v6M24 6v6"/><path d="M12 21h4M20 21h4M12 25h4"/></svg>',
    eye: '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M3 18s5.5-9 15-9 15 9 15 9-5.5 9-15 9S3 18 3 18Z"/><circle cx="18" cy="18" r="4.5"/></svg>',
  };

  // ---------- Header ----------
  function renderHeader() {
    const r = region();
    $('[data-region-code]').innerHTML = `${r.short}<span class="cur"> · ${r.currency}</span>`;
    $('.region-btn').setAttribute('aria-label', `Delivering to ${r.name}. Change country`);
    const count = state.cart.reduce((n, l) => n + l.qty, 0);
    const badge = $('[data-bag-count]');
    badge.textContent = count;
    badge.hidden = count === 0;
    const hash = location.hash || '#/';
    $$('.main-nav a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === hash.split('?')[0]));
    $$('.main-nav a[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  }

  // ---------- Views ----------
  function heroLine() {
    const r = region();
    if (state.region === 'PK') return 'Eid, wedding and everyday wear from designers in Lahore, Karachi and Islamabad. Cash on delivery across Pakistan, and no account needed.';
    if (r.ddp) return `Eid, wedding and everyday wear from designers in Lahore, Karachi and Islamabad. Prices for ${r.name} include duties and taxes, so there's nothing to pay on delivery. No account needed.`;
    return 'Eid, wedding and everyday wear from designers in Lahore, Karachi and Islamabad, delivered worldwide with DHL Express. No account needed.';
  }

  function productCard(p) {
    const pr = price(p);
    const tag = p.madeToOrder ? 'Made to order' : p.sizes[0] === 'Unstitched' ? 'Unstitched' : dispatchDays(p)[1] <= 7 ? 'Ships fast' : '';
    return `<a class="card" href="#/p/${p.id}">
      <div class="card-img">${productImg(p, 0, { small: true })}${tag ? `<span class="tag">${tag}</span>` : ''}</div>
      <div class="card-designer">${esc(DESIGNERS[p.designer].name)}</div>
      <div class="card-name">${esc(p.name)}</div>
      <div class="card-price">${money(pr)}${approx(pr) ? `<span class="approx">${approx(pr)}</span>` : ''}</div>
    </a>`;
  }

  function viewHome() {
    state.screen = 'Home';
    const hero = byId('p02');
    const cats = Object.entries(CATEGORIES).map(([key, c]) => {
      const p = PRODUCTS.find((x) => x.category === key && IMAGES_READY.has(x.images[0])) || PRODUCTS.find((x) => x.category === key);
      return `<a class="cat-tile" href="#/shop/${key}">${arch(productImg(p, 0, { small: true }), false)}<h3>${c.name}</h3><p>${c.blurb}</p></a>`;
    }).join('');
    const counts = PRODUCTS.reduce((m, p) => ((m[p.designer] = (m[p.designer] || 0) + 1), m), {});
    app.innerHTML = `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-art">${arch(productImg(hero, 0, { eager: true }))}</div>
          <div class="hero-copy">
            <h1>Pakistan's designers, delivered to your door</h1>
            <p>${heroLine()}</p>
            <div class="hero-actions">
              <a class="btn" href="#/shop">Shop new in</a>
              <button class="btn btn-ghost" type="button" data-action="shipping-info">How delivery works</button>
            </div>
          </div>
        </div>
      </section>
      <section class="section"><div class="wrap">
        <div class="section-head"><h2>Shop by category</h2></div>
        <div class="cat-row">${cats}</div>
      </div></section>
      <section class="section"><div class="wrap">
        <div class="section-head"><h2>New in</h2><a class="text-link" href="#/shop">View all ${PRODUCTS.length} pieces</a></div>
        <div class="grid">${PRODUCTS.slice(0, 8).map(productCard).join('')}</div>
      </div></section>
      <section class="section"><div class="wrap">
        <div class="promises">
          <div class="promise">${icons.duty}<div><h3>Duties included</h3><p>In the US, UK, Canada, Australia and the Gulf, the price you see is the price you pay. Nothing to pay at the door.</p></div></div>
          <div class="promise">${icons.calendar}<div><h3>Delivery dates you can plan around</h3><p>Every piece shows when it leaves our hub and when it should reach you, so Eid outfits arrive before Eid.</p></div></div>
          <div class="promise">${icons.eye}<div><h3>Checked before it ships</h3><p>Every item is inspected at our Lahore hub. We send you a photo before it's dispatched.</p></div></div>
        </div>
      </div></section>
      <section class="section"><div class="wrap">
        <div class="section-head"><h2>Designers</h2></div>
        <div class="designers">${Object.entries(DESIGNERS).map(([key, d]) =>
          `<a class="designer-row" href="#/shop?designer=${key}"><strong>${esc(d.name)}</strong><span class="muted small">${d.city} · ${counts[key] || 0} pieces</span></a>`).join('')}</div>
      </div></section>`;
  }

  function priceBuckets() {
    return [
      { key: 'low', label: `Under ${money(priceIn(10000))}`, test: (p) => p.pricePkr < 10000 },
      { key: 'mid', label: `${money(priceIn(10000))} to ${money(priceIn(40000))}`, test: (p) => p.pricePkr >= 10000 && p.pricePkr <= 40000 },
      { key: 'high', label: `Over ${money(priceIn(40000))}`, test: (p) => p.pricePkr > 40000 },
    ];
  }

  function filtered(cat) {
    const f = state.filters;
    const buckets = priceBuckets();
    let list = PRODUCTS.filter((p) =>
      (!cat || p.category === cat) &&
      (!f.designer.length || f.designer.includes(p.designer)) &&
      (!f.size.length || p.sizes.some((s) => f.size.includes(s))) &&
      (!f.fabric.length || f.fabric.includes(p.fabric)) &&
      (!f.colour.length || f.colour.includes(p.colour)) &&
      (!f.price.length || buckets.some((b) => f.price.includes(b.key) && b.test(p))) &&
      (!f.fast || dispatchDays(p)[1] <= 7));
    if (state.sort === 'low') list = [...list].sort((a, b) => a.pricePkr - b.pricePkr);
    if (state.sort === 'high') list = [...list].sort((a, b) => b.pricePkr - a.pricePkr);
    if (state.sort === 'newest') list = [...list].reverse();
    return list;
  }
  const activeFilterCount = () => Object.values(state.filters).reduce((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);

  function viewShop(cat, params) {
    const designerParam = params.get('designer');
    if (designerParam && Object.hasOwn(DESIGNERS, designerParam)) state.filters = { ...state.filters, designer: [designerParam] };
    const c = CATEGORIES[cat];
    state.screen = c ? `${c.name} listing` : 'All pieces listing';
    const list = filtered(cat);
    const n = activeFilterCount();
    const designerName = state.filters.designer.length === 1 ? DESIGNERS[state.filters.designer[0]].name : null;
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          <h1>${c ? c.name : designerName || 'New in'}</h1>
          <p>${c ? c.blurb : designerName ? `${DESIGNERS[state.filters.designer[0]].city} · every piece checked at our Lahore hub` : 'The latest pieces from our designers.'}</p>
        </div>
        <nav class="chips" aria-label="Categories">
          <a class="chip" href="#/shop" ${!cat ? 'aria-current="page"' : ''}>All</a>
          ${Object.entries(CATEGORIES).map(([k, v]) => `<a class="chip" href="#/shop/${k}" ${cat === k ? 'aria-current="page"' : ''}>${v.name}</a>`).join('')}
        </nav>
        <div class="toolbar">
          <button class="chip" type="button" data-action="filters">Filter${n ? ` (${n})` : ''}</button>
          <span class="muted small">${list.length} ${list.length === 1 ? 'piece' : 'pieces'}</span>
          <label><span class="sr-only">Sort by</span>
            <select data-sort>
              <option value="featured">Featured</option><option value="newest">Newest</option>
              <option value="low">Price: low to high</option><option value="high">Price: high to low</option>
            </select>
          </label>
        </div>
        ${list.length ? `<div class="grid">${list.map(productCard).join('')}</div>` : `
          <div class="empty"><h2>No pieces match these filters</h2><p>Try removing a filter to see more.</p>
          <button class="btn btn-ghost" type="button" data-action="clear-filters">Clear filters</button></div>`}
      </div>`;
    const sel = $('[data-sort]');
    sel.value = state.sort;
    sel.addEventListener('change', () => { state.sort = sel.value; route(); });
  }

  function dutyBox() {
    const r = region();
    if (state.region === 'PK') return `<div class="duty">${icons.check}<span>Free delivery over ${money(r.freeOver)}. Cash on delivery available.</span></div>`;
    if (r.ddp) return `<div class="duty">${icons.check}<span><strong>Duties and taxes included</strong> for ${r.name}. Nothing to pay on delivery.</span></div>`;
    return `<div class="duty ddu">${icons.info}<span>Duties and taxes may be charged by the courier on delivery to your country.</span></div>`;
  }

  function viewProduct(id) {
    const p = byId(id);
    if (!p) return viewNotFound();
    state.screen = `Product page (${p.name})`;
    const d = DESIGNERS[p.designer];
    const pr = price(p);
    const [d0, d1] = dispatchDays(p);
    const r = region();
    const more = PRODUCTS.filter((x) => x.designer === p.designer && x.id !== p.id).slice(0, 4);
    const unstitched = p.sizes[0] === 'Unstitched';
    const shots = p.images.map((im, i) => i).filter((i) => i === 0 || IMAGES_READY.has(p.images[i]));
    app.innerHTML = `
      <div class="wrap">
        <div class="pdp">
          <div class="gallery">
            <div class="gallery-main">${productImg(p, 0, { eager: true })}</div>
            ${shots.length > 1 ? `<div class="thumbs">${shots.map((i) =>
              `<button type="button" data-thumb="${i}" aria-label="Show photo ${i + 1}" ${i === 0 ? 'aria-current="true"' : ''}>${productImg(p, i, { small: true })}</button>`).join('')}</div>` : ''}
          </div>
          <div class="pdp-info">
            <div>
              <a class="pdp-designer" href="#/shop?designer=${p.designer}">${esc(d.name)}</a>
              <h1>${esc(p.name)}</h1>
            </div>
            <div class="price-block">
              <div class="price">${money(pr)}${approx(pr) ? `<span class="approx">${approx(pr)}</span>` : ''}</div>
              ${dutyBox()}
            </div>
            <div>
              <div class="size-head"><strong>${unstitched ? 'Fabric only' : 'Size'}</strong>${unstitched ? '' : '<button type="button" data-action="size-guide">Size guide</button>'}</div>
              <div class="sizes" role="group" aria-label="Choose a size">${p.sizes.map((s) =>
                `<button class="size" type="button" data-size="${s}" aria-pressed="${unstitched}">${s}</button>`).join('')}</div>
              <p class="size-error" data-size-error hidden>Choose a size to add this to your bag.</p>
              ${p.madeToOrder ? '<p class="muted small" style="margin:.5rem 0 0">Made to order. We\'ll confirm your measurements on WhatsApp after you order.</p>' : ''}
            </div>
            <div class="dispatch">
              <strong>Leaves our hub in ${d0}–${d1} days</strong>
              <span class="muted">Arrives in ${r.name} around ${deliveryRange(p)} with ${r.carrier}</span>
            </div>
            <div class="pdp-actions">
              <button class="btn btn-block" type="button" data-action="add" data-main-add>${unstitched ? 'Add to bag' : 'Choose a size'}</button>
              <button class="btn btn-ghost btn-block" type="button" data-action="ask">Ask about this piece on WhatsApp</button>
            </div>
            <table class="pieces"><caption class="sr-only">Pieces and fabric</caption><tbody>
              ${p.pieces.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
            </tbody></table>
            <div>
              <details open><summary>Details</summary><div><p style="margin-top:0">${esc(p.description)}</p><p style="margin-bottom:0">Occasion: ${esc(p.occasion)}. Fabric: ${esc(p.fabric)}.</p></div></details>
              <details><summary>Size and fit</summary><div>${unstitched ? 'Unstitched: you receive the fabric pieces listed above to have tailored.' : 'Regular fit. Our model is 5 ft 7 in and wears size S. See the size guide for garment measurements in inches and centimetres.'}</div></details>
              <details><summary>Delivery and duties</summary><div>${deliveryText()}</div></details>
              <details><summary>Returns and claims</summary><div>${returnsText()}</div></details>
            </div>
            <p class="colour-note">Colours may look slightly different on your screen than in person.</p>
          </div>
        </div>
        ${more.length ? `<section class="section"><div class="section-head"><h2>More from ${esc(d.name)}</h2></div><div class="grid">${more.map(productCard).join('')}</div></section>` : ''}
      </div>
      <div class="sticky-bar" aria-hidden="true">
        <span class="sb-price">${money(pr)}</span>
        <button class="btn" type="button" data-action="add" tabindex="-1">${unstitched ? 'Add to bag' : 'Choose a size'}</button>
      </div>`;

    let chosen = unstitched ? p.sizes[0] : null;
    $$('.size').forEach((b) => b.addEventListener('click', () => {
      chosen = b.dataset.size;
      $$('.size').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('[data-size-error]').hidden = true;
      $('.sizes').classList.remove('needs-size');
      $$('[data-action="add"]').forEach((x) => { x.textContent = 'Add to bag'; });
    }));
    $$('[data-thumb]').forEach((b) => b.addEventListener('click', () => {
      $('.gallery-main').innerHTML = productImg(p, Number(b.dataset.thumb), { eager: true });
      $$('[data-thumb]').forEach((x) => x.setAttribute('aria-current', String(x === b)));
    }));
    $$('[data-action="add"]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!chosen) {
        // Make the missing step obvious: outline the sizes, show the message and move focus there.
        $('[data-size-error]').hidden = false;
        $('.sizes').classList.add('needs-size');
        $('.sizes').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('.size').focus({ preventScroll: true });
        return;
      }
      addToCart(p.id, chosen);
    }));

    // Show the sticky bar once the main button has scrolled above the viewport. A scroll check (not an
    // IntersectionObserver) so fast flicks that jump past the button still trigger it.
    const bar = $('.sticky-bar');
    const mainAdd = $('[data-main-add]');
    let ticking = false;
    const check = () => {
      ticking = false;
      const show = mainAdd.getBoundingClientRect().bottom < 0;
      bar.classList.toggle('show', show);
      document.body.classList.toggle('bar-visible', show && innerWidth < 900);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => { removeEventListener('scroll', onScroll); document.body.classList.remove('bar-visible'); });
  }

  function deliveryText() {
    const r = region();
    if (state.region === 'PK') return `Delivered by ${r.carrier} in ${r.transit[0]}–${r.transit[1]} days after dispatch. Delivery is ${money(r.ship)}, free over ${money(r.freeOver)}. Cash on delivery is available on orders up to ${money(PRICING.codCap)}.`;
    const base = `Shipped from our Lahore hub with ${r.carrier}, ${r.transit[0]}–${r.transit[1]} working days after dispatch. Delivery is ${money(r.ship)}, free over ${money(r.freeOver)}. You pay in Pakistani rupees; your bank converts the amount.`;
    return r.ddp
      ? `${base} Duties and taxes for ${r.name} are already included in the price. The courier won't ask you for anything at the door.`
      : `${base} Duties and taxes aren't included for your country. The courier may collect them on delivery.`;
  }
  function returnsText() {
    return state.region === 'PK'
      ? 'Unused items with tags can be exchanged within 7 days of delivery. If anything arrives damaged or wrong, tell us within 7 days with a photo and we\'ll replace it.'
      : 'We can\'t accept returns on international orders. If anything arrives damaged or wrong, tell us within 7 days of delivery with a photo and we\'ll replace it or refund you.';
  }

  // ---------- Cart ----------
  function saveCart() { store.set('xw-cart', state.cart); renderHeader(); }
  function addToCart(id, size) {
    const line = state.cart.find((l) => l.id === id && l.size === size);
    if (line) line.qty += 1; else state.cart.push({ id, size, qty: 1 });
    saveCart();
    openCart();
  }
  function totals() {
    const r = region();
    const subtotal = state.cart.reduce((s, l) => s + price(byId(l.id)) * l.qty, 0);
    const shipping = subtotal === 0 || subtotal >= r.freeOver ? 0 : r.ship;
    return { subtotal, shipping, total: subtotal + shipping };
  }
  function totalsHTML() {
    const r = region();
    const t = totals();
    return `<div class="totals">
      <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div><span>Delivery<span class="note">${t.shipping ? `Free over ${money(r.freeOver)}` : ''}</span></span><span>${t.shipping ? money(t.shipping) : 'Free'}</span></div>
      <div><span>Duties and taxes</span><span>${state.region === 'PK' ? 'None' : r.ddp ? 'Included' : 'Payable on delivery'}</span></div>
      <div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
      ${state.region !== 'PK' ? `<span class="note">You'll be charged in Pakistani rupees (PKR); your bank converts it (${approx(t.total)}).</span>` : ''}
    </div>`;
  }
  function cartLines(editable = true) {
    return state.cart.map((l, i) => {
      const p = byId(l.id);
      return `<div class="line">
        <a class="line-img" href="#/p/${p.id}">${productImg(p, 0, { small: true })}</a>
        <div>
          <div class="line-meta">${esc(DESIGNERS[p.designer].name)}</div>
          <div class="line-name">${esc(p.name)}</div>
          <div class="line-meta">${l.size === 'Unstitched' ? 'Unstitched' : `Size ${l.size}`}</div>
          <div class="line-bottom">
            ${editable ? `<div class="qty"><button type="button" data-qty="${i}" data-d="-1" aria-label="Decrease quantity">−</button><span>${l.qty}</span><button type="button" data-qty="${i}" data-d="1" aria-label="Increase quantity">+</button></div>` : `<span class="line-meta">Qty ${l.qty}</span>`}
            <span>${money(price(p) * l.qty)}</span>
          </div>
          ${editable ? `<button class="remove" type="button" data-remove="${i}">Remove</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  function openCart() {
    const empty = state.cart.length === 0;
    openSheet({
      title: 'Your bag',
      side: true,
      body: empty
        ? '<div class="empty"><p>Your bag is empty.</p><a class="btn btn-ghost" href="#/shop" data-close>Browse new in</a></div>'
        : `${cartLines()}<div style="padding-top:1rem">${totalsHTML()}</div>`,
      foot: empty ? '' : '<a class="btn btn-block" href="#/checkout" data-close>Checkout</a><p class="muted small" style="text-align:center;margin:.6rem 0 0">No account needed</p>',
      onMount(sheet) {
        $$('[data-qty]', sheet).forEach((b) => b.addEventListener('click', () => {
          const l = state.cart[b.dataset.qty];
          l.qty += Number(b.dataset.d);
          if (l.qty < 1) state.cart.splice(b.dataset.qty, 1);
          saveCart(); openCart();
        }));
        $$('[data-remove]', sheet).forEach((b) => b.addEventListener('click', () => {
          state.cart.splice(b.dataset.remove, 1); saveCart(); openCart();
        }));
      },
    });
  }

  // ---------- Checkout ----------
  function viewCheckout() {
    state.screen = 'Checkout';
    if (!state.cart.length) {
      app.innerHTML = '<div class="wrap"><div class="empty"><h1>Your bag is empty</h1><p>Add a piece to your bag to check out.</p><a class="btn" href="#/shop">Browse new in</a></div></div>';
      return;
    }
    const r = region();
    const t = totals();
    const codOk = state.region === 'PK' && t.total <= PRICING.codCap;
    const codReason = state.region !== 'PK' ? 'Available for delivery in Pakistan only' : t.total > PRICING.codCap ? `Available on orders up to ${money(PRICING.codCap)}` : 'Pay in cash when your order arrives';
    const maxDispatch = Math.max(...state.cart.map((l) => dispatchDays(byId(l.id))[1]));
    const minDispatch = Math.max(...state.cart.map((l) => dispatchDays(byId(l.id))[0]));
    const eta = dateRange(minDispatch + r.transit[0], maxDispatch + r.transit[1]);
    app.innerHTML = `
      <div class="wrap">
        <form class="checkout" novalidate>
          <div>
            <h1>Checkout</h1>
            <p class="muted">No account or password needed. We'll email your receipt and a link to track your order.</p>
            <div class="form-section">
              <h2>Contact</h2>
              ${field('email', 'Email', 'email', 'you@example.com', 'email')}
              ${field('phone', 'Phone', 'tel', state.region === 'PK' ? '+92 300 1234567' : '+1 555 123 4567', 'tel', 'For the courier and delivery updates.')}
            </div>
            <div class="form-section">
              <h2>Delivery address</h2>
              <div class="field"><label>Country or region</label>
                <div class="option" style="cursor:default"><span class="muted small">${r.short}</span><span>${r.name}</span><button class="text-link" type="button" data-action="region" style="background:none;border:0;cursor:pointer">Change</button></div>
              </div>
              ${field('name', 'Full name', 'text', '', 'name')}
              ${field('line1', 'Address', 'text', 'House number and street', 'address-line1')}
              ${field('line2', 'Apartment, suite (optional)', 'text', '', 'address-line2', '', false)}
              <div class="row2">${field('city', 'City', 'text', '', 'address-level2')}${field('state', state.region === 'UK' ? 'County (optional)' : 'State or province', 'text', '', 'address-level1', '', state.region !== 'UK')}</div>
              ${field('zip', state.region === 'US' ? 'ZIP code' : 'Postal code', 'text', '', 'postal-code', '', state.region !== 'AE' && state.region !== 'PK')}
            </div>
            <div class="form-section">
              <h2>Delivery</h2>
              <label class="option"><input type="radio" name="ship" checked><span>${r.carrier}<small>Arrives around ${eta}</small></span><span>${t.shipping ? money(t.shipping) : 'Free'}</span></label>
            </div>
            <div class="form-section">
              <h2>Payment</h2>
              <label class="option"><input type="radio" name="pay" value="card" checked><span>Debit or credit card<small>Visa and Mastercard, secured with 3-D Secure</small></span><span></span></label>
              <label class="option" ${codOk ? '' : 'aria-disabled="true"'}><input type="radio" name="pay" value="cod" ${codOk ? '' : 'disabled'}><span>Cash on delivery<small>${codReason}</small></span><span></span></label>
              <label class="check-row"><input type="checkbox" name="news"> Email me about new collections and Eid launches</label>
            </div>
            <div style="padding-top:1.25rem">
              <button class="btn btn-block" type="submit" data-submit>Pay ${money(t.total)}</button>
              <p class="muted small" style="margin:.75rem 0 0;text-align:center">By placing your order you agree to our terms. ${state.region === 'PK' ? '' : "International orders can't be returned; damaged or wrong items are replaced."}</p>
            </div>
          </div>
          <aside class="summary" aria-label="Order summary">
            <h2 style="font-size:1.375rem">Order summary</h2>
            ${state.cart.map((l) => { const p = byId(l.id); return `<div class="summary-line"><div class="line-img">${productImg(p, 0, { small: true })}</div><div>${esc(p.name)}<div class="line-meta">${l.size === 'Unstitched' ? 'Unstitched' : `Size ${l.size}`} · Qty ${l.qty}</div></div><span>${money(price(p) * l.qty)}</span></div>`; }).join('')}
            ${totalsHTML()}
          </aside>
        </form>
      </div>`;

    const form = $('.checkout');
    const submit = $('[data-submit]');
    $$('input[name="pay"]', form).forEach((i) => i.addEventListener('change', () => {
      submit.textContent = i.value === 'cod' && i.checked ? 'Place order' : `Pay ${money(t.total)}`;
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const data = Object.fromEntries(new FormData(form));
      const pay = form.querySelector('input[name="pay"]:checked').value;
      if (pay === 'cod') return placeOrder(data, 'cod', eta);
      openPayment(data, eta);
    });
  }

  function field(name, label, type, placeholder, autocomplete, hint = '', required = true) {
    return `<div class="field">
      <label for="f-${name}">${label}</label>
      <input id="f-${name}" name="${name}" type="${type}" ${placeholder ? `placeholder="${placeholder}"` : ''} autocomplete="${autocomplete}" ${required ? 'required' : ''}>
      ${hint ? `<span class="hint">${hint}</span>` : ''}
      <span class="err" hidden></span>
    </div>`;
  }
  function validate(form) {
    let first = null;
    $$('.field', form).forEach((f) => {
      const input = $('input', f);
      if (!input) return;
      const v = input.value.trim();
      let msg = '';
      if (input.required && !v) msg = `Enter your ${$('label', f).textContent.toLowerCase().replace(' (optional)', '')}.`;
      else if (input.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = 'Enter an email address like name@example.com.';
      else if (input.type === 'tel' && v && v.replace(/\D/g, '').length < 7) msg = 'Enter a phone number with country code.';
      f.classList.toggle('invalid', !!msg);
      const err = $('.err', f);
      err.hidden = !msg;
      err.textContent = msg;
      input.setAttribute('aria-invalid', String(!!msg));
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  }

  function openPayment(data, eta) {
    const t = totals();
    openSheet({
      title: 'Secure card payment',
      body: `<div class="pay-card">
        <div class="pay-brand"><span>XWoman · ${money(t.total)}${state.region !== 'PK' ? ` (${approx(t.total)})` : ''}</span><span>3-D Secure</span></div>
        <p class="duty ddu" style="margin:0">${icons.info}<span>This is a mockup. The card below is a test card; don't enter your real card details.</span></p>
        <div class="field"><label for="c-num">Card number</label><input id="c-num" value="4242 4242 4242 4242" inputmode="numeric" autocomplete="off"></div>
        <div class="row2"><div class="field"><label for="c-exp">Expiry</label><input id="c-exp" value="12 / 28" autocomplete="off"></div><div class="field"><label for="c-cvc">Security code</label><input id="c-cvc" value="123" autocomplete="off"></div></div>
        <div class="field"><label for="c-name">Name on card</label><input id="c-name" value="${esc(data.name || '')}" autocomplete="off"></div>
      </div>`,
      foot: `<button class="btn btn-block" type="button" data-pay>Pay ${money(t.total)}</button>`,
      onMount(sheet) {
        $('[data-pay]', sheet).addEventListener('click', () => {
          $('.sheet-body', sheet).innerHTML = '<div class="spinner" role="status" aria-label="Processing"></div><p style="text-align:center" class="muted">Confirming with your bank…</p>';
          $('.sheet-foot', sheet).remove();
          setTimeout(() => { closeSheet(); placeOrder(data, 'card', eta); }, 1600);
        });
      },
    });
  }

  function placeOrder(data, pay, eta) {
    const t = totals();
    const order = {
      no: `XW-${Math.floor(10000 + Math.random() * 89999)}`,
      name: data.name, email: data.email, city: data.city, region: state.region,
      lines: state.cart.slice(), total: t.total, pay, eta, placed: new Date().toISOString(),
    };
    store.set('xw-last-order', order);
    state.cart = [];
    saveCart();
    location.hash = '#/confirmed';
  }

  function viewConfirmed() {
    state.screen = 'Order confirmation';
    const o = store.get('xw-last-order', null);
    if (!o) { location.hash = '#/'; return; }
    const r = REGIONS[o.region];
    const first = byId(o.lines[0].id);
    const dispatch = Math.max(...o.lines.map((l) => dispatchDays(byId(l.id))[1]));
    app.innerHTML = `
      <div class="wrap">
        <div class="confirm">
          ${arch(productImg(first, 0, { small: true }))}
          <div>
            <h1>Thank you, ${esc((o.name || '').split(' ')[0] || 'friend')}</h1>
            <p class="muted" style="font-size:1.0625rem">Your order is confirmed. We've emailed your receipt and a tracking link to <strong style="color:var(--ink)">${esc(o.email)}</strong>. (In this mockup, no email is sent.)</p>
            <dl class="facts">
              <div><dt>Order number</dt><dd>${o.no}</dd></div>
              <div><dt>${o.pay === 'cod' ? 'To pay on delivery' : 'Paid'}</dt><dd>${money(o.total, o.region)}</dd></div>
              <div><dt>Leaves our hub</dt><dd>Within ${dispatch} days</dd></div>
              <div><dt>Arrives</dt><dd>Around ${o.eta}</dd></div>
              <div><dt>Delivery to</dt><dd>${esc(o.city || '')}, ${r.name}</dd></div>
              ${r.ddp && o.region !== 'PK' ? '<div><dt>Duties and taxes</dt><dd>Already paid</dd></div>' : ''}
            </dl>
            <div class="hero-actions">
              <a class="btn" href="#/track?o=${o.no}">Track this order</a>
              <a class="btn btn-ghost" href="#/shop">Continue shopping</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  function viewTrack(params) {
    state.screen = 'Track order';
    const o = store.get('xw-last-order', null);
    const prefill = params.get('o') || '';
    app.innerHTML = `
      <div class="wrap">
        <div class="track">
          <h1>Track your order</h1>
          <p class="muted">Enter your order number and the email you used at checkout. No account needed.</p>
          <form class="form-section" style="border:0" novalidate data-track>
            ${field('order', 'Order number', 'text', 'XW-12345', 'off')}
            ${field('temail', 'Email', 'email', 'you@example.com', 'email')}
            <button class="btn" type="submit">Track order</button>
          </form>
          <div data-result></div>
        </div>
      </div>`;
    const form = $('[data-track]');
    if (prefill) { $('#f-order').value = prefill; if (o) $('#f-temail').value = o.email; }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      showTimeline($('#f-order').value.trim().toUpperCase(), o);
    });
    if (prefill && o) showTimeline(prefill, o);
  }

  function showTimeline(no, o) {
    const match = o && o.no === no;
    const r = REGIONS[match ? o.region : state.region];
    const p = byId(match ? o.lines[0].id : 'p01');
    const placed = match ? new Date(o.placed) : addDays(-2);
    const eta = match ? o.eta : deliveryRange(p);
    const fmt = (d) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    $('[data-result]').innerHTML = `
      <h2 style="margin-top:2rem;font-size:1.5rem">Order ${esc(no)}</h2>
      ${match ? '' : '<p class="muted small">Showing a sample order, since this mockup only remembers the last order you placed.</p>'}
      <ol class="timeline">
        <li class="done"><span class="dot"></span><strong>Order confirmed</strong><span>${fmt(placed)}</span></li>
        <li class="now"><span class="dot"></span><strong>Being prepared by ${esc(DESIGNERS[p.designer].name)}</strong><span>We'll let you know when it reaches our hub</span></li>
        <li><span class="dot"></span><strong>Quality check at our Lahore hub</strong><span>We'll email you a photo of your piece before it ships</span></li>
        <li><span class="dot"></span><strong>On its way with ${r.carrier}</strong><span>You'll get a tracking link by email</span></li>
        <li><span class="dot"></span><strong>Delivered</strong><span>Expected around ${eta}${r.ddp && r.short !== 'PK' ? ', with nothing to pay at the door' : ''}</span></li>
      </ol>`;
  }

  function viewNotFound() {
    state.screen = 'Not found';
    app.innerHTML = '<div class="wrap"><div class="empty"><h1>We couldn\'t find that page</h1><p>It may have moved. Try the latest pieces instead.</p><a class="btn" href="#/shop">Browse new in</a></div></div>';
  }

  // ---------- Sheets ----------
  let sheetReturnFocus = null;
  function openSheet({ title, body, foot = '', side = false, left = false, onMount }) {
    closeSheet(true);
    sheetReturnFocus = sheetReturnFocus || document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const sheet = document.createElement('div');
    sheet.className = `sheet${side ? ' side' : ''}${left ? ' left' : ''}`;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', title);
    sheet.innerHTML = `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icons.close}</button></div>
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
    document.body.append(scrim, sheet);
    document.documentElement.classList.add('sheet-open'); // locks background scroll, incl. iOS Safari
    requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });
    scrim.addEventListener('click', () => closeSheet());
    $$('[data-close]', sheet).forEach((b) => b.addEventListener('click', () => closeSheet()));
    onMount?.(sheet);
    setTimeout(() => ($('button, a, input', $('.sheet-body', sheet)) || $('[data-close]', sheet)).focus({ preventScroll: true }), 60);
  }
  function closeSheet(immediate = false) {
    const sheet = $('.sheet'), scrim = $('.scrim');
    if (!sheet) return;
    const done = () => { sheet.remove(); scrim?.remove(); };
    if (immediate) done();
    else { sheet.classList.remove('show'); scrim?.classList.remove('show'); setTimeout(done, 280); }
    document.documentElement.classList.remove('sheet-open');
    if (!immediate) { sheetReturnFocus?.focus?.({ preventScroll: true }); sheetReturnFocus = null; }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') {
      const sheet = $('.sheet.show');
      if (!sheet) return;
      const f = $$('button:not([disabled]), a[href], input:not([disabled]), select', sheet).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function openRegion() {
    openSheet({
      title: 'Deliver to',
      body: `<p class="muted small" style="margin-top:0">Prices, delivery times and duties update for your country.</p>
        <div class="region-list">${Object.entries(REGIONS).map(([code, r]) =>
          `<button class="region-opt" type="button" data-region="${code}" aria-pressed="${code === state.region}">
            <span class="flag">${r.short}</span><span>${r.name}<small>${code === 'PK' ? 'Pay in PKR, cash on delivery' : r.ddp ? 'Duties included · pay in PKR' : 'Duties payable on delivery · pay in PKR'}</small></span><span>${r.currency}</span>
          </button>`).join('')}</div>`,
      onMount(sheet) {
        $$('[data-region]', sheet).forEach((b) => b.addEventListener('click', () => {
          state.region = b.dataset.region;
          store.set('xw-region', state.region);
          closeSheet();
          renderHeader();
          route(false);
          toast(`Showing prices and delivery for ${region().name}`);
        }));
      },
    });
  }

  function openMenu() {
    openSheet({
      title: 'Menu', side: true, left: true,
      body: `<nav class="nav-list" aria-label="Mobile">
        <a href="#/shop" data-close>New in</a>${Object.entries(CATEGORIES).map(([k, c]) => `<a href="#/shop/${k}" data-close>${c.name}</a>`).join('')}
        <a href="#/track" data-close>Track order</a></nav>`,
    });
  }

  function openSizeGuide() {
    let unit = 'in';
    const render = (sheet) => {
      $('[data-chart]', sheet).innerHTML = `<table class="chart"><thead><tr><th scope="col">${unit === 'in' ? 'Inches' : 'Centimetres'}</th>${SIZE_CHART.sizes.map((s) => `<th scope="col">${s}</th>`).join('')}</tr></thead>
        <tbody>${SIZE_CHART.rows.map(([label, vals]) => `<tr><th scope="row">${label}</th>${vals.map((v) => `<td>${unit === 'in' ? v : Math.round(v * 2.54)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      $$('[data-unit]', sheet).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === unit)));
    };
    openSheet({
      title: 'Size guide',
      body: `<div class="unit-toggle" role="group" aria-label="Units"><button type="button" data-unit="in">Inches</button><button type="button" data-unit="cm">cm</button></div>
        <div data-chart></div>
        <h3 style="margin:1.5rem 0 .5rem;font-size:1.125rem">How to measure</h3>
        <p class="muted small" style="margin:0">Bust: around the fullest part. Waist: around the narrowest part. Hips: around the fullest part, about 20 cm below the waist. Between two sizes? Choose the larger one for a relaxed fit.</p>`,
      onMount(sheet) {
        render(sheet);
        $$('[data-unit]', sheet).forEach((b) => b.addEventListener('click', () => { unit = b.dataset.unit; render(sheet); }));
      },
    });
  }

  function openFilters() {
    const draft = JSON.parse(JSON.stringify(state.filters));
    const cat = (location.hash.match(/#\/shop\/(\w+)/) || [])[1];
    const opt = (group, value, label) =>
      `<button class="chip" type="button" data-f="${group}" data-v="${esc(value)}" aria-pressed="${draft[group].includes(value)}">${label}</button>`;
    const uniq = (k) => [...new Set(PRODUCTS.map((p) => p[k]))].sort();
    const swatchFor = (c) => PRODUCTS.find((p) => p.colour === c).swatch;
    const count = () => { const saved = state.filters; state.filters = draft; const n = filtered(cat).length; state.filters = saved; return n; };
    openSheet({
      title: 'Filter',
      body: `
        <div class="filter-group"><h3>Designer</h3><div class="filter-opts">${Object.entries(DESIGNERS).map(([k, d]) => opt('designer', k, esc(d.name))).join('')}</div></div>
        <div class="filter-group"><h3>Size</h3><div class="filter-opts">${[...PRET_SIZES, 'Unstitched'].map((s) => opt('size', s, s)).join('')}</div></div>
        <div class="filter-group"><h3>Fabric</h3><div class="filter-opts">${uniq('fabric').map((f) => opt('fabric', f, f)).join('')}</div></div>
        <div class="filter-group"><h3>Colour</h3><div class="filter-opts">${uniq('colour').map((c) => opt('colour', c, `<span style="width:.8rem;height:.8rem;border-radius:50%;background:${swatchFor(c)};border:1px solid rgba(0,0,0,.15);margin-right:.4rem"></span>${c}`)).join('')}</div></div>
        <div class="filter-group"><h3>Price</h3><div class="filter-opts">${priceBuckets().map((b) => opt('price', b.key, b.label)).join('')}</div></div>
        <div class="filter-group" style="border:0"><label class="switch-row"><span><strong style="font-weight:500">Leaves our hub within 7 days</strong><br><span class="muted small">Good for last-minute Eid shopping</span></span><input type="checkbox" data-fast ${draft.fast ? 'checked' : ''} style="width:1.25rem;height:1.25rem;accent-color:var(--kattha)"></label></div>`,
      foot: '<div style="display:flex;gap:.75rem"><button class="btn btn-ghost" type="button" data-clear>Clear all</button><button class="btn" type="button" data-apply style="flex:1"></button></div>',
      onMount(sheet) {
        const label = () => { const n = count(); $('[data-apply]', sheet).textContent = `Show ${n} ${n === 1 ? 'piece' : 'pieces'}`; };
        label();
        $$('[data-f]', sheet).forEach((b) => b.addEventListener('click', () => {
          const list = draft[b.dataset.f];
          const v = b.dataset.v;
          const i = list.indexOf(v);
          if (i >= 0) list.splice(i, 1); else list.push(v);
          b.setAttribute('aria-pressed', String(i < 0));
          label();
        }));
        $('[data-fast]', sheet).addEventListener('change', (e) => { draft.fast = e.target.checked; label(); });
        $('[data-clear]', sheet).addEventListener('click', () => {
          Object.keys(draft).forEach((k) => (draft[k] = Array.isArray(draft[k]) ? [] : false));
          $$('[data-f]', sheet).forEach((b) => b.setAttribute('aria-pressed', 'false'));
          $('[data-fast]', sheet).checked = false;
          label();
        });
        $('[data-apply]', sheet).addEventListener('click', () => { state.filters = draft; closeSheet(); route(false); });
      },
    });
  }

  function openInfo(kind) {
    openSheet(kind === 'shipping'
      ? { title: 'Delivery and duties', body: `<p style="margin-top:0">Every order is checked at our Lahore hub, packed as one parcel and sent to you.</p><p>${deliveryText()}</p><p class="muted small">Duties are included for the United States, United Kingdom, Canada, Australia and the UAE and Gulf. Elsewhere, the courier may collect duties and taxes on delivery.</p>` }
      : { title: 'Returns and claims', body: `<p style="margin-top:0">${returnsText()}</p><p class="muted small">To report a problem, use the link in your order email. No account needed.</p>` });
  }

  // ---------- Feedback ----------
  function openFeedback() {
    const text = [
      `Hi! My feedback on the XWoman mockup (I was on: ${state.screen})`,
      '',
      '1. First impression in a few words:',
      '2. Would you buy from a site like this? Why or why not?',
      '3. Was anything confusing or hard to find?',
      '4. How do "duties included" and the delivery dates make you feel?',
      '5. What is missing that you would expect?',
      '',
      'I shop from (country):',
    ].join('\n');
    window.open(`https://wa.me/${FEEDBACK_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  // ---------- Global actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const actions = {
      feedback: openFeedback, region: openRegion, cart: openCart, menu: openMenu,
      'size-guide': openSizeGuide, filters: openFilters,
      'shipping-info': () => openInfo('shipping'), 'returns-info': () => openInfo('returns'),
      'clear-filters': () => { Object.keys(state.filters).forEach((k) => (state.filters[k] = Array.isArray(state.filters[k]) ? [] : false)); route(false); },
      ask: () => toast('In the real store, this opens a WhatsApp chat with our team.'),
    };
    if (actions[a]) { e.preventDefault(); actions[a](); }
  });

  // ---------- Router ----------
  let cleanup = [];
  let lastPath = '';
  function route(scroll = true) {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    const hash = location.hash.slice(1) || '/';
    const [path, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'shop' && lastPath.startsWith('/shop')) {
      state.filters = { designer: [], size: [], fabric: [], colour: [], price: [], fast: false };
    }
    if (parts[0] === 'shop' && lastPath.startsWith('/shop') && lastPath !== path && !params.get('designer')) {
      state.filters.designer = [];
    }
    if (!parts.length) viewHome();
    else if (parts[0] === 'shop') viewShop(parts[1], params);
    else if (parts[0] === 'p') viewProduct(parts[1]);
    else if (parts[0] === 'checkout') viewCheckout();
    else if (parts[0] === 'confirmed') viewConfirmed();
    else if (parts[0] === 'track') viewTrack(params);
    else if (parts[0] === 'admin' && window.XWAdmin) { state.screen = 'Admin chat'; window.XWAdmin.render({ store, money, priceIn, approx, esc, toast }); }
    else viewNotFound();
    lastPath = path;
    document.body.classList.toggle('admin-mode', parts[0] === 'admin');
    renderHeader();
    if (scroll) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', () => { closeSheet(true); document.documentElement.classList.remove('sheet-open'); route(); });
  route();
})();
