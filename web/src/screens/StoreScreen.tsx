/**
 * The Store — one global place to browse and buy everything Chatterbox sells.
 *
 * Deliberately a single screen rather than a per-chat picker: a theme applied
 * here overwrites every conversation, so the app lands on one consistent look
 * instead of each chat drifting to its own.
 *
 * Sections are data-driven so adding a category later (sticker packs, chat
 * effects) means adding a section, not restructuring this file. Only
 * categories with real content ship — an empty "coming soon" shelf is worse
 * than no shelf.
 */
import {useCallback, useState} from 'react';
import type {User} from 'firebase/auth';
import {colors} from '../theme';
import {useT} from '../i18n';
import {useToast} from '../context/ToastContext';
import {useEntitlement} from '../context/EntitlementContext';
import {useAccountTheme} from '../context/StoreThemeContext';
import {createBillingPortalSession, createCheckoutSession, type ProPlan} from '../services/billing';
import {THEME_CATALOG, type StoreTheme} from '../services/themeCatalog';
import {applyStoreTheme} from '../services/storeTheme';
import Icon from '../components/Icon';

export default function StoreScreen({user}: {user: User}) {
  const {t} = useT();
  const toast = useToast();
  const {isPro, entitlement} = useEntitlement();

  const applied = useAccountTheme();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Both billing actions hand off to a Stripe-hosted page, so card details
  // never touch this app.
  const startBilling = async (getUrl: () => Promise<string>) => {
    setBillingBusy(true);
    setBillingError(null);
    try {
      window.location.assign(await getUrl());
    } catch (err) {
      console.warn('billing action failed:', err);
      setBillingError(t('pro.error'));
      setBillingBusy(false); // stays busy on success — we're navigating away
    }
  };

  const applyTheme = useCallback(
    async (theme: StoreTheme) => {
      // A locked swatch that silently does nothing reads as a bug, so the tap
      // always produces a response.
      if (theme.pro && !isPro) {
        toast.error(t('pro.lockedTheme'));
        return;
      }
      setApplyingId(theme.id);
      try {
        const count = await applyStoreTheme(user.uid, theme);
        // Separate keys rather than one "{count} chats" string: "1 chats"
        // reads as a bug, and a zero-chat account needs a different message
        // entirely — nothing changed yet, but new chats will use it.
        const key = count === 0 ? 'store.appliedNone' : count === 1 ? 'store.appliedOne' : 'store.applied';
        toast.show(t(key).replace('{name}', theme.name).replace('{count}', String(count)));
      } catch (err) {
        console.warn('applyStoreTheme failed:', err);
        toast.error(t('common.error'));
      } finally {
        setApplyingId(null);
      }
    },
    [isPro, t, toast, user.uid],
  );

  const proStatusText = (() => {
    if (!entitlement) return t('pro.active');
    const renews = new Date(entitlement.currentPeriodEnd).toLocaleDateString();
    if (entitlement.cancelAtPeriodEnd) return `${t('pro.endsOn')} ${renews}`;
    if (entitlement.status === 'past_due') return t('pro.pastDue');
    return `${t('pro.renewsOn')} ${renews}`;
  })();

  return (
    <div style={styles.wrap}>
      <div className="scroll" style={styles.scroll}>
        <h1 style={styles.pageTitle}>{t('store.title')}</h1>
        <p style={styles.pageDesc}>{t('store.subtitle')}</p>

        {/* ---- Chatterbox Pro ---- */}
        <section style={styles.hero} aria-labelledby="store-pro-heading">
          <span style={styles.heroBadge}>{t('pro.badge')}</span>
          <h2 id="store-pro-heading" style={styles.heroTitle}>
            {t('pro.title')}
          </h2>
          <p style={styles.heroDesc}>{isPro ? proStatusText : t('pro.pitch')}</p>
          <ul style={styles.heroList}>
            <li>{t('pro.featureAi')}</li>
            <li>{t('pro.featureThemes')}</li>
          </ul>
          {billingError && <div style={styles.error}>{billingError}</div>}
          {isPro ? (
            <button
              type="button"
              className="btn btn-soft"
              style={styles.fullBtn}
              disabled={billingBusy}
              onClick={() => startBilling(createBillingPortalSession)}>
              {billingBusy ? <span className="spinner" /> : t('pro.manage')}
            </button>
          ) : (
            <div style={styles.planRow}>
              {(['monthly', 'yearly'] as ProPlan[]).map((plan, i) => (
                <button
                  key={plan}
                  type="button"
                  className={i === 0 ? 'btn btn-primary' : 'btn btn-soft'}
                  style={styles.planBtn}
                  disabled={billingBusy}
                  onClick={() => startBilling(() => createCheckoutSession(plan))}>
                  {billingBusy && i === 0 ? <span className="spinner" /> : t(`pro.${plan}`)}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---- Themes ---- */}
        <section aria-labelledby="store-themes-heading">
          <h2 id="store-themes-heading" style={styles.sectionTitle}>
            {t('store.themes')}
          </h2>
          <p style={styles.sectionDesc}>{t('store.themesDesc')}</p>
          <div style={styles.grid}>
            {THEME_CATALOG.map(theme => {
              const locked = theme.pro && !isPro;
              const selected = applied?.id === theme.id;
              const busy = applyingId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-label={locked ? `${theme.name} — ${t('pro.locked')}` : theme.name}
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => applyTheme(theme)}
                  style={{
                    ...styles.card,
                    borderColor: selected ? theme.accent : colors.border,
                    borderWidth: selected ? 2 : 1,
                    opacity: locked ? 0.62 : 1,
                  }}>
                  <span
                    style={{
                      ...styles.swatch,
                      background: theme.wallpaper || colors.inputBg,
                      borderColor: theme.accent,
                    }}>
                    <span style={{...styles.dot, background: theme.accent}} />
                  </span>
                  <span style={styles.cardName}>{theme.name}</span>
                  {theme.pro && (
                    <span style={locked ? styles.lock : styles.owned}>
                      {locked && <Icon name="lock" size={10} style={{marginRight: 3, verticalAlign: '-1px'}} />}
                      {t('pro.badge')}
                    </span>
                  )}
                  {selected && <span style={styles.appliedTag}>{t('store.appliedTag')}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center'},
  scroll: {width: '100%', maxWidth: 560, overflowY: 'auto', padding: '32px 20px 48px'},
  pageTitle: {fontSize: 26, fontWeight: 800, margin: '0 0 4px', color: colors.text},
  pageDesc: {fontSize: 14, color: colors.textSecondary, margin: '0 0 22px'},
  hero: {
    background: colors.surfaceStrong,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    boxShadow: colors.shadowSoft,
  },
  heroBadge: {
    display: 'inline-block',
    background: colors.primaryLight,
    color: colors.primary,
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.6,
    padding: '3px 9px',
    borderRadius: 999,
    marginBottom: 10,
  },
  heroTitle: {fontSize: 21, fontWeight: 800, margin: '0 0 6px', color: colors.text},
  heroDesc: {fontSize: 14, color: colors.textSecondary, margin: '0 0 12px'},
  heroList: {margin: '0 0 16px', paddingLeft: 20, color: colors.textSecondary, fontSize: 13.5, lineHeight: 1.7},
  error: {color: colors.danger, fontSize: 13, marginBottom: 10},
  planRow: {display: 'flex', gap: 10, flexWrap: 'wrap'},
  planBtn: {flex: '1 1 140px', padding: '12px 16px', fontWeight: 700},
  fullBtn: {width: '100%', padding: '12px 16px', fontWeight: 700},
  sectionTitle: {fontSize: 17, fontWeight: 800, margin: '0 0 4px', color: colors.text},
  sectionDesc: {fontSize: 13.5, color: colors.textSecondary, margin: '0 0 14px'},
  grid: {display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12},
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '14px 10px',
    borderRadius: 16,
    borderStyle: 'solid',
    background: colors.surfaceStrong,
    cursor: 'pointer',
    font: 'inherit',
    color: colors.text,
  },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 14, height: 14, borderRadius: 999},
  cardName: {fontSize: 13.5, fontWeight: 700},
  lock: {fontSize: 10.5, fontWeight: 800, color: colors.textSecondary, letterSpacing: 0.4},
  owned: {fontSize: 10.5, fontWeight: 800, color: colors.primary, letterSpacing: 0.4},
  appliedTag: {fontSize: 10.5, fontWeight: 800, color: colors.primary, letterSpacing: 0.4},
};
