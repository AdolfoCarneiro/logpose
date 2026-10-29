#!/usr/bin/env python3
"""Põe nos .xtb pt-BR as traduções das strings do Helium e do Log Pose (logpose/translations)."""

import json
import re
import sys
import xml.etree.ElementTree as xml
from collections import defaultdict
from functools import cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "helium-chromium" / "utils"))
sys.path.insert(0, str(ROOT / "logpose" / "tools"))

import i18n_apply as helium  # noqa: E402
import name_substitution_utils as util  # noqa: E402
from logpose_name_substitution import RULES  # noqa: E402

LANG = "pt-BR"
LOGPOSE = ROOT / "logpose" / "translations" / f"{LANG}.json"
PLACEHOLDER = re.compile(r'<ph name="([^"]+)"\s*/>')
GUIA = re.compile(r"\b(?:(\w+) )?([Gg])uia(s?)\b")
GUIDE = {"o", "os", "um", "uns", "do", "dos", "no", "nos", "ao", "aos", "pelo", "pelos", "este", "esse", "seu", "seus"}


@cache
def parse_grd(path):
    from grit import grd_reader
    from grit.node import message

    root = grd_reader.Parse(str(path), skip_validation_checks=True)
    messages = defaultdict(list)
    xtb = None
    for node in root.Preorder():
        if isinstance(node, message.MessageNode) and node.IsTranslateable():
            messages[node.attrs["name"]].append(node.GetCliques()[0].GetMessage())
        elif node.name == "file" and node.attrs.get("lang") == LANG:
            xtb = path.parent / node.attrs["path"]
    if xtb is None:
        raise SystemExit(f"{path}: sem .xtb {LANG}")
    return messages, xtb


def xtb_text(text):
    text = util.replace_text(helium.to_xtb_message(text))[0]
    return PLACEHOLDER.sub(r'<ph name="\1" />', text)


def check(grd, name, message, text):
    xml.fromstring(f"<t>{text}</t>")
    expected = {ph.GetPresentation() for ph in message.GetPlaceholders()}
    found = set(PLACEHOLDER.findall(text))
    if expected != found:
        raise SystemExit(f"{grd} {name}: placeholders {sorted(found)}, esperado {sorted(expected)}")


def helium_translations(src):
    source = json.loads(helium.SOURCE_PATH.read_text(encoding="utf-8"))
    translated = json.loads((helium.TRANSLATIONS_DIR / f"{LANG}.json").read_text(encoding="utf-8"))
    by_key = {(t["name"], t["source"]): t["message"] for t in translated if t}
    result = defaultdict(dict)
    for entry in source:
        text = by_key.get((entry["name"], entry["message"]))
        if text is None:
            continue
        grd = helium.get_parent_grd(src, entry["source"])
        messages, _ = parse_grd(grd)
        fp = helium.get_id(entry["name"], entry["context"], util.replace_text(entry["message"])[0], entry.get("meaning"))
        for message in messages.get(entry["name"], []):
            if message.GetId() == fp:
                result[grd][message.GetId()] = (entry["name"], message, xtb_text(text))
    return result


def logpose_translations(src):
    data = json.loads(LOGPOSE.read_text(encoding="utf-8"))
    result = defaultdict(dict)
    for grd_name, entries in data.items():
        grd = src / grd_name
        messages, _ = parse_grd(grd)
        for name, text in entries.items():
            if name not in messages:
                raise SystemExit(f"{grd_name}: mensagem {name} não existe mais")
            for message in messages[name]:
                result[grd][message.GetId()] = (name, message, xtb_text(text))
    return result


def write_xtb(path, translations):
    content = path.read_text(encoding="utf-8")
    for msg_id, text in translations.items():
        element = f'<translation id="{msg_id}">{text}</translation>'
        pattern = re.compile(rf'<translation id="{msg_id}"[^>]*>.*?</translation>\n?', re.DOTALL)
        found = list(pattern.finditer(content))
        if not found:
            content = content.replace("</translationbundle>", f"{element}\n</translationbundle>", 1)
            continue
        for match in reversed(found[1:]):
            content = content[:match.start()] + content[match.end():]
        first = found[0]
        content = content[:first.start()] + element + "\n" + content[first.end():]
    path.write_text(content, encoding="utf-8")


def aba(match):
    before, g, plural = match.groups()
    if before and before.lower() in GUIDE:
        return match[0]
    return (f"{before} " if before else "") + ("A" if g == "G" else "a") + "ba" + plural


def prefer_aba(src):
    changed = 0
    for path in src.glob(f"**/*_{LANG}.xtb"):
        if "out" in path.relative_to(src).parts[:1]:
            continue
        content = path.read_text(encoding="utf-8")
        result = GUIA.sub(aba, content)
        if result != content:
            path.write_text(result, encoding="utf-8")
            changed += 1
    return changed


def main(src):
    if not (src / "OWNERS").exists():
        raise SystemExit("pasta do código do Chromium errada")
    util.add_grit_to_path(src)
    util.REPLACEMENT_REGEXES = [(re.compile(a), b) for a, b in RULES]
    applied = defaultdict(dict)
    for source in (helium_translations(src), logpose_translations(src)):
        for grd, entries in source.items():
            applied[grd].update(entries)
    for grd, entries in applied.items():
        translations = {}
        for msg_id, (name, message, text) in entries.items():
            check(grd.relative_to(src), name, message, text)
            translations[msg_id] = text
        write_xtb(parse_grd(grd)[1], translations)
    print(f"{sum(map(len, applied.values()))} traduções {LANG} aplicadas em {len(applied)} arquivos .xtb")
    print(f"guia -> aba em {prefer_aba(src)} arquivos .xtb {LANG}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
