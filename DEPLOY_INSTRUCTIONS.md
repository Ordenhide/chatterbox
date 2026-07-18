# Firebase Deployment Instructions (China/Proxy-Friendly)

Since Firebase CLI authentication fails with VPN/proxy in China, here are your options:

## ⚠️ IMPORTANT: Current Implementation Requires Cloud Functions

The current strict session management uses **custom claims** which require Cloud Functions. Without deploying the `claimSession` function, the app will fail on login.

## Option 1: Manual Rule Deployment (Do This First)

### Deploy Firestore Rules:
1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project (`chatterbox-e5d10`) → Firestore Database → Rules
2. Copy the **entire contents** of `firestore.rules`
3. Paste into the Rules editor
4. Click **"Publish"**

### Deploy Storage Rules:
1. Go to Firebase Console → Storage → Rules
2. Copy the **entire contents** of `storage.rules`
3. Paste into the Rules editor
4. Click **"Publish"**

## Option 2: Deploy Cloud Functions

### Method A: Use GitHub Actions (Recommended for China)
1. Create a GitHub repository
2. Add a GitHub Actions workflow that deploys functions
3. GitHub Actions can authenticate without proxy issues

### Method B: Use a VPS/Server Outside China
1. SSH into a server outside China
2. Install Firebase CLI there
3. Deploy functions from that server

### Method C: Manual Function Deployment (Not Recommended)
Cloud Functions cannot be deployed via Firebase Console UI. You must use CLI or CI/CD.

## Option 3: Simplified Version (No Cloud Functions) ✅ READY

I've created a simplified version that works **without Cloud Functions**:

### Files Created:
- `src/contexts/AuthContext.simple.tsx` - Simplified auth context using Firestore transactions
- `firestore.rules.simple` - Simplified rules (no custom claims required)
- `storage.rules.simple` - Simplified Storage rules (no custom claims required)

### To Switch to Simplified Version:

1. **Backup current files:**
   ```bash
   cp src/contexts/AuthContext.tsx src/contexts/AuthContext.full.tsx
   cp firestore.rules firestore.rules.full
   cp storage.rules storage.rules.full
   ```

2. **Use simplified versions:**
   ```bash
   cp src/contexts/AuthContext.simple.tsx src/contexts/AuthContext.tsx
   cp firestore.rules.simple firestore.rules
   cp storage.rules.simple storage.rules
   ```

3. **Deploy simplified rules manually:**
   - Firestore: copy `firestore.rules` → Firebase Console → Firestore Rules → Paste → Publish
   - Storage: copy `storage.rules` → Firebase Console → Storage Rules → Paste → Publish

4. **Remove Cloud Functions dependency (optional):**
   ```bash
   npm uninstall @react-native-firebase/functions
   ```

### How It Works:
- Uses **Firestore transactions** to atomically claim sessions
- Old sessions are signed out via **Firestore listeners** (within seconds)
- **Less secure** than custom claims (rules can't enforce session matching)
- **Works immediately** without Cloud Functions deployment

### Trade-offs:
- ✅ Works without Cloud Functions
- ✅ Still enforces single active session
- ⚠️ Old sessions aren't blocked by security rules (only client-side)
- ⚠️ Slight delay before old session is signed out (listener latency)

