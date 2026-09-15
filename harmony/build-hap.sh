#!/usr/bin/env bash
#
# Build the HarmonyOS HAP with the JS bundle actually inside it.
#
# Why this exists rather than two documented commands: hvigor packages whatever
# happens to sit in entry/src/main/resources/rawfile and reports BUILD
# SUCCESSFUL either way. Measured 2026-09-14 — it will happily ship a HAP
# carrying a month-old bundle, and, on a fresh clone where rawfile is empty
# (the bundle is a build artifact, gitignored), a HAP carrying no JS at all.
# That installs and boots to a blank screen with nothing in the build log to
# say why. So: regenerate the bundle, build, then verify that the bundle inside
# the HAP is the one we just built.
#
# Usage: harmony/build-hap.sh          (release-mode bundle, unsigned HAP)
#        DEVECO_APP=/path harmony/build-hap.sh
#
# The HAP is unsigned. Signing needs a Huawei developer account and is done in
# DevEco Studio (Project Structure -> Signing Configs); see harmony/README.md.

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
deveco=${DEVECO_APP:-/Applications/DevEco-Studio.app}
bundle=$root/harmony/entry/src/main/resources/rawfile/bundle.harmony.js
hap=$root/harmony/entry/build/default/outputs/default/entry-default-unsigned.hap

[ -d "$deveco" ] || { echo "DevEco Studio not found at $deveco (set DEVECO_APP)" >&2; exit 1; }

export DEVECO_SDK_HOME="$deveco/Contents/sdk"

# Metro runs on the system node. DevEco's bundled node (18.20.1) is older than
# what metro-config accepts and only hvigor needs it, so its bin directory goes
# on PATH for the hvigor step alone, never for the bundler.
echo "==> bundling JS for harmony"
rm -f "$bundle"
(cd "$root" && npx react-native bundle-harmony --dev false)
[ -s "$bundle" ] || { echo "bundle-harmony produced no bundle" >&2; exit 1; }

echo "==> assembling HAP"
rm -f "$hap"
(cd "$root/harmony" \
  && export PATH="$deveco/Contents/tools/node/bin:$deveco/Contents/tools/ohpm/bin:$PATH" \
  && node "$deveco/Contents/tools/hvigor/bin/hvigorw.js" \
       --mode module -p product=default assembleHap --no-daemon)
[ -s "$hap" ] || { echo "hvigor reported success but produced no HAP" >&2; exit 1; }

# The check that a green build log does not give you.
echo "==> verifying the HAP carries this bundle"
packaged=$(mktemp)
trap 'rm -f "$packaged"' EXIT
unzip -p "$hap" resources/rawfile/bundle.harmony.js > "$packaged" 2>/dev/null || true
if ! [ -s "$packaged" ]; then
  echo "FAIL: the HAP contains no JS bundle; it would boot to a blank screen" >&2
  exit 1
fi
if ! cmp -s "$packaged" "$bundle"; then
  echo "FAIL: the HAP carries a different bundle than the one just built" >&2
  exit 1
fi

echo "ok: $hap"
echo "    $(wc -c < "$hap" | tr -d ' ') bytes, bundle $(wc -c < "$bundle" | tr -d ' ') bytes, unsigned"
