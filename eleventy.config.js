// ─────────────────────────────────────────────────────────────────────────
//  Eleventy configuration — the only "logic" file in the project.
//
//  Eleventy's job here is deliberately small: assemble content into templates
//  and auto-generate the homepage feed + filter pages. It designs nothing.
//  All visual design lives in plain HTML/CSS under src/.
// ─────────────────────────────────────────────────────────────────────────

export default function (eleventyConfig) {
  // ── Copy files into the built site untouched ──────────────────────────
  // CSS is hand-written; Eleventy should just copy it across as-is.
  eleventyConfig.addPassthroughCopy({ "src/css": "css" });
  // Hand-written vanilla JS (e.g. the homepage filter sidebar) — copied as-is.
  eleventyConfig.addPassthroughCopy({ "src/js": "js" });

  // Interactive tools live in their OWN top-level folder, fully decoupled
  // from Eleventy (each has its own stack / build step). We copy the whole
  // folder verbatim into the site, then embed each one via a sandboxed
  // iframe from a normal entry page. This means a tool can never break the
  // main site build.
  eleventyConfig.addPassthroughCopy({ interactive: "interactive" });

  // Let the browser live-reload when an interactive tool's files change too.
  eleventyConfig.addWatchTarget("interactive/");

  // ── Collections: the auto-generated lists that drive the site ─────────
  // A collection is just an array of pages Eleventy hands to our templates.
  // The homepage feed and the filter pages are built entirely from these,
  // so you never hand-edit any list of entries.

  // Helper: is an entry visible in listings?
  // NOTE: visibility only HIDES an entry from feeds / nav / filter pages.
  // It does NOT make the page private or access-controlled — a static page
  // is still reachable by its direct URL. Treat "private" as "unlisted".
  const isPublic = (entry) =>
    (entry.data.visibility || "public") !== "private";

  // Every entry, newest first, excluding anything marked private.
  // Built by globbing the entries folder, so adding a new file = done.
  eleventyConfig.addCollection("entries", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/entries/**/*.md")
      .filter(isPublic)
      .sort((a, b) => b.date - a.date)
  );

  // The set of unique tags across all public entries (for /tags/ pages).
  // Tags are loose, user-defined metadata — nothing is hardcoded here.
  eleventyConfig.addCollection("entryTags", (collectionApi) => {
    const tags = new Set();
    collectionApi
      .getFilteredByGlob("src/entries/**/*.md")
      .filter(isPublic)
      .forEach((entry) => (entry.data.tags || []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  });

  // The set of unique types across all public entries (for /types/ pages).
  eleventyConfig.addCollection("entryTypes", (collectionApi) => {
    const types = new Set();
    collectionApi
      .getFilteredByGlob("src/entries/**/*.md")
      .filter(isPublic)
      .forEach((entry) => entry.data.type && types.add(entry.data.type));
    return [...types].sort();
  });

  // ── Small display helpers usable inside templates ─────────────────────
  // Human-friendly date, e.g. "19 Jun 2026".
  eleventyConfig.addFilter("readableDate", (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  });

  // ── Folder layout ─────────────────────────────────────────────────────
  return {
    // GitHub Pages serves this site from /wunderkammer/, not the domain
    // root. The build workflow sets PATH_PREFIX for that; local dev leaves
    // it unset so http://localhost:8080/ keeps working at the root. Every
    // absolute link in the templates goes through the `url` filter, which
    // applies this prefix automatically.
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes", // layouts + partials
      data: "_data", // global data files
    },
    // Let .md files contain Nunjucks template syntax too.
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
