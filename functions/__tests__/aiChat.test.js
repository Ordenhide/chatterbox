const {validateMessages, buildPrompt, extractAnswer} = require('../aiChat');

describe('validateMessages', () => {
  test('accepts a non-empty array of {sender, text}', () => {
    expect(() => validateMessages([{sender: 'A', text: 'hi'}])).not.toThrow();
  });

  test.each([
    [undefined],
    [null],
    [[]],
    ['not an array'],
    [[{sender: 'A', text: ''}]],
    [[{sender: 'A', text: '   '}]],
    [[{sender: 'A'}]],
    [[{sender: 'A', text: 42}]],
  ])('rejects %p', input => {
    expect(() => validateMessages(input)).toThrow();
  });
});

describe('buildPrompt', () => {
  const messages = [
    {sender: 'Alice', text: 'Are we still on for dinner Friday?'},
    {sender: 'Bob', text: 'Yes! 7pm at the usual place.'},
  ];

  test('builds a summary prompt when no question is given', () => {
    const prompt = buildPrompt(messages);
    expect(prompt).toMatch(/Summarize the key points/);
    expect(prompt).toContain('Alice: Are we still on for dinner Friday?');
    expect(prompt).toContain('Bob: Yes! 7pm at the usual place.');
    expect(prompt).not.toMatch(/Question:/);
  });

  test('builds a targeted question prompt when a question is given', () => {
    const prompt = buildPrompt(messages, 'What time is dinner?');
    expect(prompt).toMatch(/Answer the question below/);
    expect(prompt).toContain('Question: What time is dinner?');
    expect(prompt).toContain('Alice: Are we still on for dinner Friday?');
  });

  test('treats a blank/whitespace-only question as no question', () => {
    const prompt = buildPrompt(messages, '   ');
    expect(prompt).toMatch(/Summarize the key points/);
  });

  test('falls back to "User" for a message with no sender', () => {
    const prompt = buildPrompt([{text: 'hello'}]);
    expect(prompt).toContain('User: hello');
  });

  test('propagates invalid messages as a clear error rather than sending garbage to the model', () => {
    expect(() => buildPrompt([])).toThrow(/non-empty array/);
    expect(() => buildPrompt([{sender: 'A', text: ''}])).toThrow(/non-empty text/);
  });
});

describe('extractAnswer', () => {
  test('extracts result.response from a Cloudflare Workers AI response', () => {
    expect(extractAnswer({result: {response: 'The summary.'}, success: true})).toBe('The summary.');
  });

  test('trims incidental whitespace', () => {
    expect(extractAnswer({result: {response: '  hi  '}})).toBe('hi');
  });

  test('returns an empty string rather than throwing on a malformed/missing response', () => {
    expect(extractAnswer(null)).toBe('');
    expect(extractAnswer(undefined)).toBe('');
    expect(extractAnswer({})).toBe('');
    expect(extractAnswer({result: {}})).toBe('');
  });
});
