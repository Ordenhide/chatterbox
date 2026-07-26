// Web-parity mode. The native apps (iOS/Android/macOS) historically shipped a
// number of extra features that the web client doesn't have. To keep the two in
// lockstep, those extras are hidden behind this single flag rather than deleted,
// so they can be restored by flipping it back to `true`.
//
// Features gated off when this is `false` (hidden from the UI, code retained):
//   chat pet · context cards · chat-lock (PIN) · quote-wall action · safety
//   number · invisible ink · message styles · anonymous mode · gesture messages
//   · lottery/decision · voice filters · soundscapes · incognito · screenshot
//   protection/watermark · Focus Mode · Voice Diary
export const SHOW_NATIVE_ONLY_FEATURES = false;
