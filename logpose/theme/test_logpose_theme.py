import json
import os
import struct
import tempfile
import time
import unittest

import logpose_theme
import logpose_theme_host


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
        css = logpose_theme.to_css(dict(self.BASE, secondary="#90add3", tertiary="#b59ad4"))
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
        css = logpose_theme.to_css(self.BASE)
        self.assertIn(f"--k-color-secondary: {logpose_theme.mix('#71b1ec', '#c6ccdb', 0.45)};", css)
        self.assertIn(f"--k-color-tertiary: {logpose_theme.mix('#71b1ec', '#1b1f28', 0.25)};", css)

    def test_tertiary_falls_back_to_magenta(self):
        css = logpose_theme.to_css(dict(self.BASE, magenta="#b59ad4"))
        self.assertIn("--k-color-tertiary: #b59ad4;", css)

    def test_light_mode(self):
        css = logpose_theme.to_css(dict(self.BASE, mode="light", background="#fafafa", foreground="#111111"))
        self.assertIn("color-scheme: light;", css)

    def test_mix(self):
        self.assertEqual(logpose_theme.mix("#000000", "#ffffff", 0.5), "#808080")

    def test_on_color(self):
        self.assertEqual(logpose_theme.on_color("#ffffff"), "#0f1117")
        self.assertEqual(logpose_theme.on_color("#101010"), "#f5f7fb")

    def test_missing_key_raises(self):
        with self.assertRaises(KeyError):
            logpose_theme.to_css({"background": "#000000"})


class Frame(unittest.TestCase):
    COLORS = {"background": "#1b1f28", "foreground": "#c6ccdb", "accent": "#71b1ec"}

    def test_frame_color_is_tinted_low_surface(self):
        low = logpose_theme.mix("#1b1f28", "#c6ccdb", 0.06)
        container = logpose_theme.mix("#1b1f28", "#71b1ec", 0.26)
        self.assertEqual(logpose_theme.frame_color(self.COLORS), logpose_theme.mix(low, container, 0.35))

    def test_css_exposes_frame(self):
        css = logpose_theme.to_css(self.COLORS)
        self.assertIn(f"--logpose-frame: {logpose_theme.frame_color(self.COLORS)};", css)

    def test_main_writes_theme_and_frame_files(self):
        d = tempfile.mkdtemp()
        src = os.path.join(d, "colors.toml")
        with open(src, "w") as f:
            f.write('background = "#1b1f28"\nforeground = "#c6ccdb"\naccent = "#71b1ec"\n')
        dest = os.path.join(d, "out", "theme.css")
        logpose_theme.main(src, dest)
        with open(os.path.join(d, "out", "frame-color")) as f:
            self.assertEqual(f.read(), logpose_theme.with_alpha(logpose_theme.frame_color(self.COLORS), logpose_theme.DEFAULT_OPACITY) + "\n")
        self.assertTrue(os.path.exists(dest))


class Palette(unittest.TestCase):
    COLORS = {"background": "#1b1f28", "foreground": "#c6ccdb", "accent": "#71b1ec"}

    def test_palette_mirrors_kurobe_tokens(self):
        lines = dict(line.split(" ", 1) for line in logpose_theme.palette(self.COLORS).splitlines())
        self.assertEqual(lines["scheme"], "dark")
        self.assertEqual(lines["surface"], "#1b1f28")
        self.assertEqual(lines["surface-container-high"], logpose_theme.mix("#1b1f28", "#c6ccdb", 0.14))
        self.assertEqual(lines["primary"], "#71b1ec")
        self.assertEqual(lines["primary-container"], logpose_theme.mix("#1b1f28", "#71b1ec", 0.26))
        self.assertEqual(lines["on-primary"], logpose_theme.on_color("#71b1ec"))

    def test_light_scheme(self):
        self.assertTrue(logpose_theme.palette({**self.COLORS, "mode": "light"}).startswith("scheme light\n"))

    def test_main_writes_palette(self):
        d = tempfile.mkdtemp()
        src = os.path.join(d, "colors.toml")
        with open(src, "w") as f:
            f.write('background = "#1b1f28"\nforeground = "#c6ccdb"\naccent = "#71b1ec"\n')
        logpose_theme.main(src, os.path.join(d, "out", "theme.css"))
        with open(os.path.join(d, "out", "palette")) as f:
            self.assertEqual(f.read(), logpose_theme.palette(self.COLORS))


class Opacity(unittest.TestCase):
    COLORS = {"background": "#1b1f28", "foreground": "#c6ccdb", "accent": "#71b1ec"}

    def test_with_alpha(self):
        self.assertEqual(logpose_theme.with_alpha("#2d2d1e", 100), "#2d2d1eff")
        self.assertEqual(logpose_theme.with_alpha("#2d2d1e", 0), "#2d2d1e00")
        self.assertEqual(logpose_theme.with_alpha("#2d2d1e", 85), "#2d2d1ed9")

    def test_read_opacity_defaults_and_clamps(self):
        d = tempfile.mkdtemp()
        self.assertEqual(logpose_theme.read_opacity(os.path.join(d, "nada")), logpose_theme.DEFAULT_OPACITY)
        p = os.path.join(d, "material-opacity")
        for raw, want in [("70\n", 70), ("150", 100), ("-3", 0), ("abc", logpose_theme.DEFAULT_OPACITY)]:
            with open(p, "w") as f:
                f.write(raw)
            self.assertEqual(logpose_theme.read_opacity(p), want)

    def test_main_applies_opacity(self):
        d = tempfile.mkdtemp()
        src = os.path.join(d, "colors.toml")
        with open(src, "w") as f:
            f.write('background = "#1b1f28"\nforeground = "#c6ccdb"\naccent = "#71b1ec"\n')
        out = os.path.join(d, "out")
        os.makedirs(out)
        with open(os.path.join(out, "material-opacity"), "w") as f:
            f.write("50")
        logpose_theme.main(src, os.path.join(out, "theme.css"))
        frame = logpose_theme.with_alpha(logpose_theme.frame_color(self.COLORS), 50)
        with open(os.path.join(out, "frame-color")) as f:
            self.assertEqual(f.read(), frame + "\n")
        with open(os.path.join(out, "theme.css")) as f:
            self.assertIn(f"--logpose-frame: {frame};", f.read())


class Host(unittest.TestCase):
    def test_encode(self):
        raw = logpose_theme_host.encode({"type": "theme", "css": "x"})
        size = struct.unpack("<I", raw[:4])[0]
        self.assertEqual(size, len(raw) - 4)
        self.assertEqual(json.loads(raw[4:]), {"type": "theme", "css": "x"})

    def test_missing_file_yields_nothing(self):
        path = os.path.join(tempfile.mkdtemp(), "theme.css")
        gen = logpose_theme_host.changes(path, 0.01)
        with open(path, "w") as f:
            f.write("a")
        self.assertEqual(next(gen), "a")

    def test_yields_on_change(self):
        path = os.path.join(tempfile.mkdtemp(), "theme.css")
        with open(path, "w") as f:
            f.write("a")
        gen = logpose_theme_host.changes(path, 0.01)
        self.assertEqual(next(gen), "a")
        time.sleep(0.02)
        with open(path, "w") as f:
            f.write("b")
        os.utime(path, (time.time() + 1, time.time() + 1))
        self.assertEqual(next(gen), "b")


if __name__ == "__main__":
    unittest.main()


class Font(unittest.TestCase):
    def test_reads_denden_font_with_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            colors = os.path.join(d, "colors.toml")
            self.assertIsNone(logpose_theme.read_font(colors))
            with open(os.path.join(d, "shell.toml"), "w") as f:
                f.write('[font]\nbase-size = 12\n')
            self.assertEqual(logpose_theme.read_font(colors), "Adwaita Sans")
            with open(os.path.join(d, "shell.toml"), "w") as f:
                f.write('[font]\nfamily = "Inter"\n')
            self.assertEqual(logpose_theme.read_font(colors), "Inter")

    def test_css_carries_font_only_when_given(self):
        self.assertNotIn("--k-type-family", logpose_theme.to_css(ToCss.BASE))
        css = logpose_theme.to_css(ToCss.BASE, font="Adwaita Sans")
        self.assertIn('--k-type-family: "Adwaita Sans", sans-serif;', css)


class ShellState(unittest.TestCase):
    def test_prefers_denden_then_ciel(self):
        with tempfile.TemporaryDirectory() as d:
            old = logpose_theme.STATE
            logpose_theme.STATE = d
            try:
                ciel = os.path.join(d, "ciel", "theme", "colors.toml")
                denden = os.path.join(d, "denden", "theme", "colors.toml")
                self.assertEqual(logpose_theme.shell_state("theme", "colors.toml"), denden)
                os.makedirs(os.path.dirname(ciel))
                open(ciel, "w").close()
                self.assertEqual(logpose_theme.shell_state("theme", "colors.toml"), ciel)
                os.makedirs(os.path.dirname(denden))
                open(denden, "w").close()
                self.assertEqual(logpose_theme.shell_state("theme", "colors.toml"), denden)
            finally:
                logpose_theme.STATE = old


class HostMessages(unittest.TestCase):
    def test_decode_reads_one_message(self):
        import io
        raw = logpose_theme_host.encode({"type": "set-opacity", "value": 70})
        self.assertEqual(logpose_theme_host.decode(io.BytesIO(raw)), {"type": "set-opacity", "value": 70})

    def test_decode_end_of_stream(self):
        import io
        self.assertIsNone(logpose_theme_host.decode(io.BytesIO(b"")))

    def test_set_opacity_writes_file_and_regenerates(self):
        d = tempfile.mkdtemp()
        colors = os.path.join(d, "colors.toml")
        with open(colors, "w") as f:
            f.write('background = "#1b1f28"\nforeground = "#c6ccdb"\naccent = "#71b1ec"\n')
        theme = os.path.join(d, "state", "theme.css")
        logpose_theme_host.handle({"type": "set-opacity", "value": 40}, colors, theme)
        with open(os.path.join(d, "state", "material-opacity")) as f:
            self.assertEqual(f.read(), "40\n")
        with open(os.path.join(d, "state", "frame-color")) as f:
            self.assertTrue(f.read().strip().endswith("66"))

    def test_handle_ignores_unknown_and_clamps(self):
        d = tempfile.mkdtemp()
        colors = os.path.join(d, "colors.toml")
        with open(colors, "w") as f:
            f.write('background = "#1b1f28"\nforeground = "#c6ccdb"\naccent = "#71b1ec"\n')
        theme = os.path.join(d, "state", "theme.css")
        logpose_theme_host.handle({"type": "outra-coisa"}, colors, theme)
        self.assertFalse(os.path.exists(os.path.join(d, "state", "material-opacity")))
        logpose_theme_host.handle({"type": "set-opacity", "value": 300}, colors, theme)
        with open(os.path.join(d, "state", "material-opacity")) as f:
            self.assertEqual(f.read(), "100\n")


class LogPoseWindowsTest(unittest.TestCase):
    def test_only_visible_logpose_windows_newest_first(self):
        monitors = [{"activeWorkspace": {"id": 1}, "specialWorkspace": {"id": 0}}]
        clients = [
            {"class": "logpose", "title": "Gmail - Log Pose", "at": [10, 20], "size": [800, 600], "focusHistoryID": 1, "workspace": {"id": 1}},
            {"class": "logpose", "title": "WhatsApp - Log Pose", "at": [820, 20], "size": [800, 600], "focusHistoryID": 0, "workspace": {"id": 1}},
            {"class": "logpose", "title": "Outro - Log Pose", "at": [0, 0], "size": [10, 10], "focusHistoryID": 2, "workspace": {"id": 3}},
            {"class": "kitty", "title": "zsh", "at": [0, 0], "size": [10, 10], "focusHistoryID": 3, "workspace": {"id": 1}},
        ]
        found = logpose_theme_host.logpose_windows({"x": 900, "y": 300}, clients, monitors)
        self.assertEqual((found["x"], found["y"]), (900, 300))
        self.assertEqual([w["title"] for w in found["windows"]], ["WhatsApp - Log Pose", "Gmail - Log Pose"])
        self.assertEqual(found["windows"][1], {"title": "Gmail - Log Pose", "x": 10, "y": 20, "width": 800, "height": 600, "focus": 1})
