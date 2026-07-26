import {DeviceEventEmitter} from 'react-native';
import {mmkvStorage} from './storageMMKV';

// First-run guided tour (parity with the web client's tutorial). The "seen"
// flag lives in MMKV; a DeviceEventEmitter event lets Profile → "Replay
// tutorial" re-open the tour that App hosts, from anywhere in the tree.
const KEY = 'tutorial_seen_v1';
export const TUTORIAL_EVENT = 'cb:start-tutorial';

export function hasSeenTutorial(): boolean {
  return mmkvStorage.getBoolean(KEY) === true;
}

export function markTutorialSeen(): void {
  mmkvStorage.setBoolean(KEY, true);
}

/** Ask App to (re)open the tutorial, from anywhere. */
export function startTutorial(): void {
  DeviceEventEmitter.emit(TUTORIAL_EVENT);
}
