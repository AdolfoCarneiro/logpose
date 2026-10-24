#!/usr/bin/env python3
import json
import os
import struct
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ranga_theme

STATE = os.path.join(os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "ranga")
THEME = os.path.join(STATE, "theme.css")
COLORS = os.path.join(os.environ.get("XDG_STATE_HOME") or os.path.expanduser("~/.local/state"), "ciel", "theme", "colors.toml")


def encode(obj):
    data = json.dumps(obj).encode("utf-8")
    return struct.pack("<I", len(data)) + data


def decode(stream):
    header = stream.read(4)
    if len(header) < 4:
        return None
    size = struct.unpack("<I", header)[0]
    return json.loads(stream.read(size))


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


def handle(message, colors, theme):
    if message.get("type") != "set-opacity":
        return
    value = max(0, min(100, int(message.get("value", ranga_theme.DEFAULT_OPACITY))))
    out = os.path.dirname(theme)
    os.makedirs(out, exist_ok=True)
    ranga_theme.write_atomic(os.path.join(out, "material-opacity"), f"{value}\n")
    ranga_theme.main(colors, theme)


def listen():
    stdin = sys.stdin.buffer
    while (message := decode(stdin)) is not None:
        try:
            handle(message, COLORS, THEME)
        except (OSError, ValueError, KeyError):
            pass
    os._exit(0)


def main():
    threading.Thread(target=listen, daemon=True).start()
    out = sys.stdout.buffer
    for css in changes(THEME, 0.2):
        out.write(encode({"type": "theme", "css": css}))
        out.flush()


if __name__ == "__main__":
    main()
