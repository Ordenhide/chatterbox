import {I18nManager} from 'react-native';

/**
 * Right-to-left layout.
 *
 * Arabic was in the language picker with nothing behind it: no I18nManager
 * call anywhere in the app, and every style written with left/right rather
 * than start/end. Arabic *text* renders right-to-left on its own — the text
 * engine does that from the glyphs — so the result was Arabic script inside a
 * left-to-right layout, which is the shape that reads as broken rather than
 * as untranslated.
 *
 * Only languages actually offered are listed. `he`, `fa` and `ur` are here
 * because they are the ones most likely to be added next and it costs nothing
 * to be right about them in advance; `ar` is the one that ships today.
 */
export const RTL_LANGUAGES: readonly string[] = ['ar', 'he', 'fa', 'ur'];

/** Language tags carry region and script subtags: `ar-EG` is still Arabic. */
export function isRTLLanguage(code: string | null | undefined): boolean {
  if (!code) return false;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return RTL_LANGUAGES.includes(base);
}

export type DirectionChange = {
  /** The direction this language wants. */
  rtl: boolean;
  /**
   * True when the running app is laid out the other way.
   *
   * React Native decides layout direction once, from native, at startup.
   * `forceRTL` records what the *next* launch should do; it does not reflow
   * the running app. So a language change that flips direction leaves the
   * user in a half-applied state until a relaunch, and the honest thing is to
   * say so rather than let them find a mirrored-text-in-unmirrored-layout
   * screen and conclude the app is broken.
   */
  needsRestart: boolean;
};

/**
 * Records the layout direction a language needs, and reports whether the
 * running process is already in it.
 *
 * Safe to call on every language change and at startup; `forceRTL` with the
 * value already in effect is a no-op.
 */
export function applyLayoutDirection(code: string | null | undefined): DirectionChange {
  const rtl = isRTLLanguage(code);
  // Without allowRTL, forceRTL is ignored outright on iOS.
  I18nManager.allowRTL(true);
  const needsRestart = I18nManager.isRTL !== rtl;
  I18nManager.forceRTL(rtl);
  return {rtl, needsRestart};
}
