/**
 * A named haptic vocabulary, keyed by what a beat *means* rather than by how
 * strong it is.
 *
 * The app previously called HapticFeedback.trigger('impactLight') from a dozen
 * places in ChatScreen, which has two problems. The obvious one is that
 * everything felt identical, so the buzz carried no information. The subtler
 * one is that naming the intensity at the call site means the call site is
 * deciding physics, and nobody can retune the whole app's feel without
 * grepping for magic strings.
 *
 * The other half of this — see the note on `fire` — is *when* to call it.
 *
 * Platform split is deliberate rather than incidental: iOS has a genuine
 * Taptic Engine with distinct impact weights, while Android's stock effects
 * are coarser, so a couple of beats map to the closest thing that actually
 * feels different on each rather than to the same-named constant.
 */
import {Platform} from 'react-native';
import HapticFeedback, {HapticFeedbackTypes} from 'react-native-haptic-feedback';

/**
 * The beats.
 *
 * - `arm`     a gesture crossed the threshold at which releasing would commit.
 *             The single most valuable haptic in the app: it is what lets you
 *             swipe to reply without watching the screen.
 * - `commit`  an ordinary action completed — a message sent, a reaction added.
 *             These happen constantly, so this is deliberately light. The
 *             temptation is to make "it worked" feel emphatic; do that and a
 *             busy conversation turns into a stutter of buzzing.
 * - `confirm` a *consequential* action succeeded, of the kind you do rarely and
 *             would want reassurance about: bookmarked, saved, added. This is
 *             the emphatic one, and it stays rare so that it keeps meaning
 *             something.
 * - `revert`  the gesture was abandoned below the threshold and sprang back.
 *             Deliberately fainter than `arm` — an undo should not feel as
 *             consequential as the thing it undoes.
 * - `select`  the highlighted item under a moving finger changed. Fires
 *             repeatedly during one gesture, so it has to be the faintest
 *             thing available or it turns into a rattle.
 * - `impact`  something landed or was destroyed. Reserved for events the user
 *             did not directly cause with the finger currently on screen.
 * - `fail`    the action was rejected.
 */
export type HapticBeat =
  | 'arm'
  | 'commit'
  | 'confirm'
  | 'revert'
  | 'select'
  | 'impact'
  | 'fail';

const BEATS: Record<HapticBeat, HapticFeedbackTypes> = {
  arm: HapticFeedbackTypes.impactMedium,
  commit: HapticFeedbackTypes.impactLight,
  confirm: HapticFeedbackTypes.notificationSuccess,
  revert: Platform.OS === 'ios' ? HapticFeedbackTypes.selection : HapticFeedbackTypes.clockTick,
  // Android's `selection` is silent on a lot of devices; clockTick is the
  // effect its own list pickers use and is the closest thing that reliably
  // registers as a tick rather than a buzz.
  select: Platform.OS === 'ios' ? HapticFeedbackTypes.selection : HapticFeedbackTypes.clockTick,
  impact: HapticFeedbackTypes.impactHeavy,
  fail: HapticFeedbackTypes.notificationError,
};

const OPTIONS = {
  // A phone with no haptic hardware buzzing the whole handset is worse than no
  // feedback at all — it is loud, and it is nothing like what was intended.
  enableVibrateFallback: false,
  // Someone who turned haptics off in system settings meant it.
  ignoreAndroidSystemSettings: false,
};

/**
 * Fire a beat.
 *
 * Call this on the *animation frame the state changes*, not on the touch event
 * that will eventually lead there. Those are usually a few frames apart, and
 * that gap is the whole difference between a gesture that feels physical and
 * one that merely feels acknowledged: the buzz has to land on the frame you
 * see the detent catch, or your hand and your eye disagree.
 *
 * Never throws. Haptics are the most disposable thing in the app — a device
 * without a Taptic Engine, a revoked vibrate permission, or a module that
 * failed to link should all degrade to silence rather than taking out the
 * interaction the haptic was decorating.
 */
export function fire(beat: HapticBeat): void {
  try {
    HapticFeedback.trigger(BEATS[beat], OPTIONS);
  } catch {
    // Intentionally silent — see above.
  }
}

/**
 * Guards a beat that fires from inside a gesture's move handler, so it only
 * fires on an actual *change*.
 *
 * `select` and `arm` are both driven by continuous input, and a move handler
 * runs every frame; without this, crossing a threshold once would fire sixty
 * times a second for as long as the finger stayed there. Returns the value it
 * was given so callers can thread it straight back into their own state.
 */
export function fireOnChange<T>(beat: HapticBeat, previous: T, next: T): T {
  if (previous !== next) fire(beat);
  return next;
}
