import {useEffect, useRef, useState} from 'react';
import {colors} from '../theme';
import {useT} from '../i18n';
import type {CallType} from '../services/call';
import Icon from './Icon';

/**
 * Full-screen incoming-call prompt. Deliberately unmissable: it takes the whole
 * viewport, dims everything behind it, and animates — the previous version was a
 * small banner that was easy to scroll past or ignore.
 *
 * For a video call it also opens a local camera preview *before* answering, so
 * you can see exactly what you are about to broadcast and can answer with the
 * camera already off.
 */
export default function IncomingCall({
  callerName,
  type,
  audible,
  onAccept,
  onDecline,
}: {
  callerName: string;
  type: CallType;
  /** False when the browser blocked the ringtone — we say so instead of pretending it rang. */
  audible: boolean;
  onAccept: (opts: {camOn: boolean}) => void;
  onDecline: () => void;
}) {
  const {t} = useT();
  const isVideo = type === 'video';
  const [camOn, setCamOn] = useState(isVideo);
  const [previewError, setPreviewError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Open a preview stream for video calls so the camera state is visible before
  // answering. Torn down on unmount so the camera light never outlives the prompt.
  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({video: true, audio: false})
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(tr => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setPreviewError(true);
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    };
  }, [isVideo]);

  // Mirror the toggle onto the live preview track, so turning the camera off
  // visibly blanks the preview — the state is demonstrated, not just asserted.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) track.enabled = camOn;
  }, [camOn]);

  const accept = () => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
    onAccept({camOn});
  };

  return (
    <div
      className="cb-call-overlay"
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('call.incoming')}>
      <div style={styles.card}>
        <div style={styles.pulseWrap}>
          <span className="cb-call-pulse" style={{...styles.pulse, animationDelay: '0s'}} />
          <span className="cb-call-pulse" style={{...styles.pulse, animationDelay: '1s'}} />
          <div style={styles.avatar}>{callerName.charAt(0).toUpperCase()}</div>
        </div>

        <div style={styles.name}>{callerName}</div>
        <div style={styles.sub}>
          {isVideo ? t('call.incomingVideo') : t('call.incomingVoice')}
        </div>

        {isVideo && (
          <div style={styles.previewBlock}>
            <div style={styles.previewFrame}>
              {previewError ? (
                <div style={styles.previewMsg}>{t('call.cameraUnavailable')}</div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline muted style={styles.preview} />
                  {!camOn && <div style={styles.previewMsg}>{t('call.cameraWillBeOff')}</div>}
                </>
              )}
            </div>
            <button
              style={{...styles.camToggle, ...(camOn ? {} : styles.camToggleOff)}}
              onClick={() => setCamOn(v => !v)}
              disabled={previewError}
              aria-pressed={camOn}>
              <Icon name={camOn ? 'camera' : 'cameraOff'} size={16} />
              <span>{camOn ? t('call.cameraOn') : t('call.cameraOff')}</span>
            </button>
          </div>
        )}

        {!audible && <div style={styles.muted}>{t('call.ringtoneBlocked')}</div>}

        <div style={styles.actions}>
          <button style={styles.action} onClick={onDecline}>
            <span style={{...styles.actionIcon, background: colors.danger}}>
              <Icon name="phoneOff" size={24} />
            </span>
            <span style={styles.actionLabel}>{t('call.decline')}</span>
          </button>
          <button style={styles.action} onClick={accept}>
            <span style={{...styles.actionIcon, background: colors.success}}>
              <Icon name={isVideo && camOn ? 'video' : 'phone'} size={24} />
            </span>
            <span style={styles.actionLabel}>{t('call.accept')}</span>
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
    zIndex: 60, // above CallModal's 40 and the toast layer
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'rgba(6,10,20,0.82)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    animation: 'cbCallFadeIn 180ms ease-out',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#101018',
    border: `1px solid ${colors.border}`,
    borderRadius: 26,
    padding: '32px 24px 26px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
  },
  pulseWrap: {
    position: 'relative',
    width: 104,
    height: 104,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pulse: {
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
    border: `2px solid ${colors.primary}`,
    animation: 'cbCallPulse 2s ease-out infinite',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 999,
    background: colors.primary,
    color: '#fff',
    fontSize: 36,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  name: {color: '#fff', fontSize: 23, fontWeight: 700, textAlign: 'center'},
  sub: {color: 'rgba(255,255,255,0.62)', fontSize: 14, marginTop: 5},
  previewBlock: {width: '100%', marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10},
  previewFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#000',
    border: '1px solid rgba(255,255,255,0.14)',
  },
  preview: {width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)'},
  previewMsg: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
    background: '#000',
  },
  camToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '9px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.22)',
    background: 'rgba(255,255,255,0.10)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
  },
  camToggleOff: {background: colors.danger, borderColor: colors.danger},
  muted: {
    marginTop: 14,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  actions: {display: 'flex', gap: 28, marginTop: 26},
  action: {
    width: 74,
    border: 'none',
    background: 'transparent',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 0,
  },
  actionIcon: {
    width: 62,
    height: 62,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 8px 24px -8px rgba(0,0,0,0.8)',
  },
  actionLabel: {fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)'},
};

// Keyframes cannot be expressed as inline styles, so the animations live in a
// stylesheet injected once. Honours prefers-reduced-motion: the prompt is
// already unmissable at full-screen without the motion.
const CSS = `
@keyframes cbCallPulse {
  0%   { transform: scale(0.86); opacity: 0.9; }
  100% { transform: scale(1.35); opacity: 0; }
}
@keyframes cbCallFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .cb-call-pulse, .cb-call-overlay { animation: none !important; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('cb-call-css')) {
  const el = document.createElement('style');
  el.id = 'cb-call-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
