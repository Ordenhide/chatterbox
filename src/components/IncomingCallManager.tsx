import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Svg, {Line, Path, Rect} from 'react-native-svg';
import InCallManager from 'react-native-incall-manager';
import {RTCView, mediaDevices} from 'react-native-webrtc';
import {useAuth} from '../contexts/AuthContext';
import {getColors} from '../theme/colors';
import {
  getUserById,
  listenChatsForUser,
  listenLatestCall,
  updateCall,
} from '../services/firebaseChat';
import {reportError} from '../services/telemetry';
import type {CallSession} from '../types';
import {bodyWeight} from '../theme/typography';

/** How long a call rings here before we treat it as missed and end it. */
const RING_TIMEOUT_MS = 45_000;
/** Rings older than this are junk from a previous session — cleaned up silently. */
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

interface Incoming {
  call: CallSession;
  callerName: string;
}

/**
 * Inline SVG glyphs. react-native-svg is already linked, whereas
 * react-native-vector-icons would need font linking and a native rebuild —
 * the same reasoning as TabIcon.
 */
function Glyph({name, size = 26}: {name: 'phone' | 'phoneOff' | 'video' | 'videoOff'; size?: number}) {
  const stroke = {
    stroke: '#fff',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  const handset =
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z';

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(name === 'phone' || name === 'phoneOff') && <Path d={handset} {...stroke} />}
      {name === 'phoneOff' && <Line x1="2" y1="2" x2="22" y2="22" {...stroke} />}
      {(name === 'video' || name === 'videoOff') && (
        <>
          <Rect x="2" y="6" width="13" height="12" rx="2" {...stroke} />
          <Path d="M22 8.5l-7 4 7 4v-8z" {...stroke} />
        </>
      )}
      {name === 'videoOff' && <Line x1="2" y1="2" x2="22" y2="22" {...stroke} />}
    </Svg>
  );
}

/**
 * App-level incoming-call watcher.
 *
 * Previously this lived inside ChatScreen behind a useFocusEffect, so a call
 * only surfaced if the recipient already had that exact conversation open —
 * every call arriving from the chat list, Moments, or another chat was silently
 * missed. Mounting it at the app root (mirroring the web client's CallProvider)
 * means calls ring wherever the user is.
 */
export default function IncomingCallManager({
  onAccept,
  isBusy,
}: {
  /** Navigates to the call screen. Camera state is chosen before answering. */
  onAccept: (call: CallSession, opts: {camOn: boolean}) => void;
  /** True while a call is already on screen, so a second ring doesn't stack. */
  isBusy: () => boolean;
}) {
  const {t} = useTranslation();
  const {user} = useAuth();
  const colors = getColors(useColorScheme());

  const [chatIds, setChatIds] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const handledRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewStreamRef = useRef<any>(null);

  const isVideo = incoming?.call.type === 'video';

  // Track every chat the user belongs to so each can be watched for a ring.
  useEffect(() => {
    if (!user) {
      setChatIds([]);
      return;
    }
    return listenChatsForUser(user.uid, chats => setChatIds(chats.map(c => c.id)));
  }, [user]);

  const stopRinging = useCallback(() => {
    InCallManager.stopRingtone();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const releasePreview = useCallback(() => {
    previewStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
    previewStreamRef.current = null;
    setPreviewUrl(null);
  }, []);

  const dismiss = useCallback(() => {
    stopRinging();
    releasePreview();
    setIncoming(null);
    setPreviewFailed(false);
  }, [stopRinging, releasePreview]);

  /** Ends the call doc — used for both an explicit decline and a ring timeout. */
  const declineCall = useCallback(
    (call: CallSession) => {
      handledRef.current.add(call.id);
      updateCall(call.chatId, call.id, {status: 'ended'}).catch(error =>
        reportError(error, 'incoming_decline'),
      );
      dismiss();
    },
    [dismiss],
  );

  // Watch the latest call in every chat.
  useEffect(() => {
    if (!user || chatIds.length === 0) return;

    const unsubs = chatIds.map(chatId =>
      listenLatestCall(chatId, async call => {
        if (!call) return;

        // Ring resolved elsewhere (answered on another device, or hung up).
        if (call.status !== 'ringing') {
          setIncoming(prev => {
            if (prev?.call.id !== call.id) return prev;
            stopRinging();
            releasePreview();
            return null;
          });
          return;
        }

        const forMe = call.createdBy !== user.uid && call.participants.includes(user.uid);
        if (!forMe || handledRef.current.has(call.id)) return;
        if (isBusy()) return;

        const createdMs =
          (call.createdAt as any)?.toMillis?.() ??
          (call.createdAt as any)?.toDate?.()?.getTime?.() ??
          Date.now();
        const age = Date.now() - createdMs;

        if (age > MAX_STALE_MS) {
          handledRef.current.add(call.id);
          updateCall(call.chatId, call.id, {status: 'ended'}).catch(() => undefined);
          return;
        }
        if (age >= RING_TIMEOUT_MS) {
          declineCall(call);
          return;
        }

        const profile = await getUserById(call.createdBy).catch(() => null);
        const callerName =
          (profile as any)?.displayName || t('call.unknownCaller');

        setIncoming(prev => (prev ? prev : {call, callerName}));
        // Ring for whatever remains of the window, then give up.
        if (!timeoutRef.current) {
          timeoutRef.current = setTimeout(() => declineCall(call), RING_TIMEOUT_MS - age);
        }
      }),
    );

    return () => unsubs.forEach(unsub => unsub());
  }, [chatIds, user, isBusy, declineCall, stopRinging, releasePreview, t]);

  // Ring + vibrate while the prompt is up. '_DEFAULT_' uses the platform's own
  // ringtone, so it sounds native and needs no bundled audio asset.
  useEffect(() => {
    if (!incoming) return;
    setCamOn(incoming.call.type === 'video');
    try {
      InCallManager.startRingtone('_DEFAULT_', [0, 1000, 800, 1000], 'playback', 45);
    } catch (error) {
      reportError(error, 'incoming_ringtone');
    }
    return () => InCallManager.stopRingtone();
  }, [incoming]);

  // Open a camera preview for video calls so the user can see what they are
  // about to broadcast — and answer with it already off.
  useEffect(() => {
    if (!incoming || incoming.call.type !== 'video') return;
    let cancelled = false;

    mediaDevices
      .getUserMedia({video: true, audio: false})
      .then((stream: any) => {
        if (cancelled) {
          stream.getTracks().forEach((track: any) => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        setPreviewUrl(stream.toURL());
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(true);
      });

    return () => {
      cancelled = true;
      previewStreamRef.current?.getTracks?.().forEach((track: any) => track.stop());
      previewStreamRef.current = null;
    };
  }, [incoming]);

  // Mirror the toggle onto the live preview track so turning the camera off
  // visibly blanks the preview rather than just relabelling a button.
  useEffect(() => {
    const track = previewStreamRef.current?.getVideoTracks?.()[0];
    if (track) track.enabled = camOn;
  }, [camOn]);

  if (!incoming) return null;

  const accept = () => {
    handledRef.current.add(incoming.call.id);
    stopRinging();
    releasePreview();
    const call = incoming.call;
    setIncoming(null);
    setPreviewFailed(false);
    onAccept(call, {camOn});
  };

  const showPreview = isVideo && !previewFailed && previewUrl && camOn;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => declineCall(incoming.call)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, {backgroundColor: colors.surface || '#101018'}]}>
          <View style={[styles.avatar, {backgroundColor: colors.primary}]}>
            <Text style={[styles.avatarText, {color: colors.textOnPrimary}]}>
              {incoming.callerName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={[styles.name, {color: colors.text}]}>{incoming.callerName}</Text>
          <Text style={[styles.sub, {color: colors.textSecondary}]}>
            {isVideo ? t('call.incomingVideo') : t('call.incomingVoice')}
          </Text>

          {isVideo && (
            <View style={styles.previewBlock}>
              <View style={styles.previewFrame}>
                {showPreview ? (
                  <RTCView streamURL={previewUrl!} style={styles.preview} mirror objectFit="cover" />
                ) : (
                  <Text style={styles.previewMsg}>
                    {previewFailed ? t('call.cameraUnavailable') : t('call.cameraWillBeOff')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.camToggle,
                  camOn ? {borderColor: colors.border} : {backgroundColor: colors.danger},
                ]}
                onPress={() => setCamOn(v => !v)}
                disabled={previewFailed}>
                <Glyph name={camOn ? 'video' : 'videoOff'} size={16} />
                <Text style={styles.camToggleText}>
                  {camOn ? t('call.cameraOn') : t('call.cameraOff')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => declineCall(incoming.call)}>
              <View style={[styles.actionIcon, {backgroundColor: colors.danger}]}>
                <Glyph name="phoneOff" />
              </View>
              <Text style={styles.actionLabel}>{t('call.decline')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.action} onPress={accept}>
              <View style={[styles.actionIcon, {backgroundColor: colors.success}]}>
                <Glyph name={isVideo && camOn ? 'video' : 'phone'} />
              </View>
              <Text style={styles.actionLabel}>{t('call.accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,10,20,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 2,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 26,
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {color: '#fff', fontSize: 36, fontFamily: bodyWeight('700')},
  name: {fontSize: 23, fontFamily: bodyWeight('700'), textAlign: 'center'},
  sub: {fontSize: 14, marginTop: 5},
  previewBlock: {width: '100%', marginTop: 18},
  previewFrame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {width: '100%', height: '100%'},
  previewMsg: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  camToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  camToggleText: {color: '#fff', fontSize: 13, fontFamily: bodyWeight('600')},
  actions: {flexDirection: 'row', gap: 28, marginTop: 26},
  action: {width: 74, alignItems: 'center', gap: 8},
  actionIcon: {
    width: 62,
    height: 62,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {fontSize: 12.5, fontFamily: bodyWeight('600'), color: 'rgba(255,255,255,0.85)'},
});
