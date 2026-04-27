/**
 * buildOgImage.mjs — one-shot generator for the placeholder Open Graph image.
 *
 * Writes public/og-image.png as a 1200×630 PNG with the Pick&Coach brand
 * background colour. Replace the file by hand once a real designed image
 * (logo + tagline) is available — committed PNG wins, the script just
 * exists so the placeholder origin is reproducible.
 *
 * Run: node scripts/buildOgImage.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const WIDTH = 1200;
const HEIGHT = 630;
// blue-950 from Tailwind (matches HeroSection background) → #172554
const R = 0x17;
const G = 0x25;
const B = 0x54;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let n = 0; n < buf.length; n++) {
    c = c ^ buf[n];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function ihdr(width, height) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8; // bit depth
  buf[9] = 2; // colour type 2 = RGB
  buf[10] = 0; // compression method
  buf[11] = 0; // filter method
  buf[12] = 0; // interlace method
  return buf;
}

function rgbScanlines(width, height, r, g, b) {
  const rowLen = 1 + width * 3;
  const row = Buffer.alloc(rowLen);
  // first byte = filter type (0 = none)
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    row.copy(raw, y * rowLen);
  }
  return raw;
}

const raw = rgbScanlines(WIDTH, HEIGHT, R, G, B);
const png = Buffer.concat([
  PNG_SIGNATURE,
  chunk('IHDR', ihdr(WIDTH, HEIGHT)),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(ROOT, 'public', 'og-image.png');
writeFileSync(out, png);
console.log(`✓ Wrote ${out} (${WIDTH}×${HEIGHT}, #${R.toString(16)}${G.toString(16)}${B.toString(16)})`);
