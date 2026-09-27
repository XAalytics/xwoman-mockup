// XWoman mockup data. Designer names are fictional; prices, duties and delivery times are illustrative.

const DESIGNERS = {
  mehrbano: { name: 'Mehrbano Atelier', city: 'Lahore', lead: 6 },
  ranghar: { name: 'Rang Ghar', city: 'Karachi', lead: 3 },
  anaya: { name: 'Anaya Lahore', city: 'Lahore', lead: 4 },
  saira: { name: 'Saira Iqbal Couture', city: 'Lahore', lead: 10 },
  kashi: { name: 'Kashi & Co.', city: 'Islamabad', lead: 5 },
};

const CATEGORIES = {
  unstitched: { name: 'Unstitched', blurb: 'Fabric suits to stitch your way: lawn, chiffon, khaddar.' },
  pret: { name: 'Pret', blurb: 'Ready to wear, everyday to evening.' },
  formals: { name: 'Formals', blurb: 'Festive, party and wedding-guest wear.' },
  bridal: { name: 'Bridal', blurb: 'Made to order for the big day.' },
};

const PRET_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const PRODUCTS = [
  {
    id: 'p01', name: 'Emerald organza three-piece', designer: 'saira', category: 'formals',
    pricePkr: 38500, sizes: PRET_SIZES, fabric: 'Organza', colour: 'Green', swatch: '#1F6B4A',
    occasion: 'Wedding guest', images: ['p01', 'd01'],
    description: 'A straight organza shirt with gold zari and resham embroidery at the neckline and hem, worn with a sheer emerald dupatta finished in a scalloped border.',
    pieces: [['Shirt', 'Organza, lined, zari and resham embroidery'], ['Dupatta', 'Organza, 2.5 m, scalloped embroidered border'], ['Trouser', 'Raw silk']],
  },
  {
    id: 'p02', name: 'Red zardozi bridal lehenga', designer: 'saira', category: 'bridal',
    pricePkr: 385000, sizes: ['S', 'M', 'L'], fabric: 'Velvet', colour: 'Red', swatch: '#8E1B2C',
    occasion: 'Bridal', images: ['p02'], madeToOrder: 25,
    description: 'A velvet choli and flared raw silk lehenga worked in gold zardozi and dabka, with a net dupatta edged in a wide gold border. Made to order in your size.',
    pieces: [['Choli', 'Velvet, zardozi and dabka embroidery'], ['Lehenga', 'Raw silk, eight-panel flare'], ['Dupatta', 'Net, 3 m, gold border']],
  },
  {
    id: 'p03', name: 'Sky printed lawn three-piece', designer: 'anaya', category: 'unstitched',
    pricePkr: 8950, sizes: ['Unstitched'], fabric: 'Lawn', colour: 'Blue', swatch: '#A9CBE3',
    occasion: 'Everyday', images: ['p03'],
    description: 'Soft summer lawn printed with small white florals, with a white thread-embroidered neckline panel. Unstitched, so you can have it tailored to your fit.',
    pieces: [['Shirt', 'Printed lawn, 3 m, embroidered neckline'], ['Dupatta', 'Printed lawn, 2.5 m'], ['Trouser', 'Cambric, 2.5 m']],
  },
  {
    id: 'p04', name: 'Mustard embroidered kurta set', designer: 'ranghar', category: 'pret',
    pricePkr: 5490, sizes: PRET_SIZES, fabric: 'Cotton', colour: 'Yellow', swatch: '#D9A441',
    occasion: 'Everyday', images: ['p04'],
    description: 'A breathable cotton kurta with multicolour thread embroidery at the placket and cuffs, with straight white trousers.',
    pieces: [['Kurta', 'Cotton, thread-embroidered placket and cuffs'], ['Trouser', 'Cotton, straight']],
  },
  {
    id: 'p05', name: 'Blush embroidered sharara set', designer: 'mehrbano', category: 'formals',
    pricePkr: 24900, sizes: PRET_SIZES, fabric: 'Chiffon', colour: 'Pink', swatch: '#E6C2BD',
    occasion: 'Festive', images: ['p05'],
    description: 'A blush chiffon kurta with silver thread embroidery at the neckline and hem, over wide raw silk sharara trousers, with a sheer chiffon dupatta.',
    pieces: [['Kurta', 'Chiffon, lined, silver thread embroidery'], ['Sharara', 'Raw silk'], ['Dupatta', 'Chiffon, 2.5 m']],
  },
  {
    id: 'p06', name: 'Sage linen co-ord', designer: 'ranghar', category: 'pret',
    pricePkr: 9990, sizes: PRET_SIZES, fabric: 'Linen', colour: 'Green', swatch: '#A7B697',
    occasion: 'Everyday', images: ['p06'],
    description: 'A relaxed linen shirt with self-embroidered cuffs and matching wide-leg trousers.',
    pieces: [['Shirt', 'Linen, self-embroidered cuffs'], ['Trouser', 'Linen, wide leg']],
  },
  {
    id: 'p07', name: 'Lilac embroidered chiffon three-piece', designer: 'anaya', category: 'unstitched',
    pricePkr: 14500, sizes: ['Unstitched'], fabric: 'Chiffon', colour: 'Purple', swatch: '#C6B3D6',
    occasion: 'Festive', images: ['p07'],
    description: 'Pastel floral resham embroidery on a lilac chiffon front, with an embroidered-border dupatta and raw silk trousers.',
    pieces: [['Shirt front', 'Embroidered chiffon, 1.25 m'], ['Back and sleeves', 'Chiffon, 1.75 m'], ['Dupatta', 'Chiffon, 2.5 m, embroidered border'], ['Trouser', 'Raw silk, 2.5 m']],
  },
  {
    id: 'p08', name: 'Ivory gota kurta set', designer: 'mehrbano', category: 'formals',
    pricePkr: 64000, sizes: PRET_SIZES, fabric: 'Raw silk', colour: 'White', swatch: '#EADFC8',
    occasion: 'Wedding guest', images: ['p08'],
    description: 'An ivory raw silk kurta with antique gold gota bands at the hem and neckline, straight trousers and an organza dupatta scattered with gold motifs.',
    pieces: [['Kurta', 'Raw silk, gota and tilla work'], ['Trouser', 'Raw silk, straight'], ['Dupatta', 'Organza, 2.5 m, gold motifs']],
  },
  {
    id: 'p09', name: 'Navy embroidered maxi', designer: 'ranghar', category: 'pret',
    pricePkr: 7990, sizes: PRET_SIZES, fabric: 'Cotton silk', colour: 'Blue', swatch: '#26365A',
    occasion: 'Everyday', images: ['p09'],
    description: 'A flowing full-sleeved navy maxi in cotton silk, with coral and white floral embroidery down the front and on the sleeves.',
    pieces: [['Maxi', 'Cotton silk, thread embroidery']],
  },
  {
    id: 'p10', name: 'Rust embroidered khaddar three-piece', designer: 'kashi', category: 'unstitched',
    pricePkr: 6750, sizes: ['Unstitched'], fabric: 'Khaddar', colour: 'Orange', swatch: '#B4582F',
    occasion: 'Everyday', images: ['p10'],
    description: 'Warm winter khaddar with cream and mustard thread embroidery on the neckline and hem, and a printed wool-blend shawl.',
    pieces: [['Shirt', 'Khaddar, 3 m, embroidered neckline and hem'], ['Shawl', 'Wool blend, 2.5 m'], ['Trouser', 'Khaddar, 2.5 m']],
  },
  {
    id: 'p11', name: 'White schiffli kurta set', designer: 'kashi', category: 'pret',
    pricePkr: 4990, sizes: PRET_SIZES, fabric: 'Cotton', colour: 'White', swatch: '#EFEAE2',
    occasion: 'Everyday', images: ['p11'],
    description: 'A crisp cotton kurta with schiffli eyelet embroidery at the hem and sleeves, with cigarette trousers.',
    pieces: [['Kurta', 'Cotton, schiffli embroidery'], ['Trouser', 'Cotton, cigarette cut']],
  },
  {
    id: 'p12', name: 'Black velvet tilla set', designer: 'kashi', category: 'formals',
    pricePkr: 42000, sizes: PRET_SIZES, fabric: 'Velvet', colour: 'Black', swatch: '#211C1D',
    occasion: 'Wedding guest', images: ['p12'],
    description: 'A black velvet kurta worked in gold tilla and sequins, with raw silk trousers and a gold-bordered chiffon dupatta.',
    pieces: [['Kurta', 'Velvet, tilla and sequin embroidery'], ['Trouser', 'Raw silk'], ['Dupatta', 'Chiffon, 2.5 m, gold border']],
  },
];

// Regions: DDP regions include an illustrative duty estimate in the price.
const REGIONS = {
  PK: { name: 'Pakistan', short: 'PK', currency: 'PKR', ddp: true, ship: 300, freeOver: 10000, transit: [2, 4], carrier: 'TCS', cod: true },
  US: { name: 'United States', short: 'US', currency: 'USD', ddp: true, duty: 0.26, ship: 25, freeOver: 200, transit: [4, 6], carrier: 'DHL Express' },
  UK: { name: 'United Kingdom', short: 'UK', currency: 'USD', ddp: true, duty: 0.32, ship: 19, freeOver: 200, transit: [3, 5], carrier: 'DHL Express', local: ['£', 0.79] },
  CA: { name: 'Canada', short: 'CA', currency: 'USD', ddp: true, duty: 0.30, ship: 25, freeOver: 200, transit: [4, 6], carrier: 'DHL Express', local: ['C$', 1.37] },
  AU: { name: 'Australia', short: 'AU', currency: 'USD', ddp: true, duty: 0.15, ship: 25, freeOver: 250, transit: [5, 7], carrier: 'DHL Express', local: ['A$', 1.52] },
  AE: { name: 'UAE & Gulf', short: 'UAE', currency: 'USD', ddp: true, duty: 0.10, ship: 15, freeOver: 150, transit: [3, 4], carrier: 'DHL Express', local: ['AED ', 3.67] },
  ROW: { name: 'Rest of world', short: 'Intl', currency: 'USD', ddp: false, duty: 0, ship: 29, freeOver: 300, transit: [5, 9], carrier: 'DHL Express' },
};

const PRICING = { fx: 280, fxBuffer: 0.03, markup: 0.6, codCap: 50000, hubDays: 2 };

const SIZE_CHART = {
  sizes: ['XS', 'S', 'M', 'L', 'XL'],
  rows: [
    ['Bust', [32, 34, 36, 38, 40]],
    ['Waist', [26, 28, 30, 32, 34]],
    ['Hips', [35, 37, 39, 41, 43]],
    ['Shirt length', [42, 42, 43, 43, 44]],
    ['Trouser length', [37, 38, 38, 39, 39]],
  ],
};

const FEEDBACK_WHATSAPP = '971509786799';
