---
title: A video log, hosted elsewhere
type: video
status: working
tags: [video, demo]
date: 2026-06-14
summary: How an externally-hosted video gets embedded without bloating the repo.
visibility: public
# Paste the provider's EMBED url here (not the normal watch/share url):
#   YouTube:  https://www.youtube.com/embed/VIDEO_ID
#   Vimeo:    https://player.vimeo.com/video/VIDEO_ID
video: https://www.youtube.com/embed/aqz-KE-bpKQ
---

Videos live on YouTube or Vimeo and are pulled in with an embed — the file
itself never enters this repository, so the site stays small and fast and we
never hit a storage limit.

To add your own: upload the video to YouTube/Vimeo, copy its **embed** URL, and
drop it into the `video:` field in this entry's frontmatter. Everything below
the embed is just normal notes.
