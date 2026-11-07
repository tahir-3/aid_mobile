import { create } from 'zustand';

import { describeApiError } from '../lib/apiError';
import { getLastSyncTime, performInitialSync } from '../lib/sync';

type SyncStatus = 'idle' | 'running' | 'done' | 'error';

interface SyncState {
  status: SyncStatus;
  /** 0–100 while running. */
  progress: number;
  message: string;
  error: string | null;
  /**
   * Increases whenever new data was written locally (each downloaded chunk, end of
   * a sync), so screens can reload. Throttled while a download is streaming in.
   */
  dataVersion: number;

  /**
   * Download recipients, aids and lookup tables in the background.
   * Safe to call repeatedly: concurrent calls share the running download.
   */
  startInitialSync: () => Promise<void>;
  /** Resume the first download if it never finished (app killed / went offline). */
  resumeIfIncomplete: () => Promise<void>;
  /** Called by any other sync (e.g. manual sync button) so screens reload. */
  markCompleted: () => void;
  reset: () => void;
}

let running: Promise<void> | null = null;

// Chunk notifications: first one immediately (first 20 rows → lists fill at once),
// then at most every 1.5s.
const CHUNK_NOTIFY_MS = 1500;
let lastBump = 0;
let pendingBump: ReturnType<typeof setTimeout> | null = null;
function bumpThrottled(set: (fn: (s: SyncState) => Partial<SyncState>) => void) {
  const bump = () => {
    lastBump = Date.now();
    pendingBump = null;
    set((s) => ({ dataVersion: s.dataVersion + 1 }));
  };
  const wait = CHUNK_NOTIFY_MS - (Date.now() - lastBump);
  if (wait <= 0) bump();
  else if (!pendingBump) pendingBump = setTimeout(bump, wait);
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
  dataVersion: 0,

  startInitialSync: () => {
    if (running) return running;
    set({ status: 'running', progress: 0, message: 'جاري تحميل البيانات...', error: null });

    running = (async () => {
      try {
        await performInitialSync(
          (progress, message) => set({ progress, message }),
          () => bumpThrottled(set)
        );
        set((s) => ({
          status: 'done',
          progress: 100,
          message: '',
          dataVersion: s.dataVersion + 1,
        }));
      } catch (e) {
        const info = describeApiError(e);
        console.warn('Background sync failed:', info);
        set({ status: 'error', error: info.message, message: '' });
      }
    })().finally(() => {
      running = null;
    });

    return running;
  },

  resumeIfIncomplete: async () => {
    // LAST_SYNC is only written when a full pull finishes.
    if (!(await getLastSyncTime())) await get().startInitialSync();
  },

  markCompleted: () =>
    set((s) => ({ status: 'done', error: null, dataVersion: s.dataVersion + 1 })),

  reset: () => set({ status: 'idle', progress: 0, message: '', error: null, dataVersion: 0 }),
}));
