---
title: Terrain experiment
type: interactive
status: prototype
tags: [canvas, generative, demo]
date: 2026-06-18
summary: Drifting contour lines that bend toward your cursor — a self-contained canvas toy.
visibility: public
# `embed` points at the self-contained tool copied into the built site.
# The entry layout renders it inside a SANDBOXED iframe, so the tool is
# walled off from the rest of the site.
embed: /interactive/terrain-experiment/
# Optional: override the embed's shape. Default is 16/9.
embedAspect: 16/9
---

This is an **interactive entry**. The actual experiment lives in its own folder
at `interactive/terrain-experiment/` with its own (here, trivial) stack, and is
pulled in above through a sandboxed iframe.

That separation is deliberate: the tool can use any technology and its own build
step without any risk of breaking the main notebook. Everything you see below
the frame is just ordinary entry notes.

To make your own: copy the `interactive/terrain-experiment/` folder, rename it,
swap in your code, then copy this file and update the `embed:` path.
