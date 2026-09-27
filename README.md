# XWoman: storefront mockup

A clickable, phone-first mockup of the XWoman shopper experience, used to collect feedback from potential customers before the real store is built.

**Live:** https://xaalytics.github.io/xwoman-mockup/

It is a static site (HTML, CSS, vanilla JavaScript): no build step, no backend. Nothing is charged or shipped. The payment step is simulated, and the cart and last order live in the browser's `localStorage`.

## What testers can try

- Home, category listings with filters and sorting, product pages (gallery, size guide, pieces and fabric, dispatch and delivery dates)
- Switching the delivery country (Pakistan, US, UK, Canada, Australia, UAE & Gulf, rest of world) to see each market's price, duties-included vs payable-on-delivery messages, and cash on delivery for Pakistan. As on the planned Shopify Basic store, everything is charged in PKR with an approximate local amount shown (e.g. `Rs 73,490 ≈ $262`)
- Bag, single-page guest checkout (no account), simulated card payment, order confirmation, and order tracking by order number + email
- **Share feedback** (floating button) opens WhatsApp with a short prefilled question list and the screen the tester was on

## Admin chat (demo)

Open **https://xaalytics.github.io/xwoman-mockup/#/admin** (not linked from the store). Demo PIN: **2026**.

1. Tap the paperclip to send a product photo (library or camera), and type the price and category, e.g. `Rs 12,500 formals` (or tap a category).
2. The assistant crops the photo to the store's 4:5 frame, finds the garment colour, reads the price from your words, and asks for anything else it needs (fabric, designer).
3. It shows a draft listing with the price you typed and the derived prices for every market. **Approve and publish**, **Edit** or **Reject**.
4. Approved products appear in their category on the same device (saved in the browser). "See what you've published" lists them with **Remove**.

In this mockup the AI steps are simulated in the browser; the design for the real agent is in the private `xaalytics/xwoman` repo (`docs/06-admin-agent.md`).

## Content notes

- Designer names are fictional. Prices, duties and delivery times are illustrative.
- Product photos are AI-generated models (FLUX.1 [dev]); no real people or real designers' garments are shown. Claude-drawn illustrations remain available with `IMG_SOURCE=art`.
- The page asks search engines not to index it.

## Run locally

```bash
python -m http.server 8765
# open http://127.0.0.1:8765/
```

## Regenerate product images

AI model photos (default): each shot is described in `tools/shots.json`.

```bash
IMG_PROVIDER=space python tools/gen_images.py   # free FLUX.1-dev Hugging Face Space (daily quota; ~/.hf_key.txt)
python tools/gen_images.py                      # or fal.ai directly (~/.fal_key.txt)
python tools/build_images.py                    # converts img/raw/*.jpg to WebP and updates img/manifest.js
```

Illustrations (alternative): `node tools/illustrate.mjs && IMG_SOURCE=art python tools/build_images.py`.

## End-to-end tests

```bash
npm install
npm run serve &                      # local server on :8765
BASE=http://127.0.0.1:8765/ npm run e2e
npm run e2e                          # against the live site
```

96 checks across 9 journeys: admin chat, browse, filter, sort, product page, bag, sticky bar, card and cash-on-delivery checkout, confirmation, tracking, region switch, feedback, and blocked browser storage.

Phones (iPhone and Android):

```bash
npx playwright install webkit        # once: WebKit is the engine behind every iPhone browser
npm run e2e:mobile                   # iPhone SE / 15 / 15 Pro Max (WebKit) and Pixel 7 / Galaxy S24 (Chrome); 230 checks incl. the admin chat
```

Real touch taps through the full journey, plus layout checks on every screen: no sideways scrolling, touch targets of at least 44px, form fields of at least 16px (so iOS doesn't zoom), Checkout and Pay buttons fully on screen, sticky bar and feedback button placement, and the home-screen app manifest and icons.

## On phones

- Works in Safari and Chrome on iPhone and Android, from 320px-wide screens up.
- Respects the iPhone notch and home indicator (safe areas), and Safari's collapsing toolbar (`dvh`).
- **Add to Home Screen** gives an app icon and opens full screen (web app manifest + Apple touch icon).

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell: banner, header, footer, feedback button, arch clip-path |
| `styles.css` | Design tokens and components (ivory, maroon, Bodoni Moda + Jost; Mughal-arch frames) |
| `data.js` | Products, designers, regions, pricing parameters, size chart, feedback WhatsApp number |
| `app.js` | Hash router and screens: home, shop, product, bag, checkout, confirmation, tracking |
| `tools/` | Image generation and conversion scripts |

The design follows the XWoman design docs (private repo `xaalytics/xwoman`, `docs/04-storefront-ux.md`).
