/**
 * Firestore rejects `undefined` field values outright — `setDoc` throws rather
 * than treating the key as absent. Object spreads produce them constantly
 * (`{...data, mediaKeys: undefined}` is how encryptOutgoingMessage clears a
 * field), so every write path has to strip them first.
 *
 * This lived privately inside firebaseChat.ts, where sendMessage used it and
 * nothing else could. scheduledMessages.ts wrote straight through without it,
 * which was harmless while the composer hand-built a clean object — and broke
 * the moment scheduling started going through encryptOutgoingMessage, whose
 * output always carries `mediaKeys: undefined`. Every scheduled send threw, and
 * because the caller did not await into a catch, it threw *silently*: the
 * button did nothing at all.
 *
 * A shared leaf module so the next write path cannot quietly skip it.
 */
export function stripUndefined(value: any): any {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter(v => v !== undefined);
  }
  if (value && typeof value === 'object') {
    // Timestamps, FieldValues, Dates and other class instances pass through
    // untouched — walking them would strip their internals.
    if (value.constructor && value.constructor !== Object) {
      return value;
    }
    const cleaned: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const next = stripUndefined(val);
      if (next !== undefined) {
        cleaned[key] = next;
      }
    });
    return cleaned;
  }
  return value;
}
