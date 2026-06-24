import { create } from 'zustand';
import { openDB, IDBPDatabase } from 'idb';
import { Song } from '../types';

interface OfflineState {
  isSyncing: boolean;
  lastSynced: number | null;
  db: IDBPDatabase | null;
  initDB: () => Promise<void>;
  saveSong: (song: Song) => Promise<void>;
  saveSongs: (songs: Song[]) => Promise<void>;
  getSong: (id: string) => Promise<Song | undefined>;
  getAllSongs: () => Promise<Song[]>;
  clearCache: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isSyncing: false,
  lastSynced: null,
  db: null,

  initDB: async () => {
    try {
      const db = await openDB('morija-cantiques-db', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('songs')) {
            const store = db.createObjectStore('songs', { keyPath: 'id' });
            store.createIndex('collectionId', 'collectionId');
            store.createIndex('songNumber', 'songNumber');
            store.createIndex('title', 'title');
          }
        },
      });
      set({ db });
    } catch (error) {
      console.error('Failed to init IndexedDB:', error);
    }
  },

  saveSong: async (song: Song) => {
    const { db } = get();
    if (!db) return;
    await db.put('songs', song);
  },

  saveSongs: async (songs: Song[]) => {
    const { db } = get();
    if (!db) return;
    
    set({ isSyncing: true });
    try {
      const tx = db.transaction('songs', 'readwrite');
      await Promise.all([
        ...songs.map(song => tx.store.put(song)),
        tx.done
      ]);
      set({ lastSynced: Date.now() });
    } catch (error) {
      console.error('Error saving songs offline:', error);
    } finally {
      set({ isSyncing: false });
    }
  },

  getSong: async (id: string) => {
    const { db } = get();
    if (!db) return undefined;
    return db.get('songs', id);
  },

  getAllSongs: async () => {
    const { db } = get();
    if (!db) return [];
    return db.getAll('songs');
  },

  clearCache: async () => {
    const { db } = get();
    if (!db) return;
    const tx = db.transaction('songs', 'readwrite');
    await tx.store.clear();
    await tx.done;
    set({ lastSynced: null });
  }
}));
