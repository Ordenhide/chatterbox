import {Component, type ReactNode} from 'react';
import {colors} from '../theme';
import BrandMark from './BrandMark';
import {tStandalone as t} from '../i18n';

interface State {
  error: Error | null;
}

/** Catches render-time crashes so a single broken screen doesn't blank the app. */
export default class ErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = {error: null};

  static getDerivedStateFromError(error: Error): State {
    return {error};
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback />;
  }
}

/**
 * Reads the dictionary without the hook: this boundary sits outside
 * LanguageProvider so that it can catch a crash in the providers themselves.
 */
function ErrorFallback() {
  return (
    <div style={styles.wrap}>
      <BrandMark size={52} />
      <h1 style={styles.title}>{t('errorBoundary.title')}</h1>
      <p style={styles.msg}>{t('errorBoundary.body')}</p>
      <button className="btn btn-primary" style={styles.btn} onClick={() => window.location.reload()}>
        {t('errorBoundary.reload')}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    textAlign: 'center',
  },
  title: {fontSize: 22, fontWeight: 800, color: colors.text, margin: '6px 0 0'},
  msg: {color: colors.textSecondary, maxWidth: 340, margin: 0},
  btn: {padding: '11px 26px', marginTop: 8},
};
