#!/usr/bin/env python3
"""Põe o ícone do Log Pose (logpose/branding) no lugar dos logos do Chromium/Helium."""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRANDING = ROOT / "logpose" / "branding"

PNG_LOGOS = [
    "chrome/app/theme/chromium/product_logo_16.png",
    "chrome/app/theme/chromium/product_logo_24.png",
    "chrome/app/theme/chromium/product_logo_48.png",
    "chrome/app/theme/chromium/product_logo_64.png",
    "chrome/app/theme/chromium/product_logo_128.png",
    "chrome/app/theme/chromium/product_logo_256.png",
    "chrome/app/theme/chromium/linux/product_logo_24.png",
    "chrome/app/theme/chromium/linux/product_logo_48.png",
    "chrome/app/theme/chromium/linux/product_logo_64.png",
    "chrome/app/theme/chromium/linux/product_logo_128.png",
    "chrome/app/theme/chromium/linux/product_logo_256.png",
    "chrome/app/theme/default_100_percent/chromium/product_logo_16.png",
    "chrome/app/theme/default_100_percent/chromium/product_logo_32.png",
    "chrome/app/theme/default_100_percent/chromium/linux/product_logo_16.png",
    "chrome/app/theme/default_100_percent/chromium/linux/product_logo_32.png",
    "chrome/app/theme/default_200_percent/chromium/product_logo_16.png",
    "chrome/app/theme/default_200_percent/chromium/product_logo_32.png",
    "components/resources/default_100_percent/chromium/product_logo.png",
    "components/resources/default_200_percent/chromium/product_logo.png",
]

MONO_LOGOS = [
    "chrome/app/theme/chromium/product_logo_22_mono.png",
    "components/resources/default_100_percent/chromium/product_logo_white.png",
    "components/resources/default_200_percent/chromium/product_logo_white.png",
]


def render(svg, target):
    size = subprocess.run(["magick", "identify", "-format", "%w %h", str(target)], check=True, capture_output=True, text=True).stdout
    width, height = size.split()
    subprocess.run(["rsvg-convert", "-w", height, "-h", height, "-o", str(target), str(svg)], check=True)
    if width != height:
        subprocess.run(["magick", str(target), "-background", "none", "-gravity", "west", "-extent", f"{width}x{height}", str(target)], check=True)


def main(src):
    if not (src / "OWNERS").exists():
        raise SystemExit("pasta do código do Chromium errada")
    for path in PNG_LOGOS:
        render(BRANDING / "icon.svg", src / path)
    for path in MONO_LOGOS:
        render(BRANDING / "icon-mono.svg", src / path)
    shutil.copy(BRANDING / "icon.svg", src / "chrome/app/theme/chromium/product_logo.svg")
    print(f"{len(PNG_LOGOS) + len(MONO_LOGOS) + 1} logos do Log Pose aplicados")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
