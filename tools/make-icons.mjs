// Generates the app icons (app/icons/*.png): a plain isometric cube drawn in code, no third-party artwork.
// Usage: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BG = [31, 95, 191];
const FACES = [
  { c: [255, 255, 255], p: [[0, -1], [0.866, -0.5], [0, 0], [-0.866, -0.5]] },   // top
  { c: [207, 220, 245], p: [[-0.866, -0.5], [0, 0], [0, 1], [-0.866, 0.5]] },    // left
  { c: [157, 184, 232], p: [[0, 0], [0.866, -0.5], [0.866, 0.5], [0, 1]] },      // right
];
const inside = (pt, poly) => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (cr === 0) continue;
    if (sign && Math.sign(cr) !== sign) return false;
    sign = Math.sign(cr);
  }
  return true;
};
function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size) {
  const ss = 3, r = 0.3 * size, cx = size / 2, cy = size / 2; // cube stays inside the 80% maskable safe zone
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const pt = [(x + (sx + 0.5) / ss - cx) / r, (y + (sy + 0.5) / ss - cy) / r];
        const face = FACES.find((f) => inside(pt, f.p));
        const c = face ? face.c : BG;
        for (let k = 0; k < 3; k++) acc[k] += c[k];
      }
      for (let k = 0; k < 3; k++) raw[y * (size * 3 + 1) + 1 + x * 3 + k] = Math.round(acc[k] / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../app/icons/${name}`, import.meta.url), png(size));
}
console.log('icons written');
