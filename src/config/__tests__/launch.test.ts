/**
 * The AI gate and the documents that describe it have to agree.
 *
 * SHOW_AI_FEATURES hides the summariser, translation, transcription and the
 * Pro tier that sells them. The privacy policy and the marketing site are not
 * driven by that flag — they are prose, in every language the app offers, and
 * they were edited by hand to match. Nothing but this test connects the two.
 *
 * The failure this exists for is the cheerful one: someone flips the flag
 * back to `true`, ships, and the app now sends message text to Cloudflare and
 * Google while its own privacy policy says in every language that nothing
 * reaches those services. That is not a stale sentence — it is a false
 * statement about where your messages go, made by the document whose only job
 * is to be true about that.
 *
 * So: turning the features on means putting the text back first. See the
 * checklist in the failure message.
 */
import {SHOW_AI_FEATURES} from '../launch';
import {PRIVACY_POLICY} from '../../i18n/privacyPolicy';

const OFF_MARKER = 'switched off in this release';

const section = (n: number) => {
  const found = PRIVACY_POLICY.en.find(s => s.title.startsWith(`${n}.`));
  if (!found) throw new Error(`the English policy has no section ${n}`);
  return found;
};

describe('the AI gate matches what the documents claim', () => {
  it.each([1, 6])('section %i says the AI features are off exactly while they are', n => {
    const saysOff = section(n).body.includes(OFF_MARKER);
    if (saysOff !== !SHOW_AI_FEATURES) {
      throw new Error(
        SHOW_AI_FEATURES
          ? `SHOW_AI_FEATURES is on, but section ${n} of the privacy policy still says the AI features are off.\n` +
            'Before turning them on, in every language the app offers:\n' +
            '  1. src/i18n/privacyPolicy.ts — sections 1 and 6, describe them as available again\n' +
            '  2. scripts/site-copy/*.mjs — reason 5 and the third feature card\n' +
            '  3. put the three provider names back in validate() in scripts/build-site-html.mjs\n' +
            '  4. re-run both generators'
          : `SHOW_AI_FEATURES is off, but section ${n} of the privacy policy does not say so.\n` +
            `Section ${n} has to contain "${OFF_MARKER}" while the features are hidden, ` +
            'or the policy describes a capability with no way to reach it.',
      );
    }
    expect(saysOff).toBe(!SHOW_AI_FEATURES);
  });
});
