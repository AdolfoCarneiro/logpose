import json
import os
import struct
import tempfile
import time
import unittest

import ranga_theme
import ranga_theme_host


class ToCss(unittest.TestCase):
    def test_maps_ciel_keys(self):
        css = ranga_theme.to_css({
            "background": "#1b1f28",
            "lighter_background": "#262c3a",
            "foreground": "#c6ccdb",
            "muted": "#495262",
            "accent": "#71b1ec",
        })
        self.assertIn("--ranga-bg: #1b1f28;", css)
        self.assertIn("--ranga-surface: #262c3a;", css)
        self.assertIn("--ranga-fg: #c6ccdb;", css)
        self.assertIn("--ranga-muted: #495262;", css)
        self.assertIn("--ranga-accent: #71b1ec;", css)
        self.assertIn("--ranga-on-accent: #0f1117;", css)
        self.assertTrue(css.startswith(":root {"))

    def test_on_color(self):
        self.assertEqual(ranga_theme.on_color("#ffffff"), "#0f1117")
        self.assertEqual(ranga_theme.on_color("#101010"), "#f5f7fb")

    def test_missing_key_raises(self):
        with self.assertRaises(KeyError):
            ranga_theme.to_css({"background": "#000000"})


class Host(unittest.TestCase):
    def test_encode(self):
        raw = ranga_theme_host.encode({"type": "theme", "css": "x"})
        size = struct.unpack("<I", raw[:4])[0]
        self.assertEqual(size, len(raw) - 4)
        self.assertEqual(json.loads(raw[4:]), {"type": "theme", "css": "x"})

    def test_missing_file_yields_nothing(self):
        path = os.path.join(tempfile.mkdtemp(), "theme.css")
        gen = ranga_theme_host.changes(path, 0.01)
        with open(path, "w") as f:
            f.write("a")
        self.assertEqual(next(gen), "a")

    def test_yields_on_change(self):
        path = os.path.join(tempfile.mkdtemp(), "theme.css")
        with open(path, "w") as f:
            f.write("a")
        gen = ranga_theme_host.changes(path, 0.01)
        self.assertEqual(next(gen), "a")
        time.sleep(0.02)
        with open(path, "w") as f:
            f.write("b")
        os.utime(path, (time.time() + 1, time.time() + 1))
        self.assertEqual(next(gen), "b")


if __name__ == "__main__":
    unittest.main()
