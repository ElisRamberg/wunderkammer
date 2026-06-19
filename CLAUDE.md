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
- Free static hosting later (Cloudflare Pages / GitHub Pages). No recurring cost.

## Commands
- `npm run dev` (or `npm start`) — dev server + live reload at http://localhost:8080/
- `npm run build` — one-off build into `_site/` (the build output; git-ignored).

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
- GitHub repo + deployment (Cloudflare Pages / GitHub Pages) — deliberately deferred.
