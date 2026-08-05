import {isChatHidden, partitionChats, unreadTotal} from '../hiddenChats';
import type {ChatRoom} from '../../types';

const chat = (id: string, extra: Partial<ChatRoom> = {}): ChatRoom => ({
  id,
  name: id,
  participants: ['me', 'them'],
  createdAt: new Date(0),
  ...extra,
});

describe('isChatHidden', () => {
  it('is false when nothing has ever been hidden', () => {
    expect(isChatHidden(chat('a'), 'me')).toBe(false);
    expect(isChatHidden(chat('a', {hiddenBy: []}), 'me')).toBe(false);
  });

  it('is true only for the user who hid it', () => {
    const c = chat('a', {hiddenBy: ['me']});
    expect(isChatHidden(c, 'me')).toBe(true);
    // The whole point of a per-user array: hiding is not visible to the peer.
    expect(isChatHidden(c, 'them')).toBe(false);
  });

  it('handles several users hiding the same chat independently', () => {
    const c = chat('a', {hiddenBy: ['me', 'them']});
    expect(isChatHidden(c, 'me')).toBe(true);
    expect(isChatHidden(c, 'them')).toBe(true);
    expect(isChatHidden(c, 'someone-else')).toBe(false);
  });
});

describe('partitionChats', () => {
  it('splits into visible and hidden without losing or duplicating a chat', () => {
    const chats = [
      chat('a'),
      chat('b', {hiddenBy: ['me']}),
      chat('c', {hiddenBy: ['them']}),
      chat('d', {hiddenBy: ['me', 'them']}),
    ];
    const {visible, hidden} = partitionChats(chats, 'me');
    expect(visible.map(c => c.id)).toEqual(['a', 'c']);
    expect(hidden.map(c => c.id)).toEqual(['b', 'd']);
    expect(visible.length + hidden.length).toBe(chats.length);
  });

  it('preserves the incoming order within each bucket', () => {
    const chats = [chat('z', {hiddenBy: ['me']}), chat('y'), chat('x', {hiddenBy: ['me']})];
    const {visible, hidden} = partitionChats(chats, 'me');
    expect(hidden.map(c => c.id)).toEqual(['z', 'x']);
    expect(visible.map(c => c.id)).toEqual(['y']);
  });

  it('handles an empty list', () => {
    expect(partitionChats([], 'me')).toEqual({visible: [], hidden: []});
  });

  it('gives the peer the opposite view of the same data', () => {
    const chats = [chat('a', {hiddenBy: ['me']}), chat('b', {hiddenBy: ['them']})];
    expect(partitionChats(chats, 'me').hidden.map(c => c.id)).toEqual(['a']);
    expect(partitionChats(chats, 'them').hidden.map(c => c.id)).toEqual(['b']);
  });
});

describe('unreadTotal', () => {
  it('sums unread for the given user only', () => {
    const chats = [
      chat('a', {unreadCountBy: {me: 3, them: 9}}),
      chat('b', {unreadCountBy: {me: 2}}),
    ];
    expect(unreadTotal(chats, 'me')).toBe(5);
  });

  it('skips muted chats, matching what the Chats badge counts', () => {
    const chats = [
      chat('a', {unreadCountBy: {me: 3}}),
      chat('b', {unreadCountBy: {me: 40}, mutedBy: ['me']}),
    ];
    expect(unreadTotal(chats, 'me')).toBe(3);
  });

  it('treats a chat muted by the peer as still counting for me', () => {
    const chats = [chat('a', {unreadCountBy: {me: 4}, mutedBy: ['them']})];
    expect(unreadTotal(chats, 'me')).toBe(4);
  });

  it('is zero for an empty list or missing counters', () => {
    expect(unreadTotal([], 'me')).toBe(0);
    expect(unreadTotal([chat('a')], 'me')).toBe(0);
  });
});

describe('hide/recover round trip', () => {
  // Mirrors what toggleHideChat does to the array, so the list logic is
  // verified against the same shape Firestore ends up holding.
  const applyToggle = (c: ChatRoom, uid: string): ChatRoom => {
    const set = new Set(c.hiddenBy || []);
    if (set.has(uid)) set.delete(uid);
    else set.add(uid);
    return {...c, hiddenBy: [...set]};
  };

  it('hiding then recovering returns the chat to the visible list', () => {
    let c = chat('a');
    expect(partitionChats([c], 'me').visible).toHaveLength(1);

    c = applyToggle(c, 'me');
    expect(partitionChats([c], 'me').hidden).toHaveLength(1);
    expect(partitionChats([c], 'me').visible).toHaveLength(0);

    c = applyToggle(c, 'me');
    expect(partitionChats([c], 'me').visible).toHaveLength(1);
    expect(partitionChats([c], 'me').hidden).toHaveLength(0);
  });

  it("recovering my copy leaves the peer's hidden state untouched", () => {
    let c = chat('a', {hiddenBy: ['me', 'them']});
    c = applyToggle(c, 'me');
    expect(isChatHidden(c, 'me')).toBe(false);
    expect(isChatHidden(c, 'them')).toBe(true);
  });
});
