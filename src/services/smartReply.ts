import i18n from '../i18n';

export function getSmartReplies(
  recentMessages: Array<{text: string; isOutgoing: boolean}>,
): string[] {
  const t = i18n.t.bind(i18n);
  const defaults = () => [t('smartReply.thumbsUp'), t('smartReply.soundsGood'), t('smartReply.gotIt')];

  const recent = recentMessages.slice(-3);
  const lastIncoming = [...recent].reverse().find(m => !m.isOutgoing);
  if (!lastIncoming) return defaults();

  const text = lastIncoming.text.toLowerCase();
  const suggestions: string[] = [];

  // Keyword detection below only matches English words, so these
  // context-aware suggestions mainly trigger for English conversations;
  // other languages fall back to the (localized) defaults.
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

  if (suggestions.length === 0) {
    return defaults();
  }

  const unique = [...new Set(suggestions)];
  return unique.slice(0, 4);
}
