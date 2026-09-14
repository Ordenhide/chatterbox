/**
 * The WebRTC seam.
 *
 * One more platform pair, for the same reason as the Firebase ones: a call
 * site should not know which platform it is on, and `react-native-webrtc` has
 * no HarmonyOS implementation.
 *
 * It matters more here than it looks. That package throws from module scope:
 *
 *   const {WebRTCModule} = NativeModules;
 *   if (WebRTCModule === null) { throw new Error('WebRTC native module not found.') }
 *   setupNativeEvents();
 *
 * and the check is `=== null`, while an unregistered native module is
 * `undefined` — so it misses, and `setupNativeEvents()` goes on to build a
 * NativeEventEmitter over nothing. Either way the failure is at import, and
 * IncomingCallManager is mounted for every signed-in user, which puts it on
 * the startup path. "Calling is out of scope for the HarmonyOS port" was
 * therefore implemented as "the app does not start".
 */
export {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
