# Chatterbox - Cross-Platform Chat App

A modern instant messaging application built with React Native for iOS and Android, backed by Firebase.

## Features

- 🔐 Firebase Email/Password Authentication
- 💬 Real-time messaging with Cloud Firestore
- 📱 Cross-platform (iOS & Android)
- 🎨 Modern, clean UI
- 👤 User profiles
- ☁️ Cloud sync with Firebase Storage for media

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **React Native CLI**: `npm install -g react-native-cli`
- **Xcode** (for iOS development on macOS)
- **Android Studio** (for Android development)
- **CocoaPods** (for iOS): `sudo gem install cocoapods`

## Initial Setup

If you're starting fresh, you'll need to initialize a React Native project first:

```bash
npx react-native init Chatterbox --version 0.73.0
cd Chatterbox
```

Then copy the source files from this repository into the project, or use the files provided here directly.

**Note:** The project structure assumes you have the native iOS and Android folders. If starting from scratch with just source files, you'll need to run `npx react-native init` to generate the native project structure.

## Installation

1. Clone the repository:
```bash
cd chatterbox
```

2. Install dependencies:
```bash
npm install
```

3. For iOS, install CocoaPods dependencies:
```bash
cd ios && pod install && cd ..
```

## Running the App

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

Make sure you have an iOS Simulator running or Android Emulator/device connected.

## How It Works

This app uses Firebase:
- Authentication for user accounts
- Cloud Firestore for chats and messages
- Firebase Storage for media attachments

**Note:** You'll need a Firebase project and internet access to send/receive messages.

## Project Structure

```
chatterbox/
├── src/
│   ├── contexts/          # React contexts (Auth)
│   ├── navigation/        # Navigation configuration
│   ├── screens/           # Screen components
│   │   ├── auth/         # Login, SignUp screens
│   │   └── chat/         # Chat list and chat screens
│   └── types/            # TypeScript type definitions
├── ios/                  # iOS native code
├── android/              # Android native code
├── App.tsx               # Main app component
└── package.json          # Dependencies
```

## Development

- Start Metro bundler: `npm start`
- Run linting: `npm run lint`
- Run tests: `npm test`

## Troubleshooting

### iOS Issues
- If pods fail to install, try: `cd ios && pod deintegrate && pod install`
- Make sure Xcode Command Line Tools are installed: `xcode-select --install`

### Android Issues
- Make sure Android SDK is properly configured
- Check that `ANDROID_HOME` environment variable is set
- Ensure you have accepted Android licenses: `sdkmanager --licenses`

### Storage Issues
- If you want to clear all data, uninstall and reinstall the app
- Data persists between app restarts automatically

## Next Steps

To enhance the app, consider adding:
- Image/file sharing
- Group chats
- Message search
- Export/import chat data
- Multiple chat rooms
- Message timestamps
- Custom themes

## License

Personal use only.

