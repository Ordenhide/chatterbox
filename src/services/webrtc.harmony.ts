/**
 * WebRTC on HarmonyOS: not implemented, and inert rather than absent.
 *
 * `react-native-webrtc` has no @react-native-oh-tpl counterpart and porting it
 * is new native authoring against HarmonyOS's own media stack, not gluing an
 * existing port — out of scope for v1, the same conclusion harmony/README.md
 * reached for the same reason.
 *
 * What this file changes is the failure. Importing the real package on a
 * platform with no WebRTCModule throws from module scope, and
 * IncomingCallManager is mounted for every signed-in user — so the port could
 * not start, which is a far worse outcome than not being able to call. These
 * stubs make the gap behave like a gap.
 *
 * Every constructor rejects rather than returning a half-object. A call that
 * silently produces a peer connection which never connects is the shape of bug
 * this codebase keeps finding: the mechanism failing quietly while the UI
 * reports progress. Whoever wires calling into a HarmonyOS build will get an
 * error that names this file.
 */
const unavailable = (what: string): never => {
  throw new Error(`${what} is unavailable on HarmonyOS — see services/webrtc.harmony.ts`);
};

/** Renders nothing. A missing video surface must not take the screen down. */
export function RTCView(): null {
  return null;
}

export class RTCPeerConnection {
  constructor() {
    unavailable('RTCPeerConnection');
  }
}

export class RTCIceCandidate {
  constructor() {
    unavailable('RTCIceCandidate');
  }
}

export class RTCSessionDescription {
  constructor() {
    unavailable('RTCSessionDescription');
  }
}

export class MediaStream {
  constructor() {
    unavailable('MediaStream');
  }
}

export const mediaDevices = {
  getUserMedia(): Promise<never> {
    return Promise.reject(
      new Error('mediaDevices.getUserMedia is unavailable on HarmonyOS — see services/webrtc.harmony.ts'),
    );
  },
  enumerateDevices(): Promise<never[]> {
    return Promise.resolve([]);
  },
};
