# Wunderkammer — project memory for Claude Code

Anything worth remembering about the project goes here. Update as needed.

## What this is
A personal notebook website — "a notebook that can grow up". Low-friction to add
anything (project, experiment, writing, note, idea) in any format/scope. Cohesion
comes from a consistent outer frame (chrome); content underneath stays flexible.

## Stack & philosophy
- **Eleventy (11ty) 3.x**, ESM config, Nunjucks templates. Node 24.
- Eleventy ONLY assembles content into templates + auto-generates the feed and
  filter pages. It designs nothing. All design is hand-written HTML/CSS.
- Plain HTML + CSS. Markdown for entries. No build frameworks for the main site.
- Hosted free on GitHub Pages. No recurring cost.

## Commands
- `npm run dev` (or `npm start`) — dev server + live reload at http://localhost:8080/
- `npm run build` — one-off build into `_site/` (the build output; git-ignored).

## Hosting & deployment
- Repo: https://github.com/ElisRamberg/wunderkammer (public)
- Live site: https://elisramberg.github.io/wunderkammer/
- `.github/workflows/deploy.yml` auto-builds and publishes to GitHub Pages on
  every push to `main`. Just commit + push to ship changes — no manual steps.
- GitHub Pages serves this as a PROJECT site from the `/wunderkammer/` subpath,
  not the domain root. To make links work in both places, `eleventy.config.js`
  sets `pathPrefix` from a `PATH_PREFIX` env var (set only in the CI workflow;
  unset locally so dev server stays at `/`). Every absolute href/src in the
  templates is run through Eleventy's `url` filter so it picks up that prefix.
  **When adding new absolute links in templates, always wrap them in `| url`**
  (see base.njk, card.njk, entry.njk, tag.njk/type.njk for the pattern) —
  otherwise they'll silently break on the live site while still working locally.

## Structure
- `eleventy.config.js` — the only logic file. Defines passthrough copies and the
  `entries` / `entryTags` / `entryTypes` collections that drive feed + filters.
- `src/_data/site.js` — global site title, tagline, nav links.
- `src/_includes/base.njk` — the shared OUTER CHROME (nav/header/footer).
- `src/_includes/entry.njk` — single-entry page layout (badge, tags, embeds, body).
- `src/_includes/card.njk` — reusable card macro for all listings.
- `src/css/tokens.css` — THE design control panel (all colors/fonts/spacing/badges/cards).
- `src/css/style.css` — layout/chrome styles, built only from tokens.
- `src/index.njk` — homepage feed; auto-built from `collections.entries`, never hand-edited.
- `src/tags.njk` + `src/tag.njk` — /tags/ landing + per-tag pages.
- `src/types.njk` + `src/type.njk` — /types/ landing + per-type pages.
- `src/entries/` — all entries (markdown). `entries.json` auto-applies the layout.
- `interactive/<tool>/` — self-contained interactive tools (own stack/build),
  copied verbatim into the site and embedded via sandboxed iframe. Decoupled so a
  tool can never break the main build.

## Big interactive tools (with their own build step)
`terrain-experiment` is a no-build tool: its source IS its shipped file, so it
lives directly in `interactive/`. A serious tool (map app, bundler, framework)
must NOT keep its source/node_modules in `interactive/`, because Eleventy copies
that whole folder verbatim into production. Split it:
- `tools/<tool>/` — the actual dev PROJECT (own package.json, deps, src, dev
  server, bundler). Worked on independently; run its own `npm run dev`.
- `interactive/<tool>/` — ONLY the tool's BUILD OUTPUT. Point the tool's bundler
  to emit here (e.g. Vite `outDir: ../../interactive/<tool>/`). Commit this
  output; no GitHub Actions change needed (matches how we commit `_site`-style
  artifacts elsewhere — though `interactive/` output IS committed, unlike `_site`).
- `src/entries/<tool>.md` — the blog entry; `embed:` points at `/interactive/<tool>/`.
Invariant to preserve: **`interactive/` only ever holds shippable static files.**
Keep one tool in this repo's `tools/` for now; if it grows its own identity
(domain, backend, release cadence) split it to its own repo and just point the
entry's `embed`/full-screen link at wherever it's hosted. Needs a live backend?
GitHub Pages can't run one — host that piece separately (e.g. Cloudflare Worker)
and have the static frontend fetch from it; the blog side stays unchanged.

## Two ways a tool is presented (both stay linked to the notebook)
1. **Embedded preview** — sandboxed iframe inside the notebook chrome, sized to
   the entry. Good for small demos seen in-context in the feed.
2. **Detached full-bleed** — the tool's own URL (`/interactive/<tool>/`), opened
   via entry.njk's "Open full-screen ↗" link. No blog chrome, no shared
   background — it feels like its own standalone app, yet is still hosted under
   the same site and reached only through its notebook entry. This is the
   intended path for big tools (a map app shouldn't live in a small window) and
   is the clearest expression of "a notebook that can grow up": an entry can
   graduate into something that feels like its own product while staying
   anchored in the notebook.

## Entry frontmatter (intentionally loose — extend any time, no restructuring)
```
title:        # required
type:         # loose label: note, writing, video, interactive, code, … (not a fixed list)
status:       # idea | prototype | working | polished  (drives the badge color)
tags: []      # loose list; auto-generates /tags/<tag>/ pages
date:         # YYYY-MM-DD; feed is newest-first
summary:      # optional one-line blurb shown on the card
visibility:   # public (default) | private
embed:        # (interactive) path to a tool, e.g. /interactive/<tool>/
embedAspect:  # optional, e.g. 16/9 or 3/4
video:        # external EMBED url (youtube.com/embed/ID or player.vimeo.com/video/ID)
```
Adding a NEW frontmatter field requires no scaffolding changes — just read it in a
template where you want it. type/tags/status are metadata, NOT folder structure.

## visibility semantics (important)
`private` only HIDES an entry from the feed, nav, and tag/type listings. It does
NOT make the page access-controlled — the page is still built and reachable by its
direct URL on a static host. Treat private as "unlisted". No secrets in entries.

## Adding content (quick reference)
- New text entry: add a `.md` file in `src/entries/` with the frontmatter above.
- New interactive entry: copy `interactive/terrain-experiment/` → rename → swap code;
  copy `src/entries/terrain-experiment.md` → update `embed:` path.
- New video entry: add a `.md` with a `video:` embed URL (file never committed).

## Not done yet (future steps)
- Custom domain (currently on the default github.io subdomain).
