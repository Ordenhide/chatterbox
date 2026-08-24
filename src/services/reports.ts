/**
 * Abuse reports — the counterpart to message deletion being author-only.
 *
 * You cannot delete someone else's message (firestore.rules restricts that to
 * its author, because only the deleter can restore from trash, so deleting
 * another person's message removes it from *their* reach). The answer to a
 * message you object to is therefore to report it.
 *
 * ## The disclosure this makes, stated plainly
 *
 * Chat content is end-to-end encrypted, so the server holds ciphertext it has
 * no key for. A report carrying only a chat id and a message id would be
 * unactionable — nobody receiving it could see what was being reported.
 *
 * So a report carries the reporter's own *decrypted* copy of the message.
 * That is a genuine disclosure: it takes one message out of the encrypted
 * conversation and hands it to whoever reads reports. It is also unavoidable
 * for the feature to mean anything, which is why the caller is required to
 * pass `content` explicitly rather than have this module quietly reach for it,
 * and why the UI confirms before sending.
 *
 * Reporting without the content is supported and still files the report — it
 * is just weaker evidence. `MAX_CONTENT_CHARS` mirrors the cap in
 * firestore.rules, so an over-long message is truncated here rather than
 * rejected by the server.
 */
import {Platform} from 'react-native';
import {addDoc, collection, getFirestore, serverTimestamp} from './firebase/firestore';

const db = getFirestore();

/** Mirrors the bound in firestore.rules' messageReports rule. */
export const MAX_CONTENT_CHARS = 4000;

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'threat',
  'sexual-content',
  'impersonation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export async function reportMessage(params: {
  chatId: string;
  messageId: string;
  authorUid: string;
  reporterUid: string;
  reason: ReportReason;
  /** The reporter's decrypted copy. Omit to file without evidence. */
  content?: string;
}): Promise<void> {
  const {chatId, messageId, authorUid, reporterUid, reason, content} = params;

  await addDoc(collection(db, 'messageReports'), {
    chatId,
    messageId,
    authorUid,
    reporterUid,
    reason,
    // Truncated rather than dropped: the first 4000 characters are usually
    // enough to act on, and losing the whole report to a length check is not.
    ...(content ? {content: content.slice(0, MAX_CONTENT_CHARS)} : null),
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}
