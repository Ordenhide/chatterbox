/**
 * Validates the two required Cloud Translate inputs before spending an API
 * call on them. `text` is the client's already-decrypted plaintext (see
 * index.js's translateMessage doc comment) — this is the one place that
 * distinguishes a genuinely empty message from a caller bug, so it fails
 * loudly rather than silently sending "" to the API.
 */
function validateTranslateInput(text, targetLanguage) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('text must be a non-empty string');
  }
  if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
    throw new Error('targetLanguage must be a non-empty string');
  }
}

/**
 * Extracts the translated string from a Cloud Translate v2 translate() call.
 * For a single-string input the client resolves to a plain string (not an
 * array — that overload is only for batch/array input), but this defends
 * against an unexpected array shape rather than assuming the exact overload
 * held at runtime.
 */
function extractTranslation(result) {
  const [translated] = result;
  if (Array.isArray(translated)) return translated[0] || '';
  return translated || '';
}

module.exports = {validateTranslateInput, extractTranslation};
