# Android NDK for React Native Build

The app requires **NDK 27.1.12297006** for `react-native-nitro-modules` (used by MMKV) and C++20 support.

## Install NDK 27

1. **Remove incomplete NDK 27** (if you had a failed install):
   ```bash
   rm -rf $ANDROID_HOME/ndk/27.1.12297006
   ```

2. **Install via Android Studio**
   - Open **Android Studio** → **Settings/Preferences** → **Languages & Frameworks** → **Android SDK**
   - Open the **SDK Tools** tab
   - Enable **NDK (Side by side)** and select version **27.1.12297006**
   - Click **Apply** and wait for the install to complete fully

3. **Clean and build**
   ```bash
   cd android && ./gradlew clean && cd .. && npm run android
   ```

If you see **"NDK at … did not have a source.properties file"**, the install is incomplete. Remove the folder (step 1) and reinstall.
