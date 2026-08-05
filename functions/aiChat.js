/** Validates the client-supplied message transcript before spending an AI call on it. */
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }
  for (const m of messages) {
    if (typeof m?.text !== 'string' || !m.text.trim()) {
      throw new Error('each message must have a non-empty text string');
    }
  }
}

/**
 * Builds the prompt sent to the model for the "Catch Up" feature. Two modes:
 * a plain summary when no question is given, or a targeted answer (citing
 * which messages support it) when one is — same call, same transcript
 * format, different instruction.
 */
function buildPrompt(messages, question) {
  validateMessages(messages);
  const transcript = messages.map(m => `${m.sender || 'User'}: ${m.text}`).join('\n');
  const trimmedQuestion = question?.trim();

  if (trimmedQuestion) {
    return [
      'The following is a transcript of a private chat conversation.',
      "Answer the question below using only this conversation's content.",
      'Reference or quote the specific messages that support your answer.',
      'If the conversation does not contain relevant information, say so',
      'plainly rather than guessing.',
      '',
      '--- Conversation ---',
      transcript,
      '--- End conversation ---',
      '',
      `Question: ${trimmedQuestion}`,
    ].join('\n');
  }

  return [
    'The following is a transcript of a private chat conversation.',
    'Summarize the key points and topics discussed, concisely.',
    '',
    '--- Conversation ---',
    transcript,
    '--- End conversation ---',
  ].join('\n');
}

/**
 * Extracts the plain-text answer from a Cloudflare Workers AI REST response.
 * The `/ai/run/{model}` endpoint wraps the OpenAI-compatible completion in
 * `{result: {response: "..."}}` — `result.response` is the plain-text
 * shortcut Cloudflare provides specifically so callers don't have to reach
 * into `result.choices[0].message.content` themselves.
 */
function extractAnswer(response) {
  return (response?.result?.response || '').trim();
}

module.exports = {validateMessages, buildPrompt, extractAnswer};
