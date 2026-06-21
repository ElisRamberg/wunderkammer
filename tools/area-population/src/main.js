import maplibregl from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawFreehandMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { union, featureCollection, area as turfArea } from "@turf/turf";
import { cellToBoundary } from "h3-js";

import { formatInt, formatNum, formatHuman } from "./stats.js";

// Below this zoom the 3 km hexagons are too small to matter; we only outline the
// grid in the viewport once you're zoomed in enough for it to be meaningful.
const GRID_ZOOM = 9;

// map.getBounds() can return a box wider than a real world (e.g. west < -180)
// once you zoom out past one world-width, since no minZoom is set. H3's
// polygonToCells expects a simple, non-self-intersecting ring — feeding it an
// out-of-range rectangle silently returns zero cells, which is why the density
// overlay went fully blank at max zoom-out. Clamp to the valid lng/lat range
// (and to the Mercator-safe latitude band) before every worker query.
function clampBounds(b) {
  return [
    Math.max(b.getWest(), -180),
    Math.max(b.getSouth(), -85),
    Math.min(b.getEast(), 180),
    Math.min(b.getNorth(), 85),
  ];
}

// ── Density overlay tuning — one live knob, read from the URL ───────────────
// Tune by appending ?opacity=… to the tool's URL and just reload — NO rebuild
// needed. (Editing the constant below only takes effect after `npm run build`,
// because the notebook embeds the BUILT output.)
//
// The overlay is a FILL layer: every finest-resolution H3 hexagon (res 6, ~3 km)
// is drawn as a real polygon, coloured straight from that cell's own people/km².
// The same small hexagons are used at every zoom — MapLibre culls the single
// whole-world FeatureCollection, so zooming out just reveals more of them rather
// than swapping to a coarser grid.
const params = new URLSearchParams(location.search);
const numParam = (name, fallback) => {
  const v = parseFloat(params.get(name));
  return Number.isFinite(v) ? v : fallback;
};
const OPACITY = numParam("opacity", 0.7);

// ── Map ──────────────────────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [12.57, 55.68],
  zoom: 4,
  maxZoom: 13,
  // Show a single world only: the population grid exists at real longitudes
  // (−180…180), so drawing in a repeated copy would count nothing. Disabling
  // world copies stops the horizontal repeat without a maxBounds — a maxBounds
  // spanning the full 360° of longitude triggers a MapLibre constraint bug that
  // locks the camera zoomed-in and unpannable, so we deliberately omit it.
  renderWorldCopies: false,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker(new URL("./grid-worker.js", import.meta.url), { type: "module" });
let gridReady = false;
let queryId = 0;
let viewId = 0;

worker.postMessage({ type: "load", url: new URL("popgrid.bin", document.baseURI).href });

worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === "ready") {
    gridReady = true;
    els.hint.textContent = HINTS[mode];
    if (getSelection()) runQuery();
    refreshGrid();
  } else if (m.type === "progress" && m.id === queryId) {
    setProgress(m.frac);
  } else if (m.type === "result" && m.id === queryId) {
    showResult(m);
  } else if (m.type === "view" && m.id === viewId) {
    renderGrid("grid-cells", m.cells);
  } else if (m.type === "error") {
    if (m.id === queryId) endBusy();
    els.status.textContent = m.message;
    els.status.classList.add("error");
  }
};

// ── State / DOM ────────────────────────────────────────────────────────────────
let mode = "polygon";
const $ = (id) => document.getElementById(id);
const els = {
  intro: $("intro"),
  results: $("results"),
  population: $("population"),
  exact: $("exact"),
  status: $("status"),
  area: $("area"),
  density: $("density"),
  hint: $("hint"),
  clear: $("clear"),
  progress: $("progress"),
  progressBar: $("progressBar"),
};

// Swap the story panel between its "asking" and "answering" states.
function showState(name) {
  const answering = name === "answer";
  els.intro.hidden = answering;
  els.results.hidden = !answering;
  els.clear.hidden = !answering;
}

els.hint.textContent = "Loading population data…";

// ── Terra Draw ──────────────────────────────────────────────────────────────────
const draw = new TerraDraw({
  adapter: new TerraDrawMapLibreGLAdapter({ map }),
  modes: [new TerraDrawPolygonMode(), new TerraDrawFreehandMode()],
});

map.on("load", () => {
  // Population-density overlay: a single pre-baked raster image (density.png,
  // generated offline by scripts/bake-density.mjs) coloured by people/km² on a
  // log scale — pale where sparse, deepening red where dense, transparent over
  // empty areas. One texture, constant at every zoom, featherlight to render
  // (no polygons, no per-move recompute). The image is in Web Mercator, so it
  // drops onto the standard mercator world quad with no warping.
  map.addSource("density", {
    type: "image",
    url: new URL("density.png", document.baseURI).href,
    coordinates: [
      [-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511],
    ],
  });
  map.addLayer({
    id: "density-heat",
    type: "raster",
    source: "density",
    paint: { "raster-opacity": OPACITY, "raster-fade-duration": 0 },
  });

  // Hex overlays: faint viewport grid + highlighted selection.
  map.addSource("grid-cells", { type: "geojson", data: featureCollection([]) });
  map.addLayer({
    id: "grid-cells-line",
    type: "line",
    source: "grid-cells",
    paint: { "line-color": "#e4572e", "line-opacity": 0.18, "line-width": 0.6 },
  });
  map.addSource("selected-cells", { type: "geojson", data: featureCollection([]) });
  map.addLayer({
    id: "selected-cells-fill",
    type: "fill",
    source: "selected-cells",
    paint: { "fill-color": "#e4572e", "fill-opacity": 0.28 },
  });
  map.addLayer({
    id: "selected-cells-line",
    type: "line",
    source: "selected-cells",
    paint: { "line-color": "#e4572e", "line-opacity": 0.75, "line-width": 1.2 },
  });

  draw.start();
  draw.setMode(mode);
});

map.on("moveend", () => {
  refreshGrid();
  renderSelection();
});

let debounceTimer = null;
draw.on("change", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runQuery, 250);
});

// ── Selection → worker ──────────────────────────────────────────────────────────
function getSelection() {
  const polys = draw
    .getSnapshot()
    .filter((f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon");
  if (!polys.length) return null;
  let merged = polys[0];
  for (let i = 1; i < polys.length; i++) {
    try {
      const u = union(featureCollection([merged, polys[i]]));
      if (u) merged = u;
    } catch {
      /* keep merged on union failure */
    }
  }
  return merged;
}

let busyTimer = null;
function runQuery() {
  const poly = getSelection();
  if (!poly) {
    showState("intro");
    renderGrid("selected-cells", []);
    return;
  }
  showState("answer");

  const km2 = turfArea(poly) / 1e6;
  els.area.textContent = `${formatNum(km2)} km²`;
  els._km2 = km2;

  if (!gridReady) {
    els.status.textContent = "Loading data…";
    return;
  }

  const id = ++queryId;
  // Only reveal the progress bar if the query is actually slow (avoids a flash
  // on the common instant case).
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => startBusy(), 150);
  worker.postMessage({ type: "query", id, feature: poly });
}

// Latest selection hexagons, kept so we can re-show/hide them as the user zooms.
let selectedCells = [];
function showResult(m) {
  endBusy();
  animateCount(els.population, m.population, formatHuman);
  els.exact.textContent =
    Number.isFinite(m.population) ? `${formatInt(m.population)} people` : "";
  els.density.textContent =
    els._km2 > 0 ? `${formatNum(m.population / els._km2)} /km²` : "—";
  els.status.textContent = "";
  els.status.classList.remove("error");
  selectedCells = m.cells || []; // null cells → area too large to outline
  renderSelection();
}

// Count the headline up to its final value so a fresh answer feels alive,
// like a number ticking into place in a published interactive.
let countRAF = null;
function animateCount(el, to, fmt) {
  cancelAnimationFrame(countRAF);
  if (!Number.isFinite(to)) {
    el.textContent = fmt(to);
    return;
  }
  const dur = 650;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = fmt(to * eased);
    if (t < 1) countRAF = requestAnimationFrame(tick);
  }
  countRAF = requestAnimationFrame(tick);
}

// The selection's hexagons are only meaningful when zoomed in enough to see them
// (same threshold as the faint viewport grid); below that we hide them.
function renderSelection() {
  if (!map.getSource("selected-cells")) return;
  renderGrid("selected-cells", map.getZoom() < GRID_ZOOM ? [] : selectedCells);
}

// ── Progress bar ────────────────────────────────────────────────────────────────
function startBusy() {
  els.progress.hidden = false;
  els.progress.classList.add("indeterminate");
  els.progressBar.style.width = "30%";
  els.status.textContent = "Counting…";
}
function setProgress(frac) {
  els.progress.hidden = false;
  els.progress.classList.remove("indeterminate");
  els.progressBar.style.width = `${Math.round(frac * 100)}%`;
}
function endBusy() {
  clearTimeout(busyTimer);
  els.progress.hidden = true;
  els.progress.classList.remove("indeterminate");
  els.progressBar.style.width = "0%";
}

// ── Hex overlays ────────────────────────────────────────────────────────────────
function cellsToFC(cells) {
  return featureCollection(
    (cells || []).map((c) => {
      const ring = cellToBoundary(c, true); // [[lng,lat], …]
      ring.push(ring[0]);
      return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
    }),
  );
}
function renderGrid(sourceId, cells) {
  map.getSource(sourceId)?.setData(cellsToFC(cells));
}

function refreshGrid() {
  if (!gridReady || !map.getSource("grid-cells")) return;
  if (map.getZoom() < GRID_ZOOM) {
    renderGrid("grid-cells", []);
    return;
  }
  worker.postMessage({
    type: "cellsInView",
    id: ++viewId,
    bbox: clampBounds(map.getBounds()),
  });
}

// ── Controls ─────────────────────────────────────────────────────────────────
const HINTS = {
  polygon: "Click to place vertices; double-click to close the shape.",
  freehand: "Press and drag to lasso an area.",
};
document.querySelectorAll(".mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll(".mode").forEach((b) => b.classList.toggle("is-active", b === btn));
    if (gridReady) els.hint.textContent = HINTS[mode];
    if (map.loaded()) draw.setMode(mode);
  });
});

els.clear.addEventListener("click", () => {
  draw.clear();
  queryId++;
  cancelAnimationFrame(countRAF);
  endBusy();
  showState("intro");
  selectedCells = [];
  renderGrid("selected-cells", []);
});
