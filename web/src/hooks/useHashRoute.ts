import {useCallback, useEffect, useState} from 'react';

export type Tab = 'chats' | 'store' | 'profile';
export interface Route {
  tab: Tab;
  chatId?: string;
}

const TABS: Tab[] = ['chats', 'store', 'profile'];

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [tab, chatId] = raw.split('/');
  const t = (TABS as string[]).includes(tab) ? (tab as Tab) : 'chats';
  return {tab: t, chatId: t === 'chats' && chatId ? decodeURIComponent(chatId) : undefined};
}

function build(r: Route): string {
  if (r.tab === 'chats' && r.chatId) return `#/chats/${encodeURIComponent(r.chatId)}`;
  return `#/${r.tab}`;
}

/**
 * Hash-based routing so the current tab and open chat survive a refresh and are
 * shareable/bookmarkable, and the browser back button works. Routes look like
 * `#/chats`, `#/chats/<chatId>`, `#/moments`, `#/store`, `#/profile`.
 */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.history.replaceState(null, '', build(parse()));
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Partial<Route>) => {
    const merged = {...parse(), ...next};
    const hash = build(merged);
    if (hash !== window.location.hash) window.location.hash = hash;
    else setRoute(merged);
  }, []);

  return {route, navigate};
}
