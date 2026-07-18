export function getSmartReplies(
  recentMessages: Array<{text: string; isOutgoing: boolean}>,
): string[] {
  const recent = recentMessages.slice(-3);
  const lastIncoming = [...recent].reverse().find(m => !m.isOutgoing);
  if (!lastIncoming) return ['👍', 'Sounds good!', 'Got it'];

  const text = lastIncoming.text.toLowerCase();
  const suggestions: string[] = [];

  if (text.includes('?')) {
    suggestions.push('Yes!', 'Not sure', 'Let me think about it');
  }
  if (/\b(hi|hey|hello|morning|evening)\b/.test(text)) {
    suggestions.push('Hey!', "What's up?", 'How are you?');
  }
  if (/\b(thanks?|thank)\b/.test(text)) {
    suggestions.push("You're welcome!", 'No problem!', 'Anytime!');
  }
  if (/\bsorry\b/.test(text)) {
    suggestions.push('No worries!', "It's all good", "Don't worry about it");
  }
  if (/\b(lol|haha|funny)\b/.test(text)) {
    suggestions.push('😂', "That's hilarious", "I can't 😂");
  }
  if (/\b(food|eat|dinner|lunch)\b/.test(text)) {
    suggestions.push('Sounds good!', "I'm in!", 'What are you thinking?');
  }
  if (/\b(time|when|tomorrow)\b/.test(text)) {
    suggestions.push('Works for me', 'Let me check', 'What time?');
  }

  if (suggestions.length === 0) {
    return ['👍', 'Sounds good!', 'Got it'];
  }

  const unique = [...new Set(suggestions)];
  return unique.slice(0, 4);
}
