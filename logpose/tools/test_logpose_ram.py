import os
import tempfile
import unittest

import logpose_ram

ROLLUP = """55a0-7ffd ---p 00000000 00:00 0 [rollup]
Rss:              204800 kB
Pss:              102400 kB
Pss_Anon:          51200 kB
"""


def fake_proc(entries):
    root = tempfile.mkdtemp()
    for pid, (cmdline, rollup) in entries.items():
        d = os.path.join(root, str(pid))
        os.makedirs(d)
        with open(os.path.join(d, "cmdline"), "wb") as f:
            f.write(cmdline.replace(" ", "\0").encode())
        if rollup is not None:
            with open(os.path.join(d, "smaps_rollup"), "w") as f:
                f.write(rollup)
    os.makedirs(os.path.join(root, "self"))
    return root


class Ram(unittest.TestCase):
    def test_pss_kb(self):
        self.assertEqual(logpose_ram.pss_kb(ROLLUP), 102400)

    def test_pids_with_marker(self):
        proc = fake_proc({
            10: ("helium --user-data-dir=/p/logpose", ROLLUP),
            11: ("helium --type=renderer --user-data-dir=/p/logpose", ROLLUP),
            12: ("chrome --user-data-dir=/p/chrome", ROLLUP),
        })
        self.assertEqual(sorted(logpose_ram.pids_with("/p/logpose", proc)), [10, 11])

    def test_total_ignores_vanished(self):
        proc = fake_proc({
            10: ("helium --user-data-dir=/p/logpose", ROLLUP),
            11: ("helium --user-data-dir=/p/logpose", None),
        })
        self.assertEqual(logpose_ram.total_mb("/p/logpose", proc), 100.0)


if __name__ == "__main__":
    unittest.main()
