# XWoman: storefront mockup

A clickable, phone-first mockup of the XWoman shopper experience, used to collect feedback from potential customers before the real store is built.

**Live:** https://xaalytics.github.io/xwoman-mockup/

It is a static site (HTML, CSS, vanilla JavaScript): no build step, no backend. Nothing is charged or shipped. The payment step is simulated, and the cart and last order live in the browser's `localStorage`.

## What testers can try

- Home, category listings with filters and sorting, product pages (gallery, size guide, pieces and fabric, dispatch and delivery dates)
- Switching the delivery country (Pakistan, US, UK, Canada, Australia, UAE & Gulf, rest of world) to see prices in PKR or USD, duties-included vs payable-on-delivery messages, and cash on delivery for Pakistan
- Bag, single-page guest checkout (no account), simulated card payment, order confirmation, and order tracking by order number + email
- **Share feedback** (banner and floating button) opens WhatsApp with a short prefilled question list and the screen the tester was on

## Content notes

- Designer names are fictional. Prices, duties and delivery times are illustrative.
- Product images are fashion illustrations drawn in code by Claude (`tools/illustrate.mjs`). AI photos can be swapped back in with `IMG_SOURCE=photos`.
- The page asks search engines not to index it.

## Run locally

```bash
python -m http.server 8765
# open http://127.0.0.1:8765/
```

## Regenerate product images

Illustrations (default): each product's look is described in `LOOKS` inside `tools/illustrate.mjs`.

```bash
npm install
node tools/illustrate.mjs            # draws img/art/*.svg and *.png
python tools/build_images.py         # converts to WebP and updates img/manifest.js
```

AI photos (optional; shots in `tools/shots.json`):

```bash
python tools/gen_images.py            # generates any missing shots (fal.ai key in ~/.fal_key.txt)
IMG_PROVIDER=hf python tools/gen_images.py   # or via the Hugging Face router (~/.hf_key.txt)
IMG_SOURCE=photos python tools/build_images.py   # converts img/raw/*.jpg to WebP
```

## End-to-end tests

```bash
npm install
npm run serve &                      # local server on :8765
BASE=http://127.0.0.1:8765/ npm run e2e
npm run e2e                          # against the live site
```

63 checks across 8 journeys: browse, filter, sort, product page, bag, sticky bar, card and cash-on-delivery checkout, confirmation, tracking, region switch, feedback, and blocked browser storage.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell: banner, header, footer, feedback button, arch clip-path |
| `styles.css` | Design tokens and components (ivory, maroon, Bodoni Moda + Jost; Mughal-arch frames) |
| `data.js` | Products, designers, regions, pricing parameters, size chart, feedback WhatsApp number |
| `app.js` | Hash router and screens: home, shop, product, bag, checkout, confirmation, tracking |
| `tools/` | Image generation and conversion scripts |

The design follows the XWoman design docs (private repo `xaalytics/xwoman`, `docs/04-storefront-ux.md`).
