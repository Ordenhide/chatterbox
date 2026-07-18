# Deploy Firebase Functions

## Quick Start

### Step 1: Login to Firebase

```bash
npx firebase login
```

This will open a browser window for authentication. If you're in China and can't access Firebase, you may need to use a VPN or deploy from a server outside China.

### Step 2: Verify Project

```bash
npx firebase projects:list
```

Make sure `chatterbox-e5d10` is listed.

### Step 3: Set Project (if needed)

```bash
npx firebase use chatterbox-e5d10
```

### Step 4: Deploy Functions

```bash
cd functions
npm install
cd ..
npx firebase deploy --only functions
```

Or use the npm script:

```bash
npm run deploy:functions
```

## Alternative: Deploy from Outside China

If you're in China and Firebase CLI authentication fails:

### Option 1: Use GitHub Actions

Create `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Firebase Functions

on:
  push:
    branches: [main]
    paths:
      - 'functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd functions && npm install
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: chatterbox-e5d10
          channelId: live
          target: functions
```

### Option 2: Deploy from VPS/Server Outside China

1. SSH into a server outside China
2. Clone your repository
3. Run deployment commands there

### Option 3: Use Service Account (No Authentication Required)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save as `service-account-key.json` in project root
4. Set environment variable: `export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"`
5. Deploy: `npx firebase deploy --only functions`

## Troubleshooting

### Error: "command not found: firebase"

**Solution**: Use `npx firebase` instead of `firebase`, or install globally with `sudo npm install -g firebase-tools`

### Error: "Node version mismatch"

**Solution**: The warning is harmless. Node 24 works fine. If you want to suppress it, update `functions/package.json`:

```json
"engines": {
  "node": ">=18"
}
```

### Error: "Authentication failed" (China)

**Solution**: 
- Use VPN
- Deploy from server outside China
- Use service account method (Option 3 above)

### Error: "Functions deploy failed"

**Solution**:
1. Check `functions/index.js` syntax
2. Verify Firebase project ID matches `.firebaserc`
3. Check Firebase Console for error details
4. Ensure billing is enabled (required for Cloud Functions)

## Verify Deployment

After deployment, verify functions are live:

```bash
npx firebase functions:list
```

You should see:
- `claimSession`
- `sessionHeartbeat`

## Test Functions

Test the deployed function:

```bash
# Get auth token first
npx firebase login:ci

# Test claimSession
curl -X POST https://us-central1-chatterbox-e5d10.cloudfunctions.net/claimSession \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"sessionId": "test123", "deviceInfo": {"platform": "ios"}}'
```

## Important Notes

1. **Billing Required**: Cloud Functions require a Blaze (pay-as-you-go) plan
2. **Region**: Functions deploy to `us-central1` by default
3. **Cold Start**: First invocation may take a few seconds
4. **Costs**: Free tier includes 2 million invocations/month

## Next Steps

After deploying:
1. Test login on two devices
2. Verify old session signs out when new login occurs
3. Monitor Cloud Function logs in Firebase Console
4. Check session management is working correctly
