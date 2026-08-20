# Quick Setup Guide

Follow these steps to get your local chat app running:

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Authentication → Email/Password**
3. Create a **Cloud Firestore** database (start in test mode for local use)
4. Enable **Firebase Storage**
5. Add iOS and Android apps:
   - iOS bundle id: `com.chatterbox`
   - Android package name: `com.chatterbox.app`
6. Download config files:
   - `GoogleService-Info.plist` → place in `ios/ChatterboxTemp/`
   - `google-services.json` → place in `android/app/`

## Step 3: Install iOS Dependencies (iOS only)

```bash
cd ios
pod install
cd ..
```

## Step 4: Run the App

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

## Step 5: First Use

1. Launch the app
2. Tap "Sign Up" to create an account
   - Enter an email (can be anything, e.g., `test@example.com`)
   - Enter a password (minimum 6 characters)
   - Optionally add a display name
3. You'll be automatically signed in
4. Tap the "+" button to create a new chat
5. Start messaging!

## Media (Photos & Videos)

- The app uses your photo library to pick images/videos.
- iOS permission prompts will appear the first time you attach media.
- Android will request media permissions when you select attachments.
- Camera access is required to capture photos/videos.
- Microphone access is required to record voice messages.
- File access is required to attach documents.

## How Firebase Works

- User accounts are stored in Firebase Authentication
- Chats and messages are stored in Cloud Firestore
- Media is stored in Firebase Storage
- You need an internet connection to send/receive messages

## Troubleshooting

### Pod install fails (iOS)
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Android build fails
- Make sure Android SDK is properly configured
- Check that `ANDROID_HOME` environment variable is set

### App won't start
- Make sure you've run `npm install`
- For iOS, make sure pods are installed
- Try clearing Metro cache: `npm start -- --reset-cache`

