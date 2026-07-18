/**
 * Read Receipt Batching Service
 * Batches read receipt updates to reduce Firestore writes
 * Similar to WeChat's approach: update read receipts in batches
 */

import {doc, getFirestore, serverTimestamp, setDoc} from '@react-native-firebase/firestore';

const db = getFirestore();
const BATCH_INTERVAL_MS = 2000; // Batch updates every 2 seconds
const MAX_BATCH_SIZE = 10;

type PendingReceipt = {
  chatId: string;
  userId: string;
  timestamp: number;
};

class ReadReceiptBatcher {
  private pending: Map<string, PendingReceipt> = new Map();
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;

  /**
   * Queue a read receipt update
   */
  queue(chatId: string, userId: string): void {
    const key = `${chatId}:${userId}`;
    this.pending.set(key, {
      chatId,
      userId,
      timestamp: Date.now(),
    });

    // Schedule flush if not already scheduled
    if (!this.flushTimeout && !this.isFlushing) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, BATCH_INTERVAL_MS);
    }

    // Flush immediately if batch is full
    if (this.pending.size >= MAX_BATCH_SIZE) {
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
        this.flushTimeout = null;
      }
      this.flush();
    }
  }

  /**
   * Flush all pending read receipts
   */
  private async flush(): Promise<void> {
    if (this.isFlushing || this.pending.size === 0) {
      return;
    }

    this.isFlushing = true;
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const receipts = Array.from(this.pending.values());
    this.pending.clear();

    // Batch update all read receipts
    const updates = receipts.map(({chatId, userId, timestamp}) => ({
      chatId,
      userId,
      timestamp,
    }));

    // Group by chatId for efficient updates
    const byChatId = new Map<string, PendingReceipt[]>();
    updates.forEach(update => {
      const existing = byChatId.get(update.chatId) || [];
      existing.push(update);
      byChatId.set(update.chatId, existing);
    });

    // Update each chat's lastReadAt
    const promises = Array.from(byChatId.entries()).map(async ([chatId, chatReceipts]) => {
      const chatRef = doc(db, 'chats', chatId);
      const lastReadAt: Record<string, number> = {};
      chatReceipts.forEach(({userId, timestamp}) => {
        lastReadAt[userId] = timestamp;
      });

      try {
        await setDoc(
          chatRef,
          {
            lastReadAt: {
              ...lastReadAt,
            },
            updatedAt: serverTimestamp(),
          },
          {merge: true},
        );
      } catch (error: any) {
        const code = error?.code || '';
        if (code === 'firestore/permission-denied' || code === 'permission-denied') {
          if (__DEV__) {
            console.warn(`[ReadReceiptBatcher] Permission denied for chat ${chatId} (session may have ended)`);
          }
        } else if (__DEV__) {
          console.error(`[ReadReceiptBatcher] Failed to update chat ${chatId}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
    this.isFlushing = false;

    // Schedule next flush if there are new pending items
    if (this.pending.size > 0) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, BATCH_INTERVAL_MS);
    }
  }

  /**
   * Force flush all pending receipts (e.g., on app background)
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await this.flush();
  }
}

export const readReceiptBatcher = new ReadReceiptBatcher();

/**
 * Update read receipt (batched)
 */
export function updateReadReceipt(chatId: string, userId: string): void {
  readReceiptBatcher.queue(chatId, userId);
}

/**
 * Force flush all pending read receipts
 */
export async function flushReadReceipts(): Promise<void> {
  await readReceiptBatcher.forceFlush();
}

