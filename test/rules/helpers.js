const fs = require('fs');
const path = require('path');
const {initializeTestEnvironment} = require('@firebase/rules-unit-testing');

// A "demo-" project id is the documented safe default for rules-unit-testing:
// the emulators treat it as fake, so there is no risk of these tests ever
// touching the real chatterbox-e5d10 project even if credentials happen to be
// present in the environment they run in.
const PROJECT_ID = 'demo-chatterbox-rules-test';

/**
 * Both rules files are loaded into one environment regardless of which one a
 * given test file exercises: storage.rules calls firestore.get(...)
 * internally (hasActiveSession, isChatParticipant), so Storage rule tests
 * need a live Firestore emulator to seed against too.
 */
async function makeTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: fs.readFileSync(path.join(__dirname, '../../storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
}

module.exports = {makeTestEnv, PROJECT_ID};
