import json
import os
import struct
import tempfile
import time
import unittest

import ranga_theme
import ranga_theme_host


class ToCss(unittest.TestCase):
    BASE = {
        "mode": "dark",
        "background": "#1b1f28",
        "lighter_background": "#262c3a",
        "foreground": "#c6ccdb",
        "muted": "#495262",
        "accent": "#71b1ec",
        "red": "#d8737a",
    }

    def test_maps_ciel_keys_to_kurobe(self):
        css = ranga_theme.to_css(dict(self.BASE, secondary="#90add3", tertiary="#b59ad4"))
        self.assertTrue(css.startswith(":root {"))
        self.assertIn("--k-color-bg: #1b1f28;", css)
        self.assertIn("--k-color-fg: #c6ccdb;", css)
        self.assertIn("--k-color-primary: #71b1ec;", css)
        self.assertIn("--k-color-on-primary: #0f1117;", css)
        self.assertIn("--k-color-secondary: #90add3;", css)
        self.assertIn("--k-color-tertiary: #b59ad4;", css)
        self.assertIn("--k-color-error: #d8737a;", css)
        self.assertIn("--k-color-on-error: #0f1117;", css)
        self.assertIn("color-scheme: dark;", css)

    def test_derives_secondary_and_tertiary_like_ciel(self):
        css = ranga_theme.to_css(self.BASE)
        self.assertIn(f"--k-color-secondary: {ranga_theme.mix('#71b1ec', '#c6ccdb', 0.45)};", css)
        self.assertIn(f"--k-color-tertiary: {ranga_theme.mix('#71b1ec', '#1b1f28', 0.25)};", css)

    def test_tertiary_falls_back_to_magenta(self):
        css = ranga_theme.to_css(dict(self.BASE, magenta="#b59ad4"))
        self.assertIn("--k-color-tertiary: #b59ad4;", css)

    def test_light_mode(self):
        css = ranga_theme.to_css(dict(self.BASE, mode="light", background="#fafafa", foreground="#111111"))
        self.assertIn("color-scheme: light;", css)

    def test_mix(self):
        self.assertEqual(ranga_theme.mix("#000000", "#ffffff", 0.5), "#808080")

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
