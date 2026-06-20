// ── Population grid worker ───────────────────────────────────────────────────
// Runs all the heavy work off the main thread so the map stays smooth and we can
// stream a real progress bar. Loads the grid once, then answers:
//   • query     — sum population in a polygon (+ progress, + selected cells)
//   • cellsInView — populated cells in a bbox (to show grid granularity)

import { loadGrid, queryCells, sumCells, populatedCellsInBbox } from "./grid.js";

// Above this, we don't ship the selected cells back for outlining — at that
// scale the 3 km granularity is irrelevant and drawing them would be heavy.
const RENDER_MAX = 8000;

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await loadGrid(msg.url);
      self.postMessage({ type: "ready" });
      return;
    }

    if (msg.type === "query") {
      const { id, feature } = msg;
      const cells = queryCells(feature);
      const population = sumCells(cells, (frac) =>
        self.postMessage({ type: "progress", id, frac }),
      );
      self.postMessage({
        type: "result",
        id,
        population,
        cellCount: cells.length,
        cells: cells.length <= RENDER_MAX ? cells : null,
      });
      return;
    }

    if (msg.type === "cellsInView") {
      const { id, bbox } = msg;
      const cells = populatedCellsInBbox(bbox);
      self.postMessage({ type: "view", id, cells: cells.length <= 6000 ? cells : null });
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", id: msg.id, message: String(err?.message || err) });
  }
};
