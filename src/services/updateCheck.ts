/**
 * Whether a newer Android build is sitting on chatterbox.fans, checked because
 * the reader tapped a button and not otherwise.
 *
 * Google Play updates an installed app in the background; a store that isn't
 * in the loop can't do that, so the app that replaces it has to be asked
 * instead of asking on its own. That is the whole reason this is a function
 * called from one `onPress` rather than a check that runs at launch or on a
 * timer — the same choice `wikipediaLookup.ts` and `wikipediaSummary.ts` made
 * for the same reason: a cost the reader asked for and can see the result of,
 * not a standing background channel they agreed to once and then forgot.
 *
 * Nothing is downloaded here. A tap that finds an update points the reader at
 * chatterbox.fans, where the download and its checksum live; this only reads
 * one small JSON file to compare one number.
 */
import {ANDROID_VERSION_CODE} from '../config/appVersion';

/** Long enough for a slow network, short enough that a spinner isn't the last thing seen. */
const TIMEOUT_MS = 8000;

const MANIFEST_URL = 'https://chatterbox.fans/downloads/version.json';

export type UpdateCheckResult =
  | {status: 'up-to-date'}
  | {status: 'update-available'; versionName: string}
  | {status: 'error'};

/**
 * `up-to-date` and `error` are deliberately not the same outcome: collapsing
 * "checked, and you're current" with "the check itself failed" would tell
 * someone their app is current when the truth is that nobody asked. A network
 * failure, a bad status code and an unparseable body all land on `error` — the
 * caller shows one honest "couldn't check" message rather than three
 * different silent successes.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(MANIFEST_URL, {
      signal: ctrl.signal,
      headers: {Accept: 'application/json'},
    });
    if (!resp.ok) return {status: 'error'};
    const data = await resp.json().catch(() => null);
    const versionCode = data?.versionCode;
    const versionName = data?.versionName;
    if (typeof versionCode !== 'number' || typeof versionName !== 'string') {
      return {status: 'error'};
    }
    if (versionCode <= ANDROID_VERSION_CODE) return {status: 'up-to-date'};
    return {status: 'update-available', versionName};
  } catch {
    return {status: 'error'};
  } finally {
    clearTimeout(timer);
  }
}
