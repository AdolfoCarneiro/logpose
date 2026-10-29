import os
import sys


def pss_kb(smaps_rollup):
    for line in smaps_rollup.splitlines():
        if line.startswith("Pss:"):
            return int(line.split()[1])
    return 0


def pids_with(marker, proc="/proc"):
    pids = []
    for name in os.listdir(proc):
        if not name.isdigit():
            continue
        try:
            with open(os.path.join(proc, name, "cmdline"), "rb") as f:
                cmdline = f.read().replace(b"\0", b" ").decode(errors="replace")
        except OSError:
            continue
        if marker in cmdline:
            pids.append(int(name))
    return pids


def total_mb(marker, proc="/proc"):
    total = 0
    for pid in pids_with(marker, proc):
        try:
            with open(os.path.join(proc, str(pid), "smaps_rollup")) as f:
                total += pss_kb(f.read())
        except OSError:
            continue
    return total / 1024


if __name__ == "__main__":
    print(f"{total_mb(sys.argv[1]):.0f}")
