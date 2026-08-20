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

export const DEFAULT_OFFLINE_COLLECTIONS: OfflineCollection[] = [
  { id: '1', code: 'ob', slug: 'only-believe', name: 'Only believe', language: 'English', importedHymnCount: 222, songCount: 222, sourceOrder: 1 },
  { id: '2', code: 'cs', slug: 'crois-seulement', name: 'Crois seulement', language: 'French', importedHymnCount: 226, songCount: 226, sourceOrder: 2 },
  { id: '3', code: 'hos', slug: 'hosanna', name: 'Hosanna', language: 'French', importedHymnCount: 247, songCount: 247, sourceOrder: 3 },
  { id: '4', code: 'ac', slug: 'autres-cantiques', name: 'Autres cantiques', language: 'Mixed', importedHymnCount: 214, songCount: 214, sourceOrder: 4 },
  { id: '5', code: 'cc', slug: 'collection-des-cantiques', name: 'Collection des cantiques', language: 'Mixed', importedHymnCount: 511, songCount: 511, sourceOrder: 5 },
  { id: '6', code: 'cv', slug: 'chant-de-victoire', name: 'Chant de victoire', language: 'French', importedHymnCount: 324, songCount: 324, sourceOrder: 6 },
  { id: '7', code: 'nm', slug: 'nyimbo-za-mungu', name: 'Nyimbo za mungu', language: 'Swahili', importedHymnCount: 327, songCount: 327, sourceOrder: 7 },
  { id: '8', code: 'nw', slug: 'nyimbo-za-wokovu', name: 'Nyimbo za wokovu', language: 'Swahili', importedHymnCount: 360, songCount: 360, sourceOrder: 8 },
  { id: '9', code: 'rs', slug: 'roc-seculaire', name: 'Roc séculaire', language: 'Mixed', importedHymnCount: 347, songCount: 347, sourceOrder: 9 },
  { id: '10', code: 'qtg', slug: 'quel-temps-glorieux', name: 'Quel temps glorieux', language: 'Mixed', importedHymnCount: 602, songCount: 602, sourceOrder: 10 },
  { id: '11', code: 'sss', slug: 'sacred-songs-and-solos', name: 'Sacred songs and solos', language: 'English', importedHymnCount: 1200, songCount: 1200, sourceOrder: 11 },
  { id: '12', code: 'ob2', slug: 'only-believe-2', name: 'Only believe - 2', language: 'English', importedHymnCount: 1085, songCount: 1085, sourceOrder: 12 },
  { id: '13', code: 'rsp2', slug: 'roc-seculaire-paris', name: 'Roc séculaire Paris', language: 'French', importedHymnCount: 604, songCount: 604, sourceOrder: 13 },
  { id: '14', code: 'sincerite', slug: 'sincerite', name: 'Sincérité', language: 'French', importedHymnCount: 0, songCount: 0, sourceOrder: 99 },
];

export async function getCollections(): Promise<OfflineCollection[]> {
  const db = await getDb();
  let collections = await db.getAll('collections');
  if (collections.length === 0) {
    collections = [...DEFAULT_OFFLINE_COLLECTIONS];
    await saveCollections(collections);
  } else if (!collections.some((c) => c.slug === 'sincerite' || c.code === 'sincerite')) {
    const sinceriteColl: OfflineCollection = {
      id: 'sincerite',
      code: 'sincerite',
      slug: 'sincerite',
      name: 'Sincérité',
      language: 'French',
      songCount: 0,
      importedHymnCount: 0,
      sourceOrder: 99,
    };
    collections.push(sinceriteColl);
  }
  return collections;
}

// ─── Songs ───────────────────────────────────────────────────────────

export async function saveSong(song: OfflineSong) {
  if (!song || !song.id) return;
  const db = await getDb();
  const slug = (song.collectionSlug || song.collection?.slug || song.collection?.code || '').toLowerCase();
  const tagged = { ...song, collectionSlug: slug || song.collectionSlug };
  await db.put('songs', tagged);
}

export async function saveSongs(collectionSlug: string, songs: OfflineSong[]) {
  const db = await getDb();
  const normSlug = collectionSlug.toLowerCase().trim();
  const tx = db.transaction('songs', 'readwrite');
  for (const song of songs) {
    const slug = (song.collectionSlug || song.collection?.slug || normSlug).toLowerCase();
    const tagged = { ...song, collectionSlug: slug };
    await tx.store.put(tagged);
  }
  await tx.done;
  await setMeta(`songs:${normSlug}:lastSync`, Date.now());
}

export async function getSongsByCollection(collectionQueryKey: string): Promise<OfflineSong[]> {
  const db = await getDb();
  const q = collectionQueryKey.toLowerCase().trim();
  if (!q) return [];

  // Try direct index fetch
  let songs = await db.getAllFromIndex('songs', 'by-collection', q);

  if (songs.length === 0) {
    // Resolve matching collection by slug, code, or ID
    const collections = await db.getAll('collections');
    const matched = collections.find((c) =>
      [c.slug, c.code, c.id].filter(Boolean).some((val) => String(val).toLowerCase().trim() === q)
    );

    if (matched) {
      const targetSlug = (matched.slug || matched.code || '').toLowerCase();
      songs = await db.getAllFromIndex('songs', 'by-collection', targetSlug);
      if (songs.length === 0 && matched.code) {
        songs = await db.getAllFromIndex('songs', 'by-collection', matched.code.toLowerCase());
      }
    }
  }

  // Fallback scan: check all songs for matching collection references
  if (songs.length === 0) {
    const allSongs = await db.getAll('songs');
    songs = allSongs.filter((s) => {
      const collSlug = (s.collectionSlug || s.collection?.slug || '').toLowerCase();
      const collCode = (s.collection?.code || '').toLowerCase();
      const collId = (s.collectionId || s.collection?.id || '').toLowerCase();
      return collSlug === q || collCode === q || collId === q;
    });
  }

  // If querying Sincérité, also merge any pending un-synced songs so they are immediately visible
  if (q === 'sincerite') {
    const pending = await getPendingSongs();
    for (const p of pending) {
      if (!songs.some((s) => s.id === p.localId || s.title.toUpperCase() === p.title.toUpperCase())) {
        const lyricsLines = p.lyrics.split('\n');
        const sections = lyricsLines
          .join('\n')
          .split(/\n\s*\n/)
          .map((block, index) => ({
            type: 'verse',
            label: `Verse ${index + 1}`,
            lines: block.trim().split('\n').map((l) => l.trim()).filter(Boolean),
          }));
        songs.push({
          id: p.localId,
          title: p.title.toUpperCase(),
          lyrics: JSON.stringify(sections),
          rawLyrics: p.lyrics,
          sections,
          collectionSlug: 'sincerite',
          collectionName: 'Sincérité',
          category: 'Sincérité',
        });
      }
    }
  }

  return songs;
}

export async function getSongById(id: string): Promise<OfflineSong | undefined> {
  const db = await getDb();
  const targetId = String(id).trim();
  const direct = await db.get('songs', targetId);
  if (direct) return direct;

  const allSongs = await db.getAll('songs');
  return allSongs.find((s) => String(s.id).trim() === targetId);
}

export async function getAdjacentSongsOffline(
  currentSongId: string
): Promise<{ prev: OfflineSong | null; next: OfflineSong | null }> {
  const currentSong = await getSongById(currentSongId);
  if (!currentSong) return { prev: null, next: null };

  const slug = (currentSong.collectionSlug || currentSong.collection?.slug || currentSong.collection?.code || '').toLowerCase();
  if (!slug) return { prev: null, next: null };

  const songs = await getSongsByCollection(slug);
  if (songs.length <= 1) return { prev: null, next: null };

  // Sort sequentially by number or duplicateIndex
  songs.sort((a, b) => {
    const aNum = Number(a.number ?? a.songNumber ?? 0);
    const bNum = Number(b.number ?? b.songNumber ?? 0);
    if (aNum !== bNum) return aNum - bNum;
    return Number(a.duplicateIndex ?? 1) - Number(b.duplicateIndex ?? 1);
  });

  const currentIndex = songs.findIndex((s) => String(s.id).trim() === String(currentSongId).trim());
  if (currentIndex === -1) return { prev: null, next: null };

  return {
    prev: songs[currentIndex - 1] || null,
    next: songs[currentIndex + 1] || null,
  };
}

export async function getTotalSongCount(): Promise<number> {
  const db = await getDb();
  return db.count('songs');
}

export async function getOfflineStats(): Promise<{ collectionsCount: number; songsCount: number; lastSync: number | null }> {
  const db = await getDb();
  const collectionsCount = await db.count('collections');
  const songsCount = await db.count('songs');
  const lastSync = await getLastSyncTime();
  return { collectionsCount, songsCount, lastSync };
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

  // Immediately store in offline songs store so user can read/search right away
  const lyricsLines = lyrics.split('\n');
  const sections = lyricsLines
    .join('\n')
    .split(/\n\s*\n/)
    .map((block, index) => ({
      type: 'verse',
      label: `Verse ${index + 1}`,
      lines: block.trim().split('\n').map((l) => l.trim()).filter(Boolean),
    }));

  const offlineSong: OfflineSong = {
    id: entry.localId,
    title: title.trim().toUpperCase(),
    lyrics: JSON.stringify(sections),
    rawLyrics: lyrics.trim(),
    sections,
    collectionSlug: 'sincerite',
    collectionName: 'Sincérité',
    category: 'Sincérité',
  };
  await db.put('songs', offlineSong);

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
  const db = await getDb();

  for (const song of pending) {
    try {
      const response = await fetch('/api/collections/sincerite/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: song.title, lyrics: song.lyrics }),
      });
      if (response.ok) {
        const body = await response.json();
        const serverSong = body.data;
        if (serverSong?.id) {
          // Replace temporary localId with actual server song
          await db.delete('songs', song.localId);
          await saveSong({
            id: String(serverSong.id),
            songNumber: serverSong.songNumber,
            number: serverSong.number,
            title: serverSong.title,
            collectionSlug: 'sincerite',
            collectionName: 'Sincérité',
            rawLyrics: serverSong.rawLyrics || song.lyrics,
            sections: serverSong.sections,
            lyrics: serverSong.lyrics,
          });
        }
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

export async function prefetchAllSongs(collections: OfflineCollection[], forceRefresh = false) {
  if (prefetchInProgress) return;
  prefetchInProgress = true;

  const total = collections.length;
  let done = 0;

  // Save collections to IndexedDB as well
  await saveCollections(collections);

  for (const coll of collections) {
    const slug = coll.slug || coll.code || '';
    if (!slug) { done++; continue; }

    emitPrefetchProgress({ total, done, current: coll.name, finished: false });

    // Check if we already have songs cached for this collection
    if (!forceRefresh) {
      const existing = await getSongsByCollection(slug);
      if (existing.length > 0) {
        done++;
        continue;
      }
    }

    try {
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
