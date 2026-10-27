// Page ornaments shared by the drawn editions (kfgqpc/render.js, shamarly/render.js), after the printed mushafs:
// a patterned frame band with corner rosettes, an ornamental surah-name cartouche (the name in the Surah Name V4
// calligraphy font, fonts/Surahs.ttf of zonetecde/mushaf-layout), hizb and quarter medallions in the outer margin,
// and a medallion round the page number. Only decoration changes: the text block keeps its place, so ayah boxes
// and the tajweed layers stay valid.
//
// Quarter starts (rub' al-hizb) of the Madinah mushaf: the ayat marked ۞ in the KFGQPC text, plus those at the start
// of a surah, where the print sets no ۞ (data/rub.json, 240 entries "s:a").
const fs = require('fs'), path = require('path');
const RUB = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/rub.json'), 'utf8'));
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const NUMW = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

const THEMES = {
  kfgqpc: { line: '#2e5e4e', gold: '#b48c3c', fill: '#f4ecd6', tile: '#d9c38d', ink: '#1d3a30' },
  shamarly: { line: '#6b4a2b', gold: '#a87a3a', fill: '#f5ead8', tile: '#d8b98a', ink: '#3a2614' },
};

// A small eight-pointed star (two squares) used as the repeating tile and in the medallions.
const star = (cx, cy, r, fill, stroke) => {
  const sq = a => [0, 1, 2, 3].map(i => { const t = a + i * Math.PI / 2; return (cx + r * Math.cos(t)).toFixed(2) + ',' + (cy + r * Math.sin(t)).toFixed(2); }).join(' ');
  return `<polygon points="${sq(0)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/><polygon points="${sq(Math.PI / 4)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`;
};
const rosette = (cx, cy, r, t) => {
  let p = '';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p += `<ellipse cx="${(cx + r * 0.55 * Math.cos(a)).toFixed(2)}" cy="${(cy + r * 0.55 * Math.sin(a)).toFixed(2)}" rx="${(r * 0.42).toFixed(2)}" ry="${(r * 0.2).toFixed(2)}" transform="rotate(${i * 45} ${(cx + r * 0.55 * Math.cos(a)).toFixed(2)} ${(cy + r * 0.55 * Math.sin(a)).toFixed(2)})" fill="${t.tile}" stroke="${t.line}" stroke-width="0.6"/>`; }
  return p + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(2)}" fill="${t.gold}" stroke="${t.line}" stroke-width="0.6"/>`;
};

// The frame: outer and inner rules, a band of tiles between them, a rosette in each corner. x0,y0,x1,y1 = outer edge.
function frame(W, H, box, t) {
  const [x0, y0, x1, y1] = box, b = 9, id = 'fb' + Math.random().toString(36).slice(2, 7);
  const tile = `<pattern id="${id}" width="${b}" height="${b}" patternUnits="userSpaceOnUse" x="${x0}" y="${y0}"><rect width="${b}" height="${b}" fill="${t.fill}"/>${star(b / 2, b / 2, b * 0.36, t.tile, t.gold)}</pattern>`;
  const corner = (x, y) => `<rect x="${x - 3}" y="${y - 3}" width="${b + 6}" height="${b + 6}" fill="${t.fill}" stroke="${t.line}" stroke-width="1"/>` + rosette(x + b / 2, y + b / 2, b * 0.75, t);
  return `<svg class="orn" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;pointer-events:none"><defs>${tile}</defs>
<path d="M${x0},${y0}H${x1}V${y1}H${x0}Z M${x0 + b},${y0 + b}V${y1 - b}H${x1 - b}V${y0 + b}Z" fill="url(#${id})" fill-rule="evenodd"/>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${t.line}" stroke-width="1.6"/>
<rect x="${x0 - 3}" y="${y0 - 3}" width="${x1 - x0 + 6}" height="${y1 - y0 + 6}" fill="none" stroke="${t.gold}" stroke-width="0.8"/>
<rect x="${x0 + b}" y="${y0 + b}" width="${x1 - x0 - 2 * b}" height="${y1 - y0 - 2 * b}" fill="none" stroke="${t.line}" stroke-width="1.1"/>
${corner(x0, y0)}${corner(x1 - b, y0)}${corner(x0, y1 - b)}${corner(x1 - b, y1 - b)}</svg>`;
}

// The surah cartouche, w x h CSS px: a tiled band with pointed medallions at both ends and a white field for the name.
function header(w, h, s, t) {
  const id = 'hb' + s + Math.random().toString(36).slice(2, 6), m = h / 2, e = h * 0.95, k = 7;
  const tile = `<pattern id="${id}" width="${k}" height="${k}" patternUnits="userSpaceOnUse"><rect width="${k}" height="${k}" fill="${t.fill}"/>${star(k / 2, k / 2, k * 0.34, t.tile, t.gold)}</pattern>`;
  // Field: a long hexagon with pointed ends, inside the band.
  const fx0 = e + 4, fx1 = w - e - 4, fy0 = h * 0.16, fy1 = h * 0.84, p = (fy1 - fy0) / 2;
  const field = `M${fx0},${m} L${fx0 + p},${fy0} H${fx1 - p} L${fx1},${m} L${fx1 - p},${fy1} H${fx0 + p} Z`;
  const end = cx => `<circle cx="${cx}" cy="${m}" r="${h * 0.44}" fill="${t.fill}" stroke="${t.line}" stroke-width="1"/>` + rosette(cx, m, h * 0.38, t);
  return `<div style="position:relative;width:${w}px;height:${h}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><defs>${tile}</defs>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="3" fill="url(#${id})" stroke="${t.line}" stroke-width="1.5"/>
<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="2" fill="none" stroke="${t.gold}" stroke-width="0.7"/>
<path d="${field}" fill="#fff" stroke="${t.line}" stroke-width="1.2"/>
${end(e * 0.62)}${end(w - e * 0.62)}
</svg><span style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;direction:ltr;font:${(h * 1.55).toFixed(1)}px SN;color:${t.ink};line-height:1;padding-top:${(h * 0.12).toFixed(1)}px">${String(s).padStart(3, '0')}</span></div>`;
}

// The page number in a small lobed medallion.
const pageNo = (n, t) => `<svg width="46" height="26" viewBox="0 0 46 26" style="display:block;margin:0 auto">
<path d="M6,13 C6,4 14,2 23,2 C32,2 40,4 40,13 C40,22 32,24 23,24 C14,24 6,22 6,13Z" fill="${t.fill}" stroke="${t.line}" stroke-width="1"/>
<circle cx="3.5" cy="13" r="2.2" fill="${t.gold}"/><circle cx="42.5" cy="13" r="2.2" fill="${t.gold}"/>
<text x="23" y="14" text-anchor="middle" dominant-baseline="central" font-family="N" font-size="14" fill="${t.ink}">${AR(n)}</text></svg>`;

// Label of quarter i (0-239), as printed in the margin.
function label(i) {
  const hz = Math.floor(i / 4) + 1, q = i % 4;
  if (q === 0) return hz % 2 ? ['الجزء', AR((hz + 1) / 2)] : ['الحزب', AR(hz)];
  return [['', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'][q], AR(hz)];
}

// Margin medallions: called in the page after layout. side = 'r' or 'l' (the outer margin), x = medallion centre.
// Each sits beside the line where its quarter starts, with the label written along the margin.
function marksScript(rub, x, t) {
  return `(() => { const RUB = ${JSON.stringify(rub)}, T = ${JSON.stringify(t)}, X = ${x}, pg = document.getElementById('pg'), P = pg.getBoundingClientRect();
  RUB.forEach(([i, k, l1, l2, f]) => {
    const w = document.querySelector('.w[data-k="' + k + '"]') || document.querySelector('.w[data-k^="' + k + ':"]'); if (!w || (f && w.textContent.trim() !== f)) return;
    const ln = w.closest('.ln').getBoundingClientRect(), y = (ln.top + ln.bottom) / 2 - P.top;
    const d = document.createElement('div'); d.className = 'mk'; d.style.cssText = 'position:absolute;left:' + (X - 10) + 'px;top:' + (y - 10) + 'px;width:20px;height:20px';
    d.innerHTML = '<svg width="20" height="20" viewBox="0 0 26 26">' + ${JSON.stringify(rosette(13, 13, 12.5, t).replace(/"/g, "'"))} + '</svg>';
    pg.appendChild(d);
    const tx = document.createElement('div'); tx.className = 'mkt';
    tx.style.cssText = 'position:absolute;left:' + (X - 60) + 'px;top:' + (y + (y > ${t.H / 2} ? -12 - 120 : 12)) + 'px;width:120px;height:120px;display:flex;align-items:' + (y > ${t.H / 2} ? 'flex-end' : 'flex-start') + ';justify-content:center';
    tx.innerHTML = '<span style="writing-mode:vertical-rl;font:10px N;color:' + T.ink + ';white-space:nowrap;background:#fff;padding:2px 0;line-height:1">' + l1 + ' ' + l2 + '</span>';
    pg.appendChild(tx); }); })();`;
}

// The page's quarters: [index, "s:a", label words].
function rubOn(keys) { const set = new Set(keys); return RUB.map((k, i) => i && set.has(k) ? [i, k, ...label(i)] : null).filter(Boolean); }

module.exports = { THEMES, frame, header, pageNo, marksScript, rubOn, RUB };
