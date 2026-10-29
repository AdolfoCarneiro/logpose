import os
import sys
import tomllib

DEFAULT_OPACITY = 85


def _rgb(hex_color):
    return [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]


def mix(a, b, t):
    return "#" + "".join(f"{round(x * (1 - t) + y * t):02x}" for x, y in zip(_rgb(a), _rgb(b)))


def on_color(hex_color):
    r, g, b = (c / 255 for c in _rgb(hex_color))
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#0f1117" if luminance > 0.5 else "#f5f7fb"


def with_alpha(hex_color, opacity):
    return f"{hex_color}{round(opacity * 255 / 100):02x}"


def read_opacity(path):
    try:
        with open(path) as f:
            value = int(f.read().strip())
    except (OSError, ValueError):
        return DEFAULT_OPACITY
    return max(0, min(100, value))


def frame_color(colors):
    bg = colors["background"]
    low = mix(bg, colors["foreground"], 0.06)
    container = mix(bg, colors["accent"], 0.26)
    return mix(low, container, 0.35)


def base(colors):
    bg = colors["background"]
    fg = colors["foreground"]
    primary = colors["accent"]
    error = colors.get("red", colors.get("urgent", "#d8737a"))
    return {
        "bg": bg,
        "fg": fg,
        "primary": primary,
        "on-primary": on_color(primary),
        "secondary": colors.get("secondary") or mix(primary, fg, 0.45),
        "tertiary": colors.get("tertiary") or colors.get("magenta") or mix(primary, bg, 0.25),
        "error": error,
        "on-error": on_color(error),
    }


def palette(colors):
    b = base(colors)
    bg, fg = b["bg"], b["fg"]
    values = {
        "surface": bg,
        "surface-container-low": mix(bg, fg, 0.06),
        "surface-container": mix(bg, fg, 0.10),
        "surface-container-high": mix(bg, fg, 0.14),
        "surface-container-highest": mix(bg, fg, 0.18),
        "on-surface": fg,
        "on-surface-variant": mix(fg, bg, 0.12),
        "outline": mix(bg, fg, 0.32),
        "outline-variant": mix(bg, fg, 0.16),
        "primary": b["primary"],
        "on-primary": b["on-primary"],
        "primary-container": mix(bg, b["primary"], 0.26),
        "on-primary-container": mix(fg, b["primary"], 0.18),
        "secondary": b["secondary"],
        "on-secondary": on_color(b["secondary"]),
        "secondary-container": mix(bg, b["secondary"], 0.30),
        "on-secondary-container": mix(fg, b["secondary"], 0.18),
        "tertiary": b["tertiary"],
        "on-tertiary": on_color(b["tertiary"]),
        "tertiary-container": mix(bg, b["tertiary"], 0.30),
        "on-tertiary-container": mix(fg, b["tertiary"], 0.18),
        "error": b["error"],
        "on-error": b["on-error"],
        "error-container": mix(bg, b["error"], 0.30),
        "on-error-container": mix(fg, b["error"], 0.18),
    }
    scheme = "light" if colors.get("mode", "dark") == "light" else "dark"
    return f"scheme {scheme}\n" + "".join(f"{k} {v}\n" for k, v in values.items())


def to_css(colors, opacity=None):
    values = base(colors)
    dark = colors.get("mode", "dark") != "light"
    lines = "".join(f"  --k-color-{k}: {v};\n" for k, v in values.items())
    frame_value = frame_color(colors) if opacity is None else with_alpha(frame_color(colors), opacity)
    frame = f"  --logpose-frame: {frame_value};\n"
    scheme = f"  color-scheme: {'dark' if dark else 'light'};\n"
    return ":root {\n" + lines + frame + scheme + "}\n"


def write_atomic(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)


def main(src, dest):
    with open(src, "rb") as f:
        colors = tomllib.load(f)
    out = os.path.dirname(dest)
    os.makedirs(out, exist_ok=True)
    opacity = read_opacity(os.path.join(out, "material-opacity"))
    write_atomic(dest, to_css(colors, opacity))
    write_atomic(os.path.join(out, "frame-color"), with_alpha(frame_color(colors), opacity) + "\n")
    write_atomic(os.path.join(out, "palette"), palette(colors))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
