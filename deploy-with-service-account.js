#!/usr/bin/env node

/**
 * Deploy Firebase Functions using Service Account
 * 
 * This script uses gcloud CLI (which supports service accounts) to deploy functions.
 * 
 * Requirements:
 * 1. Install gcloud CLI: brew install google-cloud-sdk
 * 2. Have service-account-key.json in project root
 * 3. Run: node deploy-with-service-account.js
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account-key.json');
const FUNCTIONS_DIR = path.join(__dirname, 'functions');
const PROJECT_ID = 'chatterbox-e5d10';

// Check if service account exists
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Error: service-account-key.json not found!');
  console.error('\n📋 Setup Instructions:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save the JSON file as "service-account-key.json" in the project root');
  process.exit(1);
}

// Check if gcloud is installed
try {
  execSync('which gcloud', {stdio: 'ignore'});
} catch {
  console.error('❌ Error: gcloud CLI not found!');
  console.error('\n📋 Install gcloud CLI:');
  console.error('  brew install google-cloud-sdk');
  console.error('\nOr use alternative deployment methods (see DEPLOY_FUNCTIONS_FIXED.md)');
  process.exit(1);
}

console.log('🚀 Deploying Firebase Functions using Service Account...\n');

try {
  // Step 1: Authenticate with service account
  console.log('1️⃣ Authenticating with service account...');
  execSync(`gcloud auth activate-service-account --key-file="${SERVICE_ACCOUNT_PATH}"`, {
    stdio: 'inherit',
  });

  // Step 2: Set project
  console.log('\n2️⃣ Setting project...');
  execSync(`gcloud config set project ${PROJECT_ID}`, {
    stdio: 'inherit',
  });

  // Step 3: Install dependencies
  console.log('\n3️⃣ Installing function dependencies...');
  execSync('npm install', {
    cwd: FUNCTIONS_DIR,
    stdio: 'inherit',
  });

  // Step 4: Deploy functions using Firebase CLI with gcloud credentials
  console.log('\n4️⃣ Deploying functions...');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
  
  // Try to get a Firebase CI token using gcloud
  try {
    console.log('   Attempting to authenticate Firebase CLI...');
    // Use gcloud to get access token and pass it to Firebase
    const accessToken = execSync(
      `gcloud auth print-access-token --key-file="${SERVICE_ACCOUNT_PATH}"`,
      {encoding: 'utf-8', stdio: 'pipe'}
    ).trim();
    
    // Set token for Firebase CLI
    process.env.FIREBASE_TOKEN = accessToken;
    
    execSync(`npx firebase deploy --only functions --project ${PROJECT_ID}`, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        FIREBASE_TOKEN: accessToken,
      },
    });
  } catch (error) {
    console.error('\n⚠️  Firebase CLI deployment failed. Trying alternative method...');
    console.error('   Error:', error.message);
    
    // Alternative: Use gcloud functions deploy directly
    console.log('\n   Trying gcloud functions deploy...');
    try {
      const functionName = 'claimSession';
      const region = 'us-central1';
      
      // Note: This requires the function to be packaged differently
      // For now, let's show the user how to use Firebase CLI with token
      console.log('\n💡 Alternative: Use Firebase CLI with access token');
      console.log('   1. Get access token:');
      console.log(`      gcloud auth print-access-token --key-file="${SERVICE_ACCOUNT_PATH}"`);
      console.log('   2. Use token with Firebase CLI:');
      console.log('      export FIREBASE_TOKEN="<token-from-step-1>"');
      console.log('      npx firebase deploy --only functions');
      
      throw error; // Re-throw to show original error
    } catch (altError) {
      throw error; // Show original Firebase CLI error
    }
  }

  console.log('\n✅ Functions deployed successfully!');
  console.log('\n📋 Verify deployment:');
  console.log(`   npx firebase functions:list --project ${PROJECT_ID}`);
} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  console.error('\n💡 Troubleshooting:');
  console.error('1. Check service account has Cloud Functions Admin role');
  console.error('2. Verify billing is enabled (Blaze plan required)');
  console.error('3. Check functions/index.js for syntax errors');
  process.exit(1);
}
