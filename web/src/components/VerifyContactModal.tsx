import {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useModal} from '../hooks/useModal';
import {useT} from '../i18n';
import {computeSafetyNumber} from '../services/e2ee';
import {fetchPeerPublicKeyChecked, getOrCreateDeviceKeypair} from '../services/e2eeKeys';
import Icon from './Icon';

/**
 * Out-of-band key verification ("safety number"). This is the only defense
 * the E2EE prototype has against a compromised server substituting a public
 * key on first contact — see the module doc in services/e2ee.ts. Showing the
 * number here is what lets `peerKeyChanged` (ChatPane's key-change banner) be
 * dismissed with real confidence rather than blind trust.
 */
export default function VerifyContactModal({
  myUid,
  peerUid,
  peerName,
  onClose,
  onVerified,
}: {
  myUid: string;
  peerUid: string;
  peerName: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const {t} = useT();
  const dialogRef = useModal<HTMLDivElement>(onClose);
  const [state, setState] = useState<'loading' | 'no-key' | 'error' | 'ready'>('loading');
  const [safetyNumber, setSafetyNumber] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{publicKey: myPublicKey}, peer] = await Promise.all([
          getOrCreateDeviceKeypair(myUid),
          fetchPeerPublicKeyChecked(myUid, peerUid),
        ]);
        if (!active) return;
        // The checked read, not fetchPeerPublicKey: that one maps a failed
        // lookup onto null, which this screen would render as "this contact
        // hasn't set up encryption". Saying that because the network blipped
        // is a bad answer anywhere, and an actively harmful one *here* — this
        // dialog exists to tell the user whether their key material is sound,
        // so it must never report a transient failure as a fact about the peer.
        if (peer.status === 'unavailable') {
          setState('error');
          return;
        }
        const peerPublicKey = peer.key;
        if (!peerPublicKey) {
          setState('no-key');
          return;
        }
        // Depends on the real key material, not identities — if a compromised
        // server substituted either side's key, the two devices would compute
        // different numbers here. See computeSafetyNumber().
        setSafetyNumber(computeSafetyNumber(myPublicKey, peerPublicKey));
        setState('ready');
        onVerified();
      } catch (err) {
        console.warn('safety number failed:', err);
        if (active) setState('error');
      }
    })();
    return () => {
      active = false;
    };
    // onVerified is a setState wrapper from the parent; the fetch/compute
    // should run exactly once per (myUid, peerUid) pair, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUid, peerUid]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('chat.verifyContact')}
        tabIndex={-1}
        style={styles.modal}
        onClick={e => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>
            <Icon name="lock" size={16} />
            {t('chat.verifyContact')} — {peerName}
          </span>
          <button style={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {state === 'loading' && <div style={styles.info}>{t('app.loading')}</div>}

        {state === 'no-key' && <div style={styles.info}>{t('chat.verifyNoKey')}</div>}

        {state === 'error' && <div style={styles.info}>{t('common.error')}</div>}

        {state === 'ready' && (
          <>
            <div style={styles.numberBox}>{safetyNumber}</div>
            <div style={styles.desc}>{t('chat.safetyNumberDesc')}</div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,7,16,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 40,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: colors.shadow,
  },
  head: {display: 'flex', alignItems: 'center', justifyContent: 'space-between'},
  title: {display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: colors.text},
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {fontSize: 14, color: colors.textSecondary, lineHeight: 1.5},
  numberBox: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: 1,
    color: colors.text,
    background: colors.inputBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '14px 12px',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  desc: {fontSize: 13, color: colors.textSecondary, lineHeight: 1.5},
};
