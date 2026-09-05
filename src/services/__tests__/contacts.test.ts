/**
 * `contactsFromChats` is what group creation and member-adding use now that
 * there is no email to type. It is the whole reachable set, so anything it
 * drops is a person the user can no longer add to anything.
 */
import {contactsFromChats, uidLabel} from '../contacts';
import type {ChatRoom} from '../../types';

const ME = 'me';

const chat = (id: string, extra: Partial<ChatRoom> = {}): ChatRoom =>
  ({
    id,
    name: 'Chat',
    participants: [ME, 'them'],
    createdAt: new Date(1000),
    ...extra,
  }) as ChatRoom;

describe('contactsFromChats', () => {
  it('is the other side of each direct chat', () => {
    const result = contactsFromChats([chat('a', {participants: [ME, 'ada']})], ME);
    expect(result.map(c => c.uid)).toEqual(['ada']);
  });

  it('prefers your own name for them over the chat name', () => {
    const result = contactsFromChats(
      [chat('a', {participants: [ME, 'ada'], name: 'Chat with Ada', nameBy: {[ME]: 'Ada W'}})],
      ME,
    );
    expect(result[0].label).toBe('Ada W');
  });

  it('falls back to the chat name, then to the uid', () => {
    const named = contactsFromChats([chat('a', {participants: [ME, 'ada'], name: 'Ada'})], ME);
    expect(named[0].label).toBe('Ada');
    // 'Chat' is what createChat writes when nobody supplied a name, so showing
    // it as a label would present the absence of a name as a name.
    const unnamed = contactsFromChats([chat('b', {participants: [ME, 'bob'], name: 'Chat'})], ME);
    expect(unnamed[0].label).toBe(uidLabel('bob'));
    const blank = contactsFromChats(
      [chat('c', {participants: [ME, 'cy'], name: '  ', nameBy: {[ME]: '   '}})],
      ME,
    );
    expect(blank[0].label).toBe(uidLabel('cy'));
  });

  it('leaves out groups', () => {
    // Being in a group with someone is not a way to reach them: the invite
    // that put them there was somebody else's.
    const result = contactsFromChats([chat('g', {participants: [ME, 'ada', 'bob']})], ME);
    expect(result).toEqual([]);
  });

  it('leaves out chats you are not in', () => {
    expect(contactsFromChats([chat('x', {participants: ['ada', 'bob']})], ME)).toEqual([]);
  });

  it('leaves out a chat with only yourself', () => {
    expect(contactsFromChats([chat('s', {participants: [ME, ME]})], ME)).toEqual([]);
    expect(contactsFromChats([chat('s', {participants: [ME]})], ME)).toEqual([]);
  });

  it('lists a person once even with several chats, keeping the newest label', () => {
    const result = contactsFromChats(
      [
        chat('old', {participants: [ME, 'ada'], nameBy: {[ME]: 'Old name'}, updatedAt: new Date(1)}),
        chat('new', {participants: [ME, 'ada'], nameBy: {[ME]: 'Ada'}, updatedAt: new Date(9000)}),
      ],
      ME,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Ada');
  });

  it('puts the most recently active first', () => {
    const result = contactsFromChats(
      [
        chat('a', {participants: [ME, 'ada'], nameBy: {[ME]: 'Ada'}, updatedAt: new Date(10)}),
        chat('b', {participants: [ME, 'bob'], nameBy: {[ME]: 'Bob'}, updatedAt: new Date(99)}),
      ],
      ME,
    );
    expect(result.map(c => c.label)).toEqual(['Bob', 'Ada']);
  });

  it('reads a Firestore timestamp, a Date and a number alike', () => {
    const stamp = {toDate: () => new Date(500)};
    const result = contactsFromChats(
      [
        chat('a', {participants: [ME, 'ada'], nameBy: {[ME]: 'Ada'}, updatedAt: stamp as any}),
        chat('b', {participants: [ME, 'bob'], nameBy: {[ME]: 'Bob'}, updatedAt: 400 as any}),
        chat('c', {participants: [ME, 'cy'], nameBy: {[ME]: 'Cy'}, updatedAt: new Date(600)}),
      ],
      ME,
    );
    expect(result.map(c => c.label)).toEqual(['Cy', 'Ada', 'Bob']);
  });

  it('survives a chat with nothing usable on it', () => {
    const junk = [{id: 'j'}, {id: 'k', participants: null}, {}] as unknown as ChatRoom[];
    expect(() => contactsFromChats(junk, ME)).not.toThrow();
    expect(contactsFromChats(junk, ME)).toEqual([]);
  });

  it('is empty when there are no chats at all', () => {
    // What a brand-new account sees, and the reason the invite screen has to
    // be reachable from wherever this list is shown.
    expect(contactsFromChats([], ME)).toEqual([]);
  });
});
