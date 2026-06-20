import { defineConfig } from "vite";

// The built tool ships ONLY as static output committed to
// interactive/area-population/. Eleventy passthrough-copies that folder
// verbatim into the GitHub Pages site at /interactive/area-population/.
//
// base: "./" → all asset URLs are relative, so they resolve correctly whether
// the site is served from the domain root (dev) or the /wunderkammer/ subpath
// (GitHub Pages project site). No PATH_PREFIX coupling needed here.
export default defineConfig({
  base: "./",
  build: {
    outDir: "../../interactive/area-population",
    // The committed population grid (popgrid.bin.gz) also lives in outDir, so we
    // must NOT wipe it on build. The `build` npm script removes the old hashed
    // assets/ folder beforehand instead.
    emptyOutDir: false,
  },
});
