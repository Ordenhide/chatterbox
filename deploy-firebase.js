#!/usr/bin/env node

/**
 * Firebase Deployment Script using Service Account
 * 
 * This script deploys Firebase Functions and Rules without requiring CLI authentication.
 * 
 * Setup:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Save the JSON file as `service-account-key.json` in the project root
 * 4. Run: node deploy-firebase.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account-key.json');
const FUNCTIONS_DIR = path.join(__dirname, 'functions');
const RULES_DIR = __dirname;

// Check if service account file exists
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Error: service-account-key.json not found!');
  console.error('\n📋 Setup Instructions:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save the JSON file as "service-account-key.json" in the project root');
  console.error('4. Run this script again: node deploy-firebase.js');
  process.exit(1);
}

// Initialize Firebase Admin with service account
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

console.log('✅ Firebase Admin initialized with service account');

// Deploy Firestore Rules
async function deployFirestoreRules() {
  console.log('\n📝 Deploying Firestore Rules...');
  const rulesPath = path.join(RULES_DIR, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error('❌ firestore.rules not found!');
    return false;
  }
  
  try {
    // Use Firebase CLI with service account via environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
    execSync(`npx firebase-tools deploy --only firestore:rules --token "${process.env.FIREBASE_TOKEN || ''}"`, {
      cwd: RULES_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Firestore Rules deployed');
    return true;
  } catch (error) {
    console.error('❌ Failed to deploy Firestore Rules:', error.message);
    return false;
  }
}

// Deploy Storage Rules
async function deployStorageRules() {
  console.log('\n📦 Deploying Storage Rules...');
  const rulesPath = path.join(RULES_DIR, 'storage.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error('❌ storage.rules not found!');
    return false;
  }
  
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
    execSync(`npx firebase-tools deploy --only storage:rules --token "${process.env.FIREBASE_TOKEN || ''}"`, {
      cwd: RULES_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Storage Rules deployed');
    return true;
  } catch (error) {
    console.error('❌ Failed to deploy Storage Rules:', error.message);
    return false;
  }
}

// Deploy Cloud Functions
async function deployFunctions() {
  console.log('\n⚡ Deploying Cloud Functions...');
  
  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.error('❌ functions directory not found!');
    return false;
  }
  
  try {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = SERVICE_ACCOUNT_PATH;
    execSync(`npx firebase-tools deploy --only functions --token "${process.env.FIREBASE_TOKEN || ''}"`, {
      cwd: FUNCTIONS_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Cloud Functions deployed');
    return true;
  } catch (error) {
    console.error('❌ Failed to deploy Cloud Functions:', error.message);
    return false;
  }
}

// Main deployment function
async function deploy() {
  console.log('🚀 Starting Firebase Deployment...\n');
  
  const results = {
    firestore: await deployFirestoreRules(),
    storage: await deployStorageRules(),
    functions: await deployFunctions(),
  };
  
  console.log('\n📊 Deployment Summary:');
  console.log(`  Firestore Rules: ${results.firestore ? '✅' : '❌'}`);
  console.log(`  Storage Rules: ${results.storage ? '✅' : '❌'}`);
  console.log(`  Cloud Functions: ${results.functions ? '✅' : '❌'}`);
  
  if (Object.values(results).every(r => r)) {
    console.log('\n🎉 All deployments successful!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some deployments failed. Please check the errors above.');
    process.exit(1);
  }
}

deploy().catch(error => {
  console.error('❌ Deployment error:', error);
  process.exit(1);
});

