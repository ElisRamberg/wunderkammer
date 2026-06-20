// ── Local population grid — instant, no network per query ────────────────────
//
// Loads the committed popgrid.bin (Kontur 2023, H3 res 6 / ~3 km hexagons, ~2M
// cells, 4.7 MB gzipped) once into sorted typed arrays. Any drawn polygon is
// answered locally: enumerate the H3 cells covering it (h3-js) and binary-search
// their population. No API, no per-query fetch, no area cap.
//
// This module is shared by the Web Worker (src/grid-worker.js) and by node tests.

import { polygonToCells } from "h3-js";

let hiArr = null; // high 32 bits of each H3 index, sorted ascending
let loArr = null; // low 32 bits
let popArr = null; // population per cell (float32)
let N = 0;
let RES = 6;

// Parse the raw (already decompressed) grid buffer into views.
export function parseGrid(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "KPG1") throw new Error("Bad population grid file");
  RES = dv.getUint32(4, true);
  N = dv.getUint32(8, true);
  let off = 12;
  hiArr = new Uint32Array(buf, off, N);
  off += N * 4;
  loArr = new Uint32Array(buf, off, N);
  off += N * 4;
  popArr = new Float32Array(buf, off, N);
}

// Fetch + gunzip the grid (browser / worker).
export async function loadGrid(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn’t load population data (${res.status})`);
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  parseGrid(buf);
}

export const isLoaded = () => N > 0;
export const resolution = () => RES;

// Binary search for an H3 index split into (hi, lo) 32-bit halves; returns the
// row index, or -1 if the cell isn't in the dataset (unpopulated / ocean).
function indexOfCell(hi, lo) {
  let a = 0;
  let b = N - 1;
  while (a <= b) {
    const m = (a + b) >>> 1;
    const mh = hiArr[m];
    if (mh < hi) { a = m + 1; continue; }
    if (mh > hi) { b = m - 1; continue; }
    const ml = loArr[m];
    if (ml < lo) { a = m + 1; continue; }
    if (ml > lo) { b = m - 1; continue; }
    return m;
  }
  return -1;
}

// Split a (≤16-char) hex H3 index into hi/lo 32-bit halves without BigInt.
function splitH3(c) {
  const lo = parseInt(c.slice(-8), 16);
  const hi = c.length > 8 ? parseInt(c.slice(0, -8), 16) : 0;
  return [hi, lo];
}

function popOf(c) {
  const [hi, lo] = splitH3(c);
  const i = indexOfCell(hi, lo);
  return i < 0 ? 0 : popArr[i];
}

// All H3 cells covering a GeoJSON Polygon/MultiPolygon feature.
export function queryCells(feature) {
  const g = feature.geometry;
  if (!g) return [];
  const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  let cells = [];
  for (const rings of polys) {
    // h3-js v4: isGeoJSON=true → coords are GeoJSON [lng, lat] rings (Turf's form).
    cells = cells.length ? cells.concat(polygonToCells(rings, RES, true)) : polygonToCells(rings, RES, true);
  }
  return cells;
}

// Sum population over a list of cells, reporting fractional progress.
export function sumCells(cells, onProgress) {
  const CHUNK = 50000;
  let total = 0;
  for (let i = 0; i < cells.length; i++) {
    total += popOf(cells[i]);
    if (onProgress && (i & (CHUNK - 1)) === 0) onProgress(i / cells.length);
  }
  onProgress?.(1);
  return total;
}

export function sumPopulationInPolygon(feature, onProgress) {
  return sumCells(queryCells(feature), onProgress);
}

// Populated cells within a [west, south, east, north] bbox — for showing the
// grid granularity in the current viewport. Returns h3 index strings.
export function populatedCellsInBbox([w, s, e, n]) {
  const ring = [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
  const cells = polygonToCells(ring, RES, true);
  const out = [];
  for (const c of cells) {
    const [hi, lo] = splitH3(c);
    if (indexOfCell(hi, lo) >= 0) out.push(c);
  }
  return out;
}
