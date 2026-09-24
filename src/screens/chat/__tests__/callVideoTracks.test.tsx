/**
 * Two ways a video call ended up half audio-only, and neither said so.
 *
 * Reported from a real device as "one side is always audio-only". "Audio only"
 * is one string in one place — CallScreen's remote placeholder, shown when
 * `hasRemoteVideo` is false — so the question was only ever which of the two
 * sides lost its video track and why nothing mentioned it.
 *
 * ## The receiving side: a MediaStream is mutated in place
 *
 * react-native-webrtc keeps one MediaStream object per remote stream id and
 * pushes later tracks into that same object, without dispatching `addtrack`
 * (RTCPeerConnection.ts, the track-event loop inside setRemoteDescription).
 * `hasRemoteVideo` was a `useMemo` over `[remoteStream]`, so the second
 * `setRemoteStream(sameObject)` hit React's Object.is bail-out and the memo
 * kept the answer it computed from the first track for the rest of the call.
 *
 * The local half of this was found and documented months earlier — the comment
 * above `localVideoTrack` describes exactly this failure for the self-view —
 * and the remote half was left alone.
 *
 * ## The sending side: getUserMedia degrades silently
 *
 * Both layers of react-native-webrtc test audio and video together:
 *
 *   src/getUserMedia.ts    if (!audioPerm && !videoPerm) reject(...)
 *   GetUserMediaImpl.java  if (audioTrack == null && videoTrack == null)
 *
 * so a denied camera permission resolves with an audio-only stream and no
 * error. `isVideoEnabled` came from the route params rather than from the
 * stream, so the app claimed the camera was on while sending nothing.
 *
 * ## Why this renders the screen instead of scanning it
 *
 * The first defect *is* a React state-identity bug. Reading the source can
 * check which hook is used; only a render can show that the second track
 * reaches the screen. The sibling test in this directory scans ChatScreen's
 * source because gifted-chat drags untransformed ESM into jest — CallScreen
 * has no such dependency once the native seams are mocked.
 */
import React from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {Text} from 'react-native';

// --- the native and Firebase seams -----------------------------------------

const mockReportError = jest.fn();
jest.mock('../../../services/errorLog', () => ({reportError: (...a: unknown[]) => mockReportError(...a)}));

jest.mock('react-i18next', () => ({useTranslation: () => ({t: (k: string) => k})}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({params: (global as any).__callRouteParams}),
  useNavigation: () => ({goBack: jest.fn(), navigate: jest.fn()}),
}));

jest.mock('../../../contexts/AuthContext', () => ({useAuth: () => ({user: {uid: 'me'}})}));

jest.mock('react-native-incall-manager', () => ({
  start: jest.fn(),
  stop: jest.fn(),
  setSpeakerphoneOn: jest.fn(),
  stopRingtone: jest.fn(),
}));

jest.mock('../../../config/rtc', () => ({
  // 'turn', not 'stun-only': the latter reports an error of its own, which
  // would make the reportError assertions below pass for the wrong reason.
  describeIceServers: async () => ({servers: [], status: 'turn'}),
  describeIceServersForTest: undefined,
}));

jest.mock('../../../services/firebaseChat', () => ({
  addCallCandidate: jest.fn(),
  updateCall: jest.fn(async () => undefined),
  cleanupCallCandidates: jest.fn(async () => undefined),
  listenCall: jest.fn(() => () => undefined),
  listenCallCandidates: jest.fn(() => () => undefined),
}));

jest.mock('../../../components/GlassScreen', () => {
  const {View} = require('react-native');
  return {__esModule: true, default: ({children}: any) => <View>{children}</View>};
});

/** A track is only ever identified by `kind` here, and by object identity. */
const track = (kind: 'audio' | 'video') => ({kind, enabled: true, stop: jest.fn()});

/** Mutated in place, exactly like the library's remote MediaStream. */
function fakeStream(tracks: any[] = []) {
  const _tracks = [...tracks];
  return {
    _tracks,
    getTracks: () => _tracks,
    getAudioTracks: () => _tracks.filter(t => t.kind === 'audio'),
    getVideoTracks: () => _tracks.filter(t => t.kind === 'video'),
    addTrack: (t: any) => _tracks.push(t),
    toURL: () => 'rtc://stream',
  };
}

/** Captures the handlers CallScreen assigns, so a test can fire them. */
class MockPeerConnection {
  ontrack: ((e: any) => void) | null = null;
  onicecandidate: ((e: any) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  iceConnectionState = 'new';
  connectionState = 'new';
  remoteDescription = null;
  addTransceiver = jest.fn();
  addTrack = jest.fn();
  getSenders = jest.fn(() => []);
  createOffer = jest.fn(async () => ({type: 'offer', sdp: 'o'}));
  createAnswer = jest.fn(async () => ({type: 'answer', sdp: 'a'}));
  setLocalDescription = jest.fn(async () => undefined);
  setRemoteDescription = jest.fn(async () => undefined);
  addIceCandidate = jest.fn(async () => undefined);
  close = jest.fn();
  static last: MockPeerConnection | null = null;
  constructor() {
    MockPeerConnection.last = this;
  }
}

/** Marks the RTCViews so the tree can be asked which ones are on screen. */
const mockRTCView = ({zOrder}: any) => <Text>{`rtcview:${zOrder}`}</Text>;


jest.mock('../../../services/webrtc', () => ({
  RTCPeerConnection: MockPeerConnection,
  RTCIceCandidate: class {},
  RTCSessionDescription: class {},
  MediaStream: class {
    _tracks: any[] = [];
    getTracks() {
      return this._tracks;
    }
    getVideoTracks() {
      return this._tracks.filter(t => t.kind === 'video');
    }
    getAudioTracks() {
      return this._tracks.filter(t => t.kind === 'audio');
    }
    addTrack(t: any) {
      this._tracks.push(t);
    }
    toURL() {
      return 'rtc://built';
    }
  },
  RTCView: (props: any) => mockRTCView(props),
  mediaDevices: {getUserMedia: (...a: unknown[]) => (global as any).__getUserMedia(...a)},
}));

/**
 * Required, not imported: babel hoists every jest.mock above the imports, so
 * an `import` of the screen would run the webrtc factory before the class it
 * returns has been declared.
 */
let CallScreen: React.ComponentType;
beforeAll(() => {
  CallScreen = require('../CallScreen').default;
});

/** Every Text in the tree, which is how the placeholder and buttons are read. */
const texts = (tree: ReactTestRenderer): string[] =>
  tree.root.findAllByType(Text).flatMap(n => {
    const kids = Array.isArray(n.props.children) ? n.props.children : [n.props.children];
    return kids.filter((c: unknown) => typeof c === 'string');
  });

const shows = (tree: ReactTestRenderer, needle: string) => texts(tree).some(s => s.includes(needle));

/** Renders and lets setup()'s awaited getUserMedia / ICE lookup settle. */
async function mount(params: object, stream: any): Promise<ReactTestRenderer> {
  (global as any).__callRouteParams = params;
  (global as any).__getUserMedia = jest.fn(async () => stream);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CallScreen />);
  });
  // setup() awaits getUserMedia and then describeIceServers; one more flush
  // covers both before the peer connection is expected to exist.
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

beforeEach(() => {
  mockReportError.mockClear();
  MockPeerConnection.last = null;
});

describe('the screen it renders is the call it actually has', () => {
  it('mounts far enough to hold a peer connection and its handlers', async () => {
    // Pinned first, because every case below drives the screen through
    // MockPeerConnection.last.ontrack. If setup() ever stops getting that far,
    // those cases would fire nothing and assert against an untouched screen —
    // and three of them assert that something is *absent*.
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'video'},
      fakeStream([track('audio'), track('video')]),
    );
    expect(MockPeerConnection.last).not.toBeNull();
    expect(typeof MockPeerConnection.last!.ontrack).toBe('function');
    expect(shows(tree, 'call.waitingRemote')).toBe(true);
  });

  it('shows the remote video that arrives after the first track', async () => {
    // The mid-call case: the peer answered with the camera off and turned it
    // on, so the video track arrives in its own renegotiation — a separate
    // tick, long after `remoteStream` was set from the audio track. The stream
    // object is the same one both times, which is the whole difficulty.
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'video'},
      fakeStream([track('audio'), track('video')]),
    );
    const pc = MockPeerConnection.last!;
    const remote = fakeStream();

    const audio = track('audio');
    await act(async () => {
      remote.addTrack(audio);
      pc.ontrack!({streams: [remote], track: audio});
    });
    expect(shows(tree, 'call.audioOnly') || shows(tree, 'call.waitingRemote')).toBe(true);
    expect(shows(tree, 'rtcview:0')).toBe(false);

    const video = track('video');
    await act(async () => {
      remote.addTrack(video);
      pc.ontrack!({streams: [remote], track: video});
    });
    expect(shows(tree, 'rtcview:0')).toBe(true);
    expect(shows(tree, 'call.audioOnly')).toBe(false);
  });

  it('keeps saying audio only when the peer really sends no video', async () => {
    // The other half of the same claim: this must not become "always show the
    // remote view", which would replace a wrong label with a black rectangle.
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'video'},
      fakeStream([track('audio'), track('video')]),
    );
    const pc = MockPeerConnection.last!;
    const remote = fakeStream();
    const audio = track('audio');
    await act(async () => {
      remote.addTrack(audio);
      pc.ontrack!({streams: [remote], track: audio});
      pc.iceConnectionState = 'connected';
      pc.oniceconnectionstatechange!();
    });
    expect(shows(tree, 'call.audioOnly')).toBe(true);
    expect(shows(tree, 'rtcview:0')).toBe(false);
  });
});

describe('a camera the app did not get is not a camera that is on', () => {
  it('reports it and offers video as off when getUserMedia returns no video track', async () => {
    // A denied camera permission: getUserMedia resolves, with audio only and
    // no error. The route asked for a video call with the camera on.
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'video', camOn: true},
      fakeStream([track('audio')]),
    );

    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), 'call_video_track_missing');
    // "Video On" is the offer to turn it on — so the button is an honest retry
    // rather than a claim that the camera is already live.
    expect(shows(tree, 'call.videoOn')).toBe(true);
    expect(shows(tree, 'call.videoOff')).toBe(false);
    // And no self-view, which is the truth: there is no local video track.
    expect(shows(tree, 'rtcview:1')).toBe(false);
  });

  it('says nothing about a camera a voice call never asked for', async () => {
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'voice'},
      fakeStream([track('audio')]),
    );
    expect(mockReportError).not.toHaveBeenCalledWith(expect.any(Error), 'call_video_track_missing');
    expect(shows(tree, 'call.videoOn')).toBe(true);
  });

  it('leaves a working camera alone', async () => {
    const tree = await mount(
      {chatId: 'c', callId: 'k', isCaller: true, type: 'video', camOn: true},
      fakeStream([track('audio'), track('video')]),
    );
    expect(mockReportError).not.toHaveBeenCalledWith(expect.any(Error), 'call_video_track_missing');
    expect(shows(tree, 'call.videoOff')).toBe(true);
    expect(shows(tree, 'rtcview:1')).toBe(true);
  });
});
