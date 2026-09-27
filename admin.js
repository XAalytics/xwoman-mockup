/* XWoman admin chat (demo). The admin sends a product photo with its price and category; a simulated assistant
   crops the photo, detects the colour, reads the price, asks what it can't know, drafts the listing and waits for
   approval. Approved products are saved on this device and appear in the store. Loaded before app.js, which calls
   XWAdmin.render(api) for the #/admin route. */
(() => {
  'use strict';

  const PIN = '2026'; // demo only: keeps shoppers out, not a security control
  const CATS = { unstitched: 'Unstitched', pret: 'Pret', formals: 'Formals', bridal: 'Bridal' };
  const FABRICS = ['Raw silk', 'Lawn', 'Cambric', 'Cotton', 'Khaddar', 'Linen', 'Chiffon', 'Organza', 'Silk', 'Velvet', 'Net'];
  const COLOURS = [ // [name, rgb, filter group]
    ['Emerald green', [31, 107, 74], 'Green'], ['Bottle green', [22, 72, 48], 'Green'], ['Sage green', [160, 178, 145], 'Green'],
    ['Mint', [172, 214, 188], 'Green'], ['Teal', [30, 118, 118], 'Blue'], ['Red', [186, 32, 44], 'Red'], ['Maroon', [112, 26, 40], 'Red'],
    ['Blush pink', [232, 192, 186], 'Pink'], ['Pink', [222, 122, 152], 'Pink'], ['Peach', [240, 178, 146], 'Orange'],
    ['Rust', [180, 88, 47], 'Orange'], ['Mustard', [214, 160, 50], 'Yellow'], ['Yellow', [240, 204, 64], 'Yellow'],
    ['Ivory', [236, 226, 204], 'White'], ['White', [246, 245, 241], 'White'], ['Beige', [214, 194, 164], 'White'],
    ['Sky blue', [168, 202, 228], 'Blue'], ['Royal blue', [44, 80, 170], 'Blue'], ['Navy', [36, 52, 90], 'Blue'],
    ['Lilac', [198, 180, 216], 'Purple'], ['Plum', [100, 48, 100], 'Purple'], ['Black', [30, 28, 30], 'Black'],
    ['Grey', [130, 130, 132], 'Grey'], ['Gold', [198, 160, 84], 'Yellow'],
  ];
  const GARMENT = { unstitched: 'three-piece', pret: 'kurta set', formals: 'embroidered suit', bridal: 'bridal ensemble' };

  // Session state (a reload starts a fresh chat; published products persist)
  const log = [];
  let draft = null;
  let api = null;

  // ---------- Parsing (the admin's own words are the only source of prices) ----------
  function parsePkr(text) {
    const t = text.toLowerCase().replace(/(\d),(?=\d{3})/g, '$1');
    const found = [...t.matchAll(/(?:rs\.?|pkr|₨)?\s*(\d+(?:\.\d+)?)\s*(k\b)?(?:\s*\/-)?/g)]
      .map((m) => Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)))
      .filter((v) => v >= 100); // ignore small numbers such as "3 pc" or "2.5 m"
    const values = [...new Set(found)];
    if (values.length === 1) return { value: values[0] };
    if (values.length > 1) return { ambiguous: values };
    return null;
  }
  function parseCategory(text) {
    const t = text.toLowerCase();
    if (/unstitch/.test(t)) return 'unstitched';
    if (/\bbridal\b|\bbride\b|lehenga/.test(t)) return 'bridal';
    if (/formal/.test(t)) return 'formals';
    if (/\bpret\b|ready.to.wear/.test(t)) return 'pret';
    return null;
  }
  const parseFabric = (text) => FABRICS.find((f) => text.toLowerCase().includes(f.toLowerCase())) || null;
  function parseDesigner(text) {
    const t = text.toLowerCase();
    return Object.entries(DESIGNERS).find(([, d]) => t.includes(d.name.toLowerCase().split(' ')[0]))?.[0] || null;
  }

  // ---------- Photo: crop to the store's 4:5 frame and find the garment colour ----------
  async function processPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('unreadable'));
        i.src = url;
      });
      const W = 768, H = 960;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const sw = W / scale, sh = H / scale;
      ctx.drawImage(img, (img.naturalWidth - sw) * 0.5, (img.naturalHeight - sh) * 0.35, sw, sh, 0, 0, W, H);
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.82),
        colour: garmentColour(canvas),
        small: Math.min(img.naturalWidth, img.naturalHeight) < 600,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function garmentColour(canvas) {
    const w = 48, h = 60;
    const s = document.createElement('canvas');
    s.width = w; s.height = h;
    const sc = s.getContext('2d', { willReadFrequently: true });
    sc.drawImage(canvas, 0, 0, w, h);
    const d = sc.getImageData(0, 0, w, h).data;
    const px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    // background = average of the frame's border
    const border = [];
    for (let x = 0; x < w; x++) border.push(px(x, 0), px(x, h - 1));
    for (let y = 0; y < h; y++) border.push(px(0, y), px(w - 1, y));
    const bg = [0, 1, 2].map((k) => border.reduce((s2, p) => s2 + p[k], 0) / border.length);
    // garment pixels: the centre of the frame (below the face), excluding background-like pixels
    const pts = [];
    for (let y = Math.round(h * 0.22); y < Math.round(h * 0.85); y++) {
      for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x++) {
        const p = px(x, y);
        if (dist(p, bg) > 38) pts.push(p);
      }
    }
    if (pts.length < 20) return nearestColour(bg);
    // k-means (k=3, fixed seeds for repeatable results); the largest cluster is the garment
    let centres = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p) => [...p]);
    let groups = [];
    for (let iter = 0; iter < 8; iter++) {
      groups = centres.map(() => []);
      for (const p of pts) {
        let best = 0;
        for (let k = 1; k < centres.length; k++) if (dist(p, centres[k]) < dist(p, centres[best])) best = k;
        groups[best].push(p);
      }
      centres = groups.map((g, k) => (g.length ? [0, 1, 2].map((c) => g.reduce((s2, p) => s2 + p[c], 0) / g.length) : centres[k]));
    }
    const largest = groups.reduce((a, g, k) => (g.length > groups[a].length ? k : a), 0);
    return nearestColour(centres[largest]);
  }
  function nearestColour(rgb) {
    let best = COLOURS[0], bestD = Infinity;
    for (const c of COLOURS) {
      const [r, g, b] = c[1];
      // perceptual weighting of RGB distance
      const dd = 2 * (rgb[0] - r) ** 2 + 4 * (rgb[1] - g) ** 2 + 3 * (rgb[2] - b) ** 2;
      if (dd < bestD) { bestD = dd; best = c; }
    }
    const hex = '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return { name: best[0], group: best[2], hex };
  }

  // ---------- Draft ----------
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function buildListing(dr) {
    const colour = dr.photo.colour.name, fabric = dr.fabric, cat = dr.category;
    const lc = (s) => s.toLowerCase();
    const descriptions = {
      unstitched: `Unstitched ${lc(fabric)} in ${lc(colour)}: shirt, dupatta and trouser fabric, ready to be tailored to your fit.`,
      pret: `A ready-to-wear ${lc(colour)} ${lc(fabric)} kurta with matching trousers, easy from everyday to evening.`,
      formals: `A ${lc(colour)} ${lc(fabric)} suit with fine embroidery, made for festive evenings and wedding guests.`,
      bridal: `A ${lc(colour)} ${lc(fabric)} bridal ensemble with hand embroidery, made to order in your size.`,
    };
    const pieces = {
      unstitched: [['Shirt', `${fabric}, 3 m`], ['Dupatta', `${fabric === 'Lawn' ? 'Lawn' : 'Chiffon'}, 2.5 m`], ['Trouser', 'Cambric, 2.5 m']],
      pret: [['Kurta', fabric], ['Trouser', fabric]],
      formals: [['Shirt', `${fabric}, embroidered`], ['Dupatta', 'Chiffon, 2.5 m'], ['Trouser', 'Raw silk']],
      bridal: [['Top', `${fabric}, hand embroidered`], ['Lehenga', 'Raw silk'], ['Dupatta', 'Net, 3 m']],
    };
    return {
      name: dr.name || cap(`${lc(colour)} ${lc(fabric)} ${GARMENT[cat]}`),
      description: descriptions[cat],
      pieces: pieces[cat],
      sizes: cat === 'unstitched' ? ['Unstitched'] : cat === 'bridal' ? ['S', 'M', 'L'] : PRET_SIZES,
      occasion: { unstitched: 'Everyday', pret: 'Everyday', formals: 'Festive', bridal: 'Bridal' }[cat],
      madeToOrder: cat === 'bridal' ? 25 : undefined,
    };
  }

  // ---------- Chat rendering ----------
  const say = (html, extra = {}) => { log.push({ who: 'agent', html, ...extra }); renderLog(); };
  const said = (html) => { log.push({ who: 'admin', html }); renderLog(); };
  const chips = (kind, options) => `<div class="quick">${options.map(([value, label]) =>
    `<button class="chip" type="button" data-pick="${kind}" data-value="${api.esc(value)}">${api.esc(label)}</button>`).join('')}</div>`;

  function renderLog() {
    const el = document.querySelector('[data-chat-log]');
    if (!el) return;
    el.innerHTML = log.map((m) => `<div class="msg ${m.who}${m.card ? ' card-msg' : ''}">${m.html}</div>`).join('');
    requestAnimationFrame(() => el.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
  }

  // Asks for whatever the draft still needs, in order; shows the preview once complete.
  function next() {
    if (!draft) return;
    if (!draft.photo) return say('Send the photo too: tap the paperclip below.');
    if (draft.priceAmbiguous) {
      const opts = draft.priceAmbiguous.map((v) => [String(v), `Rs ${v.toLocaleString('en-PK')}`]);
      draft.priceAmbiguous = null;
      return say(`I see more than one amount. Which is the price?${chips('price', opts)}`);
    }
    if (!draft.pricePkr) return say('What is the price in rupees? For example "Rs 12,500".');
    if (!draft.category) return say(`Which category is it in?${chips('category', Object.entries(CATS))}`);
    if (!draft.fabric) return say(`What is the fabric? I can't tell for sure from a photo.${chips('fabric', FABRICS.map((f) => [f, f]))}`);
    if (!draft.designer) return say(`Which designer is it from?${chips('designer', Object.entries(DESIGNERS).map(([k, d]) => [k, d.name]))}`);
    return preview();
  }

  function priceRows(pkr) {
    return Object.entries(REGIONS).map(([code, r]) => {
      const v = api.priceIn(pkr, code);
      const local = r.local ? ` <span class="muted">≈ ${r.local[0]}${Math.round(v * r.local[1]).toLocaleString('en-GB')}</span>` : '';
      return `<tr><th scope="row">${r.name}</th><td>${api.money(v, code)}${local}${r.ddp && code !== 'PK' ? ' <span class="muted">duties incl.</span>' : ''}</td></tr>`;
    }).join('');
  }

  function preview(mode = 'review') {
    const editing = mode === 'edit';
    const l = buildListing(draft);
    const d = DESIGNERS[draft.designer];
    const [d0, d1] = l.madeToOrder ? [l.madeToOrder, l.madeToOrder + 5] : [d.lead, d.lead + PRICING.hubDays];
    const warn = draft.photo.small ? '<p class="draft-warn">This photo is small (under 600px), so it may look soft in the store.</p>' : '';
    const body = editing ? `
      <div class="field"><label for="e-name">Title</label><input id="e-name" value="${api.esc(l.name)}"></div>
      <div class="field"><label for="e-price">Price (type it as you would in chat)</label><input id="e-price" value="Rs ${draft.pricePkr.toLocaleString('en-PK')}"></div>
      <div class="field"><label for="e-cat">Category</label><select id="e-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === draft.category ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="e-fabric">Fabric</label><select id="e-fabric">${FABRICS.map((f) => `<option ${f === draft.fabric ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <div class="draft-actions"><button class="btn" type="button" data-draft="save">Save changes</button><button class="btn btn-ghost" type="button" data-draft="cancel-edit">Cancel</button></div>`
      : `
      <p class="draft-desc">${api.esc(l.description)}</p>
      <dl class="draft-facts">
        <div><dt>Category</dt><dd>${CATS[draft.category]}</dd></div>
        <div><dt>Designer</dt><dd>${api.esc(d.name)}</dd></div>
        <div><dt>Fabric</dt><dd>${draft.fabric}</dd></div>
        <div><dt>Colour</dt><dd><span class="sw" style="background:${draft.photo.colour.hex}"></span>${draft.photo.colour.name}</dd></div>
        <div><dt>Sizes</dt><dd>${l.sizes.join(', ')}</dd></div>
        <div><dt>Leaves hub</dt><dd>${d0}–${d1} days</dd></div>
      </dl>
      <p class="draft-typed">You typed: <strong>Rs ${draft.pricePkr.toLocaleString('en-PK')}</strong></p>
      <table class="draft-prices"><caption>Prices by country</caption><tbody>${priceRows(draft.pricePkr)}</tbody></table>
      ${warn}
      ${mode === 'published' ? '<p class="draft-done">Published ✓</p>' : `<div class="draft-actions">
        <button class="btn" type="button" data-draft="approve">Approve and publish</button>
        <button class="btn btn-ghost" type="button" data-draft="edit">Edit</button>
        <button class="btn btn-ghost" type="button" data-draft="reject">Reject</button>
      </div>`}`;
    // replace the previous preview card rather than stacking copies
    const i = log.findIndex((m) => m.card === draft.id);
    const card = { who: 'agent', card: draft.id, html: `
      <div class="draft">
        <img class="draft-img" src="${draft.photo.dataUrl}" alt="Processed product photo">
        <div class="draft-body">
          <p class="draft-kicker">${mode === 'published' ? 'Listing' : 'Draft listing, waiting for your approval'}</p>
          <h3 class="draft-title">${api.esc(l.name)}</h3>
          ${body}
        </div>
      </div>` };
    if (i >= 0) log[i] = card; else log.push(card);
    renderLog();
  }

  function publish() {
    const l = buildListing(draft);
    const id = `a${Date.now().toString(36)}`;
    const product = {
      id, name: l.name, designer: draft.designer, category: draft.category, pricePkr: draft.pricePkr,
      sizes: l.sizes, fabric: draft.fabric, colour: draft.photo.colour.group, swatch: draft.photo.colour.hex,
      occasion: l.occasion, images: [id], imageData: draft.photo.dataUrl, description: l.description, pieces: l.pieces,
      ...(l.madeToOrder ? { madeToOrder: l.madeToOrder } : {}), fromAdmin: true,
    };
    const saved = api.store.get('xw-admin-products', []);
    saved.push(product);
    api.store.set('xw-admin-products', saved);
    PRODUCTS.unshift(product);
    preview('published');
    draft = null;
    say(`Published in ${CATS[product.category]} ✓ Shoppers on this device can see it now.
      <div class="quick"><a class="chip" href="#/p/${id}">View in store</a><a class="chip" href="#/shop/${product.category}">See ${CATS[product.category]}</a><button class="chip" type="button" data-undo="${id}">Undo</button></div>
      <p class="muted small" style="margin:.6rem 0 0">Send the next photo whenever you're ready.</p>`);
  }

  function undo(id) {
    const saved = api.store.get('xw-admin-products', []).filter((p) => p.id !== id);
    api.store.set('xw-admin-products', saved);
    const i = PRODUCTS.findIndex((p) => p.id === id);
    if (i >= 0) PRODUCTS.splice(i, 1);
    say('Removed from the store.');
  }

  function listPublished() {
    const saved = api.store.get('xw-admin-products', []);
    if (!saved.length) return say('Nothing has been published from this device yet.');
    say(`Published from this device:${saved.slice().reverse().map((p) => `
      <div class="pub-item">
        <img src="${p.imageData}" alt="">
        <span><a href="#/p/${p.id}">${api.esc(p.name)}</a><small>Rs ${p.pricePkr.toLocaleString('en-PK')} · ${CATS[p.category]}</small></span>
        <button class="chip" type="button" data-undo="${p.id}">Remove</button>
      </div>`).join('')}`);
  }

  // ---------- Input handling ----------
  function handleText(text) {
    said(api.esc(text));
    if (/(my products|published|list)/i.test(text) && !parsePkr(text)) return listPublished();
    if (/^\s*(help|\?)\s*$/i.test(text)) {
      return say('Send a product photo (paperclip) and a message with its price and category, for example <strong>"Rs 12,500 formals"</strong>. I\'ll ask for anything else I need, then show you a draft to approve.');
    }
    draft = draft || { id: `d${Date.now().toString(36)}` };
    const price = parsePkr(text);
    if (price?.value) draft.pricePkr = price.value;
    if (price?.ambiguous) draft.priceAmbiguous = price.ambiguous;
    draft.category = parseCategory(text) || draft.category;
    draft.fabric = parseFabric(text) || draft.fabric;
    draft.designer = parseDesigner(text) || draft.designer;
    if (!price && !parseCategory(text) && !parseFabric(text) && !parseDesigner(text) && draft.photo) {
      return say('I didn\'t catch a price or category there. Try something like "Rs 12,500 formals".');
    }
    next();
  }

  async function handlePhoto(file) {
    if (draft?.photo) { // a new photo starts a new draft; drop the unfinished one
      const old = log.findIndex((m) => m.card === draft.id);
      if (old >= 0) log.splice(old, 1);
      draft = null;
    }
    draft = draft || { id: `d${Date.now().toString(36)}` }; // keeps price/category typed before the photo
    const thumb = URL.createObjectURL(file);
    said(`<img src="${thumb}" alt="Photo you sent">`);
    const steps = ['Checking the photo', 'Cropping to the store\'s 4:5 frame', 'Finding the garment colour', 'Reading your message'];
    say(`<ul class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ul>`, { steps: true });
    let result;
    try {
      result = await processPhoto(file);
    } catch {
      log.pop();
      return say('I couldn\'t read that photo. Please send a JPG or PNG.');
    }
    for (let k = 0; k < steps.length; k++) {
      await new Promise((r) => setTimeout(r, 380));
      const m = log.findLast((x) => x.steps);
      m.html = `<ul class="steps">${steps.map((s, j) => `<li class="${j <= k ? 'done' : ''}">${s}${j <= k ? ' ✓' : ''}</li>`).join('')}</ul>`;
      renderLog();
    }
    draft.photo = result;
    say(`It looks <strong>${result.colour.name.toLowerCase()}</strong>.`);
    next();
  }

  function bind(root) {
    const form = root.querySelector('[data-composer]');
    const input = root.querySelector('[data-text]');
    const file = root.querySelector('[data-file]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      handleText(text);
    });
    root.querySelector('[data-attach]').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files[0]) handlePhoto(file.files[0]); file.value = ''; });
    root.querySelector('[data-chat-log]').addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      const act = e.target.closest('[data-draft]');
      const un = e.target.closest('[data-undo]');
      if (pick) {
        draft = draft || { id: `d${Date.now().toString(36)}` };
        const { pick: kind, value } = pick.dataset;
        said(api.esc(pick.textContent));
        if (kind === 'price') draft.pricePkr = Number(value);
        if (kind === 'category') draft.category = value;
        if (kind === 'fabric') draft.fabric = value;
        if (kind === 'designer') draft.designer = value;
        next();
      }
      if (act && draft) {
        const a = act.dataset.draft;
        if (a === 'approve') publish();
        if (a === 'reject') { log.splice(log.findIndex((m) => m.card === draft.id), 1); draft = null; say('Discarded. Send another photo whenever you\'re ready.'); }
        if (a === 'edit') preview('edit');
        if (a === 'cancel-edit') preview();
        if (a === 'save') {
          const p = parsePkr(root.querySelector('#e-price').value);
          if (!p?.value) { root.querySelector('#e-price').setCustomValidity('Enter one price, like Rs 12,500'); root.querySelector('#e-price').reportValidity(); return; }
          draft.pricePkr = p.value;
          draft.name = root.querySelector('#e-name').value.trim() || null;
          draft.category = root.querySelector('#e-cat').value;
          draft.fabric = root.querySelector('#e-fabric').value;
          preview();
        }
      }
      if (un) undo(un.dataset.undo);
      if (e.target.closest('[data-list]')) listPublished();
    });
  }

  // ---------- Views ----------
  function renderPin(app) {
    app.innerHTML = `
      <div class="wrap"><form class="pin-card" data-pin novalidate>
        <h1>Admin</h1>
        <p class="muted">Enter the demo PIN to open the catalog assistant.</p>
        <div class="field"><label for="pin">PIN</label><input id="pin" inputmode="numeric" autocomplete="off" maxlength="6"></div>
        <p class="err" data-pin-err hidden>That PIN isn't right. Try again.</p>
        <button class="btn btn-block" type="submit">Open assistant</button>
      </form></div>`;
    app.querySelector('[data-pin]').addEventListener('submit', (e) => {
      e.preventDefault();
      if (app.querySelector('#pin').value.trim() === PIN) {
        api.store.set('xw-admin', true);
        render(api);
      } else {
        app.querySelector('[data-pin-err]').hidden = false;
        app.querySelector('#pin').select();
      }
    });
    setTimeout(() => app.querySelector('#pin').focus(), 50);
  }

  function render(a) {
    api = a;
    const app = document.querySelector('#app');
    if (!api.store.get('xw-admin', false)) return renderPin(app);
    if (!log.length) {
      const count = api.store.get('xw-admin-products', []).length;
      say(`Hi! Send me a product photo with its price and category, for example <strong>"Rs 12,500 formals"</strong>.${count ? ` You've published ${count} ${count === 1 ? 'product' : 'products'} from this device.` : ''}${chips('category', Object.entries(CATS))}${count ? `<div class="quick"><button class="chip" type="button" data-list>See what you've published (${count})</button></div>` : ''}`);
    }
    app.innerHTML = `
      <div class="admin">
        <div class="admin-head wrap">
          <div><h1>Catalog assistant</h1><p class="muted small">Demo: the AI steps are simulated in this mockup.</p></div>
          <a class="text-link" href="#/">View store</a>
        </div>
        <div class="chat-log wrap" data-chat-log aria-live="polite"></div>
        <form class="composer" data-composer>
          <div class="composer-inner">
            <button class="icon-btn attach" type="button" data-attach aria-label="Attach a product photo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.5 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5"/></svg>
            </button>
            <input type="file" accept="image/*" data-file hidden>
            <label class="sr-only" for="chat-text">Message</label>
            <input id="chat-text" type="text" data-text placeholder='e.g. "Rs 12,500 formals"' autocomplete="off" enterkeyhint="send">
            <button class="icon-btn send" type="submit" aria-label="Send">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>
            </button>
          </div>
        </form>
      </div>`;
    renderLog();
    bind(app);
  }

  window.XWAdmin = { render, parsePkr, parseCategory };
})();
