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
import React, {useEffect, useState} from 'react';
import {colors} from '../theme';
import {useT} from '../i18n';
import {useEntitlement} from '../context/EntitlementContext';
import {createBillingPortalSession, createCheckoutSession, type ProPlan} from '../services/billing';

export default function StoreScreen() {
  const {t} = useT();
  const {isPro, entitlement} = useEntitlement();

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

  // The `window.location.assign` above stays busy on success on the
  // assumption that navigating away destroys this component — true for a
  // normal page unload, but the browser can instead freeze this page into
  // the back-forward cache and restore it verbatim (spinner still spinning)
  // if the user hits "back" from Stripe instead of completing checkout.
  // `pageshow`'s `persisted` flag is the standard signal that happened, so
  // the button doesn't spin forever with no way to retry.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setBillingBusy(false);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);


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

        {/* ---- Themes ---- */}
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
    borderRadius: 2,
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
    borderRadius: 2,
    borderStyle: 'solid',
    background: colors.surfaceStrong,
    cursor: 'pointer',
    font: 'inherit',
    color: colors.text,
  },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 2,
    borderWidth: 2,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 14, height: 14, borderRadius: 999},
  cardName: {fontSize: 13.5, fontWeight: 700},
  appliedTag: {fontSize: 10.5, fontWeight: 800, color: colors.primary, letterSpacing: 0.4},
};
