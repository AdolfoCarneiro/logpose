import os
import tempfile
import unittest

import check_patches

ORIGINAL = "alpha\nbeta\ngamma\n"

UPSTREAM = """--- a/src/a.cc
+++ b/src/a.cc
@@ -1,3 +1,3 @@
 alpha
-beta
+BETA
 gamma
--- a/src/other.cc
+++ b/src/other.cc
@@ -1,1 +1,1 @@
-x
+y
"""

OURS_OK = """--- a/src/a.cc
+++ b/src/a.cc
@@ -1,3 +1,4 @@
 alpha
 BETA
+delta
 gamma
"""

OURS_BAD = """--- a/src/a.cc
+++ b/src/a.cc
@@ -1,3 +1,4 @@
 alpha
 beta
+delta
 gamma
"""


def tree(patches, series):
    root = tempfile.mkdtemp()
    for name, text in patches.items():
        path = os.path.join(root, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(text)
    with open(os.path.join(root, "series"), "w") as f:
        f.write("\n".join(series) + "\n")
    return root


def fetch(path):
    return ORIGINAL if path == "src/a.cc" else None


class CheckPatches(unittest.TestCase):
    def test_sections_split_by_file(self):
        sections = check_patches.sections(UPSTREAM)
        self.assertEqual(sorted(sections), ["src/a.cc", "src/other.cc"])
        self.assertIn("+BETA", sections["src/a.cc"])
        self.assertNotIn("other", sections["src/a.cc"])

    def test_ok_when_ours_applies_on_top(self):
        root = tree({"up/x.patch": UPSTREAM, "ranga/y.patch": OURS_OK}, ["up/x.patch", "ranga/y.patch"])
        self.assertEqual(check_patches.check(os.path.join(root, "series"), root, "ranga/", fetch), [])

    def test_reports_failing_patch(self):
        root = tree({"up/x.patch": UPSTREAM, "ranga/y.patch": OURS_BAD}, ["up/x.patch", "ranga/y.patch"])
        failures = check_patches.check(os.path.join(root, "series"), root, "ranga/", fetch)
        self.assertEqual(failures, [("ranga/y.patch", "src/a.cc")])

    def test_no_ranga_patches_is_ok(self):
        root = tree({"up/x.patch": UPSTREAM}, ["up/x.patch"])
        self.assertEqual(check_patches.check(os.path.join(root, "series"), root, "ranga/", fetch), [])

    def test_new_file_created_by_patch(self):
        new = """--- /dev/null
+++ b/src/new.h
@@ -0,0 +1,1 @@
+hello
"""
        root = tree({"ranga/n.patch": new}, ["ranga/n.patch"])
        self.assertEqual(check_patches.check(os.path.join(root, "series"), root, "ranga/", fetch), [])


if __name__ == "__main__":
    unittest.main()
