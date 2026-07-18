# Quick Start Guide - Installing on iPhone

## Step 1: Install Node.js

You need Node.js installed first. Choose one method:

### Option A: Using Homebrew (Recommended)
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

### Option B: Download from Official Website
1. Go to https://nodejs.org/
2. Download the LTS version (v18 or higher)
3. Install the `.pkg` file
4. Restart your terminal

### Verify Installation
```bash
node --version
npm --version
```

You should see version numbers (e.g., v18.17.0 and 9.6.7)

## Step 2: Initialize React Native Project

**Important:** You're currently in `/Users/xiaohanliu/Documents/chatterbox` which has your source code.

You need to go **up one directory level** and create a new React Native project there:

```bash
# Go to parent directory
cd /Users/xiaohanliu/Documents

# Create React Native project
npx react-native init Chatterbox --version 0.73.0
```

This will create a new folder: `/Users/xiaohanliu/Documents/Chatterbox`

## Step 3: Copy Your Source Files

After the React Native project is created, copy your source files:

```bash
# Copy your source folder
cp -r /Users/xiaohanliu/Documents/chatterbox/src /Users/xiaohanliu/Documents/Chatterbox/

# Copy configuration files
cp /Users/xiaohanliu/Documents/chatterbox/package.json /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/tsconfig.json /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/babel.config.js /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/.eslintrc.js /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/metro.config.js /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/App.tsx /Users/xiaohanliu/Documents/Chatterbox/
cp /Users/xiaohanliu/Documents/chatterbox/index.js /Users/xiaohanliu/Documents/Chatterbox/
```

## Step 4: Install Dependencies

```bash
cd /Users/xiaohanliu/Documents/Chatterbox
npm install
```

## Step 5: Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

**Note:** If you don't have CocoaPods:
```bash
sudo gem install cocoapods
```

## Step 6: Open in Xcode

```bash
open ios/Chatterbox.xcworkspace
```

Then follow the steps in `INSTALL_IPHONE.md` for configuring and installing on your iPhone.

---

## Alternative: Manual Setup (If React Native Init Fails)

If `react-native init` doesn't work, you can manually create the iOS project structure, but it's much more complex. The recommended approach is to use `react-native init`.

