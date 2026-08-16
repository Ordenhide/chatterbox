#!/bin/bash
#
# Fixes known compile errors in installed @react-native-oh-tpl/* ports and in
# RNOH's own vendored source, found by actually running the build. Run after
# `ohpm install` inside harmony/ — it edits ohpm's *extracted* copy under
# harmony/oh_modules/, since the .har these ports ship is a zip archive, not
# text patch-package can diff, and the extracted source is what hvigor
# actually compiles.
#
# Idempotent: safe to re-run. ohpm generally preserves an already-installed
# package's extracted directory across reinstalls, but that's a cache
# behavior, not a guarantee — running this every time after `ohpm install`
# keeps it correct regardless.
#
# All four fixes below exist for one reason: react-native-gesture-handler's
# and react-native-screens' HarmonyOS ports were built against an older
# RNOH/RN pairing than the 0.84.2 core this app is on. Nothing here changes
# behavior — each is either a rename-following redirect or restores a default
# the newer base class already provides.
set -e
cd "$(dirname "${BASH_SOURCE[0]}")/.."

GH_DIR=$(find harmony/oh_modules/.ohpm -maxdepth 1 -iname "*react-native-gesture-handler*" 2>/dev/null | head -1)
SCREENS_DIR=$(find harmony/oh_modules/.ohpm -maxdepth 1 -iname "*react-native-screens*" 2>/dev/null | head -1)
RNOH_CORE_DIR=$(find harmony/oh_modules/.ohpm -maxdepth 1 -iname "*react-native-openharmony*" 2>/dev/null | head -1)

if [ -z "$GH_DIR" ] || [ -z "$SCREENS_DIR" ] || [ -z "$RNOH_CORE_DIR" ]; then
  echo "gesture-handler, screens, or the RNOH core not found under harmony/oh_modules — was ohpm install run first?" >&2
  exit 1
fi

GH_CPP="$GH_DIR/oh_modules/@react-native-oh-tpl/react-native-gesture-handler/src/main/cpp"
SCREENS_CPP="$SCREENS_DIR/oh_modules/@react-native-oh-tpl/react-native-screens/src/main/cpp"
RNOH_CORE_CPP="$RNOH_CORE_DIR/oh_modules/@rnoh/react-native-openharmony/src/main/cpp"

# Fix 1: gesture-handler's package class extends the deprecated `RNPackage`
# base. Current RNOH core requires the newer `RNOHPackage`, which is a strict
# superset — it extends RNPackage and adds one method
# (createWrappedCustomRNComponentBuilderByComponentNameMap) with a safe
# default (`return new Map()`). Swapping the import and extends clause is
# behavior-preserving: the method gesture-handler was "missing" is one it
# never needed to override in the first place.
#
# Confirmed only this one port hits it: `grep -rl "extends RNPackage\b"`
# across every installed port's generated-style class file matched nothing
# else.
GH_ETS="$GH_DIR/oh_modules/@react-native-oh-tpl/react-native-gesture-handler/src/main/ets/RNOHPackage.ets"
if [ -f "$GH_ETS" ] && grep -q "extends RNPackage\b" "$GH_ETS"; then
  sed -i '' \
    -e 's/import { RNPackage, RNPackageContext } from "@rnoh\/react-native-openharmony";/import { RNOHPackage, RNPackageContext } from "@rnoh\/react-native-openharmony";/' \
    -e 's/extends RNPackage {/extends RNOHPackage {/' \
    "$GH_ETS"
  echo "patched: gesture-handler ArkTS RNPackage -> RNOHPackage"
fi

# Fix 2 & 3: hvigor's autolink codegen derives the C++ class it instantiates
# from the npm package name (@react-native-oh-tpl/react-native-gesture-handler
# -> ReactNativeOhTplReactNativeGestureHandlerPackage) and generates
# RNOHPackagesFactory.h to #include and construct exactly that name. Both
# ports predate that convention and ship their real implementation under a
# different name (RnohReactNativeHarmony*Package) — the same situation each
# port's own author already solved once, for an even older deprecated name
# (GestureHandlerPackage.h / ScreensPackage.h, still present, aliasing to the
# Rnoh* name). This is the identical pattern for the name the *current*
# generator expects.
if [ ! -f "$GH_CPP/ReactNativeOhTplReactNativeGestureHandlerPackage.h" ]; then
  cat > "$GH_CPP/ReactNativeOhTplReactNativeGestureHandlerPackage.h" <<'EOF'
#pragma once
#include "RnohReactNativeHarmonyGestureHandlerPackage.h"

// hvigor's autolink codegen derives the expected class name from the npm
// package name (@react-native-oh-tpl/react-native-gesture-handler ->
// ReactNativeOhTplReactNativeGestureHandlerPackage) and generates
// RNOHPackagesFactory.h to include and instantiate exactly that name. This
// port predates that convention and ships its real implementation under
// RnohReactNativeHarmonyGestureHandlerPackage instead — the same situation
// the port's own GestureHandlerPackage.h alias already solves for an older
// deprecated name. This is the same pattern for the name the current
// autolink generator expects.
namespace rnoh {
class ReactNativeOhTplReactNativeGestureHandlerPackage : public RnohReactNativeHarmonyGestureHandlerPackage {
    using Super = RnohReactNativeHarmonyGestureHandlerPackage;
    using Super::Super;
};
} // namespace rnoh
EOF
  echo "patched: gesture-handler C++ class name alias created"
fi

if [ ! -f "$SCREENS_CPP/ReactNativeOhTplReactNativeScreensPackage.h" ]; then
  cat > "$SCREENS_CPP/ReactNativeOhTplReactNativeScreensPackage.h" <<'EOF'
#pragma once
#include "RnohReactNativeHarmonyScreensPackage.h"

// Same naming-convention gap as gesture-handler's identical alias header —
// see ReactNativeOhTplReactNativeGestureHandlerPackage.h for the full
// explanation. hvigor's autolink codegen expects
// ReactNativeOhTplReactNativeScreensPackage; this port's real implementation
// is RnohReactNativeHarmonyScreensPackage.
namespace rnoh {
class ReactNativeOhTplReactNativeScreensPackage : public RnohReactNativeHarmonyScreensPackage {
    using Super = RnohReactNativeHarmonyScreensPackage;
    using Super::Super;
};
} // namespace rnoh
EOF
  echo "patched: screens C++ class name alias created"
fi

# Fix 4: gesture-handler's C++ does
# `#include <react/renderer/debug/SystraceSection.h>`. RNOH's vendored React
# Native source tree now keeps that file at
# third-party/rn/ReactCommon/cxxreact/SystraceSection.h — a Meta-side
# reorganization the port predates. SystraceSection is a small, stable
# profiling-scope utility that hasn't changed shape across the move; this
# restores the old include path rather than patching every consumer.
SYSTRACE_REDIRECT="$RNOH_CORE_CPP/third-party/rn/ReactCommon/react/renderer/debug/SystraceSection.h"
if [ ! -f "$SYSTRACE_REDIRECT" ]; then
  cat > "$SYSTRACE_REDIRECT" <<'EOF'
#pragma once
// Compatibility redirect: RNOH's vendored React Native source keeps
// SystraceSection.h under cxxreact/, not react/renderer/debug/ where it lived
// in the RN version several harmony ports (react-native-gesture-handler's
// among them) were originally written against. SystraceSection is a small,
// stable profiling-scope utility that hasn't changed shape across that move —
// this just restores the old include path rather than patching every
// consumer.
#include "../../../cxxreact/SystraceSection.h"
EOF
  echo "patched: SystraceSection.h compat redirect created"
fi

echo "harmony native patches up to date"
