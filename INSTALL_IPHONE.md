# Installing Chatterbox on Your iPhone

This guide will walk you through installing the app on your physical iPhone device.

## Prerequisites

1. **macOS** (required for iOS development)
2. **Xcode** (free from Mac App Store)
3. **Apple Developer Account** (free account works for personal use)
4. **iPhone** connected via USB cable
5. **Node.js** installed (v18+)

## Step 1: Install Dependencies

First, make sure all npm packages are installed:

```bash
npm install
```

## Step 2: Initialize React Native Project (if needed)

If you don't have the iOS native project yet, you need to create it:

```bash
npx react-native init Chatterbox --version 0.73.0
```

Then copy your `src/` folder and configuration files into the new project.

## Step 3: Install iOS Dependencies

Navigate to the iOS folder and install CocoaPods dependencies:

```bash
cd ios
pod install
cd ..
```

**Note:** If you don't have CocoaPods installed:
```bash
sudo gem install cocoapods
```

## Step 4: Open Project in Xcode

Open the workspace (not the project file):

```bash
open ios/chatterbox.xcworkspace
```

**Important:** Always use `.xcworkspace`, not `.xcodeproj` when CocoaPods are involved.

## Step 5: Configure Signing & Capabilities

1. In Xcode, select the **chatterbox** project in the left sidebar
2. Select the **chatterbox** target
3. Go to the **Signing & Capabilities** tab
4. Check **"Automatically manage signing"**
5. Select your **Team** (your Apple ID)
   - If you don't see your team, click "Add Account..." and sign in with your Apple ID
   - A free Apple ID works for personal development

## Step 6: Set Bundle Identifier

1. Still in **Signing & Capabilities**
2. Change the **Bundle Identifier** to something unique, like:
   - `com.yourname.chatterbox`
   - Or `com.chatterbox.yourname`
   - This must be unique and not used by any other app

## Step 7: Select Your iPhone

1. At the top of Xcode, next to the play button, click the device selector
2. Select your connected iPhone from the list
   - Make sure your iPhone is unlocked
   - You may need to "Trust This Computer" on your iPhone when first connected

## Step 8: Trust Developer Certificate (First Time Only)

When you first install on your iPhone:

1. On your iPhone, go to **Settings** > **General** > **VPN & Device Management** (or **Profiles & Device Management**)
2. Tap on your developer certificate
3. Tap **"Trust [Your Name]"**
4. Confirm by tapping **"Trust"**

## Step 9: Build and Run

### Option A: From Xcode
1. Click the **Play** button (▶️) in Xcode
2. Wait for the build to complete
3. The app will install and launch on your iPhone

### Option B: From Terminal
```bash
npm run ios -- --device
```

Or specify your device:
```bash
npx react-native run-ios --device "Your iPhone Name"
```

## Step 10: Start Metro Bundler

In a separate terminal window, start the Metro bundler:

```bash
npm start
```

Keep this running while developing.

## Troubleshooting

### "Command PhaseScriptExecution failed with a nonzero exit code" (ReactCodegen)

**Cause:** Your project path contains **spaces** (e.g. `文稿 - Xiaohan的MacBook Pro - 1`). React Native's build scripts break when paths have spaces.

**Fix:** Move the project to a path **without spaces**:

```bash
# Move project to ~/Projects/chatterbox (no spaces)
mkdir -p ~/Projects
mv "/Users/xiaohanliu/Documents/文稿 - Xiaohan的MacBook Pro - 1/chatterbox" ~/Projects/chatterbox
cd ~/Projects/chatterbox

# Clean and rebuild
rm -rf ios/build ios/Pods node_modules/.cache
npm install
cd ios && pod install && cd ..

# Build from the new location
npx react-native run-ios --simulator="iPhone 17"
```

Then open the project from `~/Projects/chatterbox` in Cursor/Xcode instead of the path with spaces.

### "No devices found"
- Make sure your iPhone is connected via USB
- Unlock your iPhone
- Trust the computer if prompted
- Try unplugging and replugging the USB cable

### "Signing for chatterbox requires a development team"
- Make sure you've selected a Team in Signing & Capabilities
- Sign in with your Apple ID in Xcode Preferences > Accounts

### "Failed to build"
- Make sure CocoaPods are installed: `cd ios && pod install`
- Clean build folder: In Xcode, Product > Clean Build Folder (Shift+Cmd+K)
- Try deleting `ios/build` folder and rebuilding

### "Unable to install app"
- Check that your Bundle Identifier is unique
- Make sure you've trusted the developer certificate on your iPhone
- Try restarting both Xcode and your iPhone

### Metro bundler connection issues
- Make sure your iPhone and Mac are on the same Wi-Fi network
- Shake your iPhone to open the developer menu
- Tap "Configure Bundler" and enter your Mac's IP address
- Or use: `npm start -- --host [YOUR_MAC_IP]`

### App crashes on launch
- Check Metro bundler is running
- Check the Xcode console for error messages
- Try rebuilding: `cd ios && pod install && cd ..` then rebuild

## Alternative: Using TestFlight (For Distribution)

If you want to install on multiple devices or share with others:

1. Enroll in Apple Developer Program ($99/year) - required for TestFlight
2. Archive the app in Xcode: Product > Archive
3. Upload to App Store Connect
4. Add testers in TestFlight
5. Install TestFlight app on iPhone
6. Install your app via TestFlight

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Install iOS pods
cd ios && pod install && cd ..

# Run on connected iPhone
npm run ios -- --device

# Start Metro bundler
npm start

# Clean and rebuild
cd ios
rm -rf build
pod deintegrate
pod install
cd ..
```

## Notes

- **Free Apple ID:** Works for 7 days, then you need to re-sign the app
- **Paid Developer Account:** Apps stay signed for 1 year
- **Development builds:** Only work on devices registered in your Apple Developer account
- **App expiration:** Free account apps expire after 7 days and need to be reinstalled

