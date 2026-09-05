const mockReportError = jest.fn();
jest.mock('../telemetry', () => ({reportError: (...a: unknown[]) => mockReportError(...a)}));

import {guardDocSnapshot, guardQuerySnapshot} from '../snapshotGuard';

beforeEach(() => mockReportError.mockReset());

describe('guardDocSnapshot', () => {
  it('passes a real snapshot straight through', () => {
    const handler = jest.fn();
    const snap = {data: () => ({pet: {name: 'Nibbles'}})} as any;
    guardDocSnapshot('ctx', handler)(snap);
    expect(handler).toHaveBeenCalledWith(snap);
  });

  /**
   * The exact crash this exists for: deleting a chat makes its document
   * unreadable, RNFB calls the success callback with (null, error), and the
   * old handlers threw "Cannot read property 'data' of null".
   */
  it('does not invoke the handler when the listener errors with a null snapshot', () => {
    const handler = jest.fn(snap => (snap as any).data());
    const guarded = guardDocSnapshot('listen_chat_pet', handler);

    expect(() => guarded(null, new Error('permission-denied'))).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports a genuine failure so real problems stay visible', () => {
    const err = Object.assign(new Error('unavailable'), {code: 'firestore/unavailable'});
    guardDocSnapshot('listen_chat_pet', jest.fn())(null, err);
    expect(mockReportError).toHaveBeenCalledWith(err, 'listen_chat_pet');
  });

  /**
   * Losing access is how a listener ends when its chat is deleted. Reporting it
   * would send a burst of non-errors from every attached listener on each
   * delete — the noise that hides real failures.
   */
  it.each(['permission-denied', 'firestore/permission-denied'])(
    'stays silent when access is revoked (%s)',
    code => {
      const err = Object.assign(new Error('denied'), {code});
      const handler = jest.fn();
      expect(() => guardDocSnapshot('listen_chat_pet', handler)(null, err)).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
      expect(mockReportError).not.toHaveBeenCalled();
    },
  );

  // A null snapshot with no error isn't a documented RNFB state, but surviving
  // it costs nothing and crashing on it costs the whole screen.
  it('survives a null snapshot with no error, without reporting', () => {
    const handler = jest.fn();
    expect(() => guardDocSnapshot('ctx', handler)(null)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('does not swallow a genuine bug inside the handler', () => {
    // Errors thrown by real handler logic must still surface — the guard is
    // for null snapshots, not a blanket try/catch.
    const guarded = guardDocSnapshot('ctx', () => {
      throw new Error('handler bug');
    });
    expect(() => guarded({data: () => ({})} as any)).toThrow('handler bug');
  });
});

describe('guardQuerySnapshot', () => {
  it('passes a real query snapshot through', () => {
    const handler = jest.fn();
    const snap = {docs: [{id: 'a', data: () => ({})}]} as any;
    guardQuerySnapshot('ctx', handler)(snap);
    expect(handler).toHaveBeenCalledWith(snap);
  });

  it('protects collection listeners from the same null snapshot', () => {
    const handler = jest.fn(snap => (snap as any).docs.map((d: any) => d.id));
    const guarded = guardQuerySnapshot('listen_shared_lists', handler);

    expect(() => guarded(null, new Error('permission-denied'))).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
