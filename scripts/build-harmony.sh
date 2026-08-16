#!/bin/bash
#
# Builds the HarmonyOS HAP. Run from anywhere:
#
#   bash scripts/build-harmony.sh
#
# Runs the assemble step twice on purpose — see step 3/3 below.
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVECO=/Applications/DevEco-Studio.app/Contents

if [ ! -d "$DEVECO" ]; then
  echo "DevEco Studio not found at $DEVECO — it ships the ohpm/hvigor toolchain." >&2
  exit 1
fi

# The HarmonyOS toolchain is exported only into the subshells that need it.
#
# DevEco bundles Node 18, and putting it first on PATH breaks the Metro step
# below: @react-native/metro-config calls Array.prototype.toReversed, which
# needs Node 20+. The failure reads "configs.toReversed is not a function" and
# points at metro.config.js, which is a long way from "the wrong node is first
# on PATH".
#
# Scoping the export to these subshells only protects a *clean* PATH. If
# DevEco's tools/node/bin was ever exported by hand in the same terminal (e.g.
# while following DevEco's own setup instructions), it stays on PATH for the
# rest of that shell session — bash inherits it, and no local `export` inside
# this script can un-inherit something already ahead of it. clean_env
# explicitly filters any DevEco-Studio.app entries back out before step 2, so
# this script gives the right answer regardless of what the calling shell
# already exported.
harmony_env() {
  export PATH="$DEVECO/tools/node/bin:$DEVECO/tools/ohpm/bin:$DEVECO/tools/hvigor/bin:$PATH"
  export DEVECO_SDK_HOME="$DEVECO/sdk"
}
clean_env() {
  export PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/DevEco-Studio\.app/' | paste -sd: -)"
}

echo "==> 1/3  ohpm install"
( cd "$REPO/harmony" && harmony_env && ohpm install )

echo "==> 2/3  bundle JS for harmony"
( cd "$REPO" && clean_env && node --version && npx react-native bundle-harmony --dev false )

# hvigorw's own autolink task discovers every harmony-aliased package
# installed under node_modules and writes what it needs straight into
# harmony/oh-package.json5 — no manual wiring, see
# scripts/link-harmony-natives.py for how that was confirmed. But it does
# this *as part of* the same assembleHap run that then tries to compile
# against what it just declared, before ohpm has fetched/extracted it. A
# freshly-installed native port (or a truly clean checkout) therefore fails
# its first assemble on a missing-module error that has nothing to do with
# the port itself — it just hasn't been ohpm-installed yet.
#
# Running ohpm install + assemble a second time is what actually builds it:
# the first assemble is the discovery pass, ohpm install is what makes the
# discovery real, and the second assemble is the one that can succeed. If a
# native port needs one of the compatibility patches in
# scripts/patch-harmony-natives.sh (version drift against the current RNOH
# core — see that script for the two ports it's needed for so far), apply it
# between the two ohpm installs below, same as here.
echo "==> 3/3  assemble HAP (first pass: let autolink discover any new native packages)"
if ( cd "$REPO/harmony" && harmony_env && hvigorw assembleHap ); then
  FIRST_PASS_OK=1
else
  FIRST_PASS_OK=0
  echo "    (expected to fail here on a freshly-installed native port — continuing)"
fi

if [ "$FIRST_PASS_OK" = "0" ]; then
  echo "==> 3/3  ohpm install (fetch whatever autolink just declared)"
  ( cd "$REPO/harmony" && harmony_env && ohpm install )

  if [ -x "$REPO/scripts/patch-harmony-natives.sh" ]; then
    echo "==> 3/3  patch-harmony-natives.sh"
    bash "$REPO/scripts/patch-harmony-natives.sh" || true
  fi

  echo "==> 3/3  assemble HAP (second pass)"
  ( cd "$REPO/harmony" && harmony_env && hvigorw assembleHap )
fi

HAP="$REPO/harmony/entry/build/default/outputs/default/entry-default-unsigned.hap"
echo
if [ -f "$HAP" ]; then
  echo "HAP: $HAP  ($(du -h "$HAP" | cut -f1))"
  echo "Unsigned — sign it in DevEco (File > Project Structure > Signing Configs)"
  echo "before it will install on a device."
else
  echo "Build reported success but no HAP at $HAP" >&2
  exit 1
fi
