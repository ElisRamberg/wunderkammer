// ── Offline density baker ────────────────────────────────────────────────────
// Reads the committed population grid (public/popgrid.bin, gzipped Kontur 2023
// H3 res-6 cells) and rasterises it into a standard {z}/{x}/{y} Web-Mercator
// raster tile pyramid that MapLibre loads as a native "raster" source (see
// src/main.js) — MapLibre then only fetches tiles intersecting the current
// viewport/zoom and evicts offscreen ones, instead of one giant texture or a
// flat set of always-loaded tiles. Run once, commit the output; only needs
// re-running if the population data changes.
//
//   npm run bake   →   public/density/{z}/{x}/{y}.png + manifest.json

import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";
import { cellToBoundary, getHexagonAreaAvg } from "h3-js";

import { parseGrid, populatedCells } from "../src/grid.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Standard XYZ tile pyramid. 512px tiles are MapLibre's modern default (sharp
// on retina at the same fetch count as 256px). z5's effective 16384px world
// width is plenty for a log-scale choropleth of ~3km hexagons — there's no
// meaningful sub-tile detail above that for this data.
const TILE = 512;
const MINZOOM = 0;
const MAXZOOM = 5;
const MAX_LAT = 85.0511;
const D2R = Math.PI / 180;

// Colour ramp keyed on log10(people/km²) — pale where sparse, deep red where
// dense.
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

const AREA = getHexagonAreaAvg(6, "km2"); // ~constant area of a res-6 hexagon

// Each populated cell's [lng,lat] ring + colour, computed once — reprojected
// to world-pixel space per zoom level below (Mercator pixel scale changes
// with z, so this can't be precomputed once for every zoom).
const cells = [];
for (const { h3, pop: p } of populatedCells()) {
  const ring = cellToBoundary(h3, true); // [[lng, lat], …]
  const dens = p / AREA;
  const [r, g, b] = ramp(Math.log10(Math.max(dens, 1)));
  cells.push({ ring, r, g, b });
}

// lng/lat → fractional Web-Mercator pixel on a W×H virtual world square.
function project(lng, lat, W, H) {
  const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * D2R;
  const x = ((lng + 180) / 360) * W;
  const y = ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * H;
  return [x, y];
}

// Even-odd scanline fill of a polygon (xs/ys in *tile-local* pixel space,
// already translated by the tile origin) with one colour. Returns how many
// texels it painted.
function fillPoly(data, xs, ys, r, g, b) {
  const n = xs.length;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const y of ys) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(TILE - 1, Math.ceil(maxY));
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
      const xb = Math.min(TILE - 1, Math.floor(xints[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) {
        const o = (y * TILE + x) * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
        count++;
      }
    }
  }
  return count;
}

function setTexel(data, x, y, r, g, b) {
  const px = Math.min(TILE - 1, Math.max(0, Math.round(x)));
  const py = Math.min(TILE - 1, Math.max(0, Math.round(y)));
  const o = (py * TILE + px) * 4;
  data[o] = r;
  data[o + 1] = g;
  data[o + 2] = b;
  data[o + 3] = 255;
}

// ── Bake the pyramid, one zoom level at a time, skipping empty tiles ────────
const outDir = join(root, "public", "density");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let totalBytes = 0;
let writtenTiles = 0;
let possibleTiles = 0;

for (let z = MINZOOM; z <= MAXZOOM; z++) {
  const gridSize = 2 ** z;
  const W = TILE * gridSize;
  const H = TILE * gridSize;

  // Reproject every populated cell's hexagon into this zoom's world-pixel
  // space, with bbox/centroid for tile overlap tests and the antimeridian
  // guard (a hexagon straddling the ±180° seam projects to a span wider than
  // half the world — don't smear it across the map, just dot its centre).
  const shapes = [];
  for (const { ring, r, g, b } of cells) {
    const xs = new Array(ring.length);
    const ys = new Array(ring.length);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = project(ring[i][0], ring[i][1], W, H);
      xs[i] = px;
      ys[i] = py;
      sx += px;
      sy += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const wraps = maxX - minX > W / 2;
    shapes.push({ xs, ys, minX, maxX, minY, maxY, cx: sx / ring.length, cy: sy / ring.length, r, g, b, wraps });
  }

  possibleTiles += gridSize * gridSize;

  for (let ty = 0; ty < gridSize; ty++) {
    for (let tx = 0; tx < gridSize; tx++) {
      const originX = tx * TILE;
      const originY = ty * TILE;
      const png = new PNG({ width: TILE, height: TILE });
      png.data.fill(0); // transparent everywhere
      let painted = 0;

      for (const s of shapes) {
        // Skip shapes whose bbox doesn't overlap this tile at all.
        if (s.maxX < originX || s.minX > originX + TILE) continue;
        if (s.maxY < originY || s.minY > originY + TILE) continue;

        if (s.wraps) {
          if (
            s.cx >= originX && s.cx < originX + TILE &&
            s.cy >= originY && s.cy < originY + TILE
          ) {
            setTexel(png.data, s.cx - originX, s.cy - originY, s.r, s.g, s.b);
            painted++;
          }
          continue;
        }

        const xs = s.xs.map((x) => x - originX);
        const ys = s.ys.map((y) => y - originY);
        const n = fillPoly(png.data, xs, ys, s.r, s.g, s.b);
        if (n === 0) {
          const lx = s.cx - originX;
          const ly = s.cy - originY;
          if (lx >= 0 && lx < TILE && ly >= 0 && ly < TILE) {
            setTexel(png.data, lx, ly, s.r, s.g, s.b);
            painted++;
          }
        } else {
          painted += n;
        }
      }

      if (painted === 0) continue; // fully empty (ocean/ice/desert) — skip entirely

      const tileDir = join(outDir, String(z), String(tx));
      mkdirSync(tileDir, { recursive: true });
      const data = PNG.sync.write(png);
      writeFileSync(join(tileDir, `${ty}.png`), data);
      totalBytes += data.length;
      writtenTiles++;
    }
  }
}

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({ tileSize: TILE, minzoom: MINZOOM, maxzoom: MAXZOOM, writtenTiles, totalBytes }),
);

console.log(
  `baked ${outDir}\n  z${MINZOOM}-${MAXZOOM} pyramid of ${TILE}px tiles\n` +
    `  ${cells.length.toLocaleString()} cells, ${writtenTiles}/${possibleTiles} tiles written, ` +
    `${(totalBytes / 1e6).toFixed(2)} MB total`,
);
