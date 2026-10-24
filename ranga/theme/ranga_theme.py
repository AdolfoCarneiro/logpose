import os
import sys
import tomllib


def _rgb(hex_color):
    return [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]


def mix(a, b, t):
    return "#" + "".join(f"{round(x * (1 - t) + y * t):02x}" for x, y in zip(_rgb(a), _rgb(b)))


def on_color(hex_color):
    r, g, b = (c / 255 for c in _rgb(hex_color))
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#0f1117" if luminance > 0.5 else "#f5f7fb"


def to_css(colors):
    bg = colors["background"]
    fg = colors["foreground"]
    primary = colors["accent"]
    error = colors.get("red", colors.get("urgent", "#d8737a"))
    secondary = colors.get("secondary") or mix(primary, fg, 0.45)
    tertiary = colors.get("tertiary") or colors.get("magenta") or mix(primary, bg, 0.25)
    dark = colors.get("mode", "dark") != "light"
    values = {
        "bg": bg,
        "fg": fg,
        "primary": primary,
        "on-primary": on_color(primary),
        "secondary": secondary,
        "tertiary": tertiary,
        "error": error,
        "on-error": on_color(error),
    }
    lines = "".join(f"  --k-color-{k}: {v};\n" for k, v in values.items())
    scheme = f"  color-scheme: {'dark' if dark else 'light'};\n"
    return ":root {\n" + lines + scheme + "}\n"


def main(src, dest):
    with open(src, "rb") as f:
        css = to_css(tomllib.load(f))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".tmp"
    with open(tmp, "w") as f:
        f.write(css)
    os.replace(tmp, dest)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
