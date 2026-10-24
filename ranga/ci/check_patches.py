import base64
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request


def sections(text):
    result = {}
    lines = text.splitlines(keepends=True)
    current = None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("--- ") and i + 1 < len(lines) and lines[i + 1].startswith("+++ "):
            new = lines[i + 1][4:].split("\t")[0].strip()
            old = line[4:].split("\t")[0].strip()
            path = new if new != "/dev/null" else old
            current = re.sub(r"^[ab]/", "", path)
            result[current] = line + lines[i + 1]
            i += 2
            continue
        if line.startswith("diff --git"):
            current = None
        elif current is not None:
            result[current] += line
        i += 1
    return result


def read_series(series_path):
    with open(series_path) as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]


def check(series_path, patches_dir, prefix, fetch):
    series = read_series(series_path)
    texts = {}
    for name in series:
        with open(os.path.join(patches_dir, name), errors="replace") as f:
            texts[name] = sections(f.read())
    targets = set()
    for name in series:
        if name.startswith(prefix):
            targets |= set(texts[name])
    if not targets:
        return []
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        for path in targets:
            content = fetch(path)
            if content is not None:
                dest = os.path.join(tmp, path)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(dest, "w") as f:
                    f.write(content)
        for name in series:
            for path in sorted(set(texts[name]) & targets):
                done = subprocess.run(
                    ["patch", "-p1", "--ignore-whitespace", "--fuzz=0", "--forward", "--batch", "--silent",
                     "--no-backup-if-mismatch", "-r", "-", "-d", tmp],
                    input=texts[name][path], text=True, capture_output=True)
                if done.returncode != 0:
                    failures.append((name, path))
    return failures


def googlesource(version):
    def fetch(path):
        url = f"https://chromium.googlesource.com/chromium/src/+/refs/tags/{version}/{path}?format=TEXT"
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return base64.b64decode(r.read()).decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
    return fetch


def main(series_path, patches_dir, version_file):
    with open(version_file) as f:
        version = f.read().strip()
    failures = check(series_path, patches_dir, "ranga/", googlesource(version))
    for name, path in failures:
        print(f"FALHOU: {name} em {path}")
    if failures:
        sys.exit(1)
    print(f"ok: patches ranga/ aplicam sobre Chromium {version}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
