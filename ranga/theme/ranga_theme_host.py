#!/usr/bin/env python3
import json
import os
import struct
import sys
import time

THEME = os.path.expanduser("~/.local/state/ranga/theme.css")


def encode(obj):
    data = json.dumps(obj).encode("utf-8")
    return struct.pack("<I", len(data)) + data


def changes(path, interval):
    last = None
    while True:
        try:
            mtime = os.stat(path).st_mtime_ns
        except FileNotFoundError:
            mtime = None
        if mtime is not None and mtime != last:
            last = mtime
            with open(path) as f:
                yield f.read()
        else:
            time.sleep(interval)


def main():
    out = sys.stdout.buffer
    for css in changes(THEME, 0.2):
        out.write(encode({"type": "theme", "css": css}))
        out.flush()


if __name__ == "__main__":
    main()
