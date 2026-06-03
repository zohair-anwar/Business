/* =========================================================
   Off Watch Wellness — icon & social-image generator
   Pure JS (zlib only). Renders the brand mark to PNGs with
   supersampled anti-aliasing. Run:  node tools/gen-icons.js
   Outputs into ../assets and ../ (favicon PNG fallbacks).
   ========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* ---- palette (0..1 rgb) ---- */
const INK  = [0x0e / 255, 0x1b / 255, 0x2a / 255];
const INK2 = [0x14 / 255, 0x28 / 255, 0x39 / 255];
const MINT = [0x4f / 255, 0xb3 / 255, 0x9a / 255];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

/* ---- the mark, defined over a unit square (0..1), centre (0.5,0.5) ---- */
function inMark(u, v) {
  const dx = u - 0.5, dy = v - 0.5;
  const d = Math.hypot(dx, dy);
  const ring = d >= 0.240 && d <= 0.300;                          // watch face
  const line = Math.abs(v - 0.600) <= 0.0240 && d <= 0.272;       // horizon
  const sun  = v <= 0.600 && Math.hypot(u - 0.5, v - 0.600) <= 0.0875; // half-sun on horizon
  return ring || line || sun;
}

/* rounded-rect membership (qx,qy measured from centre) */
function inRoundedRect(u, v, rr) {
  const qx = Math.abs(u - 0.5), qy = Math.abs(v - 0.5);
  if (qx > 0.5 || qy > 0.5) return false;
  const inner = 0.5 - rr;
  const ex = Math.max(qx - inner, 0), ey = Math.max(qy - inner, 0);
  return Math.hypot(ex, ey) <= rr;
}

/* ---- render a square icon ---- */
function renderIcon(size, opts) {
  opts = opts || {};
  const rr = opts.radius;            // undefined => full bleed
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let ar = 0, ag = 0, ab = 0, aa = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          let alpha = 1;
          if (rr !== undefined && !inRoundedRect(u, v, rr)) alpha = 0;
          let col = mix(INK, INK2, v * 0.85);     // subtle vertical depth
          if (alpha > 0 && inMark(u, v)) col = MINT;
          ar += col[0] * alpha; ag += col[1] * alpha; ab += col[2] * alpha; aa += alpha;
        }
      }
      const n = SS * SS;
      const a = aa / n;
      const i = (py * size + px) * 4;
      if (aa > 0) {
        buf[i]     = Math.round((ar / aa) * 255);
        buf[i + 1] = Math.round((ag / aa) * 255);
        buf[i + 2] = Math.round((ab / aa) * 255);
      }
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return buf;
}

/* ---- render the 1200x630 social card ---- */
function renderOG(W, H) {
  const SS = 3;
  const buf = Buffer.alloc(W * H * 4);
  const markSize = 260;
  const mx = W / 2 - markSize / 2;
  const my = H / 2 - markSize / 2 - 6;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let ar = 0, ag = 0, ab = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          // background: ink with a mint glow toward top-right (matches hero)
          let col = mix(INK, INK2, (y / H) * 0.9);
          const gx = (x - W * 0.82) / (W * 0.55);
          const gy = (y - H * -0.05) / (H * 0.9);
          const glow = Math.max(0, 1 - Math.hypot(gx, gy));
          col = mix(col, MINT, glow * 0.16);
          // mark
          const u = (x - mx) / markSize, v = (y - my) / markSize;
          if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && inMark(u, v)) col = MINT;
          ar += col[0]; ag += col[1]; ab += col[2];
        }
      }
      const n = SS * SS;
      const i = (py * W + px) * 4;
      buf[i]     = Math.round((ar / n) * 255);
      buf[i + 1] = Math.round((ag / n) * 255);
      buf[i + 2] = Math.round((ab / n) * 255);
      buf[i + 3] = 255;
    }
  }
  return buf;
}

/* ---- minimal PNG encoder ---- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(W, H, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const stride = W * 4;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function writeIcon(file, size, opts) {
  const png = encodePNG(size, size, renderIcon(size, opts));
  fs.writeFileSync(path.join(OUT, file), png);
  console.log("  assets/" + file + " (" + size + "x" + size + ", " + png.length + " bytes)");
}

/* ---- generate ---- */
console.log("Generating icons…");
writeIcon("favicon-16.png", 16, { radius: 0.18 });
writeIcon("favicon-32.png", 32, { radius: 0.16 });
writeIcon("apple-touch-icon.png", 180);           // full bleed (Apple masks)
writeIcon("icon-192.png", 192);                   // maskable
writeIcon("icon-512.png", 512);                   // maskable

const og = encodePNG(1200, 630, renderOG(1200, 630));
fs.writeFileSync(path.join(OUT, "og-image.png"), og);
console.log("  assets/og-image.png (1200x630, " + og.length + " bytes)");
console.log("Done.");
