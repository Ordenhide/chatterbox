/**
 * Features held back from the first release.
 *
 * Separate from parity.ts, which is about native/web feature parity and asks
 * a different question. This one asks: is this ready to be sold and
 * supported on day one?
 *
 * ## Why AI and Pro are one flag
 *
 * They cannot move independently. Chat summaries are the only thing behind
 * `requirePro` (functions/index.js) — so Pro with AI off sells nothing, and
 * AI with Pro off leaves the summarise action failing on a server permission
 * check the client cannot satisfy. One switch, two surfaces:
 *
 *   AI: summaries, message translation, voice transcription, the AI consent
 *       row in Profile, and the disclosure prompt in front of the first use.
 *   Pro: the Store screen and its route, the upgrade prompt, the Pro badge
 *       and pitch in Profile, and the Pro tag on the gated menu item.
 *
 * Smart replies are deliberately NOT here. They look like the same category
 * and are not: smartReply.ts is keyword matching over the last three messages
 * against localized strings, computed on the device, sending nothing
 * anywhere. Hiding it would cost a working feature to tidy up a word.
 *
 * ## What this does not do
 *
 * The code stays, the Cloud Functions stay deployed, and the Stripe webhook
 * keeps writing entitlements for anyone who already has one. This hides the
 * ways in, so nothing can be reached from the UI; it is not a teardown, and
 * flipping it back to `true` restores all of it.
 *
 * The privacy policy and the marketing site are NOT driven by this flag —
 * they are text, and they were edited to match. If you flip this, section 6
 * of src/i18n/privacyPolicy.ts and the AI copy in scripts/site-copy/ have to
 * be put back in all fifteen languages. There is a test that will remind you
 * (src/config/__tests__/launch.test.ts), because a shipped app whose policy
 * disagrees with it is worse than either.
 */
export const SHOW_AI_FEATURES = false;
