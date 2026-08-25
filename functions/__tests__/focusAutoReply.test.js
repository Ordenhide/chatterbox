const {
  AUTO_REPLY_PREFIX,
  DEFAULT_REPLY,
  isAutoReplyTrigger,
  autoReplyDecision,
} = require('../focusAutoReply');

describe('isAutoReplyTrigger', () => {
  const plain = {user: {_id: 'alice'}, text: 'hello'};

  it('answers an ordinary text message', () => {
    expect(isAutoReplyTrigger(plain)).toBe(true);
  });

  /**
   * The bug: an end-to-end encrypted message puts its body in `encrypted` and
   * leaves `text` empty, and the old test was `!message.text`. So focus mode's
   * auto-reply never fired in an encrypted chat — which, once both parties
   * enrol, is every chat. The feature looked enabled and did nothing.
   */
  it('answers an encrypted message, whose text is empty by design', () => {
    expect(isAutoReplyTrigger({user: {_id: 'alice'}, text: '', encrypted: {alg: 'x', copies: {}}})).toBe(true);
  });

  it('ignores a message with no body at all', () => {
    expect(isAutoReplyTrigger({user: {_id: 'alice'}, text: ''})).toBe(false);
  });

  it('ignores a message with no author', () => {
    expect(isAutoReplyTrigger({text: 'hi'})).toBe(false);
    expect(isAutoReplyTrigger({user: {}, text: 'hi'})).toBe(false);
    expect(isAutoReplyTrigger(null)).toBe(false);
  });

  describe('loop prevention', () => {
    it('does not answer an auto-reply, by its flag', () => {
      expect(isAutoReplyTrigger({user: {_id: 'bob'}, text: 'anything', autoReply: true})).toBe(false);
    });

    // Replies written before the flag existed carry only the prefix.
    it('does not answer an older auto-reply, by its prefix', () => {
      expect(isAutoReplyTrigger({user: {_id: 'bob'}, text: `${AUTO_REPLY_PREFIX} away`})).toBe(false);
    });

    // The case the flag exists for: a sealed body has no prefix to find, so
    // without it two people in focus mode would answer each other forever.
    it('does not answer a sealed auto-reply, which has no readable prefix', () => {
      expect(
        isAutoReplyTrigger({user: {_id: 'bob'}, text: '', encrypted: {alg: 'x'}, autoReply: true}),
      ).toBe(false);
    });
  });
});

describe('autoReplyDecision', () => {
  const focus = {enabled: true, autoReply: 'Heads down until 5.'};
  const now = 1_000_000;

  it('replies with the away message the user wrote', () => {
    expect(autoReplyDecision({blockedEitherWay: false, focus, now})).toEqual({
      action: 'reply',
      text: `${AUTO_REPLY_PREFIX} Heads down until 5.`,
    });
  });

  it('falls back to a default when no away message is set', () => {
    for (const autoReply of [undefined, '', '   ', 42]) {
      expect(autoReplyDecision({blockedEitherWay: false, focus: {enabled: true, autoReply}, now})).toEqual({
        action: 'reply',
        text: `${AUTO_REPLY_PREFIX} ${DEFAULT_REPLY}`,
      });
    }
  });

  it('does nothing when focus mode is off or absent', () => {
    expect(autoReplyDecision({blockedEitherWay: false, focus: {enabled: false}, now}).action).toBe('skip');
    expect(autoReplyDecision({blockedEitherWay: false, focus: undefined, now}).action).toBe('skip');
  });

  it('expires focus mode once its window has passed, instead of replying', () => {
    expect(autoReplyDecision({blockedEitherWay: false, focus: {...focus, until: now - 1}, now}).action).toBe('expire');
    expect(autoReplyDecision({blockedEitherWay: false, focus: {...focus, until: now + 1}, now}).action).toBe('reply');
  });

  /**
   * Blocking means silence. An auto-reply is a message *from* the person with
   * focus mode on, so a block in either direction has to suppress it —
   * otherwise blocking someone still sent them an automated note confirming
   * you were around and had focus mode on.
   */
  it('stays silent when either party has blocked the other', () => {
    expect(autoReplyDecision({blockedEitherWay: true, focus, now})).toEqual({action: 'skip'});
  });

  it('stays silent on a block even when focus mode has also expired', () => {
    // Skip wins over expire: clearing someone's flag is a write, and a blocked
    // pair should produce no work at all.
    expect(autoReplyDecision({blockedEitherWay: true, focus: {...focus, until: now - 1}, now})).toEqual({
      action: 'skip',
    });
  });
});
