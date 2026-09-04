import {startTrace} from '../loadTrace';

describe('startTrace', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    (global as any).__DEV__ = true;
  });

  it('names the trace and the phase, with a delta and a total', () => {
    startTrace('chat abc').mark('snapshot', '50 msgs');

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0] as string;
    expect(line).toContain('chat abc');
    expect(line).toContain('snapshot');
    expect(line).toContain('50 msgs');
    expect(line).toMatch(/\+\d+ms/);
    expect(line).toMatch(/total \d+ms/);
  });

  it('omits the parenthetical when there is no detail', () => {
    startTrace('chat abc').mark('static decrypt');
    expect(log.mock.calls[0][0]).not.toContain('(');
  });

  it('keeps traces independent, so two open chats do not share a clock', () => {
    const a = startTrace('a');
    const b = startTrace('b');
    a.mark('one');
    b.mark('one');
    expect(log.mock.calls[0][0]).toContain('· a ·'.slice(2));
    expect(log.mock.calls[1][0]).toContain('b ·');
  });

  // The whole point of the guard: a release build must not narrate itself to
  // the console on every chat open.
  it('is silent outside dev', () => {
    (global as any).__DEV__ = false;
    startTrace('chat abc').mark('snapshot', 1);
    expect(log).not.toHaveBeenCalled();
  });
});
