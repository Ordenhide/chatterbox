/**
 * Paired with src/services/__tests__/contacts.test.ts on mobile. Both clients
 * decide who is reachable from the same data and must decide it the same way —
 * a person one client offers and the other does not is a chat that can be
 * started from a phone and not from a browser.
 */
import {describe, expect, it} from 'vitest';
import {contactsFromChats, uidLabel} from './contacts';
import type {ChatRoom} from '../types';

const ME = 'me';

const chat = (id: string, extra: Partial<ChatRoom> = {}): ChatRoom =>
  ({id, name: 'Chat', participants: [ME, 'them'], createdAt: new Date(1000) as never, ...extra}) as ChatRoom;

describe('contactsFromChats', () => {
  it('is the other side of each direct chat', () => {
    expect(contactsFromChats([chat('a', {participants: [ME, 'ada']})], ME).map(c => c.uid)).toEqual([
      'ada',
    ]);
  });

  it('prefers your own name for them, then the chat name, then the uid', () => {
    expect(
      contactsFromChats(
        [chat('a', {participants: [ME, 'ada'], name: 'Chat with Ada', nameBy: {[ME]: 'Ada W'}})],
        ME,
      )[0].label,
    ).toBe('Ada W');
    expect(
      contactsFromChats([chat('b', {participants: [ME, 'bob'], name: 'Bob'})], ME)[0].label,
    ).toBe('Bob');
    expect(
      contactsFromChats([chat('c', {participants: [ME, 'cy'], name: 'Chat'})], ME)[0].label,
    ).toBe(uidLabel('cy'));
  });

  it('leaves out groups, chats you are not in, and chats with only yourself', () => {
    expect(contactsFromChats([chat('g', {participants: [ME, 'ada', 'bob']})], ME)).toEqual([]);
    expect(contactsFromChats([chat('x', {participants: ['ada', 'bob']})], ME)).toEqual([]);
    expect(contactsFromChats([chat('s', {participants: [ME, ME]})], ME)).toEqual([]);
  });

  it('lists a person once even with several chats, keeping the newest label', () => {
    const result = contactsFromChats(
      [
        chat('old', {participants: [ME, 'ada'], nameBy: {[ME]: 'Old'}, updatedAt: new Date(1) as never}),
        chat('new', {participants: [ME, 'ada'], nameBy: {[ME]: 'Ada'}, updatedAt: new Date(9000) as never}),
      ],
      ME,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Ada');
  });

  it('orders by last activity, reading a Timestamp, a Date and a number alike', () => {
    const result = contactsFromChats(
      [
        chat('a', {
          participants: [ME, 'ada'],
          nameBy: {[ME]: 'Ada'},
          updatedAt: {toDate: () => new Date(500)} as never,
        }),
        chat('b', {participants: [ME, 'bob'], nameBy: {[ME]: 'Bob'}, updatedAt: 400 as never}),
        chat('c', {participants: [ME, 'cy'], nameBy: {[ME]: 'Cy'}, updatedAt: new Date(600) as never}),
      ],
      ME,
    );
    expect(result.map(c => c.label)).toEqual(['Cy', 'Ada', 'Bob']);
  });

  it('survives junk and an empty list', () => {
    const junk = [{id: 'j'}, {id: 'k', participants: null}, {}] as unknown as ChatRoom[];
    expect(contactsFromChats(junk, ME)).toEqual([]);
    expect(contactsFromChats([], ME)).toEqual([]);
  });
});
