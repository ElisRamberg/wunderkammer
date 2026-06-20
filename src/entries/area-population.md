---
title: Area population
type: interactive
status: prototype
tags: [maps, data, population, interactive]
date: 2026-06-20
summary: Draw any area on a map — polygon or freehand — and instantly see who lives inside.
visibility: public
embed: /interactive/area-population/
embedAspect: 4/3
---

Draw a region anywhere on Earth and find out how many people live inside it.
Trace a **polygon** or **freehand** a lasso the way you would in Photoshop — the
population, area, and density appear instantly.

There's no API behind this. The whole world's population — [Kontur](https://www.kontur.io/portfolio/population-dataset/)'s
2023 dataset, two million 3&nbsp;km hexagons — is packed into a 4.7&nbsp;MB file
the page loads once, then every query is answered **right in your browser** by
summing the hexagons your shape covers. So it's instant, works offline, and has
no size limit: a neighbourhood or a whole continent come back just as fast.

The trade-off for that speed is resolution — at 3&nbsp;km hexagons, areas smaller
than a few square kilometres get coarse. Plenty sharp for cities, regions, and
countries.

It's a map app, so it wants room to breathe — **open it full-screen** (link above
the frame) for the real thing; the embed here is just a peek.
