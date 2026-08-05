import {Platform, Share} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const fs = ReactNativeBlobUtil.fs;

/**
 * Writes text content to a temp file and hands it to the OS so the user can
 * save or send it elsewhere — the mobile equivalent of a browser file
 * download, which React Native has no single built-in API for.
 *
 * React Native's own `Share.share({url})` only works on iOS: on Android the
 * native module silently drops `url` and shares just `title`/`message`
 * (verified in node_modules/react-native/Libraries/Share/Share.js) — no
 * error, just an empty share sheet with nothing attached. So this splits by
 * platform: iOS uses Share.share (well-tested, resolves on completion);
 * Android uses react-native-blob-util's actionViewIntent (already a
 * dependency — see inlineAudio.ts), which opens an "Open with" chooser via
 * its bundled FileProvider rather than a true ACTION_SEND share sheet. That
 * is a real, if minor, UX gap between platforms — react-native-share would
 * close it with a proper Android share sheet, but it is a native module
 * requiring a rebuild (pod install / Gradle sync), not a Metro-only change,
 * so it is left as a deliberate follow-up rather than added here.
 */
export async function shareTextFile(
  filename: string,
  contents: string,
  mime = 'application/json',
): Promise<void> {
  const path = `${fs.dirs.CacheDir}/${filename}`;
  await fs.writeFile(path, contents, 'utf8');

  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.android.actionViewIntent(path, mime, filename);
  } else {
    await Share.share({url: `file://${path}`, title: filename});
  }
}
