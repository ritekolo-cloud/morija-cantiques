import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ─── Types ───────────────────────────────────────────────────────────

export interface OfflineCollection {
  id: string;
  code?: string;
  slug: string;
  name: string;
  language?: string;
  importedHymnCount?: number;
  songCount?: number;
  sourceOrder?: number;
}

export interface OfflineSong {
  id: string;
  songNumber?: number;
  number?: string;
  duplicateIndex?: number;
  title: string;
  category?: string;
  collection?: OfflineCollection;
  collectionId?: string;
  collectionName?: string;
  collectionSlug?: string;
  lyrics?: string;
  rawLyrics?: string;
  sections?: unknown[];
  sourceId?: string;
}

export interface PendingSong {
  localId: string;
  title: string;
  lyrics: string;
  createdAt: number;
  synced: boolean;
}

interface MorijaDB extends DBSchema {
  collections: {
    key: string;       // slug
    value: OfflineCollection;
    indexes: { 'by-code': string };
  };
  songs: {
    key: string;       // song id
    value: OfflineSong;
    indexes: {
      'by-collection': string;   // collectionSlug
      'by-title': string;
    };
  };
  pendingSongs: {
    key: string;       // localId
    value: PendingSong;
    indexes: { 'by-synced': number };
  };
  meta: {
    key: string;
    value: { key: string; value: string | number };
  };
}

// ─── Database Instance ───────────────────────────────────────────────

const DB_NAME = 'morija-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MorijaDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MorijaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MorijaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Collections store
        if (!db.objectStoreNames.contains('collections')) {
          const collStore = db.createObjectStore('collections', { keyPath: 'slug' });
          collStore.createIndex('by-code', 'code');
        }
        // Songs store
        if (!db.objectStoreNames.contains('songs')) {
          const songStore = db.createObjectStore('songs', { keyPath: 'id' });
          songStore.createIndex('by-collection', 'collectionSlug');
          songStore.createIndex('by-title', 'title');
        }
        // Pending songs store (offline queue)
        if (!db.objectStoreNames.contains('pendingSongs')) {
          const pendingStore = db.createObjectStore('pendingSongs', { keyPath: 'localId' });
          pendingStore.createIndex('by-synced', 'synced');
        }
        // Meta store for timestamps
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Meta helpers ────────────────────────────────────────────────────

async function setMeta(key: string, value: string | number) {
  const db = await getDb();
  await db.put('meta', { key, value });
}

async function getMeta(key: string): Promise<string | number | null> {
  const db = await getDb();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

// ─── Collections ─────────────────────────────────────────────────────

export async function saveCollections(collections: OfflineCollection[]) {
  const db = await getDb();
  const tx = db.transaction('collections', 'readwrite');
  await Promise.all(collections.map((c) => tx.store.put(c)));
  await tx.done;
  await setMeta('collections:lastSync', Date.now());
}

export async function getCollections(): Promise<OfflineCollection[]> {
  const db = await getDb();
  return db.getAll('collections');
}

// ─── Songs ───────────────────────────────────────────────────────────

export async function saveSongs(collectionSlug: string, songs: OfflineSong[]) {
  const db = await getDb();
  const tx = db.transaction('songs', 'readwrite');
  // Tag each song with the collection slug for indexing
  for (const song of songs) {
    const tagged = { ...song, collectionSlug };
    await tx.store.put(tagged);
  }
  await tx.done;
  await setMeta(`songs:${collectionSlug}:lastSync`, Date.now());
}

export async function getSongsByCollection(collectionSlug: string): Promise<OfflineSong[]> {
  const db = await getDb();
  return db.getAllFromIndex('songs', 'by-collection', collectionSlug);
}

export async function getSongById(id: string): Promise<OfflineSong | undefined> {
  const db = await getDb();
  return db.get('songs', id);
}

export async function getTotalSongCount(): Promise<number> {
  const db = await getDb();
  return db.count('songs');
}

// ─── Offline Search ──────────────────────────────────────────────────

export async function searchSongsOffline(query: string, limit = 80): Promise<OfflineSong[]> {
  const db = await getDb();
  const allSongs = await db.getAll('songs');
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: OfflineSong[] = [];

  for (const song of allSongs) {
    if (results.length >= limit) break;

    const titleMatch = song.title?.toLowerCase().includes(q);
    const numberMatch = String(song.number ?? song.songNumber ?? '').includes(q);
    const lyricsMatch = (song.rawLyrics || song.lyrics || '').toLowerCase().includes(q);

    if (titleMatch || numberMatch || lyricsMatch) {
      results.push(song);
    }
  }

  // Sort: number matches first, then title matches, then lyrics
  results.sort((a, b) => {
    const aNum = String(a.number ?? a.songNumber ?? '').includes(q) ? 0 : 1;
    const bNum = String(b.number ?? b.songNumber ?? '').includes(q) ? 0 : 1;
    if (aNum !== bNum) return aNum - bNum;
    const aTitle = a.title?.toLowerCase().includes(q) ? 0 : 1;
    const bTitle = b.title?.toLowerCase().includes(q) ? 0 : 1;
    return aTitle - bTitle;
  });

  return results;
}

// ─── Pending Songs (offline queue) ───────────────────────────────────

export async function queuePendingSong(title: string, lyrics: string): Promise<PendingSong> {
  const db = await getDb();
  const entry: PendingSong = {
    localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    lyrics,
    createdAt: Date.now(),
    synced: false,
  };
  await db.put('pendingSongs', entry);
  return entry;
}

export async function getPendingSongs(): Promise<PendingSong[]> {
  const db = await getDb();
  const all = await db.getAll('pendingSongs');
  return all.filter((s) => !s.synced);
}

export async function markPendingSynced(localId: string) {
  const db = await getDb();
  const song = await db.get('pendingSongs', localId);
  if (song) {
    song.synced = true;
    await db.put('pendingSongs', song);
  }
}

export async function drainPendingSongs(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSongs();
  let synced = 0;
  let failed = 0;

  for (const song of pending) {
    try {
      const response = await fetch('/api/collections/sincerite/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: song.title, lyrics: song.lyrics }),
      });
      if (response.ok) {
        await markPendingSynced(song.localId);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Prefetch All Songs ──────────────────────────────────────────────

let prefetchInProgress = false;
const prefetchListeners = new Set<(progress: PrefetchProgress) => void>();

export interface PrefetchProgress {
  total: number;
  done: number;
  current: string;
  finished: boolean;
}

export function onPrefetchProgress(fn: (p: PrefetchProgress) => void) {
  prefetchListeners.add(fn);
  return () => { prefetchListeners.delete(fn); };
}

function emitPrefetchProgress(p: PrefetchProgress) {
  for (const fn of prefetchListeners) fn(p);
}

export async function prefetchAllSongs(collections: OfflineCollection[]) {
  if (prefetchInProgress) return;
  prefetchInProgress = true;

  const total = collections.length;
  let done = 0;

  for (const coll of collections) {
    const slug = coll.slug || coll.code || '';
    if (!slug) { done++; continue; }

    emitPrefetchProgress({ total, done, current: coll.name, finished: false });

    // Check if we already have songs cached for this collection
    const existing = await getSongsByCollection(slug);
    if (existing.length > 0) {
      done++;
      continue;
    }

    try {
      // Fetch all pages for this collection
      const pageSize = 100;
      const firstRes = await fetch(`/api/collections/${slug}/songs?page=1&limit=${pageSize}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!firstRes.ok) { done++; continue; }
      const firstBody = await firstRes.json();
      const firstSongs: OfflineSong[] = firstBody.data?.songs ?? [];
      const totalPages = firstBody.meta?.totalPages ?? firstBody.meta?.pages ?? 1;

      let allSongs = [...firstSongs];

      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          try {
            const res = await fetch(`/api/collections/${slug}/songs?page=${page}&limit=${pageSize}`, {
              headers: { Accept: 'application/json' },
              credentials: 'include',
            });
            if (res.ok) {
              const body = await res.json();
              allSongs = allSongs.concat(body.data?.songs ?? []);
            }
          } catch {
            // Skip this page
          }
        }
      }

      if (allSongs.length > 0) {
        await saveSongs(slug, allSongs);
      }
    } catch {
      // Network error — skip this collection
    }

    done++;
  }

  emitPrefetchProgress({ total, done: total, current: '', finished: true });
  prefetchInProgress = false;
}

// ─── Data Freshness ──────────────────────────────────────────────────

export async function getLastSyncTime(): Promise<number | null> {
  const val = await getMeta('collections:lastSync');
  return typeof val === 'number' ? val : null;
}

export async function isDataStale(maxAgeMs = 24 * 60 * 60 * 1000): Promise<boolean> {
  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;
  return Date.now() - lastSync > maxAgeMs;
}

export async function hasOfflineData(): Promise<boolean> {
  const collections = await getCollections();
  return collections.length > 0;
}
