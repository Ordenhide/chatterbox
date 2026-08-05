const {validateTranslateInput, extractTranslation} = require('../translate');

describe('validateTranslateInput', () => {
  test('accepts non-empty text and targetLanguage', () => {
    expect(() => validateTranslateInput('hello', 'es')).not.toThrow();
  });

  test.each([
    [undefined, 'es'],
    [null, 'es'],
    ['', 'es'],
    ['   ', 'es'],
    [42, 'es'],
  ])('rejects text %p', (text, targetLanguage) => {
    expect(() => validateTranslateInput(text, targetLanguage)).toThrow(/text/);
  });

  test.each([
    ['hello', undefined],
    ['hello', null],
    ['hello', ''],
    ['hello', '   '],
    ['hello', 7],
  ])('rejects targetLanguage %p', (text, targetLanguage) => {
    expect(() => validateTranslateInput(text, targetLanguage)).toThrow(/targetLanguage/);
  });
});

describe('extractTranslation', () => {
  test('extracts a plain string result (the actual single-input shape)', () => {
    expect(extractTranslation(['Hola', {}])).toBe('Hola');
  });

  test('defensively handles an array result rather than assuming the string overload', () => {
    expect(extractTranslation([['Hola', 'Bonjour'], {}])).toBe('Hola');
  });

  test('returns an empty string rather than throwing on an empty/missing result', () => {
    expect(extractTranslation([undefined, {}])).toBe('');
    expect(extractTranslation([[], {}])).toBe('');
    expect(extractTranslation([])).toBe('');
  });
});
