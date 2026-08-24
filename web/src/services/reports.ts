/**
 * Abuse reports — the counterpart to message deletion being author-only.
 * Mirrors src/services/reports.ts on mobile; see that file for the full
 * reasoning behind the disclosure a report necessarily makes.
 *
 * In short: chat content is end-to-end encrypted, so the server holds
 * ciphertext it cannot read. A report naming only a message id would be
 * unactionable, so a report carries the reporter's own decrypted copy. That is
 * a real disclosure of one message out of an encrypted conversation, which is
 * why `content` must be passed in explicitly and why the UI confirms first.
 */
import {addDoc, collection, serverTimestamp} from 'firebase/firestore';
import {db} from '../firebase';

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
    // Truncated rather than dropped: losing the whole report to a length
    // check would be worse than losing the tail of a long message.
    ...(content ? {content: content.slice(0, MAX_CONTENT_CHARS)} : null),
    platform: 'web',
    createdAt: serverTimestamp(),
  });
}
