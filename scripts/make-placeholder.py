#!/usr/bin/env python3
"""Generate example/photo.png: a neutral silhouette for the fictional example CV.

A drawn placeholder rather than a stock photo, so the repository holds no image
of any real person. Standard library only. Run once; the output is committed.

    python3 scripts/make-placeholder.py example/photo.png
"""

import struct
import sys
import zlib

SIZE = 480
BACKGROUND = (0xDD, 0xE8, 0xE6)
FIGURE = (0x8A, 0xA6, 0xA2)


def pixel(x, y):
    cx = SIZE / 2
    # Head: a circle in the upper middle.
    if (x - cx) ** 2 + (y - SIZE * 0.38) ** 2 <= (SIZE * 0.17) ** 2:
        return FIGURE
    # Shoulders: the top half of a wide ellipse rising from the bottom edge.
    if y >= SIZE * 0.62 and ((x - cx) / (SIZE * 0.36)) ** 2 + ((y - SIZE * 1.02) / (SIZE * 0.42)) ** 2 <= 1:
        return FIGURE
    return BACKGROUND


def png(width, height, rows):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "example/photo.png"
    rows = [[pixel(x, y) for x in range(SIZE)] for y in range(SIZE)]
    with open(out, "wb") as f:
        f.write(png(SIZE, SIZE, rows))
    print(out)
