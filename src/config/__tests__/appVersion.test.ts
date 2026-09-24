/**
 * `ANDROID_VERSION_CODE` is a hand-kept copy of `versionCode` in
 * `android/app/build.gradle`, read by `updateCheck.ts` to decide whether the
 * running app is behind what chatterbox.fans is currently serving. Nothing
 * enforces that a release bump lands in both places — this is that
 * enforcement. Without it, a real Play/site release could ship a higher
 * `versionCode` that this constant never learns about, and the update
 * checker would keep telling every user they're already current.
 */
import * as fs from 'fs';
import * as path from 'path';
import {ANDROID_VERSION_CODE} from '../appVersion';

describe('ANDROID_VERSION_CODE matches build.gradle', () => {
  it('is the same versionCode Android will actually ship', () => {
    const gradlePath = path.join(__dirname, '../../../android/app/build.gradle');
    const gradle = fs.readFileSync(gradlePath, 'utf8');
    const match = gradle.match(/versionCode\s+(\d+)/);
    if (!match) throw new Error('could not find versionCode in android/app/build.gradle');
    const gradleVersionCode = Number(match[1]);

    if (gradleVersionCode !== ANDROID_VERSION_CODE) {
      throw new Error(
        `android/app/build.gradle has versionCode ${gradleVersionCode}, but ` +
          `src/config/appVersion.ts's ANDROID_VERSION_CODE is still ${ANDROID_VERSION_CODE}. ` +
          'Update ANDROID_VERSION_CODE (and APP_VERSION_NAME) to match on every release.',
      );
    }
  });
});
