import {describe, expect, it} from 'vitest';
import {resolveChatMeta} from './chatMeta';
import type {ChatRoom, UserProfile} from '../types';

const ME = 'me-uid';
const OTHER = 'other-uid';

function direct(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {id: 'c1', participants: [ME, OTHER], ...overrides};
}

function group(memberCount: number, overrides: Partial<ChatRoom> = {}): ChatRoom {
  const participants = [ME, ...Array.from({length: memberCount - 1}, (_, i) => `member-${i}`)];
  return {id: 'g1', participants, ...overrides};
}

describe('resolveChatMeta', () => {
  it('titles a 1:1 chat after the other participant\'s display name', () => {
    const userCache: Record<string, UserProfile> = {
      [OTHER]: {uid: OTHER, email: 'a@b.com', displayName: 'Ada'},
    };
    expect(resolveChatMeta(direct(), ME, userCache).title).toBe('Ada');
  });

  it('falls back to email when the other participant has no display name', () => {
    const userCache: Record<string, UserProfile> = {[OTHER]: {uid: OTHER, email: 'a@b.com'}};
    expect(resolveChatMeta(direct(), ME, userCache).title).toBe('a@b.com');
  });

  it('falls back to a generic label when the profile has not resolved yet', () => {
    expect(resolveChatMeta(direct(), ME, {}).title).toBe('Chat');
  });

  it('a custom name (renamed by me) wins over the resolved profile', () => {
    const userCache: Record<string, UserProfile> = {
      [OTHER]: {uid: OTHER, email: 'a@b.com', displayName: 'Ada'},
    };
    const chat = direct({nameBy: {[ME]: 'Work Ada'}});
    expect(resolveChatMeta(chat, ME, userCache).title).toBe('Work Ada');
  });

  it('seeds a 1:1 chat off the other participant, not the chat id', () => {
    expect(resolveChatMeta(direct(), ME, {}).seed).toBe(OTHER);
  });

  it('never titles a group after a single member — that misattributes it', () => {
    const userCache: Record<string, UserProfile> = {
      'member-0': {uid: 'member-0', email: 'x@y.com', displayName: 'Xavier'},
    };
    // Xavier happens to be first in participants, but a group's default title
    // must never read as "this is a 1:1 with Xavier".
    expect(resolveChatMeta(group(3), ME, userCache).title).toBe('3 members');
  });

  it('prefers the group\'s own name over the member count', () => {
    expect(resolveChatMeta(group(4, {name: 'Roommates'}), ME, {}).title).toBe('Roommates');
  });

  it('a custom name still wins for a group too', () => {
    const chat = group(4, {name: 'Roommates', nameBy: {[ME]: 'The Squad'}});
    expect(resolveChatMeta(chat, ME, {}).title).toBe('The Squad');
  });
});
