# Wunderkammer

A personal notebook website — a place to drop coding projects, visual/interactive
experiments, writing, and miscellaneous ideas, even when they vary wildly in
format, scope, or subject.

The guiding idea is **"a notebook that can grow up"**: low friction to add
something now (it doesn't need to be finished or polished), with the option to
evolve into something more serious later without a rewrite. Cohesion comes from a
consistent outer frame (nav, typography, cards, status badges); the content
underneath stays flexible.

Built with [Eleventy](https://www.11ty.dev/), plain HTML/CSS, and Markdown. No
drag-and-drop builders, no client-side framework for the main site.

## Running it locally

```bash
npm install      # first time only
npm run dev       # start the dev server with live reload
```

Then open **http://localhost:8080/**. Saving any file reloads the browser
automatically.

```bash
npm run build     # one-off production build into _site/ (git-ignored)
```

## Adding content

Create a new Markdown file in [src/entries/](src/entries/). It appears on the
homepage automatically — nothing else to wire up. Frontmatter at the top of the
file:

```yaml
---
title:        # required
type:         # loose label: note, writing, video, interactive, code, … (not a fixed list)
status:       # idea | prototype | working | polished — picks the badge color
tags: []      # loose list; each tag gets an auto-generated /tags/<tag>/ page
date:         # YYYY-MM-DD — the feed is newest-first
summary:      # optional one-line blurb shown on the card
visibility:   # public (default) or private — see note below
---
```

You can add new frontmatter fields any time without restructuring anything —
`type`, `tags`, and `status` are just metadata, not folder structure.

**`visibility: private`** only hides an entry from the homepage feed and the tag/type
listing pages. It does **not** make the page access-controlled — on a static
site, the page is still built and reachable by its direct URL. Treat it as
"unlisted," not secure.

### Adding an interactive experiment

Interactive tools live in their own self-contained folder under
[interactive/](interactive/), each with its own stack and build step, fully
decoupled from Eleventy. They get pulled into the site via a sandboxed `<iframe>`
plus a small Markdown entry so they still show up in the feed.

To add one:
1. Copy [interactive/terrain-experiment/](interactive/terrain-experiment/), rename
   the folder, and replace its code with your own.
2. Copy [src/entries/terrain-experiment.md](src/entries/terrain-experiment.md),
   rename it, and update its `embed:` path to point at your new folder.

### Adding a video

Videos are hosted externally (YouTube/Vimeo) and embedded — never committed to
the repo. Set the `video:` frontmatter field to the provider's **embed** URL
(e.g. `https://www.youtube.com/embed/VIDEO_ID`). See
[src/entries/a-video.md](src/entries/a-video.md) for a working example.

## Project structure

```
eleventy.config.js       Eleventy wiring: passthrough copies + collections
src/
  _data/site.js           Site title, tagline, nav links
  _includes/
    base.njk              Shared outer chrome (nav/header/footer)
    entry.njk             Single-entry page layout (badge, tags, embeds)
    card.njk              Reusable card used in the feed and filter pages
  css/
    tokens.css             The single visual control panel (colors, fonts, spacing, badges)
    style.css               Layout/chrome styles, built only from tokens
  index.njk                Homepage feed — builds itself, never hand-edited
  tags.njk / tag.njk        /tags/ landing page + auto-generated per-tag pages
  types.njk / type.njk      /types/ landing page + auto-generated per-type pages
  entries/                  All entries (Markdown + interactive tool metadata)
interactive/<tool>/         Self-contained interactive tools, embedded via iframe
```

To restyle the whole site, edit `src/css/tokens.css` — it's the only file you
should need to touch for a visual tweak.

## Status

Local development is fully set up. Git/deployment (Cloudflare Pages or GitHub
Pages) is a deliberately separate next step, not yet done.
