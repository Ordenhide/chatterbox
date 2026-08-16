#!/usr/bin/env python3
"""
Reports which installed @react-native-oh-tpl/* packages ship native (.har)
code, versus which are pure JS/ArkTS over primitives RNOH's core already
provides. Read-only — prints, does not write.

This used to also write dependency entries into harmony/entry/oh-package.json5,
on the assumption that native linking needed manual wiring. That assumption
was wrong: hvigor's own autolink task discovers every harmony-aliased package
in node_modules on its own and writes what it needs directly into the
*workspace-root* harmony/oh-package.json5 — a file this script never touched.
Proven by testing the opposite: resetting both oh-package.json5 files to bare
scaffolding and rebuilding from scratch still produced a working HAP with no
manual edit anywhere.

The real two-step build reality autolink imposes, and why
scripts/build-harmony.sh runs hvigorw twice:
  1. A fresh `hvigorw assembleHap` discovers newly-npm-installed harmony
     packages and writes them into harmony/oh-package.json5 — but the same
     run fails, because ohpm hasn't fetched/extracted what autolink just
     declared.
  2. `ohpm install` fetches them. A second `hvigorw assembleHap` then
     succeeds (once scripts/patch-harmony-natives.sh has fixed whatever
     version-drift the newly-linked port hits — see that script).

Kept as a report because "does this port need scripts/patch-harmony-natives.sh
treatment" is worth knowing before you hit the compile error yourself.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NODE_MODULES = REPO / "node_modules"


def main():
    scope_dir = NODE_MODULES / "@react-native-oh-tpl"
    if not scope_dir.is_dir():
        print("No @react-native-oh-tpl packages installed.")
        return

    native, js_only = [], []
    for pkg_dir in sorted(scope_dir.iterdir()):
        pkg_json = pkg_dir / "package.json"
        if not pkg_json.exists():
            continue
        har_dir = pkg_dir / "harmony"
        har_files = list(har_dir.glob("*.har")) if har_dir.is_dir() else []
        name = json.loads(pkg_json.read_text()).get("name", f"@react-native-oh-tpl/{pkg_dir.name}")
        (native if har_files else js_only).append(name)

    if js_only:
        print(f"Pure JS/ArkTS ({len(js_only)}) — npm install is the whole job:")
        for n in js_only:
            print(f"  {n}")
    if native:
        print(f"\nShip native code ({len(native)}) — autolink wires these automatically,")
        print("but each is a candidate for the version-drift errors documented in")
        print("scripts/patch-harmony-natives.sh if the port predates the current RNOH core:")
        for n in native:
            print(f"  {n}")


if __name__ == "__main__":
    main()
