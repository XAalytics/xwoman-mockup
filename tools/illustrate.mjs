// Draws XWoman product illustrations as SVG (fashion-sketch style: faceless croquis, garment, print, embroidery,
// dupatta) and renders them to PNG with headless Chrome.
// Usage: node tools/illustrate.mjs [outDir] [id ...]   (default outDir img/art, default ids = all in LOOKS)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const W = 768, H = 960, CX = 384;
const SKIN = '#B98062', SKIN_SHADE = '#9E6A4F', HAIR = '#241816';
const GOLD = '#C9A45C', GOLD_DEEP = '#9C7A3C', SILVER = '#D9DCE0';

// ---------- colour helpers ----------
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const darken = (c, t) => mix(c, '#000000', t);
const lighten = (c, t) => mix(c, '#FFFFFF', t);
const mirrorX = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${W - Number(x)},${y}`);

// ---------- geometry ----------
const TOP = { // hem y and hem width by top length
  kurta: { hemY: 650, hw: 252 }, mid: { hemY: 560, hw: 214 }, short: { hemY: 500, hw: 204 },
  shirt: { hemY: 560, hw: 190 }, maxi: { hemY: 880, hw: 372 }, choli: { hemY: 398, hw: 108 },
};
const SLEEVE_END = { full: 470, three: 408, elbow: 350 };
const NECK = { round: 238, v: 266, boat: 226 };

function topPath(o) {
  const { hemY, hw } = TOP[o.top];
  const nd = NECK[o.neck || 'round'];
  if (o.top === 'choli') {
    return `M360,214 L322,232 C318,256 320,282 324,300 L332,398 Q${CX},404 436,398 L444,300 C448,282 450,256 446,232 L408,214 Q${CX},${nd} 360,214 Z`;
  }
  return `M360,214 L322,232 C318,256 320,282 324,300 L334,390 L${CX - hw / 2},${hemY} Q${CX},${hemY + 12} ${CX + hw / 2},${hemY} L434,390 L444,300 C448,282 450,256 446,232 L408,214 Q${CX},${nd} 360,214 Z`;
}
// x of the garment's left edge at height y (between waist and hem), for embroidery bands
function edgeX(o, y) {
  const { hemY, hw } = TOP[o.top];
  const t = Math.max(0, Math.min(1, (y - 390) / (hemY - 390)));
  return 334 + (CX - hw / 2 - 334) * t;
}
const sleevePath = (end) => `M322,232 C306,244 300,272 298,300 L290,${end} L322,${end + 4} L328,312 C328,290 330,262 334,240 Z`;
const armPath = 'M316,240 L336,246 L318,478 L294,476 Z';

function bottomPaths(o) {
  const topY = TOP[o.top].hemY - 24;
  switch (o.bottom) {
    case 'straight': return [`M352,${topY} L382,${topY} L378,878 L356,878 Z`];
    case 'cigarette': return [`M356,${topY} L382,${topY} L377,878 L361,878 Z`];
    case 'wide': return [`M338,${topY} L383,${topY} L385,886 L324,886 Z`];
    case 'sharara': return [`M350,${topY} L383,${topY} L387,888 Q352,900 310,888 Z`];
    case 'gharara': return [`M352,${topY} L383,${topY} L381,702 L391,888 Q352,900 316,888 L352,702 Z`];
    case 'lehenga': return [];
    default: return [];
  }
}
const lehengaPath = `M330,392 L438,392 L568,884 Q${CX},914 200,884 Z`;

// ---------- patterns ----------
function patterns(o) {
  const p = o.print || {};
  const c = o.colour;
  return `
  <pattern id="zari" width="16" height="16" patternUnits="userSpaceOnUse">
    <g fill="${o.embColour || GOLD}"><circle cx="8" cy="4.5" r="2.4"/><circle cx="8" cy="11.5" r="2.4"/><circle cx="4.5" cy="8" r="2.4"/><circle cx="11.5" cy="8" r="2.4"/></g>
    <circle cx="8" cy="8" r="1.6" fill="${darken(o.embColour || GOLD, 0.25)}"/>
  </pattern>
  <pattern id="zardozi" width="22" height="22" patternUnits="userSpaceOnUse">
    <path d="M11,3 C16,7 15,13 11,15 C8,13 7,8 11,3 Z" fill="${GOLD}"/><circle cx="3" cy="19" r="1.8" fill="${GOLD}"/><circle cx="19" cy="19" r="1.8" fill="${GOLD}"/>
    <path d="M11,15 L11,20" stroke="${GOLD_DEEP}" stroke-width="1.2"/>
  </pattern>
  <pattern id="buti" width="46" height="46" patternUnits="userSpaceOnUse">
    <path d="M23,14 C27,18 26,23 23,25 C20,23 19,18 23,14 Z" fill="${GOLD}" opacity=".9"/>
  </pattern>
  <pattern id="floral" width="30" height="30" patternUnits="userSpaceOnUse">
    <g fill="${p.c1 || '#FFFFFF'}" opacity=".9">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${15 + 3.4 * Math.cos((a * Math.PI) / 180)}" cy="${15 + 3.4 * Math.sin((a * Math.PI) / 180)}" r="2.1"/>`).join('')}</g>
    <circle cx="15" cy="15" r="1.4" fill="${p.c2 || '#F2E6C9'}"/><circle cx="2" cy="2" r="1" fill="${p.c1 || '#FFFFFF'}" opacity=".7"/>
  </pattern>
  <pattern id="block" width="26" height="26" patternUnits="userSpaceOnUse">
    <path d="M13,6 L19,13 L13,20 L7,13 Z" fill="none" stroke="${p.c1 || '#8C3B22'}" stroke-width="1.8"/>
    <circle cx="13" cy="13" r="2" fill="${p.c2 || '#2F3E6B'}"/><circle cx="0" cy="0" r="2" fill="${p.c2 || '#2F3E6B'}"/><circle cx="26" cy="26" r="2" fill="${p.c2 || '#2F3E6B'}"/>
  </pattern>
  <pattern id="digital" width="72" height="72" patternUnits="userSpaceOnUse">
    <g transform="translate(18,20)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${6 * Math.cos((a * Math.PI) / 180)}" cy="${6 * Math.sin((a * Math.PI) / 180)}" rx="5.5" ry="3.6" transform="rotate(${a} ${6 * Math.cos((a * Math.PI) / 180)} ${6 * Math.sin((a * Math.PI) / 180)})" fill="${p.c1 || '#E8745E'}"/>`).join('')}<circle r="2.6" fill="#F7E3C4"/></g>
    <ellipse cx="44" cy="30" rx="9" ry="3.2" transform="rotate(-35 44 30)" fill="${p.c2 || '#F4F1EA'}" opacity=".85"/>
    <ellipse cx="30" cy="50" rx="8" ry="3" transform="rotate(25 30 50)" fill="${p.c2 || '#F4F1EA'}" opacity=".85"/>
    <g transform="translate(56,58)">${[0, 90, 180, 270].map((a) => `<circle cx="${4 * Math.cos((a * Math.PI) / 180)}" cy="${4 * Math.sin((a * Math.PI) / 180)}" r="3" fill="${p.c1 || '#E8745E'}" opacity=".85"/>`).join('')}</g>
  </pattern>
  <pattern id="mirror" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="12" cy="12" r="3.4" fill="${SILVER}" stroke="#9EA3AA" stroke-width=".8"/><circle cx="11" cy="11" r="1" fill="#FFFFFF"/>
    <path d="M2,2 L6,6 M22,2 L18,6 M2,22 L6,18 M22,22 L18,18" stroke="${lighten(c, 0.55)}" stroke-width="1"/>
  </pattern>
  <pattern id="resham" width="38" height="38" patternUnits="userSpaceOnUse">
    <g transform="translate(12,12)">${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${4 * Math.cos((a * Math.PI) / 180)}" cy="${4 * Math.sin((a * Math.PI) / 180)}" r="2.4" fill="#F4D6E0"/>`).join('')}<circle r="2" fill="#F2D98B"/></g>
    <g transform="translate(29,28)">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${3 * Math.cos((a * Math.PI) / 180)}" cy="${3 * Math.sin((a * Math.PI) / 180)}" r="2" fill="#CFE3D2"/>`).join('')}<circle r="1.5" fill="#F2D98B"/></g>
    <path d="M18,22 C21,19 23,19 25,21" stroke="#9DBF9F" stroke-width="1.2" fill="none"/>
  </pattern>
  <pattern id="eyelet" width="18" height="18" patternUnits="userSpaceOnUse">
    <ellipse cx="9" cy="9" rx="3.2" ry="2.2" fill="${darken(c, 0.12)}" stroke="${darken(c, 0.3)}" stroke-width=".9"/>
    <circle cx="1" cy="1" r="1.2" fill="${darken(c, 0.25)}"/><circle cx="17" cy="17" r="1.2" fill="${darken(c, 0.25)}"/>
  </pattern>
  <pattern id="thread" width="18" height="18" patternUnits="userSpaceOnUse">
    <path d="M9,3 C13,6 13,12 9,15 C5,12 5,6 9,3 Z" fill="none" stroke="${o.embColour || '#F1E3C2'}" stroke-width="1.6"/>
    <circle cx="9" cy="9" r="1.4" fill="${p.c2 || '#D9A441'}"/>
  </pattern>
  <pattern id="shawlprint" width="34" height="34" patternUnits="userSpaceOnUse">
    <rect width="34" height="34" fill="${(o.dupatta || {}).colour || c}"/>
    <path d="M17,6 C23,11 22,19 17,22 C13,19 12,11 17,6 Z" fill="${lighten((o.dupatta || {}).colour || c, 0.35)}"/>
    <circle cx="4" cy="30" r="2" fill="${lighten((o.dupatta || {}).colour || c, 0.5)}"/>
  </pattern>
  <pattern id="gota" width="12" height="12" patternUnits="userSpaceOnUse">
    <rect width="12" height="12" fill="${GOLD}"/><path d="M0,6 L12,6" stroke="${lighten(GOLD, 0.5)}" stroke-width="2"/><path d="M6,0 L6,12" stroke="${GOLD_DEEP}" stroke-width=".8"/>
  </pattern>
  <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".24" stop-color="#000" stop-opacity="0"/>
    <stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset=".76" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity=".2"/>
  </linearGradient>
  <linearGradient id="drop" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".1"/>
  </linearGradient>
  <radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#F6F1EC"/><stop offset="1" stop-color="#E7DFD8"/></radialGradient>`;
}

// ---------- pieces ----------
const piece = (d, fill, o, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${darken(o.colour, 0.35)}" stroke-opacity=".45" stroke-width="1.3" stroke-linejoin="round" ${extra}/>`;
const shade = (d) => `<path d="${d}" fill="url(#shade)"/><path d="${d}" fill="url(#drop)"/>`;
const folds = (o) => {
  const { hemY } = TOP[o.top];
  if (o.top === 'choli') return '';
  return [-70, -30, 20, 64].map((dx, i) =>
    `<path d="M${CX + dx * 0.35},${400 + i * 6} Q${CX + dx * 0.8},${(400 + hemY) / 2} ${CX + dx},${hemY - 4}" stroke="${darken(o.colour, 0.3)}" stroke-opacity=".22" stroke-width="2" fill="none"/>`).join('');
};

function hemBand(o, fillId, h = 38, off = 10) {
  const { hemY } = TOP[o.top];
  const y1 = hemY - off - h, y2 = hemY - off;
  const l1 = edgeX(o, y1), l2 = edgeX(o, y2);
  const d = `M${l1},${y1} L${W - l1},${y1} L${W - l2},${y2} Q${CX},${y2 + 11} ${l2},${y2} Z`;
  const edge = o.embColour || GOLD;
  return `<path d="${d}" fill="url(#${fillId})"/><path d="M${l1},${y1} L${W - l1},${y1}" stroke="${edge}" stroke-width="2.4"/><path d="M${l2},${y2} Q${CX},${y2 + 11} ${W - l2},${y2}" stroke="${edge}" stroke-width="2.4" fill="none"/>`;
}
function neckWork(o, fillId) {
  const deep = o.neck === 'v';
  const yoke = deep
    ? `M356,214 L${CX},270 L412,214 L424,222 L${CX},300 L344,222 Z`
    : `M354,214 Q${CX},262 414,214 L424,222 Q${CX},296 344,222 Z`;
  const placket = o.placket === false ? '' : `<path d="M378,${deep ? 292 : 262} L390,${deep ? 292 : 262} L388,352 L380,352 Z" fill="url(#${fillId})"/>`;
  return `<path d="${yoke}" fill="url(#${fillId})"/>${placket}`;
}
function cuffs(o, fillId) {
  const end = SLEEVE_END[o.sleeve || 'full'];
  const d = `M293,${end - 26} L323,${end - 22} L322,${end + 4} L290,${end} Z`;
  return `<path d="${d}" fill="url(#${fillId})"/><path d="${mirrorX(d)}" fill="url(#${fillId})"/>`;
}

function dupatta(o) {
  const du = o.dupatta;
  if (!du) return { back: '', front: '' };
  const fill = du.fill || du.colour;
  const border = du.border ? `stroke="${du.border}" stroke-width="5" stroke-dasharray="${du.dash || '2 5'}" stroke-linecap="round"` : '';
  if (du.style === 'head') {
    const left = 'M384,98 C356,98 336,120 332,180 C326,320 312,520 298,722 L330,728 C340,540 346,360 350,230 C352,190 352,150 360,126 C368,110 376,106 384,106 Z';
    const outline = 'M384,98 C356,98 336,120 332,180 C326,320 312,520 298,722 L330,728';
    return {
      back: '',
      front: `<g opacity="${du.opacity || 0.62}"><path d="${left}" fill="${fill}"/><path d="${mirrorX(left)}" fill="${fill}"/></g>
        <path d="${outline}" fill="none" ${border}/><path d="${mirrorX(outline)}" fill="none" ${border}/>`,
    };
  }
  if (du.style === 'shawl') {
    const left = 'M360,214 C340,220 322,228 314,242 L298,642 L348,652 L356,300 Z';
    return { back: '', front: `<g opacity="${du.opacity || 0.96}"><path d="${left}" fill="${fill}"/><path d="${mirrorX(left)}" fill="${fill}"/></g>
      <path d="M298,642 L348,652" stroke="${du.border || lighten(du.colour, 0.4)}" stroke-width="6"/><path d="${mirrorX('M298,642 L348,652')}" stroke="${du.border || lighten(du.colour, 0.4)}" stroke-width="6"/>` };
  }
  // one shoulder: falls behind the right arm and down the side, with a thin band across the chest
  const drape = 'M428,222 C462,232 482,284 486,364 L496,806 Q470,818 444,810 L444,424 C446,334 440,272 422,238 Z';
  const across = 'M352,218 C372,236 404,236 428,222 L432,236 C404,252 370,252 348,232 Z';
  const printed = (d) => (du.fill ? `<path d="${d}" fill="${du.colour}"/>` : ''); // base colour under a print
  return {
    back: `<g opacity="${du.opacity || 0.58}">${printed(drape)}<path d="${drape}" fill="${fill}"/></g><path d="M496,806 Q470,818 444,810" fill="none" ${border}/><path d="M486,364 L496,806" fill="none" ${border}/>`,
    front: `<g opacity="${(du.opacity || 0.58) * 0.9}">${printed(across)}<path d="${across}" fill="${fill}"/></g>`,
  };
}

// ---------- figure ----------
function figure(o) {
  const end = SLEEVE_END[o.sleeve || 'full'];
  const du = dupatta(o);
  const bottoms = bottomPaths(o);
  // Garments are always painted in their base colour first; a print is laid on top (patterns are transparent).
  const bottomFill = o.bottomColour || o.colour;
  const topFill = o.colour;
  const overlay = (d) => (o.print ? `<path d="${d}" fill="url(#${o.print.type})"/>` : '');
  const t = topPath(o);
  const e = o.emb || {};
  const embFill = e.style || 'zari';
  return `
  <ellipse cx="${CX}" cy="894" rx="${o.bottom === 'lehenga' ? 220 : 150}" ry="14" fill="#000" opacity=".08"/>
  <!-- hair behind -->
  <path d="M350,128 C346,94 422,94 418,128 L426,306 Q${CX},322 342,306 Z" fill="${HAIR}"/>
  ${du.back}
  <!-- arms -->
  <path d="${armPath}" fill="${SKIN}"/><path d="${mirrorX(armPath)}" fill="${SKIN}"/>
  <ellipse cx="305" cy="494" rx="11" ry="17" fill="${SKIN}"/><ellipse cx="463" cy="494" rx="11" ry="17" fill="${SKIN}"/>
  <!-- feet -->
  <path d="M354,884 Q367,878 381,886 L380,892 L353,892 Z" fill="${SKIN}"/><path d="M387,886 Q401,878 414,884 L415,892 L388,892 Z" fill="${SKIN}"/>
  <path d="M356,886 L379,886 M389,886 L412,886" stroke="${GOLD}" stroke-width="2.2"/>
  <!-- neck and head -->
  <path d="M372,178 L396,178 L400,220 L368,220 Z" fill="${SKIN_SHADE}"/>
  <ellipse cx="${CX}" cy="148" rx="30" ry="38" fill="${SKIN}"/>
  <path d="M354,152 C349,102 419,102 414,152 C410,124 396,116 384,118 C372,120 358,128 354,152 Z" fill="${HAIR}"/>
  <circle cx="355" cy="176" r="3.5" fill="${GOLD}"/><path d="M352,180 L358,180 L355,190 Z" fill="${GOLD}"/>
  <circle cx="413" cy="176" r="3.5" fill="${GOLD}"/><path d="M410,180 L416,180 L413,190 Z" fill="${GOLD}"/>
  <!-- bottoms -->
  ${bottoms.map((d) => `${piece(d, bottomFill, { colour: o.bottomColour || o.colour })}${shade(d)}${piece(mirrorX(d), bottomFill, { colour: o.bottomColour || o.colour })}${shade(mirrorX(d))}`).join('')}
  ${o.bottom === 'gharara' ? `<path d="M352,702 L381,702 M387,702 L416,702" stroke="${GOLD}" stroke-width="7"/>` : ''}
  ${o.bottom === 'lehenga' ? `${piece(lehengaPath, o.colour, o)}<path d="${lehengaPath}" fill="url(#buti)"/>${shade(lehengaPath)}
    <path d="M232,800 L536,800 L568,884 Q${CX},914 200,884 Z" fill="url(#zardozi)"/><path d="M232,800 L536,800" stroke="${GOLD}" stroke-width="3"/>
    <path d="M256,736 L512,736 L520,756 L248,756 Z" fill="url(#zari)"/><path d="M200,884 Q${CX},914 568,884" stroke="${GOLD}" stroke-width="4" fill="none"/>` : ''}
  <!-- top -->
  ${piece(t, topFill, o)}${overlay(t)}
  ${e.panel ? `<path d="M352,260 Q${CX},246 416,260 L426,${Math.min(TOP[o.top].hemY - 60, 600)} Q${CX},${Math.min(TOP[o.top].hemY - 48, 612)} 342,${Math.min(TOP[o.top].hemY - 60, 600)} Z" fill="url(#${e.panel})" opacity=".95"/>` : ''}
  ${e.neck ? neckWork(o, embFill) : ''}
  ${e.hem ? hemBand(o, e.hemStyle || embFill, e.hemH || 38) : ''}
  ${folds(o)}
  ${shade(t)}
  <!-- sleeves -->
  ${piece(sleevePath(end), topFill, o)}${overlay(sleevePath(end))}${shade(sleevePath(end))}${piece(mirrorX(sleevePath(end)), topFill, o)}${overlay(mirrorX(sleevePath(end)))}${shade(mirrorX(sleevePath(end)))}
  ${e.cuffs ? cuffs(o, e.cuffStyle || embFill) : ''}
  ${du.front}`;
}

const svg = (o) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>${patterns(o)}</defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${figure(o)}
</svg>`;

// ---------- looks (one per product) ----------
export const LOOKS = {
  p01: { top: 'kurta', bottom: 'straight', sleeve: 'full', colour: '#1F6B4A', emb: { neck: true, hem: true, cuffs: true },
    dupatta: { style: 'shoulder', colour: '#2E8A60', opacity: 0.5, border: GOLD } },
  p02: { top: 'choli', bottom: 'lehenga', sleeve: 'elbow', colour: '#8E1B2C', emb: { neck: true, cuffs: true, style: 'zardozi' },
    dupatta: { style: 'head', colour: '#C8283A', opacity: 0.55, border: GOLD, dash: '3 4' } },
  p03: { top: 'kurta', bottom: 'straight', bottomColour: '#F5F2EC', sleeve: 'full', colour: '#A9CBE3', print: { type: 'floral' },
    embColour: '#FFFFFF', emb: { neck: true, style: 'thread' }, dupatta: { style: 'shoulder', colour: '#BCD7EA', fill: 'url(#floral)', opacity: 0.75 } },
  p04: { top: 'kurta', bottom: 'straight', bottomColour: '#F5F2EC', sleeve: 'three', colour: '#D9A441', print: { type: 'block', c1: '#8C3B22', c2: '#2F3E6B' } },
  p05: { top: 'mid', bottom: 'sharara', sleeve: 'full', colour: '#E6C2BD', print: { type: 'mirror' }, embColour: '#E8E8EA',
    emb: { neck: true, hem: true, cuffs: true }, dupatta: { style: 'shoulder', colour: '#EFD3CF', opacity: 0.55, border: '#E8E8EA' } },
  p06: { top: 'shirt', bottom: 'wide', sleeve: 'full', colour: '#A7B697', embColour: '#C9D3BE', emb: { cuffs: true, cuffStyle: 'thread' } },
  p07: { top: 'kurta', bottom: 'straight', bottomColour: '#D8CBE3', sleeve: 'full', colour: '#C6B3D6', emb: { panel: 'resham', cuffs: true, cuffStyle: 'resham', hem: true, hemStyle: 'resham' },
    embColour: '#F2D98B', dupatta: { style: 'shoulder', colour: '#D3C3E0', opacity: 0.55, border: '#F2D98B' } },
  p08: { top: 'short', bottom: 'gharara', sleeve: 'full', colour: '#EADFC8', emb: { neck: true, hem: true, cuffs: true, hemStyle: 'gota', style: 'zari' },
    dupatta: { style: 'shoulder', colour: '#E9DCC0', opacity: 0.8, border: GOLD } },
  p09: { top: 'maxi', bottom: 'none', sleeve: 'full', colour: '#26365A', print: { type: 'digital', c1: '#E8745E', c2: '#F4F1EA' } },
  p10: { top: 'kurta', bottom: 'straight', sleeve: 'full', colour: '#B4582F', embColour: '#F1E3C2', emb: { neck: true, hem: true, style: 'thread' },
    print: null, dupatta: { style: 'shawl', colour: '#7A3A22', fill: 'url(#shawlprint)', border: '#E0B45C' } },
  p11: { top: 'kurta', bottom: 'cigarette', bottomColour: '#F7F4EE', sleeve: 'full', colour: '#F4F1EA', emb: { hem: true, hemStyle: 'eyelet', cuffs: true, cuffStyle: 'eyelet', hemH: 52 } },
  p12: { top: 'kurta', bottom: 'straight', sleeve: 'full', colour: '#211C1D', emb: { neck: true, cuffs: true, hem: true, style: 'zari' },
    dupatta: { style: 'shoulder', colour: '#3A3334', opacity: 0.55, border: GOLD } },
};

// ---------- render ----------
const outDir = process.argv[2] || 'img/art';
const ids = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(LOOKS);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
for (const id of ids) {
  const s = svg(LOOKS[id]);
  fs.writeFileSync(path.join(outDir, `${id}.svg`), s);
  await page.setContent(`<html><body style="margin:0">${s}</body></html>`);
  await page.screenshot({ path: path.join(outDir, `${id}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  console.log(id, 'drawn');
}
await browser.close();
