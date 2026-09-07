/**
 * Features held back from the first release.
 *
 * Separate from src/config/parity.ts, which is about native/web feature parity and asks
 * a different question. This one asks: is this ready to ship on day one?
 *
 * Hidden: summaries, message translation, voice transcription, the AI consent
 * row in Profile, and the disclosure prompt in front of the first use.
 *
 * The paid tier that used to sell summaries is not behind this flag — it was
 * deleted. Stripe was a third-party recipient of a name, an email address and
 * a card, in an app whose argument is that the server does not even keep your
 * email; summaries are simply free now, and `requirePro` is gone with it.
 *
 * Smart replies are deliberately NOT here. They look like the same category
 * and are not: smartReply.ts is keyword matching over the last three messages
 * against localized strings, computed on the device, sending nothing
 * anywhere. Hiding it would cost a working feature to tidy up a word.
 *
 * ## What this does not do
 *
 * The code stays and the Cloud Functions stay deployed. This hides the ways
 * in, so nothing can be reached from the UI; it is not a teardown, and
 * flipping it back to `true` restores all of it.
 *
 * The privacy policy and the marketing site are NOT driven by this flag —
 * they are text, and they were edited to match. If you flip this, section 6
 * of src/i18n/privacyPolicy.ts and the AI copy in scripts/site-copy/ have to
 * be put back in all fifteen languages. There is a test that will remind you
 * (the mobile launch.test.ts), because a shipped app whose policy
 * disagrees with it is worse than either.
 */
export const SHOW_AI_FEATURES = false;
