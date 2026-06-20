#!/usr/bin/env python3
"""Build the committed population grid for the Area-population tool.

Downloads Kontur's 3 km (H3 res 6) global population GeoPackage, extracts just
the (h3, population) pairs, and writes a compact, sorted binary the browser can
load once and query instantly — no per-request network, no API.

Binary format (little-endian), gzipped:
    magic   "KPG1"      4 bytes
    res     uint32      H3 resolution (6)
    count   uint32      number of cells N
    hi[N]   uint32      high 32 bits of each H3 index (sorted ascending by index)
    lo[N]   uint32      low  32 bits
    pop[N]  float32     population in that hexagon

Run from anywhere:  python3 scripts/build-grid.py
"""
import gzip
import os
import sqlite3
import struct
import sys
import urllib.request

import numpy as np

SRC_URL = (
    "https://geodata-eu-central-1-kontur-public.s3.eu-central-1.amazonaws.com/"
    "kontur_datasets/kontur_population_20231101_r6.gpkg.gz"
)
RES = 6

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(TOOL))
CACHE = os.path.join(HERE, ".cache")
GPKG = os.path.join(CACHE, "kontur_r6.gpkg")

# Two output copies: the shipped one (committed, served on GitHub Pages) and a
# dev copy under public/ (git-ignored) so the Vite dev server can serve it too.
#
# NOTE: the file holds gzipped bytes but is deliberately NOT named .gz — static
# hosts (Vite dev, GitHub Pages) treat a .gz extension inconsistently (some add
# Content-Encoding: gzip and auto-decompress, some don't). With a plain .bin name
# the bytes are always delivered as-is and we gunzip them ourselves in grid.js.
OUT_SHIP = os.path.join(REPO, "interactive", "area-population", "popgrid.bin")
OUT_DEV = os.path.join(TOOL, "public", "popgrid.bin")


def download():
    os.makedirs(CACHE, exist_ok=True)
    if os.path.exists(GPKG):
        print(f"• using cached {GPKG}")
        return
    gz = GPKG + ".gz"
    print(f"• downloading {SRC_URL}")
    urllib.request.urlretrieve(SRC_URL, gz)
    print("• decompressing …")
    with gzip.open(gz, "rb") as f_in, open(GPKG, "wb") as f_out:
        while chunk := f_in.read(1 << 20):
            f_out.write(chunk)
    os.remove(gz)


def build():
    print("• reading GeoPackage …")
    con = sqlite3.connect(GPKG)
    rows = con.execute("SELECT h3, population FROM population").fetchall()
    con.close()
    n = len(rows)
    print(f"• {n:,} hexagons")

    idx = np.fromiter((int(h, 16) for h, _ in rows), dtype=np.uint64, count=n)
    pop = np.fromiter((p for _, p in rows), dtype=np.float32, count=n)

    order = np.argsort(idx, kind="stable")
    idx = idx[order]
    pop = pop[order]

    hi = (idx >> np.uint64(32)).astype("<u4")
    lo = (idx & np.uint64(0xFFFFFFFF)).astype("<u4")
    pop = pop.astype("<f4")

    header = b"KPG1" + struct.pack("<II", RES, n)
    raw = header + hi.tobytes() + lo.tobytes() + pop.tobytes()
    print(f"• raw {len(raw)/1e6:.1f} MB → gzipping")
    blob = gzip.compress(raw, compresslevel=9)
    print(f"• gzipped {len(blob)/1e6:.1f} MB; total population {pop.sum():,.0f}")

    for out in (OUT_SHIP, OUT_DEV):
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(blob)
        print(f"• wrote {out}")


if __name__ == "__main__":
    download()
    build()
    print("done.")
