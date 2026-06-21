// ── Offline density baker ────────────────────────────────────────────────────
// Reads the committed population grid (public/popgrid.bin, gzipped Kontur 2023
// H3 res-6 cells) and rasterises it into a single Web-Mercator PNG that the map
// shows as one lightweight raster layer (see src/main.js). Run once, commit the
// output; only needs re-running if the population data changes.
//
//   npm run bake   →   public/density.png

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";
import { cellToBoundary, getHexagonAreaAvg } from "h3-js";

import { parseGrid, populatedCells } from "../src/grid.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Square Web-Mercator canvas. 16384 ≈ 2.4 km/px at the equator — finer than the
// res-6 (~3 km) source grid, so cells are now ≥1 texel almost everywhere. 16384
// is the MAX_TEXTURE_SIZE on most modern desktop GPUs; older/mobile GPUs cap
// lower (8192/4096) and would show the overlay blank or downscaled — tiling
// would be the fix if that becomes a concern.
const W = 16384;
const H = 16384;
const MAX_LAT = 85.0511;
const D2R = Math.PI / 180;

// lng/lat → fractional Web-Mercator pixel on the WxH world square.
function project(lng, lat) {
  const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * D2R;
  const x = ((lng + 180) / 360) * W;
  const y = ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * H;
  return [x, y];
}

// Colour ramp keyed on log10(people/km²) — must match the legend/feel of the
// previous fill layer: pale where sparse, deep red where dense.
const STOPS = [
  [0.0, [255, 242, 224]], // ~1 /km²
  [1.0, [253, 194, 138]], // ~10
  [1.7, [252, 141, 89]], //  ~50
  [2.4, [227, 74, 51]], //   ~250
  [3.2, [127, 0, 0]], //     ~1,500+ /km²
];
function ramp(t) {
  if (t <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (t <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// ── Load + decompress the grid ───────────────────────────────────────────────
const raw = readFileSync(join(root, "public", "popgrid.bin"));
const buf = gunzipSync(raw);
// Pass a tight ArrayBuffer slice so the typed-array views line up at offset 0.
parseGrid(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// ── Rasterise each cell as its filled hexagon ────────────────────────────────
// Background starts fully transparent; populated hexagons are scanline-filled
// with their density colour. Because res-6 hexagons tile with no gaps, contiguous
// populated areas become solid fields and sparse cells read as filled hexagons —
// not the isolated dots a one-texel-per-cell splat produced.
const AREA = getHexagonAreaAvg(6, "km2"); // ~constant area of a res-6 hexagon
const png = new PNG({ width: W, height: H });
png.data.fill(0); // transparent everywhere

let cells = 0;
let painted = 0;

// Paint a single texel (clamped), used as a sub-pixel safeguard.
function setTexel(x, y, r, g, b) {
  const px = Math.min(W - 1, Math.max(0, Math.round(x)));
  const py = Math.min(H - 1, Math.max(0, Math.round(y)));
  const o = (py * W + px) * 4;
  png.data[o] = r;
  png.data[o + 1] = g;
  png.data[o + 2] = b;
  png.data[o + 3] = 255;
  painted++;
}

// Even-odd scanline fill of a polygon (xs/ys in pixel space) with one colour.
// Returns how many texels it painted.
function fillPoly(xs, ys, r, g, b) {
  const n = xs.length;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const y of ys) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  let count = 0;
  const xints = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xints.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = ys[i];
      const yj = ys[j];
      if ((yi <= yc && yj > yc) || (yj <= yc && yi > yc)) {
        xints.push(xs[i] + ((yc - yi) / (yj - yi)) * (xs[j] - xs[i]));
      }
    }
    if (xints.length < 2) continue;
    xints.sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < xints.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xints[k] - 0.5));
      const xb = Math.min(W - 1, Math.floor(xints[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) {
        const o = (y * W + x) * 4;
        png.data[o] = r;
        png.data[o + 1] = g;
        png.data[o + 2] = b;
        png.data[o + 3] = 255;
        count++;
      }
    }
  }
  return count;
}

for (const { h3, pop: p } of populatedCells()) {
  cells++;
  const ring = cellToBoundary(h3, true); // [[lng, lat], …]
  const xs = new Array(ring.length);
  const ys = new Array(ring.length);
  let minX = Infinity;
  let maxX = -Infinity;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [px, py] = project(ring[i][0], ring[i][1]);
    xs[i] = px;
    ys[i] = py;
    sx += px;
    sy += py;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
  }
  const dens = p / AREA;
  const [r, g, b] = ramp(Math.log10(Math.max(dens, 1)));

  // Antimeridian guard: a hexagon straddling the ±180° seam projects to a span
  // wider than half the world — don't smear it across the map, just dot its
  // centre. (Only a handful of cells.)
  if (maxX - minX > W / 2) {
    setTexel(sx / ring.length, sy / ring.length, r, g, b);
    continue;
  }
  const n = fillPoly(xs, ys, r, g, b);
  if (n === 0) setTexel(sx / ring.length, sy / ring.length, r, g, b);
  else painted += n;
}

const out = join(root, "public", "density.png");
const data = PNG.sync.write(png);
const { writeFileSync } = await import("node:fs");
writeFileSync(out, data);
console.log(
  `baked ${out}\n  ${W}×${H}, ${cells.toLocaleString()} cells → ${painted.toLocaleString()} painted px, ${(data.length / 1e6).toFixed(2)} MB`,
);
