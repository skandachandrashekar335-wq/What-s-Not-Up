#!/usr/bin/env node
/**
 * generate-icons.mjs
 * Generates proper PNG icons for the What's Not Up extension.
 * Uses only Node.js built-ins (no external image library needed).
 * Produces valid PNG files at 16x16, 32x32, 48x48, and 128x128.
 *
 * Design: dark navy circle background with a ghost emoji-style shape
 * representing privacy/incognito.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '../src/icons');

mkdirSync(ICONS_DIR, { recursive: true });

// PNG encoder — minimal but produces valid, correct-dimension PNGs
// Uses pure CRC32 + DEFLATE (via zlib via Node built-in)
import { deflateSync } from 'zlib';

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = uint32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePNG(pixels, width, height) {
  // pixels: Uint8Array of RGBA values, row-major
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(6, 9);   // color type: RGBA
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace

  // Build raw scanlines with filter byte 0 (None) prepended
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.allocUnsafe(rawSize);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = deflateSync(raw, { level: 6 });
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Draw the icon at a given size.
 * Design: dark navy rounded square, white ghost shape, opacity ring.
 *
 * The ghost is drawn programmatically as pixels.
 */
function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  // Color palette
  const BG     = [26, 26, 46, 255];   // #1a1a2e  dark navy
  const GHOST  = [232, 234, 246, 255]; // #e8eaf6  light lavender
  const ACCENT = [100, 100, 200, 200]; // semi-transparent purple accent
  const TRANSPARENT = [0, 0, 0, 0];

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i]     = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }

  function dist(x, y, cx, cy) {
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45; // outer circle radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = dist(x + 0.5, y + 0.5, cx, cy);

      if (d > r) {
        // Outside circle — transparent
        setPixel(x, y, ...TRANSPARENT);
      } else {
        // Inside circle — background
        setPixel(x, y, ...BG);
      }
    }
  }

  // Draw a simplified ghost shape
  // Ghost body: upper semicircle + rectangular lower half with wavy bottom
  const gCx = cx;
  const gCy = cy * 0.9;
  const gR  = r * 0.55;  // ghost head radius
  const gBottom = gCy + gR * 1.3;  // bottom of body

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5;
      const fy = y + 0.5;

      // Ghost head — upper semicircle
      const dHead = dist(fx, fy, gCx, gCy);
      if (dHead <= gR && fy <= gCy + 2) {
        setPixel(x, y, ...GHOST);
        continue;
      }

      // Ghost body — rectangle between head center and bottom
      if (fx >= gCx - gR && fx <= gCx + gR && fy >= gCy && fy <= gBottom) {
        // Wavy bottom: exclude points below a sine wave
        const wave = Math.sin((fx - (gCx - gR)) / (gR * 2) * Math.PI * 2) * gR * 0.15;
        if (fy <= gBottom - gR * 0.15 + wave) {
          setPixel(x, y, ...GHOST);
          continue;
        }
      }
    }
  }

  // Eyes — two small dark dots
  const eyeR = Math.max(1, Math.floor(gR * 0.18));
  const eyeY = gCy - gR * 0.1;
  const eyeOffset = gR * 0.3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5;
      const fy = y + 0.5;
      if (dist(fx, fy, gCx - eyeOffset, eyeY) <= eyeR ||
          dist(fx, fy, gCx + eyeOffset, eyeY) <= eyeR) {
        setPixel(x, y, ...BG);
      }
    }
  }

  return pixels;
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const pixels = drawIcon(size);
  const png = encodePNG(pixels, size, size);
  const outPath = join(ICONS_DIR, `icon${size}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ icon${size}.png  (${png.length} bytes)`);
}

console.log('Icons generated in src/icons/');
