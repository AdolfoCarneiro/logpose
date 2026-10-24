import os
import sys
import tomllib


def on_color(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return "#0f1117" if luminance > 0.5 else "#f5f7fb"


def to_css(colors):
    values = {
        "bg": colors["background"],
        "surface": colors["lighter_background"],
        "fg": colors["foreground"],
        "muted": colors["muted"],
        "accent": colors["accent"],
    }
    values["on-accent"] = on_color(values["accent"])
    lines = "".join(f"  --ranga-{k}: {v};\n" for k, v in values.items())
    return ":root {\n" + lines + "}\n"


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
