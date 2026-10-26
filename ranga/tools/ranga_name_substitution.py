#!/usr/bin/env python3
"""Troca Chrome/Chromium/Helium por Ranga nos textos da interface (.grd, .grdp, .xtb)."""

import argparse
import multiprocessing
import re
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "helium-chromium" / "utils"))

import name_substitution as helium  # noqa: E402
import name_substitution_utils as util  # noqa: E402

RULES = [
    (r"(\w+) Root Program", r"\1_unreplace Root Program"),
    (r"(\w+) Web( S|s)tore", r"\1_unreplace Web Store"),
    (r"(\w+) Remote Desktop", r"\1_unreplace Remote Desktop"),
    (r"Helium ([Ss]ervices?)", r"Helium_unreplace \1"),
    (r"([Ss])ervi(ços?) do Helium", r"\1ervi\2 do Helium_unreplace"),
    (r"The Helium Authors", r"The Helium_unreplace Authors"),
    (r"imput|Imput", r"\g<0>_unreplace"),
    (r"(?:Google )?Chrom(e|ium)(?!\w)", r"Ranga"),
    (r"\bHelium\b(?!_unreplace)", r"Ranga"),
    (r"((?:Google )?Chrom(e|ium)|Helium)_unreplace", r"\1"),
    (r"_unreplace", r""),
]


def sanity():
    cases = [
        ("Google Chrome", "Ranga"),
        ("Chromium", "Ranga"),
        ("Helium", "Ranga"),
        ("Helium services", "Helium services"),
        ("Serviços do Helium", "Serviços do Helium"),
        ("O Helium usa os serviços do Helium", "O Ranga usa os serviços do Helium"),
        ("Chrome Web Store", "Chrome Web Store"),
        ("chrome://settings", "chrome://settings"),
        ("The Helium Authors", "The Helium Authors"),
        ("Welcome to Helium!", "Welcome to Ranga!"),
    ]
    for source, expected in cases:
        result, _ = util.replace_text(source)
        assert result == expected, f"{source!r} -> {result!r}, esperado {expected!r}"


def replace_xtb_translation(msg, fp_map):
    changed = util.replace_grit_message(msg)
    if msg.get("id") in fp_map:
        msg.set("id", fp_map[msg.get("id")])
        return True
    return changed


def keep_headers(tree, backup):
    with tarfile.open(backup, "r:gz") as tar:
        for member in tar.getmembers():
            original = tar.extractfile(member).read().decode("utf-8")
            path = tree / member.name
            text = path.read_text(encoding="utf-8")
            if text.startswith("<?xml") and not original.startswith("<?xml"):
                path.write_text(text.split("\n", 1)[1], encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--sub", action="store_true")
    group.add_argument("--unsub", action="store_true")
    parser.add_argument("--backup-path", type=Path, required=True)
    parser.add_argument("-t", type=Path, required=True)
    args = parser.parse_args()

    multiprocessing.set_start_method("fork")
    util.REPLACEMENT_REGEXES = [(re.compile(a), b) for a, b in RULES]
    util.replace_xtb_translation = replace_xtb_translation
    sanity()
    if not (args.t / "OWNERS").exists():
        raise SystemExit("pasta do código do Chromium errada")
    if args.unsub:
        helium.do_unsubstitution(args.t, args.backup_path)
    else:
        if args.backup_path.exists():
            raise SystemExit(f"{args.backup_path} já existe: rode --unsub antes")
        helium.do_substitution(args.t, args.backup_path, None, False)
        keep_headers(args.t, args.backup_path)


if __name__ == "__main__":
    main()
