// Suggested quick replies — a lightweight, on-device heuristic (no AI call)
// ported from the mobile app. Keyword matching is English-only; other languages
// fall back to the localized defaults. `t` is passed in so the strings follow
// the user's chosen language.
import type {TKey} from '../i18n';

export function getSmartReplies(
  recentMessages: Array<{text: string; isOutgoing: boolean}>,
  t: (k: TKey) => string,
): string[] {
  const defaults = () => [t('smartReply.thumbsUp'), t('smartReply.soundsGood'), t('smartReply.gotIt')];

  const recent = recentMessages.slice(-3);
  const lastIncoming = [...recent].reverse().find(m => !m.isOutgoing);
  if (!lastIncoming || !lastIncoming.text) return defaults();

  const text = lastIncoming.text.toLowerCase();
  const suggestions: string[] = [];

  if (text.includes('?')) {
    suggestions.push(t('smartReply.yes'), t('smartReply.notSure'), t('smartReply.letMeThink'));
  }
  if (/\b(hi|hey|hello|morning|evening)\b/.test(text)) {
    suggestions.push(t('smartReply.hey'), t('smartReply.whatsUp'), t('smartReply.howAreYou'));
  }
  if (/\b(thanks?|thank)\b/.test(text)) {
    suggestions.push(t('smartReply.youreWelcome'), t('smartReply.noProblem'), t('smartReply.anytime'));
  }
  if (/\bsorry\b/.test(text)) {
    suggestions.push(t('smartReply.noWorries'), t('smartReply.itsAllGood'), t('smartReply.dontWorry'));
  }
  if (/\b(lol|haha|funny)\b/.test(text)) {
    suggestions.push(t('smartReply.laughEmoji'), t('smartReply.hilarious'), t('smartReply.cantEven'));
  }
  if (/\b(food|eat|dinner|lunch)\b/.test(text)) {
    suggestions.push(t('smartReply.soundsGood'), t('smartReply.imIn'), t('smartReply.whatAreYouThinking'));
  }
  if (/\b(time|when|tomorrow)\b/.test(text)) {
    suggestions.push(t('smartReply.worksForMe'), t('smartReply.letMeCheck'), t('smartReply.whatTime'));
  }

  if (suggestions.length === 0) return defaults();
  return [...new Set(suggestions)].slice(0, 4);
}
