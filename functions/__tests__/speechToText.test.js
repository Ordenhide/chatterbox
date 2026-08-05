const {parseAudioDataUri, buildRecognizeRequest, extractTranscript} = require('../speechToText');

describe('parseAudioDataUri', () => {
  test('parses a well-formed data URI', () => {
    expect(parseAudioDataUri('data:audio/mp4;base64,AAAA')).toEqual({
      mimeType: 'audio/mp4',
      base64: 'AAAA',
    });
  });

  test.each([
    [undefined],
    [null],
    [42],
    [''],
    ['not-a-data-uri'],
    ['data:audio/mp4,missingBase64Marker'],
    ['audio/mp4;base64,AAAA'], // missing "data:" scheme
  ])('rejects %p', input => {
    expect(() => parseAudioDataUri(input)).toThrow();
  });
});

describe('buildRecognizeRequest', () => {
  test('builds a v2 recognize() request using the implicit default recognizer', () => {
    const req = buildRecognizeRequest('my-project', 'data:audio/mp4;base64,AAAA', 'fr-FR', 24000, 1);
    expect(req.recognizer).toBe('projects/my-project/locations/global/recognizers/_');
    expect(req.config).toEqual({
      explicitDecodingConfig: {encoding: 'MP4_AAC', sampleRateHertz: 24000, audioChannelCount: 1},
      model: 'long',
      languageCodes: ['fr-FR'],
    });
    expect(Buffer.isBuffer(req.content)).toBe(true);
    expect(req.content).toEqual(Buffer.from('AAAA', 'base64'));
  });

  test('defaults to en-US when no language is given', () => {
    const req = buildRecognizeRequest('my-project', 'data:audio/mp4;base64,AAAA');
    expect(req.config.languageCodes).toEqual(['en-US']);
  });

  // Real production failures these tests lock in, found only by actually
  // deploying and recording real clips against the live function:
  //  1. autoDecodingConfig rejected real recordings from both platforms with
  //     "Audio data does not appear to be in a supported encoding" — explicit,
  //     MIME-type-derived encoding is what actually works.
  //  2. explicitDecodingConfig then rejected sampleRateHertz/audioChannelCount
  //     left unset ("Invalid sample rate hertz value: 0") — these container
  //     formats do NOT get sample rate inferred from their own headers the
  //     way one might expect; the API requires it spelled out.
  test.each([
    ['audio/mp4', 'MP4_AAC'], // mobile always, web on Safari/newer Chrome
    ['audio/m4a', 'M4A_AAC'],
    ['audio/x-m4a', 'M4A_AAC'],
    ['audio/mpeg', 'MP3'],
    ['audio/wav', 'LINEAR16'],
  ])('maps %s to explicit encoding %s, using the client-supplied sample rate', (mimeType, encoding) => {
    const req = buildRecognizeRequest('p', `data:${mimeType};base64,AAAA`, undefined, 44100, 2);
    expect(req.config.explicitDecodingConfig).toEqual({encoding, sampleRateHertz: 44100, audioChannelCount: 2});
    expect(req.config.autoDecodingConfig).toBeUndefined();
  });

  test.each([
    ['audio/mp4', 'MP4_AAC'],
    ['audio/mpeg', 'MP3'],
  ])(
    '%s falls back to this app\'s actual AAC capture defaults (24kHz mono) when the client sends none',
    (mimeType, encoding) => {
      // Covers messages sent before audioSampleRateHertz/audioChannelCount
      // existed on the message doc.
      const req = buildRecognizeRequest('p', `data:${mimeType};base64,AAAA`);
      expect(req.config.explicitDecodingConfig).toEqual({encoding, sampleRateHertz: 24000, audioChannelCount: 1});
    },
  );

  test.each([
    ['audio/webm', 'WEBM_OPUS'], // web on Chrome/Firefox
    ['audio/ogg', 'OGG_OPUS'],
  ])(
    'always uses 48kHz for %s (%s) regardless of client-supplied rate — a fixed Opus property, not a capture setting',
    (mimeType, encoding) => {
      // Even if a caller passes a bogus/irrelevant sample rate, Opus's own
      // internal 48kHz rate is what's actually correct — RFC 6716.
      const req = buildRecognizeRequest('p', `data:${mimeType};base64,AAAA`, undefined, 16000, 1);
      expect(req.config.explicitDecodingConfig).toEqual({encoding, sampleRateHertz: 48000, audioChannelCount: 1});
    },
  );

  test('handles a MediaRecorder.mimeType with codec parameters (real web shape)', () => {
    // web's Blob type is recorder.mimeType verbatim (ChatPane.tsx:1136-1137),
    // e.g. "audio/webm;codecs=opus" — two ";"s before "base64,", not one, and
    // only the part before the first ";" is a lookup key into the encoding map.
    const req = buildRecognizeRequest('p', 'data:audio/webm;codecs=opus;base64,SGVsbG8=');
    expect(req.config.explicitDecodingConfig).toEqual({
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      audioChannelCount: 1,
    });
    expect(req.content).toEqual(Buffer.from('SGVsbG8=', 'base64'));
  });

  test('falls back to auto-detect for an unrecognized MIME type rather than throwing', () => {
    const req = buildRecognizeRequest('p', 'data:audio/x-some-future-format;base64,AAAA');
    expect(req.config.autoDecodingConfig).toEqual({});
    expect(req.config.explicitDecodingConfig).toBeUndefined();
  });

  test('propagates a malformed audio payload as a clear error', () => {
    expect(() => buildRecognizeRequest('my-project', 'garbage')).toThrow(/data:<mime>;base64/);
  });
});

describe('extractTranscript', () => {
  test('extracts the top alternative from a single result', () => {
    const response = {
      results: [{alternatives: [{transcript: 'hello world', confidence: 0.98}]}],
    };
    expect(extractTranscript(response)).toBe('hello world');
  });

  test('joins multiple segments (e.g. separated by a pause) into one string', () => {
    const response = {
      results: [
        {alternatives: [{transcript: 'hello there'}]},
        {alternatives: [{transcript: 'how are you'}]},
      ],
    };
    expect(extractTranscript(response)).toBe('hello there how are you');
  });

  test('returns an empty string for silence (no results)', () => {
    expect(extractTranscript({results: []})).toBe('');
    expect(extractTranscript({})).toBe('');
  });

  test('does not throw on a malformed/missing response', () => {
    expect(extractTranscript(null)).toBe('');
    expect(extractTranscript(undefined)).toBe('');
    expect(extractTranscript({results: [{alternatives: []}]})).toBe('');
    expect(extractTranscript({results: [{}]})).toBe('');
  });

  test('trims incidental whitespace', () => {
    const response = {results: [{alternatives: [{transcript: '  hi  '}]}]};
    expect(extractTranscript(response)).toBe('hi');
  });
});
