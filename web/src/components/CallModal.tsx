import {useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {
  addCallCandidate,
  endCall as endCallDoc,
  ICE_SERVERS,
  listenCall,
  listenCallCandidates,
  updateCall,
  type CallType,
} from '../services/call';
import {logMissedCall} from '../services/chat';
import {useT} from '../i18n';
import Icon from './Icon';

/** How long the caller rings before giving up and logging a missed call. */
const RING_TIMEOUT_MS = 45_000;

export default function CallModal({
  chatId,
  callId,
  isCaller,
  type,
  me,
  otherName,
  onClose,
}: {
  chatId: string;
  callId: string;
  isCaller: boolean;
  type: CallType;
  me: {uid: string; name: string};
  otherName: string;
  onClose: () => void;
}) {
  const {t} = useT();
  const [status, setStatus] = useState<'connecting' | 'ringing' | 'active' | 'ended'>(
    isCaller ? 'ringing' : 'connecting',
  );
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(type === 'video');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteDescSet = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const startedRef = useRef(false);
  const answeredRef = useRef(false);

  /**
   * Client fallback for the missed-call notice. The server function
   * (functions/index.js → onCallEnded) is authoritative and covers the case
   * where this tab dies mid-ring, but it needs Cloud Functions deployed. Both
   * write the same `missed_<callId>` doc under an existence check, so running
   * both is safe — whichever lands first wins and the other no-ops.
   */
  const logMissed = () => {
    if (!isCaller || answeredRef.current) return;
    logMissedCall(chatId, callId, {uid: me.uid, name: me.name}, type).catch(() => undefined);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let unsubCall: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
      } catch {
        setError('Could not access microphone/camera. Check browser permissions.');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({iceServers: ICE_SERVERS});
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const remoteStream = new MediaStream();
      pc.ontrack = e => {
        e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      };

      pc.onicecandidate = e => {
        if (e.candidate) {
          addCallCandidate(chatId, callId, me.uid, {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          }).catch(() => undefined);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setStatus('active');
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          if (!cancelled) hangUp();
        }
      };

      const drainCandidates = async () => {
        for (const c of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            /* ignore */
          }
        }
        pendingCandidates.current = [];
      };

      // Remote ICE candidates (skip our own).
      unsubCandidates = listenCallCandidates(chatId, callId, (candidate, from) => {
        if (from === me.uid) return;
        if (!remoteDescSet.current) {
          pendingCandidates.current.push(candidate);
        } else {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
        }
      });

      // Signaling via the call doc.
      unsubCall = listenCall(chatId, callId, async call => {
        if (!call) return;
        if (call.status === 'ended') {
          logMissed(); // no-op unless we're the caller and it was never answered
          cleanup();
          onClose();
          return;
        }
        if (call.status === 'active') answeredRef.current = true;
        if (isCaller && call.answer && !remoteDescSet.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer as RTCSessionDescriptionInit));
          remoteDescSet.current = true;
          await drainCandidates();
          answeredRef.current = true;
          setStatus('active');
        }
        if (!isCaller && call.offer && !remoteDescSet.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(call.offer as RTCSessionDescriptionInit));
          remoteDescSet.current = true;
          await drainCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateCall(chatId, callId, {
            answer: {type: answer.type, sdp: answer.sdp || ''},
            status: 'active',
          });
        }
      });

      // Caller kicks off the offer.
      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateCall(chatId, callId, {offer: {type: offer.type, sdp: offer.sdp || ''}});
      }
    })();

    function cleanup() {
      unsubCall?.();
      unsubCandidates?.();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    }

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, callId, isCaller, type, me.uid]);

  const hangUp = () => {
    logMissed(); // cancelled/timed out while still ringing
    endCallDoc(chatId, callId).catch(() => undefined);
    setStatus('ended');
    onClose();
  };

  // Caller gives up after ringing unanswered for a while.
  useEffect(() => {
    if (!isCaller || status !== 'ringing') return;
    const id = setTimeout(() => {
      if (!answeredRef.current) hangUp();
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCaller, status]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const statusLabel = error
    ? ''
    : status === 'active'
    ? t('call.connected')
    : status === 'ringing'
    ? t('call.ringing')
    : t('call.connecting');

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label={`Call with ${otherName}`}>
        {type === 'video' ? (
          <div style={styles.videoStage}>
            <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
            <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
            <div style={styles.videoOverlayName}>{otherName}</div>
          </div>
        ) : (
          <div style={styles.voiceStage}>
            <div style={styles.bigAvatar}>{otherName.charAt(0).toUpperCase()}</div>
            <div style={styles.voiceName}>{otherName}</div>
            {/* hidden audio sink for the remote stream */}
            <video ref={remoteVideoRef} autoPlay playsInline style={{display: 'none'}} />
          </div>
        )}

        <div style={styles.statusText}>{error || statusLabel}</div>

        <div style={styles.controls}>
          <button
            style={{...styles.ctrl, background: micOn ? 'rgba(255,255,255,0.12)' : colors.danger}}
            onClick={toggleMic}
            title={micOn ? 'Mute' : 'Unmute'}>
            <Icon name={micOn ? 'mic' : 'micOff'} size={22} />
          </button>
          {type === 'video' && (
            <button
              style={{...styles.ctrl, background: camOn ? 'rgba(255,255,255,0.12)' : colors.danger}}
              onClick={toggleCam}
              title={camOn ? 'Camera off' : 'Camera on'}>
              <Icon name={camOn ? 'camera' : 'cameraOff'} size={22} />
            </button>
          )}
          <button style={{...styles.ctrl, ...styles.hangup}} onClick={hangUp} title="Hang up">
            <Icon name="phoneOff" size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,10,20,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    background: '#101018',
    borderRadius: 24,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  videoStage: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    background: '#000',
    borderRadius: 16,
    overflow: 'hidden',
  },
  remoteVideo: {width: '100%', height: '100%', objectFit: 'cover'},
  localVideo: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 120,
    borderRadius: 10,
    border: '2px solid rgba(255,255,255,0.5)',
    objectFit: 'cover',
  },
  videoOverlayName: {
    position: 'absolute',
    left: 14,
    top: 12,
    color: '#fff',
    fontWeight: 700,
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
  },
  voiceStage: {display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0'},
  bigAvatar: {
    width: 110,
    height: 110,
    borderRadius: 999,
    background: colors.primary,
    color: '#fff',
    fontSize: 46,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voiceName: {color: '#fff', fontSize: 22, fontWeight: 700},
  statusText: {color: 'rgba(255,255,255,0.7)', margin: '16px 0', minHeight: 20, textAlign: 'center'},
  controls: {display: 'flex', gap: 16, marginTop: 6},
  ctrl: {
    width: 56,
    height: 56,
    borderRadius: 999,
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangup: {background: colors.danger},
};
