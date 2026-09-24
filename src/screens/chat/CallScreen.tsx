import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from '../../services/webrtc';
import InCallManager from 'react-native-incall-manager';
import {useRoute, useNavigation} from '@react-navigation/native';
import {useAuth} from '../../contexts/AuthContext';
import {getColors} from '../../theme/colors';
import {useColorScheme} from 'react-native';
import {
  addCallCandidate,
  listenCall,
  listenCallCandidates,
  updateCall,
  cleanupCallCandidates,
} from '../../services/firebaseChat';
import {CallType} from '../../types';
import {describeIceServers} from '../../config/rtc';
import {reportError} from '../../services/errorLog';
import GlassScreen from '../../components/GlassScreen';
import {bodyWeight} from '../../theme/typography';

export default function CallScreen() {
  const {t} = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const {user} = useAuth();
  const colors = getColors(useColorScheme());
  const chatId = (route.params as any)?.chatId as string;
  const callId = (route.params as any)?.callId as string;
  const isCaller = (route.params as any)?.isCaller as boolean;
  const callType = ((route.params as any)?.type as CallType) || 'voice';
  // Camera state chosen on the answer screen, before the call was accepted.
  const initialCamOn = ((route.params as any)?.camOn ?? true) as boolean;

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video' && initialCamOn);
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [status, setStatus] = useState<'ringing' | 'active' | 'ended'>('ringing');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const lastOfferSdpRef = useRef<string | null>(null);
  const lastAnswerSdpRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const lastIceRestartAtRef = useRef<number>(0);
  const restartingIceRef = useRef(false);
  const makingOfferRef = useRef(false);

  /**
   * State rather than derived from localStream, because a MediaStream is
   * mutated in place: toggleVideo adds a track to the existing stream and
   * hands the same object back to setLocalStream, so React's Object.is bail-out
   * means a value memoised on [localStream] never recomputes. Deriving the
   * track that way left the self-view permanently absent after turning the
   * camera on mid-call.
   */
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  /**
   * And the remote video track, for exactly the same reason one level out.
   *
   * This was `useMemo(() => remoteStream.getVideoTracks().length > 0,
   * [remoteStream])`, which cannot work: react-native-webrtc creates one
   * MediaStream per remote stream id and *pushes later tracks into that same
   * object* (RTCPeerConnection.ts, the sRD track-event loop) without
   * dispatching `addtrack`. So the second `setRemoteStream(sameObject)` hits
   * React's Object.is bail-out, the memo's dependency never changes, and the
   * answer computed on the first track stood for the whole call.
   *
   * The visible bug was the other side's camera coming on mid-call — via
   * toggleVideo, or by answering with it off and turning it on — and never
   * appearing here: a permanent "Audio only" against a peer that was sending
   * video. `event.track` is a fresh object per track, so keying off it is
   * what makes the second event a state change at all.
   */
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);

  const localAudioTrack = useMemo(() => {
    if (!localStream) return null;
    return localStream.getAudioTracks()?.[0] || null;
  }, [localStream]);

  // isVideoEnabled, not track.enabled: the latter is mutated by toggleVideo
  // without changing any dependency, so reading it from a memo showed whatever
  // the camera was doing when the call started and never updated again.
  const hasLocalVideo = !!localVideoTrack && isVideoEnabled;

  const hasRemoteVideo = !!remoteVideoTrack;

  useEffect(() => {
    let candidateUnsub: (() => void) | null = null;
    let callUnsub: (() => void) | null = null;
    let isMounted = true;

    const setup = async () => {
      if (!user || !chatId || !callId) return;

      // react-native-webrtc 124 tightened MediaTrackConstraints to describe
      // only *video* fields (width/height/frameRate/facingMode/deviceId/
      // groupId) — it declares no audio properties at all. These are standard
      // WebRTC audio constraints and are still forwarded to the native layer
      // unchanged, so this is a gap in the library's types, not a behaviour
      // change.
      //
      // The target type is derived from getUserMedia's own signature rather
      // than imported: the library does not export the constraint type from
      // its package root, and reaching into lib/typescript/ would break on any
      // internal reshuffle. Scoped to the audio object alone, so the video
      // constraint below stays type-checked.
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Best-effort hints; some platforms ignore these.
        sampleRate: 48000,
        channelCount: 1,
        googEchoCancellation: true,
        googNoiseSuppression: true,
        googAutoGainControl: true,
        googHighpassFilter: true,
      } as unknown as Parameters<typeof mediaDevices.getUserMedia>[0]['audio'];

      const stream = await mediaDevices.getUserMedia({
        audio: audioConstraints,
        // Explicitly the front camera. `video: true` leaves the choice to the
        // platform, and a video call opening on the rear camera is never what
        // was meant.
        video: callType === 'video' ? {facingMode: 'user'} : false,
      });
      if (!isMounted) return;
      // Apply the answer-screen camera choice before the track is attached to
      // the peer connection, so a call answered with the camera off never
      // transmits a frame.
      if (callType === 'video' && !initialCamOn) {
        stream.getVideoTracks().forEach((track: any) => {
          track.enabled = false;
        });
      }
      // getUserMedia resolving does not mean it gave us what we asked for.
      // Both layers of react-native-webrtc degrade a video-only failure
      // silently, on purpose:
      //
      //   src/getUserMedia.ts   if (!audioPerm && !videoPerm) reject(...)
      //                         videoPerm || delete constraints.video
      //   GetUserMediaImpl.java if (audioTrack == null && videoTrack == null)
      //
      // Both conditions are `&&`, so a denied camera permission — or a
      // capturer that cannot be created — resolves with an audio-only stream
      // and no error anywhere.
      //
      // Nothing here noticed. isVideoEnabled was seeded from the route params,
      // so the button went on reading "Video Off" as though the camera were
      // live, the self-view was absent with nothing to explain it, and the
      // peer showed "Audio only" for the whole call. It hit whoever *started*
      // the call, because the answer screen's camera preview has already asked
      // for the permission by the time the callee reaches this line.
      //
      // So the flag comes from whether a track exists rather than from what
      // was requested. That also makes the button an honest retry: it reads
      // "Video On", and toggleVideo asks for the camera again and reports a
      // second failure to the user instead of swallowing it.
      const videoTrack = stream.getVideoTracks()?.[0] || null;
      if (callType === 'video' && !videoTrack) {
        reportError(new Error('video call started with no camera track'), 'call_video_track_missing');
        setIsVideoEnabled(false);
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setLocalVideoTrack(videoTrack);
      InCallManager.start({media: callType === 'video' ? 'video' : 'audio'});
      if (typeof (InCallManager as any).setAudioSessionMode === 'function') {
        (InCallManager as any).setAudioSessionMode(callType === 'video' ? 'videoChat' : 'voiceChat');
      }
      InCallManager.setSpeakerphoneOn(callType === 'video');
      if (typeof (InCallManager as any).setForceSpeakerphoneOn === 'function') {
        (InCallManager as any).setForceSpeakerphoneOn(callType === 'video' ? 1 : 0);
      }

      // Awaited before the peer connection exists: ICE servers can only be
      // supplied at construction, so a list that arrived later would not apply
      // to this call. Mints a short-lived TURN credential through the
      // getTurnCredentials Cloud Function, and falls back to STUN rather than
      // rejecting when that is unavailable or unconfigured.
      const ice = await describeIceServers();
      if (!isMounted) return;
      // Recorded per call because a missing TURN relay is otherwise invisible:
      // the call simply fails to connect between two symmetric NATs, which
      // looks exactly like the other person having bad signal. See
      // config/rtc.ts and CALLING.md.
      if (ice.status === 'stun-only') {
        reportError(new Error('starting a call with no TURN relay'), 'call_ice_stun_only');
      }
      const pc = new RTCPeerConnection({iceServers: ice.servers});
      pcRef.current = pc;

      // Ensure both sides negotiate send/receive for audio/video.
      if ((pc as any).addTransceiver) {
        (pc as any).addTransceiver('audio', {direction: 'sendrecv'});
        if (callType === 'video') {
          (pc as any).addTransceiver('video', {direction: 'sendrecv'});
        }
      }

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Try to increase audio bitrate for better voice quality.
      if ((pc as any).getSenders) {
        const audioSender = (pc as any)
          .getSenders()
          ?.find((sender: any) => sender?.track?.kind === 'audio');
        if (audioSender?.getParameters && audioSender?.setParameters) {
          const params = audioSender.getParameters() || {};
          params.encodings = params.encodings || [{}];
          params.encodings[0].maxBitrate = 64000; // 64kbps
          audioSender.setParameters(params).catch(() => undefined);
        }
      }

      (pc as any).onicecandidate = (event: any) => {
        if (event.candidate) {
          addCallCandidate(chatId, callId, user.uid, {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          });
        }
      };

      const drainPendingCandidates = async () => {
        if (!pc.remoteDescription) return;
        const pending = [...pendingCandidatesRef.current];
        pendingCandidatesRef.current = [];
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            reportError(error, 'add_pending_ice_failed');
            if (__DEV__) {
              console.warn('Failed to add pending ICE candidate', error);
            }
          }
        }
      };

      const tryRestartIce = async () => {
        if (!isCaller || restartingIceRef.current) return;
        const now = Date.now();
        if (now - lastIceRestartAtRef.current < 5000) return;
        restartingIceRef.current = true;
        lastIceRestartAtRef.current = now;
        try {
          if (pc.restartIce) {
            pc.restartIce();
          }
          const offer = await pc.createOffer({iceRestart: true});
          await pc.setLocalDescription(offer);
          await updateCall(chatId, callId, {
            offer: offer ? {type: offer.type, sdp: offer.sdp} : null,
            status: 'ringing',
          });
        } catch (error) {
          reportError(error, 'ice_restart_failed');
          if (__DEV__) {
            console.warn('ICE restart failed', error);
          }
        } finally {
          restartingIceRef.current = false;
        }
      };

      (pc as any).oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected') {
          setStatus('active');
        }
        if (state === 'failed' || state === 'disconnected') {
          tryRestartIce();
        }
      };

      (pc as any).onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('active');
        }
        if (pc.connectionState === 'failed') {
          tryRestartIce();
        }
      };

      (pc as any).ontrack = (event: any) => {
        // Before the stream, because the stream object may be one React
        // already holds — see remoteVideoTrack. This is the only signal that
        // a *later* track arrived at all.
        if (event.track?.kind === 'video') {
          setRemoteVideoTrack(event.track);
        }
        const [remote] = event.streams || [];
        if (remote) {
          remoteStreamRef.current = remote;
          setRemoteStream(remote);
          return;
        }
        // Some platforms don't populate event.streams; build the stream manually.
        const stream = remoteStreamRef.current || new MediaStream();
        stream.addTrack(event.track);
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      };

      const makeOffer = async (reason: string) => {
        if (!pcRef.current || makingOfferRef.current) return;
        makingOfferRef.current = true;
        try {
          const offer = await pcRef.current.createOffer({});
          await pcRef.current.setLocalDescription(offer);
          await updateCall(chatId, callId, {
            offer: offer ? {type: offer.type, sdp: offer.sdp} : null,
            status: 'ringing',
            needsOffer: false,
            needsOfferFrom: null,
          });
        } catch (error) {
          reportError(error, `offer_failed_${reason}`);
          if (__DEV__) {
            console.warn(`Offer failed (${reason})`, error);
          }
        } finally {
          makingOfferRef.current = false;
        }
      };

      candidateUnsub = listenCallCandidates(chatId, callId, (candidate, from) => {
        if (from === user.uid) return;
        if (!pc.remoteDescription) {
          pendingCandidatesRef.current.push(candidate);
          return;
        }
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(error => {
          reportError(error, 'add_ice_candidate_failed');
          if (__DEV__) {
            console.warn('Failed to add ICE candidate', error);
          }
        });
      });

      callUnsub = listenCall(chatId, callId, async call => {
        if (!call) return;
        setStatus(call.status);
        if (call.status === 'ended') {
          endCall(false);
          return;
        }

        if (call.needsOffer && call.needsOfferFrom !== user.uid && isCaller) {
          await makeOffer('remote-request');
        }

        if (call.offer && !isCaller && call.offer.sdp !== lastOfferSdpRef.current) {
          lastOfferSdpRef.current = call.offer.sdp;
          await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
          await drainPendingCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateCall(chatId, callId, {
            answer: answer ? {type: answer.type, sdp: answer.sdp} : null,
            status: 'active',
          });
        }

        if (call.answer && isCaller && call.answer.sdp !== lastAnswerSdpRef.current) {
          lastAnswerSdpRef.current = call.answer.sdp;
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
          await drainPendingCandidates();
          setStatus('active');
        }
      });

      if (isCaller) {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await updateCall(chatId, callId, {
          offer: offer ? {type: offer.type, sdp: offer.sdp} : null,
        });
      }

      (pc as any).onnegotiationneeded = () => {
        if (!isCaller) return;
        makeOffer('negotiationneeded');
      };
    };

    setup().catch(error => {
      reportError(error, 'call_setup_failed');
      if (__DEV__) {
        console.error('Call setup failed:', error);
      }
      Alert.alert(t('common.error'), t('call.errors.startFailed'));
      navigation.goBack();
    });

    return () => {
      isMounted = false;
      if (candidateUnsub) candidateUnsub();
      if (callUnsub) callUnsub();
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => track.stop());
      }
      InCallManager.stop();
    };
  }, [user, chatId, callId, isCaller, callType, navigation, t]);

  const endCall = async (updateRemote = true) => {
    if (updateRemote && chatId && callId) {
      await updateCall(chatId, callId, {status: 'ended'});
      cleanupCallCandidates(chatId, callId).catch(error => reportError(error, 'cleanupCallCandidates'));
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    navigation.goBack();
  };

  const toggleMute = () => {
    if (!localAudioTrack) return;
    const next = !localAudioTrack.enabled;
    localAudioTrack.enabled = next;
    setIsMuted(!next);
  };

  const toggleVideo = async () => {
    if (!user) return;
    if (!pcRef.current) return;
    const currentStream = localStreamRef.current;
    if (localVideoTrack) {
      const next = !localVideoTrack.enabled;
      localVideoTrack.enabled = next;
      setIsVideoEnabled(next);
      return;
    }
    try {
      const videoStream = await mediaDevices.getUserMedia({
        video: {facingMode: 'user'},
        audio: false,
      });
      const track = videoStream.getVideoTracks()?.[0];
      if (track && currentStream) {
        currentStream.addTrack(track);
        pcRef.current.addTrack(track, currentStream);
        setLocalStream(currentStream);
        setLocalVideoTrack(track);
        setIsVideoEnabled(true);
        if (isCaller) {
          await updateCall(chatId, callId, {status: 'ringing'});
        } else {
          await updateCall(chatId, callId, {needsOffer: true, needsOfferFrom: user.uid});
        }
      }
    } catch (error) {
      reportError(error, 'enable_video_failed');
      if (__DEV__) {
        console.error('Enable video failed:', error);
      }
      Alert.alert(t('common.error'), t('call.errors.videoFailed'));
    }
  };

  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    InCallManager.setSpeakerphoneOn(next);
  };

  return (
    <GlassScreen style={styles.container} textureSeed={chatId}>
      <Text style={[styles.status, {color: colors.textSecondary}]}>
        {status === 'ringing' ? t('call.connecting') : status === 'active' ? t('call.active') : t('call.ended')}
      </Text>

      {hasRemoteVideo && remoteStream ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} zOrder={0} />
      ) : (
        <View style={[styles.remotePlaceholder, {backgroundColor: colors.surface}]}>
          <Text style={{color: colors.textSecondary}}>
            {status === 'active' ? t('call.audioOnly') : t('call.waitingRemote')}
          </Text>
        </View>
      )}

      {/*
        zOrder puts this above the remote view. On Android both are backed by
        SurfaceViewRenderer, which composites outside the normal view hierarchy
        — so absolute positioning alone is not enough, and the self-view sat
        invisible behind the full-screen remote one. 0/1 is the split the
        library's own docs recommend for exactly this layout.

        mirror because this is the user looking at themselves through the
        front camera, which everyone expects to behave like a mirror. It is
        local-only: what the other side receives is unmirrored.
      */}
      {hasLocalVideo && localStream ? (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          zOrder={1}
          mirror
          objectFit="cover"
        />
      ) : null}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, {backgroundColor: colors.surface}]} onPress={toggleMute}>
          <Text style={[styles.controlText, {color: colors.text}]}>
            {isMuted ? t('call.unmute') : t('call.mute')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, {backgroundColor: colors.surface}]} onPress={toggleSpeaker}>
          <Text style={[styles.controlText, {color: colors.text}]}>
            {isSpeakerOn ? t('call.speakerOn') : t('call.speakerOff')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, {backgroundColor: colors.surface}]} onPress={toggleVideo}>
          <Text style={[styles.controlText, {color: colors.text}]}>
            {isVideoEnabled ? t('call.videoOff') : t('call.videoOn')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.endButton, {backgroundColor: colors.danger}]} onPress={() => endCall(true)}>
          <Text style={[styles.endButtonText, {color: colors.textOnDanger}]}>{t('call.end')}</Text>
        </TouchableOpacity>
      </View>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  status: {
    textAlign: 'center',
    marginBottom: 12,
  },
  remoteVideo: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  remotePlaceholder: {
    flex: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localVideo: {
    position: 'absolute',
    end: 20,
    top: 80,
    width: 120,
    height: 160,
    borderRadius: 2,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  controlText: {
    fontFamily: bodyWeight('600'),
  },
  endButton: {
    flex: 1,
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 2,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#fff',
    fontFamily: bodyWeight('700'),
  },
});

