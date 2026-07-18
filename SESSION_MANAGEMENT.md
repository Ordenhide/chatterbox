# Strict Session Management

## Overview

This implementation ensures that **only one active session exists per user** across all devices and platforms. When a user logs in on a new device/platform, all other sessions are immediately terminated.

## How It Works

### 1. Token Revocation (Critical)

When a user logs in:
1. **Cloud Function revokes all existing refresh tokens** using `admin.auth().revokeRefreshTokens(uid)`
2. This immediately invalidates all Firebase Auth tokens on other devices
3. Old sessions detect token revocation and sign out automatically

### 2. Session ID Tracking

- Each device gets a unique session ID (stored locally)
- Session ID is stored in Firestore: `users/{uid}/activeSessionId`
- Real-time listener detects when session ID changes
- If session ID doesn't match, device signs out immediately

### 3. Device Information

- Tracks platform (iOS/Android), device ID, device name, app version
- Stored in Firestore for monitoring and debugging
- Helps identify which device is currently active

### 4. Heartbeat Mechanism

- Active session sends heartbeat every 60 seconds
- Keeps session alive and detects stale sessions
- If heartbeat fails, session might be invalid

### 5. Token Revocation Detection

- Client checks token validity every 10 seconds
- If token is revoked, user is immediately signed out
- Shows alert: "You've been signed out because you logged in on another device"

## Architecture

```
┌─────────────────┐
│  Device A       │
│  (Old Session)  │
└────────┬────────┘
         │
         │ Token Revoked
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Device B       │────▶│  Cloud Function  │────▶│  Firebase Auth  │
│  (New Login)    │     │  claimSession    │     │  Revoke Tokens  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │
         │                        │ Update Session ID
         │                        ▼
         │              ┌──────────────────┐
         └─────────────▶│    Firestore     │
                        │  activeSessionId │
                        └──────────────────┘
                                 │
                                 │ Real-time Update
                                 ▼
                        ┌─────────────────┐
                        │  Device A        │
                        │  Detects Change  │
                        │  Signs Out       │
                        └─────────────────┘
```

## Setup Instructions

### Step 1: Deploy Cloud Functions

The Cloud Functions **must be deployed** for token revocation to work:

```bash
cd functions
npm install
firebase deploy --only functions
```

**Critical**: Without Cloud Functions, old sessions won't be immediately invalidated. They'll only be detected when:
- The app checks session ID (on app resume)
- The real-time listener detects session change
- Token expires naturally (can take hours)

### Step 2: Verify Firestore Rules

Ensure your Firestore rules allow users to update their own `activeSessionId`:

```javascript
match /users/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### Step 3: Test Session Management

1. **Login on Device A** (e.g., iPhone)
2. **Login on Device B** (e.g., Android)
3. **Device A should immediately sign out** (within 10 seconds)
4. **Device B remains logged in**

## Code Flow

### Login Flow

```typescript
1. User enters credentials
2. Firebase Auth signs in → Gets auth token
3. Generate new session ID
4. Call Cloud Function: claimSession(sessionId, deviceInfo)
   ├─ Revoke all existing refresh tokens
   ├─ Set new session ID in Firestore
   └─ Track device information
5. Set up real-time listener for session changes
6. Start heartbeat mechanism
```

### Session Detection Flow

```typescript
1. Real-time listener detects session ID change
2. OR Token check detects revocation
3. Sign out immediately
4. Show alert: "Logged in on another device"
```

## Key Components

### Cloud Function: `claimSession`

**Location**: `functions/index.js`

**What it does**:
- Revokes all refresh tokens (forces logout everywhere)
- Sets new session ID
- Tracks device information
- Returns success

**Required parameters**:
- `sessionId`: Unique session identifier
- `deviceInfo`: Platform, device ID, device name, app version

### Cloud Function: `sessionHeartbeat`

**Location**: `functions/index.js`

**What it does**:
- Verifies session is still active
- Updates heartbeat timestamp
- Keeps session alive

**Required parameters**:
- `sessionId`: Current session ID

### Client: `AuthContext.tsx`

**Key features**:
- Calls Cloud Function on login
- Listens for session changes
- Detects token revocation
- Sends heartbeat every 60 seconds
- Signs out immediately on session mismatch

### Device Info Service

**Location**: `src/services/deviceInfo.ts`

**What it provides**:
- Platform (iOS/Android)
- Device ID (unique per device)
- Device name
- App version

## Security Considerations

### Token Revocation

- **Immediate**: Old tokens are revoked instantly
- **Irreversible**: Once revoked, tokens cannot be used
- **Universal**: Works across all platforms (iOS, Android, Web)

### Session ID

- **Unique**: Generated per device/login
- **Random**: Uses timestamp + random string
- **Stored**: Locally in MMKV storage
- **Validated**: Checked on every app resume

### Heartbeat

- **Frequency**: Every 60 seconds
- **Purpose**: Keep session alive, detect stale sessions
- **Failure**: If heartbeat fails, session might be invalid

## Monitoring

### Firestore Structure

```javascript
users/{uid} {
  activeSessionId: "sess_1234567890_abc123",
  sessionUpdatedAt: Timestamp,
  sessionClaimedAt: Timestamp,
  sessionHeartbeatAt: Timestamp,
  deviceInfo: {
    platform: "ios",
    deviceId: "device_123",
    deviceName: "John's iPhone",
    appVersion: "1.0.0"
  },
  tokensRevokedAt: Timestamp
}
```

### Logs

Cloud Functions log:
- Session claims
- Token revocations
- Heartbeat failures
- Errors

## Troubleshooting

### Old Sessions Not Signing Out

**Possible causes**:
1. Cloud Functions not deployed
2. Network issues preventing token revocation
3. App not checking token revocation frequently enough

**Solutions**:
1. Deploy Cloud Functions: `firebase deploy --only functions`
2. Check Cloud Function logs in Firebase Console
3. Verify real-time listener is active

### Session ID Mismatch But User Still Logged In

**Possible causes**:
1. Real-time listener not working
2. Firestore rules blocking updates
3. Network connectivity issues

**Solutions**:
1. Check Firestore rules allow session updates
2. Verify network connectivity
3. Check Firestore listener is subscribed

### Heartbeat Failing

**Possible causes**:
1. Cloud Function not deployed
2. Network issues
3. Session already invalidated

**Solutions**:
1. Deploy Cloud Functions
2. Check network connectivity
3. Verify session ID matches

## Testing

### Manual Test

1. Install app on two devices (or simulator + device)
2. Login on Device A
3. Verify Device A is logged in
4. Login on Device B with same credentials
5. **Expected**: Device A signs out within 10 seconds
6. **Expected**: Device B remains logged in

### Automated Test

```typescript
// Test session claim
const claimSessionFn = httpsCallable(functions, 'claimSession');
await claimSessionFn({
  sessionId: 'test_session_123',
  deviceInfo: {
    platform: 'ios',
    deviceId: 'test_device',
    deviceName: 'Test Device',
    appVersion: '1.0.0',
  },
});

// Verify old tokens are revoked
// (Old session should detect and sign out)
```

## Fallback Behavior

If Cloud Functions are not available:
- Session ID tracking still works
- Real-time listener still detects changes
- **BUT**: Token revocation doesn't happen immediately
- Old sessions will sign out when:
  - App resumes and checks session
  - Real-time listener detects change
  - Token expires naturally

**Recommendation**: Always deploy Cloud Functions for immediate session termination.

## Performance

- **Token Revocation**: < 1 second
- **Session Detection**: < 10 seconds (polling interval)
- **Heartbeat**: Every 60 seconds (minimal overhead)
- **Real-time Listener**: Instant (when Firestore updates)

## Best Practices

1. **Always deploy Cloud Functions** for production
2. **Monitor session claims** in Cloud Function logs
3. **Track device information** for security auditing
4. **Test on multiple devices** before release
5. **Handle network failures** gracefully (fallback to Firestore)

## Future Enhancements

- [ ] Session history tracking (which devices logged in)
- [ ] Remote session termination (user can sign out specific devices)
- [ ] Session expiration (auto-logout after inactivity)
- [ ] Multi-factor authentication integration
- [ ] Suspicious login detection
