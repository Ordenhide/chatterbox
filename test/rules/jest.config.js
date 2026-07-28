// Isolated from the root Jest config on purpose: that one uses the
// react-native preset (RN mocks, jsdom-like environment) for testing app
// code. These tests are plain Node hitting a local Firestore/Storage
// emulator over HTTP — no RN, no app code — so they get their own minimal
// config rather than fighting the RN preset's transforms and module mocks.
module.exports = {
  rootDir: '../..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/rules/**/*.test.js'],
  testTimeout: 20000,
  // Every test file talks to the *same* running emulator instance (one
  // Firestore/Storage pair, started once by `emulators:exec`), and
  // clearFirestore()/clearStorage() reset that instance's data project-wide,
  // not just whatever the calling file wrote. Jest's default is to run
  // separate test files in parallel worker processes, which raced file A's
  // afterEach(clearFirestore) against file B's seed writes and produced
  // flaky "document not found" failures that were really a test-harness bug,
  // not a rules bug. Forcing one worker makes the suite deterministic.
  maxWorkers: 1,
};
