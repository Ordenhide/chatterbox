import mmkvStorage from './storageMMKV';

const SESSION_KEY = '@chatterbox:sessionId';

export async function getSessionId(): Promise<string> {
  try {
    const existing = await mmkvStorage.getItem(SESSION_KEY);
    if (existing && typeof existing === 'string' && existing.trim()) {
      return existing;
    }
  } catch {
    // Storage read failed; fall through to create new session
  }
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    await mmkvStorage.setItem(SESSION_KEY, created);
  } catch {
    // Persist failed; still return created so caller has a session ID
  }
  return created;
}

export async function getStoredSessionId(): Promise<string | null> {
  return mmkvStorage.getItem(SESSION_KEY);
}

export async function rotateSessionId(): Promise<string> {
  const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await mmkvStorage.setItem(SESSION_KEY, created);
  return created;
}

export async function clearSessionId(): Promise<void> {
  try {
    await mmkvStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore; clearing is best-effort
  }
}

