/**
 * generate-icons.js
 * One-time build script (Node.js, no dependencies) that draws a simple
 * church-house glyph on a brand-blue background and writes real PNG icon
 * files for the PWA manifest. Run once with: node generate-icons.js
 * Safe to re-run — it just overwrites the PNGs.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLUE = [0, 87, 184, 255]; // #0057B8
const WHITE = [255, 255, 255, 255];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // no filter
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Point-in-polygon (even-odd rule) for the house glyph. */
function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawIcon(size, { maskable } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const bgRadius = maskable ? size * 0.5 : size * 0.5;
  const cx = size / 2, cy = size / 2;

  // Glyph scale: full-bleed for regular icons, safe-zone shrunk for maskable.
  const scale = maskable ? 0.5 : 0.62;
  const s = size * scale;
  const left = cx - s / 2;
  const top = cy - s * 0.42;

  // Simple house shape: roof (triangle) + body (rectangle) + door (cut-out).
  const roofPeak = [cx, top];
  const roofLeft = [left, top + s * 0.42];
  const roofRight = [left + s, top + s * 0.42];
  const roofPoly = [roofPeak, roofRight, [left + s * 0.86, top + s * 0.42], [left + s * 0.14, top + s * 0.42], roofLeft];

  const bodyLeft = left + s * 0.14;
  const bodyRight = left + s * 0.86;
  const bodyTop = top + s * 0.42;
  const bodyBottom = top + s * 0.95;

  const doorW = s * 0.18, doorH = s * 0.3;
  const doorLeft = cx - doorW / 2, doorRight = cx + doorW / 2;
  const doorTop = bodyBottom - doorH, doorBottom = bodyBottom;

  // Small cross above the roof peak.
  const crossCx = cx, crossCy = top - s * 0.12;
  const crossArm = s * 0.16, crossThick = s * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let color = null;

      if (!maskable && !inCircle(x, y, cx, cy, bgRadius)) {
        // outside circular background for non-maskable => transparent
        buf[idx] = 0; buf[idx + 1] = 0; buf[idx + 2] = 0; buf[idx + 3] = 0;
        continue;
      }
      color = BLUE;

      const isRoof = inPolygon(x, y, roofPoly);
      const isBody = x >= bodyLeft && x <= bodyRight && y >= bodyTop && y <= bodyBottom;
      const isDoor = x >= doorLeft && x <= doorRight && y >= doorTop && y <= doorBottom;
      const isCrossV = Math.abs(x - crossCx) <= crossThick && Math.abs(y - crossCy) <= crossArm;
      const isCrossH = Math.abs(y - crossCy) <= crossThick && Math.abs(x - crossCx) <= crossArm;

      if ((isRoof || isBody) && !isDoor) color = WHITE;
      if (isCrossV || isCrossH) color = WHITE;

      buf[idx] = color[0]; buf[idx + 1] = color[1]; buf[idx + 2] = color[2]; buf[idx + 3] = color[3];
    }
  }
  return buf;
}

const outDir = __dirname;
const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false }
];

targets.forEach(t => {
  const rgba = drawIcon(t.size, { maskable: t.maskable });
  const png = encodePng(t.size, t.size, rgba);
  fs.writeFileSync(path.join(outDir, t.file), png);
  console.log('Wrote', t.file);
});
