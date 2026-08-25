/**
 * The decision half of focus mode's auto-reply, kept out of index.js so it can
 * be tested. index.js keeps the I/O — reading the chat, the block records and
 * the recipient's profile, and writing the reply.
 *
 * Two bugs lived in the version that was inline:
 *
 *  - It required `message.text`. An end-to-end encrypted message carries its
 *    body in `encrypted` and leaves `text` empty, so the auto-reply never fired
 *    in an encrypted chat — which, once both parties enrol, is every chat. The
 *    feature looked enabled and did nothing.
 *
 *  - It never looked at blocks. Blocking someone still sent them an automated
 *    note confirming you were around and had focus mode on.
 */

const AUTO_REPLY_PREFIX = '[Auto-Reply]';
const DEFAULT_REPLY = "I'm currently in focus mode. I'll get back to you later.";

/**
 * True if this newly created message is one an auto-reply should answer.
 *
 * Loop prevention checks the `autoReply` flag first: the prefix test still runs
 * for replies written before that flag existed, but a sealed body has no prefix
 * to find, so the flag is what actually holds once bodies are encrypted.
 */
function isAutoReplyTrigger(message) {
  if (!message || !message.user || !message.user._id) return false;
  if (!message.text && !message.encrypted) return false;
  if (message.autoReply) return false;
  if ((message.text || '').startsWith(AUTO_REPLY_PREFIX)) return false;
  return true;
}

/**
 * What to do for one recipient of a triggering message.
 *
 * `blockedEitherWay` suppresses in both directions on purpose. An auto-reply is
 * a message *from* the person with focus mode on, so it has to stop whether
 * they blocked the sender or the sender blocked them.
 *
 * Returns one of:
 *   {action: 'skip'}                 — nothing to do
 *   {action: 'expire'}               — focus mode's window has passed; clear it
 *   {action: 'reply', text: string}  — post this
 */
function autoReplyDecision({blockedEitherWay, focus, now}) {
  if (blockedEitherWay) return {action: 'skip'};
  if (!focus || !focus.enabled) return {action: 'skip'};
  if (focus.until && focus.until < now) return {action: 'expire'};
  const body = typeof focus.autoReply === 'string' && focus.autoReply.trim()
    ? focus.autoReply.trim()
    : DEFAULT_REPLY;
  return {action: 'reply', text: `${AUTO_REPLY_PREFIX} ${body}`};
}

module.exports = {AUTO_REPLY_PREFIX, DEFAULT_REPLY, isAutoReplyTrigger, autoReplyDecision};
