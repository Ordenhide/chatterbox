// The mime-type segment is captured greedily up to the last ";base64,"
// marker rather than stopping at the first ";" — web's MediaRecorder.mimeType
// commonly includes codec parameters (e.g. "audio/webm;codecs=opus"), which
// land verbatim in the Blob's type and therefore in the data URI web
// produces (web/src/components/ChatPane.tsx:1136-1137,
// web/src/services/storage.ts:65-72's blobToDataUri).
const DATA_URI_RE = /^data:(.+);base64,([\s\S]+)$/;

/**
 * Parses a "data:<mimeType>;base64,<data>" URI, the shape both clients
 * already produce for decrypted voice-message audio (see inlineAudio.ts /
 * storage.ts). Throws on anything else rather than silently degrading, so a
 * malformed client payload fails loudly instead of being sent to the Speech
 * API as garbage.
 */
function parseAudioDataUri(dataUri) {
  if (typeof dataUri !== 'string') {
    throw new Error('audio must be a data URI string');
  }
  const match = DATA_URI_RE.exec(dataUri);
  if (!match) {
    throw new Error('audio must be a "data:<mime>;base64,<data>" URI');
  }
  const [, mimeType, base64] = match;
  return {mimeType, base64};
}

// v2's ExplicitDecodingConfig.AudioEncoding enum (see @google-cloud/speech's
// protos.d.ts) supports these container/codec combinations by name — a
// direct match for what each client actually records:
//   mobile: always "audio/mp4" (AAC in an MPEG-4 container, inlineAudio.ts:35)
//   web: "audio/mp4" on Safari, "audio/webm"(;codecs=opus) on Chrome/Firefox
//        (ChatPane.tsx:93-94's VOICE_MIME candidates)
// autoDecodingConfig looked like the safer choice going in — one config for
// every input, no per-MIME-type table to maintain — but in production it
// rejected real recordings from both platforms with "Audio data does not
// appear to be in a supported encoding," so explicit mapping is what
// actually works.
const EXPLICIT_ENCODING_BY_MIME_TYPE = {
  'audio/mp4': 'MP4_AAC',
  'audio/m4a': 'M4A_AAC',
  'audio/x-m4a': 'M4A_AAC',
  'audio/webm': 'WEBM_OPUS',
  'audio/ogg': 'OGG_OPUS',
  'audio/mpeg': 'MP3',
  'audio/mp3': 'MP3',
  'audio/wav': 'LINEAR16',
  'audio/x-wav': 'LINEAR16',
};

// Opus (in either a WebM or Ogg container) always operates at a fixed 48kHz
// internally, per RFC 6716 — regardless of what sample rate the microphone
// actually captured at. Only AAC/MP3/LINEAR16 need the client's real
// capture settings, since those vary by encoder/config.
const OPUS_ENCODINGS = new Set(['WEBM_OPUS', 'OGG_OPUS']);
const OPUS_SAMPLE_RATE_HERTZ = 48000;

// v2's explicit decoding config rejects a request with sampleRateHertz: 0 /
// audioChannelCount: 0 outright ("Invalid sample rate hertz value: 0") —
// confirmed against the deployed function, this is not optional the way
// container-embedded metadata is for other APIs. These match this app's
// actual current AAC encoder settings (ChatScreen.tsx's audioSet: 24kHz
// mono) and are used only when a client sends a clip without its own
// values — e.g. a message recorded before these fields existed.
const DEFAULT_SAMPLE_RATE_HERTZ = 24000;
const DEFAULT_AUDIO_CHANNEL_COUNT = 1;

/**
 * Builds a Speech-to-Text v2 recognize() request for one voice-message clip.
 * The implicit "_" recognizer needs no separate GCP resource to be
 * provisioned ahead of time.
 */
function buildRecognizeRequest(projectId, dataUri, language, sampleRateHertz, audioChannelCount) {
  const {mimeType, base64} = parseAudioDataUri(dataUri);
  // MIME types may carry codec parameters ("audio/webm;codecs=opus") —
  // only the base type before the first ";" maps to an encoding.
  const baseMimeType = mimeType.split(';')[0].trim().toLowerCase();
  const encoding = EXPLICIT_ENCODING_BY_MIME_TYPE[baseMimeType];

  let decodingConfig;
  if (!encoding) {
    decodingConfig = {autoDecodingConfig: {}}; // unrecognized MIME type — best effort
  } else if (OPUS_ENCODINGS.has(encoding)) {
    decodingConfig = {
      explicitDecodingConfig: {
        encoding,
        sampleRateHertz: OPUS_SAMPLE_RATE_HERTZ,
        audioChannelCount: audioChannelCount || DEFAULT_AUDIO_CHANNEL_COUNT,
      },
    };
  } else {
    decodingConfig = {
      explicitDecodingConfig: {
        encoding,
        sampleRateHertz: sampleRateHertz || DEFAULT_SAMPLE_RATE_HERTZ,
        audioChannelCount: audioChannelCount || DEFAULT_AUDIO_CHANNEL_COUNT,
      },
    };
  }

  return {
    recognizer: `projects/${projectId}/locations/global/recognizers/_`,
    config: {
      ...decodingConfig,
      model: 'long',
      languageCodes: [language || 'en-US'],
    },
    content: Buffer.from(base64, 'base64'),
  };
}

/**
 * Extracts the transcript from a v2 recognize() response. A response can
 * carry multiple results (e.g. one per speech segment after a pause); these
 * are joined into a single string, which is what the chat UI displays.
 */
function extractTranscript(response) {
  const results = response?.results || [];
  return results
    .map(result => result.alternatives?.[0]?.transcript || '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

module.exports = {parseAudioDataUri, buildRecognizeRequest, extractTranscript};
