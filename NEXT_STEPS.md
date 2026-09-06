# Next Steps - Installing on iPhone

Great! The React Native project structure is now set up. Here's what to do next:

## Step 1: Install Dependencies

```bash
cd /Users/xiaohanliu/Documents/chatterbox
npm install
```

## Step 2: Install iOS CocoaPods

```bash
cd ios
pod install
cd ..
```

**Note:** If you don't have CocoaPods installed:
```bash
sudo gem install cocoapods
```

## Step 3: Open in Xcode

```bash
open ios/Chatterbox.xcworkspace
```

**Important:** Always use `.xcworkspace`, not `.xcodeproj`!

## Step 4: Configure for Your iPhone

1. In Xcode, select the **Chatterbox** project (left sidebar)
2. Select the **Chatterbox** target
3. Go to **Signing & Capabilities** tab
4. Check **"Automatically manage signing"**
5. Select your **Team** (your Apple ID)
6. Change **Bundle Identifier** to something unique like: `com.yourname.chatterbox`

## Step 5: Connect Your iPhone

1. Connect iPhone via USB
2. Unlock your iPhone
3. Trust the computer if prompted
4. In Xcode, select your iPhone from the device dropdown (top toolbar)

## Step 6: Build and Run

Click the **Play** button (▶️) in Xcode, or run:
```bash
npm run ios -- --device
```

## Step 7: Trust Developer Certificate (First Time)

On your iPhone:
- Go to **Settings** > **General** > **VPN & Device Management**
- Tap your developer certificate
- Tap **"Trust"**

## Step 8: Start Metro Bundler

In a separate terminal:
```bash
npm start
```

Keep this running while developing.

## Note About Project Name

The project, target, scheme and source folder are all `Chatterbox`. They were
`ChatterboxTemp` — the name React Native's template left behind — until that
name turned up on the launch screen in 36pt bold, which is where the stock
storyboard puts it.

The **Bundle Identifier** (`com.chatterbox`, set in Step 4) is the thing
signing and Firebase actually key off; it was never affected by the project
name and did not change with it.

## Troubleshooting

If you encounter issues, see `INSTALL_IPHONE.md` for detailed troubleshooting steps.

