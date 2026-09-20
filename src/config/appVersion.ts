/**
 * The build's own version, kept in sync by hand with
 * `android/app/build.gradle`'s `versionCode`/`versionName` (and
 * `ios/Chatterbox.xcodeproj`'s `MARKETING_VERSION`) at release time.
 *
 * A native version-reader (e.g. react-native-device-info) would read these
 * from the platform instead of a literal, but that is a new native
 * dependency to save hand-syncing a single integer — this file is the same
 * hand-sync cost the codebase already carries across those two files, not an
 * additional one. `appVersion.test.ts` is what catches drift: it reads
 * `versionCode` back out of `build.gradle` and fails if it no longer matches
 * `ANDROID_VERSION_CODE` below.
 */
export const ANDROID_VERSION_CODE = 3;
export const APP_VERSION_NAME = '1.2';
