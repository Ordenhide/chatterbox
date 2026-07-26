import {useEffect, useState} from 'react';
import {useT} from '../i18n';

/** Shows a banner while the browser reports it's offline. */
export default function ConnectionBanner() {
  const {t} = useT();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;
  return <div className="conn-banner">{t('conn.offline')}</div>;
}
