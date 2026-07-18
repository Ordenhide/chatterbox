/**
 * Background Sync Service with Exponential Backoff
 * Handles retries for failed network operations
 * Similar to WeChat's offline message sync
 */

import {AppState, AppStateStatus} from 'react-native';
import {useNetworkStatus} from '../hooks/useNetworkStatus';

type SyncTask = {
  id: string;
  fn: () => Promise<void>;
  retries: number;
  lastAttempt: number;
  priority: 'high' | 'normal' | 'low';
};

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000; // 30 seconds max

class BackgroundSync {
  private queue: Map<string, SyncTask> = new Map();
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private appState: AppStateStatus = 'active';

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    const wasBackground = this.appState === 'background' || this.appState === 'inactive';
    const isNowActive = nextAppState === 'active';
    this.appState = nextAppState;

    if (wasBackground && isNowActive) {
      // App came to foreground, sync immediately
      this.sync();
    }
  };

  /**
   * Calculate exponential backoff delay
   */
  private getBackoffDelay(retries: number): number {
    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, retries), MAX_BACKOFF_MS);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Add a sync task
   */
  add(task: Omit<SyncTask, 'retries' | 'lastAttempt'>): void {
    this.queue.set(task.id, {
      ...task,
      retries: 0,
      lastAttempt: 0,
    });

    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Remove a sync task
   */
  remove(id: string): void {
    this.queue.delete(id);
  }

  /**
   * Start sync loop
   */
  private start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.sync();

    // Periodic sync every 30 seconds when app is active
    this.syncInterval = setInterval(() => {
      if (this.appState === 'active') {
        this.sync();
      }
    }, 30000);
  }

  /**
   * Stop sync loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Execute sync tasks
   */
  private async sync(): Promise<void> {
    if (this.queue.size === 0) {
      this.stop();
      return;
    }

    // Sort by priority and retry count
    const tasks = Array.from(this.queue.values()).sort((a, b) => {
      const priorityOrder = {high: 0, normal: 1, low: 2};
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.retries - b.retries;
    });

    // Process tasks
    for (const task of tasks) {
      const now = Date.now();
      const delay = this.getBackoffDelay(task.retries);

      // Skip if not enough time has passed since last attempt
      if (now - task.lastAttempt < delay) {
        continue;
      }

      try {
        await task.fn();
        // Success, remove from queue
        this.queue.delete(task.id);
      } catch (error) {
        // Failed, increment retries
        task.retries += 1;
        task.lastAttempt = now;

        if (task.retries >= MAX_RETRIES) {
          if (__DEV__) {
            console.warn(`[BackgroundSync] Task ${task.id} exceeded max retries`);
          }
          this.queue.delete(task.id);
        }
      }
    }

    // Continue if there are pending tasks
    if (this.queue.size > 0) {
      setTimeout(() => this.sync(), 1000);
    } else {
      this.stop();
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.queue.clear();
    this.stop();
  }
}

export const backgroundSync = new BackgroundSync();

/**
 * Sync a task with retry logic
 */
export function syncTask(
  id: string,
  fn: () => Promise<void>,
  priority: 'high' | 'normal' | 'low' = 'normal',
): void {
  backgroundSync.add({id, fn, priority});
}

/**
 * Remove a sync task
 */
export function removeSyncTask(id: string): void {
  backgroundSync.remove(id);
}

