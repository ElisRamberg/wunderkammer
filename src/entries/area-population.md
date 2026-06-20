---
title: Free Form Population Meassurement Map
type: interactive
status: prototype
tags: [maps, data, population, interactive, geography, demography]
date: 2026-06-21
summary: Draw any area on a map, polygon or freehand, and instantly see how many people live inside (+population density)
visibility: public
embed: /interactive/area-population/
embedAspect: 16/9
---

Draw a region anywhere on Earth and find out how many people live inside it.
Trace a **polygon** or **freehand** (like the lasso tool in Photoshop). The
population, area, and density appear instantly.

There's no API behind this. The whole world's population, ([Kontur](https://www.kontur.io/portfolio/population-dataset/)'s
2023 dataset) two million 3km hexagons is packed into a 4.7MB file
the page loads once, then every query is answered **right in your browser** by
summing the hexagons your shape covers. So it's instant, works offline, and has
no size limit. Excpect some slowness when marking particularly large areas.

The trade-off for that speed is resolution. At 3km hexagons, areas smaller
than a few square kilometres get coarse. Plenty sharp for cities, regions, and
countries.

**Open it full-screen** (link above the frame) for the real thing.

**To do:**
- Enable more granular markings (400 meter hexagons?)
- Map customization options: the option to see population-density as a color overlay.
- Increase speed for better user experience.

**Ideas:**
- Give the user an area and they should guess the population. (Geoguessr-style point system)
- Reverse of the above: give the user a target population and they draw a shape. Possible variants with geographical/shape/other limitation.