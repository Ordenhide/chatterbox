const mockCall = jest.fn();

jest.mock('../firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => (...args: unknown[]) => mockCall(...args),
}));
jest.mock('../errorLog', () => ({reportError: jest.fn()}));

import {markViewOnceViewed} from '../viewOnce';
import {reportError} from '../errorLog';

beforeEach(() => {
  mockCall.mockReset();
  (reportError as jest.Mock).mockReset();
});

describe('markViewOnceViewed', () => {
  it('reports the view to the server', async () => {
    // This client previously wrote nothing at all, so a view-once photo could
    // be opened indefinitely and the feature did nothing.
    mockCall.mockResolvedValue({data: {ok: true, allViewed: false}});
    await markViewOnceViewed('chat1', 'msg1');
    expect(mockCall).toHaveBeenCalledWith({chatId: 'chat1', messageId: 'msg1'});
  });

  it('passes a numeric message id through as a string', async () => {
    mockCall.mockResolvedValue({data: {ok: true}});
    await markViewOnceViewed('chat1', 12345);
    expect(mockCall).toHaveBeenCalledWith({chatId: 'chat1', messageId: '12345'});
  });

  it('returns what the server reported', async () => {
    mockCall.mockResolvedValue({data: {ok: true, allViewed: true}});
    expect(await markViewOnceViewed('chat1', 'msg1')).toEqual({ok: true, allViewed: true});
  });

  it('never throws, so a failed call cannot stop the photo opening', async () => {
    // A photo that refuses to open because a bookkeeping call failed reads as
    // a broken app. The cost of a lost call is that the message stays
    // viewable — which is the behaviour this replaces, not a regression.
    mockCall.mockRejectedValue(new Error('network down'));
    await expect(markViewOnceViewed('chat1', 'msg1')).resolves.toBeNull();
    expect(reportError).toHaveBeenCalled();
  });

  it('does not report an already-viewed race as an error', async () => {
    // Two renders can call this before the first lands. Ordinary, not a fault.
    const error = Object.assign(new Error('already viewed'), {
      code: 'functions/already-exists',
    });
    mockCall.mockRejectedValue(error);
    await expect(markViewOnceViewed('chat1', 'msg1')).resolves.toBeNull();
    expect(reportError).not.toHaveBeenCalled();
  });
});
