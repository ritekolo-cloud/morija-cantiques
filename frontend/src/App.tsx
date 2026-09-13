import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Heart,
  HeartHandshake,
  Home,
  Library,
  ListMusic,
  Maximize2,
  Minus,
  Minimize2,
  Monitor,
  MonitorUp,
  Mail,
  MessageCircle,
  MousePointer2,
  Moon,
  Plus,
  Play,
  Phone,
  Presentation,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  saveCollections as saveCollectionsIdb,
  getCollections as getCollectionsIdb,
  saveSong as saveSongIdb,
  saveSongs as saveSongsIdb,
  getSongsByCollection as getSongsByCollectionIdb,
  getSongById as getSongByIdIdb,
  getAdjacentSongsOffline,
  getOfflineStats,
  searchSongsOffline,
  queuePendingSong,
  drainPendingSongs,
  prefetchAllSongs,
  onPrefetchProgress,
  type OfflineCollection,
  type OfflineSong,
  type PrefetchProgress,
} from './offlineDb';

type ApiResponse<T> = {
  success?: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: string;
  message?: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  pages?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
};

type Collection = {
  id: string;
  code?: string;
  slug: string;
  name: string;
  language?: string;
  importedHymnCount?: number;
  songCount?: number;
  sourceOrder?: number;
};

type SongSection = {
  id?: number;
  type?: string;
  label?: string;
  content?: string;
  lines?: string[];
  order?: number;
};

type Song = {
  id: string;
  songNumber?: number;
  number?: string;
  duplicateIndex?: number;
  title: string;
  category?: string;
  collection?: Collection;
  collectionId?: string;
  collectionName?: string;
  lyrics?: string;
  rawLyrics?: string;
  sections?: SongSection[];
};

type CollectionSongs = {
  collection: Collection;
  songs: Song[];
};

type AdjacentSongs = {
  prev?: { id: string; songNumber?: number; number?: string; title: string } | null;
  next?: { id: string; songNumber?: number; number?: string; title: string } | null;
};

type PresentationSong = Song & {
  entryId: string;
  collectionName: string;
  categoryCode?: string;
};

type PresentationPointerMode = 'off' | 'laser' | 'spotlight' | 'ink';

type ProjectionState = {
  type: 'presentation-state';
  songs: PresentationSong[];
  selectedIndex: number;
  zoom: number;
  zoomOrigin: { x: number; y: number };
  scrollProgress: number;
  pointer: { x: number; y: number };
  pointerMode: PresentationPointerMode;
  background: string;
};

type ProjectionCommand = {
  type: 'presentation-command';
  command: 'end-projection' | 'audience-closed' | 'hide-taskbar' | 'show-taskbar';
};

type ProjectionAudienceEvent = {
  type: 'presentation-audience-event';
  event: 'fullscreen-change' | 'scroll-progress';
  fullscreen?: boolean;
  scrollProgress?: number;
};

type ProjectionReadyMessage = {
  type: 'morija-projection-ready';
};

type ProjectionMessage = ProjectionState | ProjectionCommand | ProjectionAudienceEvent | ProjectionReadyMessage;

type PresentationDisplayDetails = {
  availLeft?: number;
  availTop?: number;
  availWidth?: number;
  availHeight?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  isPrimary?: boolean;
  isInternal?: boolean;
};

type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<{ screens: PresentationDisplayDetails[] }>;
};

const COLLECTIONS_CACHE_KEY = 'collections:v2';
const PRESENTATION_SONGS_KEY = 'presentation:songs:v1';
const PRESENTATION_SCREEN_ZOOM_KEY = 'presentation:screen-zoom:v1';
const PRESENTATION_BACKGROUND_KEY = 'presentation:background:v1';
const NAV_COLLAPSED_KEY = 'ui:nav-collapsed:v1';
const DOUBLE_TAP_DELAY_MS = 320;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function apiUrl(path: string) {
  return `${API_BASE_URL}/api${path}`;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function evictOldCollectionCaches(exceptKey?: string) {
  const collectionKeys = Object.keys(localStorage)
    .filter((k) => k.startsWith('collection-songs:') && k !== exceptKey);
  for (const k of collectionKeys) {
    localStorage.removeItem(k);
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError — evict old collection caches and retry once
    try {
      evictOldCollectionCaches(key);
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Still full — silently skip caching
    }
  }
}

function randomId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function slideScrollProgress(element: HTMLElement) {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  return maxScroll > 1 ? clampNumber(element.scrollTop / maxScroll, 0, 1) : 0;
}

function scrollSlideToProgress(element: HTMLElement, progress: number) {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  element.scrollTop = maxScroll * clampNumber(progress, 0, 1);
}

function presentationInkColor(background: string) {
  const match = background.trim().match(/^#([\da-f]{6})$/i);
  if (!match) return '#24104f';
  const red = Number.parseInt(match[1].slice(0, 2), 16);
  const green = Number.parseInt(match[1].slice(2, 4), 16);
  const blue = Number.parseInt(match[1].slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? '#24104f' : '#fffdf5';
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, a, label, select, textarea, .pointer-controls'));
}

async function requestAppFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  }
}

async function exitAppFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen?.();
  }
}

function audienceWindowFeatures(display?: PresentationDisplayDetails | null) {
  const currentScreen = window.screen as Screen & { availLeft?: number; availTop?: number };
  const fallbackLeft = (currentScreen.availLeft ?? 0) + (currentScreen.availWidth || currentScreen.width || 1440);
  const left = Math.round(display?.left ?? display?.availLeft ?? fallbackLeft);
  const top = Math.round(display?.top ?? display?.availTop ?? currentScreen.availTop ?? 0);
  const width = Math.round(display?.width ?? display?.availWidth ?? currentScreen.width ?? 1440);
  const height = Math.round(display?.height ?? display?.availHeight ?? currentScreen.height ?? 900);

  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

async function getExternalPresentationDisplay() {
  const screenWindow = window as WindowWithScreenDetails;
  if (!screenWindow.getScreenDetails) return null;

  try {
    const details = await screenWindow.getScreenDetails();
    return (
      details.screens.find((screen) => screen.isPrimary === false) ||
      details.screens.find((screen) => screen.isInternal === false) ||
      null
    );
  } catch {
    return null;
  }
}

async function moveAudienceWindowToPresentationDisplay(audienceWindow: Window) {
  const display = await getExternalPresentationDisplay();
  if (!display) return false;

  try {
    audienceWindow.moveTo(
      Math.round(display.left ?? display.availLeft ?? 0),
      Math.round(display.top ?? display.availTop ?? 0),
    );
    audienceWindow.resizeTo(
      Math.round(display.width ?? display.availWidth ?? 1440),
      Math.round(display.height ?? display.availHeight ?? 900),
    );
    return true;
  } catch {
    return false;
  }
}

function collectionCode(collection?: Collection) {
  return (collection?.code || collection?.slug || '').toUpperCase();
}

function collectionRouteKey(collection?: Collection | null) {
  return String(collection?.slug || collection?.code || collection?.id || '').trim();
}

function collectionMatchesRoute(collection: Collection | undefined, routeKey: string) {
  const expected = routeKey.trim().toLowerCase();
  if (!collection || !expected) return false;
  return [collection.slug, collection.code, collection.id]
    .filter(Boolean)
    .some((value) => String(value).trim().toLowerCase() === expected);
}

function collectionCount(collection: Collection) {
  return collection.importedHymnCount ?? collection.songCount ?? 0;
}

function songNumber(song?: Song | null) {
  return String(song?.number ?? song?.songNumber ?? '');
}

function songNumberLabel(song?: Song | null) {
  const number = songNumber(song);
  return `${number}${Number(song?.duplicateIndex ?? 1) > 1 ? `.${song?.duplicateIndex}` : ''}`;
}

function songCollectionName(song: Song) {
  return song.collection?.name || song.collectionName || song.collection?.slug || 'Hymnal';
}

function normalizePlainLyrics(song?: Song | null) {
  if (!song) return '';
  if (song.rawLyrics) return song.rawLyrics;
  if (Array.isArray(song.sections) && song.sections.length > 0) {
    return song.sections
      .map((section) => (section.lines?.length ? section.lines.join('\n') : section.content || ''))
      .filter(Boolean)
      .join('\n\n');
  }

  if (song.lyrics) {
    try {
      const parsed = JSON.parse(song.lyrics) as SongSection[];
      if (Array.isArray(parsed)) {
        return parsed
          .map((section) => (section.lines?.length ? section.lines.join('\n') : section.content || ''))
          .filter(Boolean)
          .join('\n\n');
      }
    } catch {
      return song.lyrics;
    }
  }

  return '';
}

async function apiFetchResponse<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) throw new Error(body.error || body.message || 'Request failed.');
  return body;
}

async function apiFetch<T>(path: string): Promise<T> {
  const body = await apiFetchResponse<T>(path);
  return body.data;
}

async function apiFetchCached<T>(path: string, cacheKey: string): Promise<{ data: T; offline: boolean }> {
  if (path === '/collections') {
    try {
      const data = await apiFetch<Collection[]>(path);
      saveCollectionsIdb(data as unknown as OfflineCollection[]).catch(() => {});
      return { data: data as unknown as T, offline: false };
    } catch {
      const idbCollections = await getCollectionsIdb();
      if (idbCollections.length > 0) {
        return { data: idbCollections as unknown as T, offline: true };
      }
    }
  }

  // For individual song paths, also try IndexedDB
  const songIdMatch = path.match(/^\/songs\/([^/]+)$/);
  if (songIdMatch) {
    return getSongByIdCached(songIdMatch[1]) as unknown as Promise<{ data: T; offline: boolean }>;
  }

  try {
    const data = await apiFetch<T>(path);
    writeLocal(cacheKey, data);
    return { data, offline: false };
  } catch (error) {
    const cached = readLocal<T | null>(cacheKey, null);
    if (cached) return { data: cached, offline: true };
    throw error;
  }
}

async function getCollectionSongs(slug: string): Promise<CollectionSongs> {
  const pageSize = 100;
  const firstPage = await apiFetchResponse<CollectionSongs>(
    `/collections/${slug}/songs?page=1&limit=${pageSize}`,
  );
  const totalPages = firstPage.meta?.totalPages ?? firstPage.meta?.pages ?? 1;
  if (totalPages <= 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      apiFetchResponse<CollectionSongs>(
        `/collections/${slug}/songs?page=${index + 2}&limit=${pageSize}`,
      ),
    ),
  );

  return {
    ...firstPage.data,
    songs: [
      ...firstPage.data.songs,
      ...remainingPages.flatMap((page) => page.data.songs),
    ],
  };
}

async function getCollectionSongsCached(slug: string, cacheKey: string): Promise<{ data: CollectionSongs; offline: boolean }> {
  try {
    const data = await getCollectionSongs(slug);
    if (!collectionMatchesRoute(data.collection, slug)) {
      throw new Error(`Loaded ${data.collection.name}, not the selected collection.`);
    }
    await saveSongsIdb(slug, data.songs as unknown as OfflineSong[]).catch(() => {});
    if (slug.toLowerCase() === 'sincerite') {
      const localSongs = await getSongsByCollectionIdb(slug);
      const serverIds = new Set(data.songs.map((song) => String(song.id)));
      const mergedSongs = [
        ...data.songs,
        ...(localSongs as unknown as Song[]).filter((song) => !serverIds.has(String(song.id))),
      ];
      const count = Math.max(collectionCount(data.collection), mergedSongs.length);
      return {
        data: {
          collection: { ...data.collection, songCount: count, importedHymnCount: count },
          songs: mergedSongs,
        },
        offline: false,
      };
    }
    return { data, offline: false };
  } catch (fetchError) {
    const idbSongs = await getSongsByCollectionIdb(slug);
    const idbCollections = await getCollectionsIdb();
    const collection = idbCollections.find((c) => collectionMatchesRoute(c, slug));
    if (idbSongs.length > 0 && collection) {
      return {
        data: { collection: collection as unknown as Collection, songs: idbSongs as unknown as Song[] },
        offline: true,
      };
    }

    const cached = readLocal<CollectionSongs | null>(cacheKey, null);
    if (cached && collectionMatchesRoute(cached.collection, slug)) return { data: cached, offline: true };
    if (cached) localStorage.removeItem(cacheKey);
    throw fetchError;
  }
}

async function getSongByIdCached(id: string): Promise<{ data: Song; offline: boolean }> {
  try {
    const data = await apiFetch<Song>(`/songs/${id}`);
    saveSongIdb(data as unknown as OfflineSong).catch(() => {});
    return { data, offline: false };
  } catch (err) {
    const idbSong = await getSongByIdIdb(id);
    if (idbSong) {
      return { data: idbSong as unknown as Song, offline: true };
    }
    const cached = readLocal<Song | null>(`song:${id}`, null);
    if (cached) return { data: cached, offline: true };
    throw err;
  }
}

async function getSearchResults(query: string): Promise<Song[]> {
  try {
    const data = await apiFetch<{ data: Array<{ song?: Song } | Song> }>(
      `/songs/search?q=${encodeURIComponent(query)}&limit=80`,
    );
    return data.data.map((item) => ('song' in item && item.song ? item.song : item as Song));
  } catch {
    // Always fall back to local IndexedDB search — never re-throw network errors
    return searchSongsOffline(query) as unknown as Promise<Song[]>;
  }
}

function presentationSongFromSong(song: Song): PresentationSong {
  return {
    ...song,
    entryId: randomId(),
    collectionName: songCollectionName(song),
    rawLyrics: normalizePlainLyrics(song),
  };
}

function readPresentationSongs() {
  const songs = readLocal<PresentationSong[]>(PRESENTATION_SONGS_KEY, []);
  return Array.isArray(songs) ? songs : [];
}

function writePresentationSongs(songs: PresentationSong[]) {
  writeLocal(PRESENTATION_SONGS_KEY, songs);
  window.dispatchEvent(new CustomEvent('presentationchange'));
}

function addPresentationSong(song: Song) {
  const songs = readPresentationSongs();
  if (songs.some((item) => item.id === song.id)) return { added: false, songs };
  const next = [...songs, presentationSongFromSong(song)];
  writePresentationSongs(next);
  return { added: true, songs: next };
}

function usePresentationSongs() {
  const [songs, setSongs] = useState(readPresentationSongs);

  useEffect(() => {
    const refresh = () => setSongs(readPresentationSongs());
    window.addEventListener('storage', refresh);
    window.addEventListener('presentationchange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('presentationchange', refresh);
    };
  }, []);

  function save(next: PresentationSong[]) {
    setSongs(next);
    writePresentationSongs(next);
  }

  return [songs, save] as const;
}

function useDoubleTapFullscreen(onDoubleTap: () => void) {
  const lastTapRef = useRef(0);

  function onDoubleClick(event: React.MouseEvent<HTMLElement>) {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    onDoubleTap();
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'touch' || isInteractiveTarget(event.target)) return;
    const now = Date.now();
    if (now - lastTapRef.current <= DOUBLE_TAP_DELAY_MS) {
      event.preventDefault();
      lastTapRef.current = 0;
      onDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }

  return { onDoubleClick, onPointerUp };
}

type ProjectionStanza = string[];

function projectionLyricWeight(lines: ProjectionStanza) {
  return lines.reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / 34)), 0);
}

function getProjectionStanzas(lyrics: string): ProjectionStanza[] {
  const normalized = String(lyrics || '').trim();
  if (!normalized) return [[String.fromCharCode(160)]];

  const blocks = normalized
    .split(/\n\s*\n/)
    .map((part) => part.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  if (blocks.length > 1) return blocks;

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 6) return [lines];

  const grouped: ProjectionStanza[] = [];
  for (let index = 0; index < lines.length; index += 4) {
    grouped.push(lines.slice(index, index + 4));
  }
  return grouped;
}

function isProjectionChorus(lines: ProjectionStanza) {
  const normalized = lines
    .join(' ')
    .toLowerCase()
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'oe');

  return /\b(chorus|choeur|refrain)\b/.test(normalized);
}

function splitProjectionLyrics(lyrics: string) {
  const stanzas = getProjectionStanzas(lyrics);
  const totalWeight = stanzas.reduce((total, stanza) => total + projectionLyricWeight(stanza) + 1, 0);
  const columnCount = totalWeight > 14 || stanzas.length > 2 ? 2 : 1;
  const targetWeight = Math.ceil(totalWeight / columnCount);
  const columns = Array.from({ length: columnCount }, () => [] as ProjectionStanza[]);
  let columnIndex = 0;
  let currentWeight = 0;

  for (const stanza of stanzas) {
    const weight = projectionLyricWeight(stanza) + 1;
    if (columnIndex < columnCount - 1 && currentWeight > 0 && currentWeight + weight > targetWeight) {
      columnIndex += 1;
      currentWeight = 0;
    }
    columns[columnIndex].push(stanza);
    currentWeight += weight;
  }

  return columns.filter((column) => column.length > 0);
}

function PresentationSlideCanvas({
  song,
  background = '#cdeeff',
  zoom = 1,
  zoomOrigin = { x: 50, y: 50 },
  scrollProgress = 0,
  pointer,
  pointerMode = 'off',
  onScrollProgressChange,
  onPointerMove,
}: {
  song: PresentationSong;
  background?: string;
  zoom?: number;
  zoomOrigin?: { x: number; y: number };
  scrollProgress?: number;
  pointer?: { x: number; y: number };
  pointerMode?: PresentationPointerMode;
  onScrollProgressChange?: (progress: number) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const slideRef = useRef<HTMLElement | null>(null);
  const applyingScrollRef = useRef(false);
  const projectionLyricColumns = useMemo(() => splitProjectionLyrics(normalizePlainLyrics(song)), [song]);

  useLayoutEffect(() => {
    const slide = slideRef.current;
    if (!slide) return undefined;
    let frameId = 0;
    applyingScrollRef.current = true;
    scrollSlideToProgress(slide, scrollProgress);
    frameId = window.requestAnimationFrame(() => {
      applyingScrollRef.current = false;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [scrollProgress, song.entryId, zoom]);

  function handleScroll(event: React.UIEvent<HTMLElement>) {
    if (applyingScrollRef.current) return;
    onScrollProgressChange?.(slideScrollProgress(event.currentTarget));
  }

  return (
    <article
      ref={slideRef}
      className="presentation-slide"
      onScroll={handleScroll}
      onPointerMove={onPointerMove}
      style={{ background, '--presentation-ink': presentationInkColor(background) } as React.CSSProperties}
    >
      <div
        className="presentation-slide-zoom"
        style={{
          '--presentation-screen-zoom': zoom,
          '--presentation-origin-x': `${zoomOrigin.x}%`,
          '--presentation-origin-y': `${zoomOrigin.y}%`,
        } as React.CSSProperties}
      >
        <p className="presentation-song-meta">{song.collectionName} / {songNumberLabel(song)}</p>
        <h1>{song.title}</h1>
        <div className={`projection-lyrics columns-${projectionLyricColumns.length}`}>
          {projectionLyricColumns.map((column, index) => {
            const columnOffset = projectionLyricColumns
              .slice(0, index)
              .reduce((total, currentColumn) => total + currentColumn.length, 0);

            return (
              <div className="projection-lyric-column" key={`${song.id}-column-${index}`}>
                {column.map((stanza, stanzaIndex) => {
                  const partNumber = columnOffset + stanzaIndex + 1;
                  const isChorus = isProjectionChorus(stanza);

                  return (
                    <div className="projection-stanza-group" key={`${song.id}-stanza-${index}-${stanzaIndex}`}>
                      <span className={`projection-part-number ${isChorus ? 'projection-part-number-chorus' : ''}`}>
                        {partNumber}
                      </span>
                      <div className={`projection-stanza ${isChorus ? 'projection-stanza-chorus' : ''}`}>
                        {stanza.map((line, lineIndex) => <p key={`${line}-${lineIndex}`}>{line || String.fromCharCode(160)}</p>)}
                      </div>
                      {stanzaIndex < column.length - 1 && (
                        <div className="projection-divider" aria-hidden="true"><span /><b>✣</b><span /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {pointer && pointerMode !== 'off' && (
        <span
          className={`presentation-pointer presentation-pointer-${pointerMode}`}
          style={{ '--pointer-x': `${pointer.x}%`, '--pointer-y': `${pointer.y}%` } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
    </article>
  );
}

function NavButton({
  to,
  icon: Icon,
  children,
  active,
  onClick,
}: {
  to: string;
  icon: typeof Home;
  children: string;
  active: boolean;
  onClick: (to: string) => void;
}) {
  return (
    <button className={`nav-link ${active ? 'active' : ''}`} onClick={() => onClick(to)}>
      <Icon size={18} />
      <span>{children}</span>
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname === '/app/home' ? '/' : location.pathname;
  const [navCollapsed, setNavCollapsed] = useState(readLocal(NAV_COLLAPSED_KEY, false));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function toggleNavigation() {
    const next = !navCollapsed;
    setNavCollapsed(next);
    writeLocal(NAV_COLLAPSED_KEY, next);
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${navCollapsed ? 'collapsed' : ''}`}>
        <button className="brand" onClick={() => navigate('/')}>
          <BookOpen size={26} />
          <strong>Morija Cantiques</strong>
        </button>
        {!navCollapsed && (
          <>
            <nav className="topnav">
              <NavButton to="/" icon={Home} active={path === '/'} onClick={navigate}>Home</NavButton>
              <NavButton to="/search" icon={Search} active={path === '/search'} onClick={navigate}>Search</NavButton>
              <NavButton to="/presentations" icon={ListMusic} active={path === '/presentations'} onClick={navigate}>Presentations</NavButton>
              <NavButton to="/favorites" icon={Heart} active={path === '/favorites'} onClick={navigate}>Favorites</NavButton>
              <NavButton to="/support" icon={HeartHandshake} active={path === '/support'} onClick={navigate}>Support the work</NavButton>
              <NavButton to="/settings" icon={Settings} active={path === '/settings'} onClick={navigate}>Settings</NavButton>
            </nav>
            <div className="account-actions">
              {!isOnline && (
                <span className="offline-badge" title="Offline mode — using local database">
                  <WifiOff size={14} /> Offline
                </span>
              )}
            </div>
          </>
        )}
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={!navCollapsed}
          aria-label={navCollapsed ? 'Show navigation' : 'Hide navigation'}
          title={navCollapsed ? 'Show navigation' : 'Hide navigation'}
          onClick={toggleNavigation}
        >
          {navCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

function CollectionGrid({ collections }: { collections: Collection[] }) {
  const navigate = useNavigate();
  return (
    <div className="collection-grid">
      {collections.map((collection) => {
        const routeKey = collectionRouteKey(collection);
        return (
        <button
          key={collection.id || collection.slug}
          className="collection-card"
          onClick={() => routeKey && navigate(`/collections/${encodeURIComponent(routeKey)}`)}
        >
          <span className="collection-code">{collectionCode(collection)}</span>
          <strong>{collection.name}</strong>
          <small>{collectionCount(collection)} Hymns</small>
        </button>
        );
      })}
    </div>
  );
}

function HymnRow({ song, meta }: { song: Song; meta?: string }) {
  const navigate = useNavigate();
  return (
    <button className="hymn-row" onClick={() => navigate(`/hymns/${song.id}`)}>
      <span className="hymn-number">{songNumberLabel(song)}</span>
      <span>
        <strong>{song.title}</strong>
        <small>{meta || songCollectionName(song)}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [status, setStatus] = useState('Loading');
  const [prefetchProgress, setPrefetchProgress] = useState<PrefetchProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchCached<Collection[]>('/collections', COLLECTIONS_CACHE_KEY)
      .then(({ data, offline }) => {
        if (cancelled) return;
        setCollections(data);
        setStatus(offline ? 'Offline — using local database' : '');
        // Always trigger background prefetch — it skips collections already cached offline
        if (data.length > 0) {
          prefetchAllSongs(data as unknown as OfflineCollection[]).catch(() => {});
        }
      })
      .catch((error: Error) => !cancelled && setStatus(error.message));

    // Listen to prefetch progress
    const unsubscribe = onPrefetchProgress((progress) => {
      if (!cancelled) setPrefetchProgress(progress);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <section className="page">
      <div className="home-heading">
        <div>
          <p className="eyebrow">Digital hymn book</p>
          <h1>Morija Cantiques</h1>
          <p className="home-subtitle">Choose a collection to browse hymns in their imported order.</p>
        </div>
        <div className="home-actions">
          <button className="primary-action" onClick={() => navigate('/search')}>
            <Search size={18} />
            Search
          </button>
          <button className="ghost-action" onClick={() => navigate('/add-song')}>
            <Plus size={18} />
            Add Song
          </button>
        </div>
      </div>
      {prefetchProgress && !prefetchProgress.finished && (
        <div className="offline-prefetch-banner">
          <RefreshCw size={16} className="spin-icon" />
          <span>Downloading songs for offline use ({prefetchProgress.done}/{prefetchProgress.total} collections) - {prefetchProgress.current}</span>
        </div>
      )}
      {status && <p className="status">{status}</p>}
      <CollectionGrid collections={collections} />
    </section>
  );
}

function CollectionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.pathname.match(/^\/(?:app\/)?collections\/([^/]+)/);
  const slug = match?.[1] ? decodeURIComponent(match[1]) : '';
  const [collections, setCollections] = useState<Collection[]>([]);
  const [data, setData] = useState<CollectionSongs | null>(null);
  const [status, setStatus] = useState('Loading');

  useEffect(() => {
    let cancelled = false;
    const key = slug ? `collection-songs:${slug}:v2` : COLLECTIONS_CACHE_KEY;
    const request = slug
      ? getCollectionSongsCached(slug, key)
      : apiFetchCached<Collection[]>('/collections', key);

    setStatus(slug ? 'Loading songs' : 'Loading collections');
    if (slug) setData(null);

    request
      .then(({ data: response, offline }) => {
        if (cancelled) return;
        if (slug) {
          setData(response as CollectionSongs);
        } else {
          setCollections(response as Collection[]);
        }
        setStatus(offline ? 'Offline' : '');
      })
      .catch((error: Error) => {
        if (cancelled) return;
        if (slug) setData(null);
        setStatus(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function addSongToPresentation(song: Song) {
    if (!data) return;
    const result = addPresentationSong({ ...song, collection: data.collection });
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  if (!slug) {
    return (
      <section className="page">
        <div className="page-heading"><h1>Collections</h1></div>
        {status && <p className="status">{status}</p>}
        <CollectionGrid collections={collections} />
      </section>
    );
  }

  if (!data) return <section className="page"><p className="status">{status}</p></section>;

  return (
    <section className="page">
      <button className="ghost-action" onClick={() => navigate('/collections')}><ChevronLeft size={18} /> Collections</button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{collectionCode(data.collection)}</p>
          <h1>{data.collection.name}</h1>
        </div>
        <span className="count-pill">{collectionCount(data.collection)} hymns</span>
      </div>
      {status && <p className="status">{status}</p>}
      <div className="hymn-number-grid">
        {data.songs.map((song) => (
          <div key={song.id} className="hymn-tile">
            <button className="hymn-tile-main" onClick={() => navigate(`/hymns/${song.id}`)}>
              <strong>{songNumberLabel(song)}</strong>
              <span>{song.title}</span>
            </button>
            <button className="hymn-tile-add" title="Add to presentation" onClick={() => addSongToPresentation(song)}>
              <Plus size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReaderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const id = location.pathname.split('/').pop() || '';
  const [song, setSong] = useState<Song | null>(null);
  const [adjacent, setAdjacent] = useState<AdjacentSongs | null>(null);
  const [fontSize, setFontSize] = useState(Math.max(readLocal('fontSize', 28), 26));
  const [bookmarks, setBookmarks] = useState<string[]>(readLocal('bookmarks', []));
  const [favorites, setFavorites] = useState<string[]>(readLocal('favorites', []));
  const [dark, setDark] = useState(readLocal<string>('theme', 'light') === 'dark');
  const [presentation, setPresentation] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [status, setStatus] = useState('Loading');
  const readerLyricsRef = useRef<HTMLPreElement | null>(null);
  const readerTapHandlers = useDoubleTapFullscreen(() => {
    const next = !immersive;
    setImmersive(next);
    if (next) requestAppFullscreen().catch(() => {});
    else exitAppFullscreen().catch(() => {});
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    writeLocal('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    document.documentElement.dataset.presentation = presentation || immersive ? 'on' : 'off';
    return () => {
      document.documentElement.dataset.presentation = 'off';
    };
  }, [presentation, immersive]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetchCached<Song>(`/songs/${id}`, `song:${id}`)
      .then(async (songResponse) => {
        if (cancelled) return;
        setSong(songResponse.data);
        setStatus(songResponse.offline ? 'Offline' : '');

        try {
          const adjacentResponse = await apiFetch<AdjacentSongs>(`/songs/${id}/adjacent`);
          if (!cancelled) setAdjacent(adjacentResponse);
        } catch {
          const offlineAdjacent = await getAdjacentSongsOffline(id);
          if (!cancelled) {
            setAdjacent({
              prev: offlineAdjacent.prev as unknown as Song | null,
              next: offlineAdjacent.next as unknown as Song | null,
            });
          }
        }
      })
      .catch((error: Error) => !cancelled && setStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!song || !readerLyricsRef.current) return undefined;
    const lyricsElement = readerLyricsRef.current;
    if (!presentation && !immersive) {
      lyricsElement.style.setProperty('--reader-fit-scale', '1');
      return undefined;
    }

    let frameId = 0;
    const fitLyrics = () => {
      window.cancelAnimationFrame(frameId);
      lyricsElement.style.setProperty('--reader-fit-scale', '1');
      frameId = window.requestAnimationFrame(() => {
        let scale = 1;
        const isOverflowing = () => (
          lyricsElement.scrollHeight > lyricsElement.clientHeight + 2 ||
          lyricsElement.scrollWidth > lyricsElement.clientWidth + 2
        );
        while (isOverflowing() && scale > 0.56) {
          scale -= 0.035;
          lyricsElement.style.setProperty('--reader-fit-scale', scale.toFixed(2));
        }
      });
    };
    fitLyrics();
    window.addEventListener('resize', fitLyrics);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', fitLyrics);
    };
  }, [fontSize, immersive, presentation, song]);

  if (!song) return <section className="reader-page"><p className="status">{status}</p></section>;

  const currentSong = song;
  const isBookmarked = bookmarks.includes(currentSong.id);
  const isFavorited = favorites.includes(currentSong.id);
  const lyrics = normalizePlainLyrics(currentSong);

  function changeFont(next: number) {
    const value = clampNumber(next, 22, 44);
    setFontSize(value);
    writeLocal('fontSize', value);
  }

  function toggleBookmark() {
    const next = isBookmarked ? bookmarks.filter((item) => item !== currentSong.id) : [...bookmarks, currentSong.id];
    setBookmarks(next);
    writeLocal('bookmarks', next);
  }

  function toggleFavorite() {
    const next = isFavorited ? favorites.filter((item) => item !== currentSong.id) : [...favorites, currentSong.id];
    setFavorites(next);
    writeLocal('favorites', next);
  }

  function copySong() {
    navigator.clipboard?.writeText(`${songNumberLabel(currentSong)}. ${currentSong.title}\n\n${lyrics}`).catch(() => {});
  }

  function shareSong() {
    const shareData = { title: currentSong.title, text: `${songNumberLabel(currentSong)}. ${currentSong.title}`, url: window.location.href };
    if (navigator.share) navigator.share(shareData).catch(() => {});
    else copySong();
  }

  function addCurrentSongToPresentation() {
    const result = addPresentationSong(currentSong);
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  function exitReaderPresentation() {
    setPresentation(false);
    setImmersive(false);
    exitAppFullscreen().catch(() => {});
  }

  return (
    <section className={`reader-page ${immersive ? 'immersive' : ''}`} {...readerTapHandlers}>
      {(presentation || immersive) && (
        <button
          className="reader-presentation-back"
          type="button"
          aria-label="Back to hymn reader"
          title="Back to hymn reader"
          onClick={exitReaderPresentation}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="reader-toolbar">
        <button className="ghost-action" disabled={!adjacent?.prev} onClick={() => adjacent?.prev && navigate(`/hymns/${adjacent.prev.id}`)}>
          <ChevronLeft size={18} /> Previous hymn
        </button>
        <button className="icon-button" title="Decrease font size" onClick={() => changeFont(fontSize - 2)}><Minus size={18} /></button>
        <span className="font-readout">{fontSize}px</span>
        <button className="icon-button" title="Increase font size" onClick={() => changeFont(fontSize + 2)}><Plus size={18} /></button>
        <button className={`icon-button ${isBookmarked ? 'active' : ''}`} title="Bookmark hymn" onClick={toggleBookmark}><Bookmark size={18} /></button>
        <button className={`icon-button ${isFavorited ? 'active' : ''}`} title="Favorite hymn" onClick={toggleFavorite}><Heart size={18} /></button>
        <button className="icon-button" title="Add to presentation" onClick={addCurrentSongToPresentation}><ListMusic size={18} /></button>
        <button className="icon-button" title="Presentation mode" onClick={() => setPresentation(!presentation)}><Play size={18} /></button>
        <button className="icon-button" title="Dark mode" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button className="icon-button" title="Copy hymn text" onClick={copySong}><Copy size={18} /></button>
        <button className="icon-button" title="Share hymn" onClick={shareSong}><Share2 size={18} /></button>
        <button className="ghost-action" disabled={!adjacent?.next} onClick={() => adjacent?.next && navigate(`/hymns/${adjacent.next.id}`)}>
          Next hymn <ChevronRight size={18} />
        </button>
      </div>
      {status && <p className="status compact">{status}</p>}
      <article className="hymn-reader">
        <p className="eyebrow">{songCollectionName(currentSong)} / {songNumberLabel(currentSong)}</p>
        <h1>{currentSong.title}</h1>
        <pre ref={readerLyricsRef} style={{ fontSize: `calc(${fontSize}px * var(--reader-fit-scale, 1))` }}>{lyrics}</pre>
      </article>
    </section>
  );
}

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [status, setStatus] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setStatus('Searching');
    const songs = await getSearchResults(trimmed);
    setResults(songs);
    if (songs.length > 0) writeLocal(`search:${trimmed}`, songs);
    const isOnline = navigator.onLine;
    setStatus(isOnline ? '' : 'Offline — searching local database');
  }

  return (
    <section className="page">
      <div className="page-heading"><h1>Search</h1></div>
      <form className="search-bar" onSubmit={submit}>
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, lyric, or number" />
        <button className="primary-action"><Send size={18} /> Go</button>
      </form>
      {status && <p className="status">{status}</p>}
      <div className="list">{results.map((song) => <HymnRow key={song.id} song={song} meta={songCollectionName(song)} />)}</div>
    </section>
  );
}

function PresentationsPage() {
  const location = useLocation();
  const isProjectionWindow = new URLSearchParams(location.search).get('projection') === '1';
  const [songs, setSongs] = usePresentationSongs();
  const [projectionSongs, setProjectionSongs] = useState<PresentationSong[]>(readPresentationSongs);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [browseCode, setBrowseCode] = useState('');
  const [browseData, setBrowseData] = useState<CollectionSongs | null>(null);
  const [browseStatus, setBrowseStatus] = useState('Loading collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [status, setStatus] = useState('');
  const [presentationScreenZoom, setPresentationScreenZoom] = useState(() => (
    clampNumber(readLocal(PRESENTATION_SCREEN_ZOOM_KEY, 1), 0.75, 4)
  ));
  const [presentationBackground, setPresentationBackground] = useState(() => (
    readLocal(PRESENTATION_BACKGROUND_KEY, '#cdeeff')
  ));
  const [presentationZoomOrigin, setPresentationZoomOrigin] = useState({ x: 50, y: 50 });
  const [presentationScrollProgress, setPresentationScrollProgress] = useState(0);
  const [pointerMode, setPointerMode] = useState<PresentationPointerMode>('off');
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const [audienceWindowOpen, setAudienceWindowOpen] = useState(false);
  const [audienceFullscreen, setAudienceFullscreen] = useState(false);
  const [projectionEnded, setProjectionEnded] = useState(false);
  const audienceWindowRef = useRef<Window | null>(null);
  const projectionChannelRef = useRef<BroadcastChannel | null>(null);
  const projectionStateRef = useRef<ProjectionState | null>(null);
  const slideSong = songs[selectedIndex] || null;
  const projectionSlideSong = projectionSongs[selectedIndex] || projectionSongs[0] || null;

  useEffect(() => {
    if (selectedIndex > songs.length - 1) setSelectedIndex(Math.max(songs.length - 1, 0));
  }, [selectedIndex, songs.length]);

  useEffect(() => {
    let cancelled = false;
    apiFetchCached<Collection[]>('/collections', COLLECTIONS_CACHE_KEY)
      .then(({ data, offline }) => {
        if (cancelled) return;
        setCollections(data);
        setBrowseCode((current) => current || data[0]?.slug || data[0]?.code || '');
        setBrowseStatus(offline ? 'Offline' : '');
      })
      .catch((error: Error) => !cancelled && setBrowseStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!browseCode) return undefined;
    let cancelled = false;
    setBrowseData(null);
    setBrowseStatus('Loading songs');
    getCollectionSongsCached(browseCode, `collection-songs:${browseCode}:v2`)
      .then(({ data, offline }) => {
        if (cancelled) return;
        setBrowseData(data);
        setBrowseStatus(offline ? 'Offline' : '');
      })
      .catch((error: Error) => !cancelled && setBrowseStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, [browseCode]);

  useEffect(() => {
    document.documentElement.dataset.presentation = isProjectionWindow ? 'on' : 'off';
    document.documentElement.dataset.projection = isProjectionWindow ? 'on' : 'off';
    return () => {
      document.documentElement.dataset.presentation = 'off';
      document.documentElement.dataset.projection = 'off';
    };
  }, [isProjectionWindow]);

  useEffect(() => {
    document.documentElement.dataset.presenter = presenting && !isProjectionWindow ? 'on' : 'off';
    return () => {
      document.documentElement.dataset.presenter = 'off';
    };
  }, [presenting, isProjectionWindow]);

  useEffect(() => {
    const channel = typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('morija-presentation');
    projectionChannelRef.current = channel;
    const sendReady = () => {
      if (isProjectionWindow) window.opener?.postMessage({ type: 'morija-projection-ready' }, window.location.origin);
    };
    const onMessage = (event: MessageEvent<ProjectionMessage>) => {
      if (event.origin && event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'morija-projection-ready' && !isProjectionWindow) {
        setAudienceWindowOpen(true);
        sendProjectionState();
        return;
      }

      if (message.type === 'presentation-command') {
        if (message.command === 'audience-closed' && !isProjectionWindow) {
          audienceWindowRef.current = null;
          setAudienceWindowOpen(false);
          setAudienceFullscreen(false);
          return;
        }

        if (message.command === 'end-projection') {
          if (isProjectionWindow) {
            setProjectionEnded(true);
            setPointerMode('off');
            exitAppFullscreen().catch(() => {});
          } else {
            setPresenting(false);
            setAudienceWindowOpen(false);
            setAudienceFullscreen(false);
            setStatus('Projection cancelled.');
          }
          return;
        }

        if (message.command === 'hide-taskbar' && isProjectionWindow) {
          requestAppFullscreen().catch(() => {});
          return;
        }

        if (message.command === 'show-taskbar' && isProjectionWindow) {
          exitAppFullscreen().catch(() => {});
        }
        return;
      }

      if (message.type === 'presentation-audience-event' && !isProjectionWindow) {
        if (message.event === 'fullscreen-change') {
          setAudienceFullscreen(Boolean(message.fullscreen));
        } else if (message.event === 'scroll-progress' && typeof message.scrollProgress === 'number') {
          setPresentationScrollProgress(clampNumber(message.scrollProgress, 0, 1));
        }
        return;
      }

      if (message.type !== 'presentation-state' || !isProjectionWindow) return;
      const state = message;
      setProjectionEnded(false);
      setProjectionSongs(state.songs);
      setSelectedIndex(state.selectedIndex);
      setPresentationScreenZoom(state.zoom);
      setPresentationZoomOrigin(state.zoomOrigin);
      setPresentationScrollProgress(clampNumber(state.scrollProgress ?? 0, 0, 1));
      setPointer(state.pointer);
      setPointerMode(state.pointerMode);
      setPresentationBackground(state.background);
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('message', onMessage);
    sendReady();
    return () => {
      channel?.close();
      projectionChannelRef.current = null;
      window.removeEventListener('message', onMessage);
    };
  // The channel is intentionally created once per window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectionWindow]);

  function getProjectionState(selectedIndexOverride = selectedIndex): ProjectionState {
    return {
      type: 'presentation-state',
      songs,
      selectedIndex: selectedIndexOverride,
      zoom: presentationScreenZoom,
      zoomOrigin: presentationZoomOrigin,
      scrollProgress: presentationScrollProgress,
      pointer,
      pointerMode,
      background: presentationBackground,
    };
  }

  projectionStateRef.current = getProjectionState();

  function sendProjectionState(state = projectionStateRef.current ?? getProjectionState()) {
    projectionChannelRef.current?.postMessage(state);
    if (audienceWindowRef.current && !audienceWindowRef.current.closed) {
      audienceWindowRef.current.postMessage(state, window.location.origin);
    }
  }

  function sendProjectionCommand(command: ProjectionCommand['command']) {
    const message: ProjectionCommand = { type: 'presentation-command', command };
    projectionChannelRef.current?.postMessage(message);
    if (isProjectionWindow) {
      window.opener?.postMessage(message, window.location.origin);
    } else if (audienceWindowRef.current && !audienceWindowRef.current.closed) {
      audienceWindowRef.current.postMessage(message, window.location.origin);
    }
  }

  function sendProjectionAudienceEvent(message: Omit<ProjectionAudienceEvent, 'type'>) {
    const payload: ProjectionAudienceEvent = { type: 'presentation-audience-event', ...message };
    projectionChannelRef.current?.postMessage(payload);
    window.opener?.postMessage(payload, window.location.origin);
  }

  useEffect(() => {
    if (isProjectionWindow || !presenting) return;
    sendProjectionState();
  // State changes are the signal that keeps the audience window in lockstep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectionWindow, presenting, songs, selectedIndex, presentationScreenZoom, presentationZoomOrigin, presentationScrollProgress, pointer, pointerMode, presentationBackground]);

  useEffect(() => {
    writeLocal(PRESENTATION_BACKGROUND_KEY, presentationBackground);
  }, [presentationBackground]);

  useEffect(() => {
    if (!isProjectionWindow) return undefined;
    const onStorage = () => setProjectionSongs(readPresentationSongs());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isProjectionWindow]);

  useEffect(() => {
    if (!isProjectionWindow) return undefined;
    const notifyClosed = () => {
      const message: ProjectionCommand = { type: 'presentation-command', command: 'audience-closed' };
      projectionChannelRef.current?.postMessage(message);
      window.opener?.postMessage(message, window.location.origin);
    };
    window.addEventListener('pagehide', notifyClosed);
    return () => window.removeEventListener('pagehide', notifyClosed);
  }, [isProjectionWindow]);

  useEffect(() => {
    writeLocal(PRESENTATION_SCREEN_ZOOM_KEY, presentationScreenZoom);
  }, [presentationScreenZoom]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement);
      if (isProjectionWindow) {
        sendProjectionAudienceEvent({ event: 'fullscreen-change', fullscreen });
      }
    };
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  // Fullscreen status is mirrored back only from the audience window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectionWindow]);

  useEffect(() => {
    if (isProjectionWindow || !audienceWindowOpen) return undefined;
    const checkAudienceWindow = () => {
      if (!audienceWindowRef.current || audienceWindowRef.current.closed) {
        audienceWindowRef.current = null;
        setAudienceWindowOpen(false);
        setAudienceFullscreen(false);
      }
    };
    const intervalId = window.setInterval(checkAudienceWindow, 800);
    return () => window.clearInterval(intervalId);
  }, [audienceWindowOpen, isProjectionWindow]);

  useEffect(() => {
    if (!presenting || isProjectionWindow) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          setPresentationZoomOrigin({ x: 50, y: 50 });
          setPresentationScreenZoom((zoom) => clampNumber(Number((zoom + 0.16).toFixed(2)), 0.75, 4));
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault();
          setPresentationZoomOrigin({ x: 50, y: 50 });
          setPresentationScreenZoom((zoom) => clampNumber(Number((zoom - 0.16).toFixed(2)), 0.75, 4));
        } else if (event.key === '0') {
          event.preventDefault();
          setPresentationZoomOrigin({ x: 50, y: 50 });
          setPresentationScreenZoom(1);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (document.fullscreenElement) exitAppFullscreen().catch(() => {});
        else cancelProjection();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, songs.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (['PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        if (!scrollPresenterSlide(1)) setSelectedIndex((index) => Math.min(index + 1, songs.length - 1));
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        if (!scrollPresenterSlide(-1)) setSelectedIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        scrollPresenterSlide(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        scrollPresenterSlide(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, songs.length, isProjectionWindow]);

  useLayoutEffect(() => {
    if (!presenting && !isProjectionWindow) return;
    setPresentationZoomOrigin({ x: 50, y: 50 });
    setPresentationScreenZoom(1);
    setPresentationScrollProgress(0);
    setPointerMode('off');
  }, [presenting, isProjectionWindow, selectedIndex]);

  function saveSongs(next: PresentationSong[]) {
    setSongs(next);
  }

  function moveSong(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= songs.length) return;
    const next = [...songs];
    [next[index], next[target]] = [next[target], next[index]];
    saveSongs(next);
    setSelectedIndex(target);
  }

  function removeSong(index: number) {
    const next = songs.filter((_, itemIndex) => itemIndex !== index);
    saveSongs(next);
    setSelectedIndex(Math.min(index, Math.max(next.length - 1, 0)));
  }

  function clearPresentation() {
    saveSongs([]);
    setSelectedIndex(0);
    setStatus('');
  }

  function addBrowseSong(song: Song) {
    if (!browseData) return;
    const result = addPresentationSong({ ...song, collection: browseData.collection });
    saveSongs(result.songs);
    if (result.added) setSelectedIndex(result.songs.length - 1);
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  function addSearchSong(song: Song) {
    const result = addPresentationSong(song);
    saveSongs(result.songs);
    if (result.added) setSelectedIndex(result.songs.length - 1);
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  async function searchPresentationSongs(event: React.FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchStatus('');
      return;
    }
    setSearchStatus('Searching');
    try {
      setSearchResults(await getSearchResults(query));
      setSearchStatus('');
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : 'Search failed');
    }
  }

  const isSearchingSongs = searchQuery.trim().length > 0;
  const visibleBrowseSongs = isSearchingSongs ? searchResults : (browseData?.songs || []);
  const changePresentationScreenZoom = (delta: number, clientX?: number, clientY?: number) => {
    const slideRect = document.querySelector<HTMLElement>('.presenter-main-panel .presentation-slide')?.getBoundingClientRect();
    if (slideRect && typeof clientX === 'number' && typeof clientY === 'number') {
      const x = clampNumber(((clientX - slideRect.left) / slideRect.width) * 100, 0, 100);
      const y = clampNumber(((clientY - slideRect.top) / slideRect.height) * 100, 0, 100);
      setPresentationZoomOrigin({ x, y });
    }

    setPresentationScreenZoom((zoom) => clampNumber(Number((zoom + delta).toFixed(2)), 0.75, 4));
  };

  function scrollPresenterSlide(direction: -1 | 1) {
    const slide = document.querySelector<HTMLElement>('.presenter-main-panel .presentation-slide');
    if (!slide) return false;
    const maxScroll = Math.max(slide.scrollHeight - slide.clientHeight, 0);
    if (maxScroll <= 1) return false;
    const atEdge = direction > 0 ? slide.scrollTop >= maxScroll - 2 : slide.scrollTop <= 2;
    if (atEdge) return false;
    slide.scrollBy({ top: direction * Math.max(slide.clientHeight * 0.78, 240), behavior: 'smooth' });
    return true;
  }

  const handlePresentationWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      changePresentationScreenZoom(event.deltaY < 0 ? 0.12 : -0.12, event.clientX, event.clientY);
      return;
    }

    if (isInteractiveTarget(event.target)) return;
    const direction = event.deltaY > 0 ? 1 : -1;
    event.preventDefault();
    scrollPresenterSlide(direction);
  };

  function handleAudienceScrollProgress(progress: number) {
    setPresentationScrollProgress(progress);
    sendProjectionAudienceEvent({ event: 'scroll-progress', scrollProgress: progress });
  }

  function handleSlidePointerMove(event: React.PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clampNumber(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    });
  }

  async function sendAudienceToProjector() {
    const audienceWindow = audienceWindowRef.current;
    if (!audienceWindow || audienceWindow.closed) {
      setStatus('Open the audience screen first.');
      return;
    }

    const moved = await moveAudienceWindowToPresentationDisplay(audienceWindow);
    if (moved) {
      audienceWindow.focus();
      setStatus('Audience screen moved to the external display.');
    } else {
      setStatus('Audience screen is open. Focus that window and use Win + Shift + Right Arrow to move it to the projector.');
    }
  }

  function openAudienceWindow(initialState?: ProjectionState) {
    const projectionUrl = `${window.location.origin}${window.location.pathname}?projection=1`;
    const existing = audienceWindowRef.current;
    const audienceWindow = existing && !existing.closed
      ? existing
      : window.open(projectionUrl, 'morija-audience', audienceWindowFeatures());

    if (!audienceWindow) {
      setStatus('Allow pop-ups to open the audience screen.');
      setPresenting(false);
      setAudienceWindowOpen(false);
      return;
    }

    audienceWindowRef.current = audienceWindow;
    setAudienceWindowOpen(true);
    setPresenting(true);
    audienceWindow.focus();
    setStatus('Audience screen opened. Use Hide taskbar here if the taskbar is visible on the projector.');
    moveAudienceWindowToPresentationDisplay(audienceWindow)
      .then((moved) => {
        if (moved) setStatus('Audience screen moved to the external display. Use Hide taskbar here if needed.');
      })
      .catch(() => {});
    window.setTimeout(() => sendProjectionState(initialState), 500);
  }

  function cancelProjection() {
    sendProjectionCommand('end-projection');
    setAudienceWindowOpen(false);
    setAudienceFullscreen(false);
    setPresenting(false);
    setPointerMode('off');
    setStatus('Projection cancelled.');
  }

  function startPresentation(index: number) {
    const initialState = getProjectionState(index);
    setSelectedIndex(index);
    setPresenting(true);
    openAudienceWindow(initialState);
  }

  async function toggleAudienceTaskbar() {
    if (!audienceWindowOpen) {
      setStatus('Open the audience screen first.');
      return;
    }

    if (audienceFullscreen) {
      sendProjectionCommand('show-taskbar');
      setAudienceFullscreen(false);
      setStatus('Taskbar shown on the projector.');
      return;
    }

    let requestedFullscreen = false;
    const audienceWindow = audienceWindowRef.current;
    if (audienceWindow && !audienceWindow.closed) {
      try {
        const audienceDocument = audienceWindow.document;
        const requestFullscreen = audienceDocument.documentElement.requestFullscreen;
        if (requestFullscreen) {
          await requestFullscreen.call(audienceDocument.documentElement);
          requestedFullscreen = true;
        }
      } catch {
        requestedFullscreen = false;
      }
    }

    if (!requestedFullscreen) {
      sendProjectionCommand('hide-taskbar');
      setStatus('Hide taskbar request sent to the projector.');
      return;
    }
    setAudienceFullscreen(true);
    setStatus('Taskbar hidden on the projector.');
  }

  if (isProjectionWindow) {
    return (
      <section className="presentation-projection-window">
        {projectionEnded ? (
          <div className="projection-ended-state">
            <MonitorUp size={34} />
            <p>Projection cancelled</p>
          </div>
        ) : projectionSlideSong ? (
          <PresentationSlideCanvas
            song={projectionSlideSong}
            background={presentationBackground}
            zoom={presentationScreenZoom}
            zoomOrigin={presentationZoomOrigin}
            scrollProgress={presentationScrollProgress}
            onScrollProgressChange={handleAudienceScrollProgress}
            pointer={pointer}
            pointerMode={pointerMode}
          />
        ) : (
          <div className="projection-empty-state">
            <MonitorUp size={34} />
            <p>Waiting for presenter</p>
          </div>
        )}
      </section>
    );
  }

  if (presenting && slideSong) {
    return (
      <section className="presentation-presenter" onWheel={handlePresentationWheel}>
        <header className="presentation-presenter-header">
          <div>
            <p className="eyebrow"><Presentation size={16} /> Presenter view</p>
            <h1>{slideSong.title}</h1>
            <span>{selectedIndex + 1} of {songs.length} · {slideSong.collectionName}</span>
          </div>
          <div className="presentation-presenter-actions">
            <button className={`secondary-action ${audienceWindowOpen ? 'is-live' : ''}`} onClick={() => openAudienceWindow()}>
              {audienceWindowOpen ? <Radio size={17} /> : <MonitorUp size={17} />}
              {audienceWindowOpen ? 'Audience live' : 'Open audience'}
            </button>
            <button className="secondary-action" disabled={!audienceWindowOpen} onClick={sendAudienceToProjector}>
              <Monitor size={17} />
              Send to projector
            </button>
            <button className="secondary-action" disabled={!audienceWindowOpen} onClick={toggleAudienceTaskbar}>
              {audienceFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              {audienceFullscreen ? 'Show taskbar' : 'Hide taskbar'}
            </button>
            <button className="ghost-action" onClick={cancelProjection}><X size={17} /> Cancel projection</button>
          </div>
        </header>

        <div className="presentation-presenter-grid">
          <section className="presenter-main-panel">
            <div className="presenter-panel-label"><span>Now showing</span><span className="live-dot">LIVE</span></div>
            <PresentationSlideCanvas
              song={slideSong}
              background={presentationBackground}
              zoom={presentationScreenZoom}
              zoomOrigin={presentationZoomOrigin}
              scrollProgress={presentationScrollProgress}
              onScrollProgressChange={setPresentationScrollProgress}
              pointer={pointer}
              pointerMode={pointerMode}
              onPointerMove={handleSlidePointerMove}
            />
          </section>
          <aside className="presenter-side-panel">
            <div className="presenter-next-card">
              <div className="presenter-panel-label"><span>Next up</span><span>{selectedIndex < songs.length - 1 ? selectedIndex + 2 : 'End'}</span></div>
              {songs[selectedIndex + 1] ? (
                <button className="presenter-next-preview" onClick={() => setSelectedIndex(selectedIndex + 1)}>
                  <strong>{songs[selectedIndex + 1].title}</strong>
                  <span>{songs[selectedIndex + 1].collectionName} / {songNumberLabel(songs[selectedIndex + 1])}</span>
                </button>
              ) : <p className="presenter-muted">You are on the final slide.</p>}
            </div>
            <div className="presenter-toolbox">
              <div className="presenter-panel-label"><span>Presenter tools</span><MousePointer2 size={16} /></div>
              <div className="presenter-tool-row">
                <button className={pointerMode === 'off' ? 'active' : ''} onClick={() => setPointerMode('off')}>Off</button>
                <button className={pointerMode === 'laser' ? 'active' : ''} onClick={() => setPointerMode('laser')}>Laser</button>
                <button className={pointerMode === 'spotlight' ? 'active' : ''} onClick={() => setPointerMode('spotlight')}>Spotlight</button>
                <button className={pointerMode === 'ink' ? 'active' : ''} onClick={() => setPointerMode('ink')}>Mark</button>
              </div>
              <div className="presenter-tool-row">
                <button title="Scroll lyrics up" aria-label="Scroll lyrics up" onClick={() => scrollPresenterSlide(-1)}><ChevronUp size={16} /></button>
                <button title="Scroll lyrics down" aria-label="Scroll lyrics down" onClick={() => scrollPresenterSlide(1)}><ChevronDown size={16} /></button>
              </div>
              <label className="presenter-zoom-control">Slide zoom <input type="range" min="0.75" max="1.5" step="0.01" value={presentationScreenZoom} onChange={(event) => setPresentationScreenZoom(Number(event.target.value))} /></label>
              <label className="presenter-color-control">
                <span>Background color</span>
                <input
                  type="color"
                  value={presentationBackground}
                  aria-label="Presentation background color"
                  onChange={(event) => setPresentationBackground(event.target.value)}
                />
              </label>
            </div>
          </aside>
        </div>

        <footer className="presenter-footer">
          <button className="presentation-nav-button" disabled={selectedIndex === 0} onClick={() => setSelectedIndex(selectedIndex - 1)}><ChevronLeft size={18} /> Previous</button>
          <div className="presenter-slide-strip">
            {songs.map((song, index) => (
              <button key={song.entryId} className={index === selectedIndex ? 'active' : ''} onClick={() => setSelectedIndex(index)} title={song.title}><span>{index + 1}</span><small>{song.title}</small></button>
            ))}
          </div>
          <button className="presentation-nav-button" disabled={selectedIndex >= songs.length - 1} onClick={() => setSelectedIndex(selectedIndex + 1)}>Next <ChevronRight size={18} /></button>
        </footer>
      </section>
    );
  }

  return (
    <section className="page presentation-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Presentations</p>
          <h1>Presentations</h1>
        </div>
        <div className="presentation-actions">
          <button className="primary-action" disabled={!songs.length} onClick={() => startPresentation(0)}><Play size={18} /> From beginning</button>
          <button className="secondary-action" disabled={!songs.length} onClick={() => startPresentation(selectedIndex)}><MonitorUp size={18} /> From current</button>
          <button className="ghost-action" disabled={!songs.length} onClick={clearPresentation}><Trash2 size={18} /> Clear</button>
        </div>
      </div>
      {status && <p className="status">{status}</p>}
      <div className="presentation-builder">
        <section className="presentation-list">
          <div className="presentation-panel-heading">
            <h2>Slide order</h2>
            <span className="count-pill">{songs.length} songs</span>
          </div>
          {songs.length === 0 ? (
            <div className="presentation-empty">
              <Library size={36} />
              <strong>No songs selected</strong>
            </div>
          ) : (
            <div className="presentation-song-list">
              {songs.map((song, index) => (
                <div key={song.entryId} className={`presentation-song ${index === selectedIndex ? 'active' : ''}`}>
                  <button className="presentation-song-main" onClick={() => setSelectedIndex(index)}>
                    <span className="slide-number">{index + 1}</span>
                    <span>
                      <strong>{song.title}</strong>
                      <small>{song.collectionName} / {songNumberLabel(song)}</small>
                    </span>
                  </button>
                  <div className="presentation-song-tools">
                    <button className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveSong(index, -1)}><ArrowUp size={17} /></button>
                    <button className="icon-button" title="Move down" disabled={index === songs.length - 1} onClick={() => moveSong(index, 1)}><ArrowDown size={17} /></button>
                    <button className="icon-button" title="Remove from presentation" onClick={() => removeSong(index)}><Trash2 size={17} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section id="presentation-browser" className="presentation-browser">
          <div className="presentation-panel-heading">
            <h2>Browse songs</h2>
            <span className="count-pill">{visibleBrowseSongs.length} songs</span>
          </div>
          <form className="presentation-search" onSubmit={searchPresentationSongs}>
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search songs" />
            {searchQuery && (
              <button type="button" className="icon-button" title="Clear search" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                <X size={16} />
              </button>
            )}
            <button className="primary-action"><Search size={17} /> Search</button>
          </form>
          <div className="presentation-collection-list">
            {collections.map((collection) => {
              const routeKey = collectionRouteKey(collection);
              return (
              <button
                key={collection.id || collection.slug}
                className={`presentation-collection-button ${routeKey === browseCode ? 'active' : ''}`}
                onClick={() => routeKey && setBrowseCode(routeKey)}
              >
                <strong>{collectionCode(collection)}</strong>
                <span>{collection.name}</span>
              </button>
              );
            })}
          </div>
          {(searchStatus || (!isSearchingSongs && browseStatus)) && <p className="status">{searchStatus || browseStatus}</p>}
          <div className="presentation-browser-grid">
            {visibleBrowseSongs.map((song) => (
              <button
                key={`${isSearchingSongs ? 'search' : 'browse'}-${song.id}`}
                className="presentation-browser-song"
                onClick={() => isSearchingSongs ? addSearchSong(song) : addBrowseSong(song)}
              >
                <strong>{songNumberLabel(song)}</strong>
                <span>{song.title}</span>
                <Plus size={17} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function FavoritesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'favorites' | 'bookmarks'>('favorites');
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState('');

  const favoriteIds = readLocal<string[]>('favorites', []);
  const bookmarkIds = readLocal<string[]>('bookmarks', []);

  useEffect(() => {
    const ids = activeTab === 'favorites' ? favoriteIds : bookmarkIds;
    if (ids.length === 0) { setSongs([]); return; }
    setStatus('Loading');
    // Use getSongByIdCached which falls back to IndexedDB, then localStorage — works offline
    Promise.all(ids.map((id) => getSongByIdCached(id).catch(() => null)))
      .then((results) => {
        const loaded = results.filter(Boolean).map((r) => r!.data);
        setSongs(loaded);
        setStatus(loaded.length < ids.length ? 'Some hymns could not be loaded' : '');
      })
      .catch(() => setStatus('Failed to load saved hymns.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const ids = activeTab === 'favorites' ? favoriteIds : bookmarkIds;
  const isEmpty = !status && songs.length === 0;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Personal library</p>
          <h1>Saved Hymns</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="saved-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'favorites'}
          className={`saved-tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          <Heart size={15} />
          Favorites
          <span className="saved-tab-count">{favoriteIds.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'bookmarks'}
          className={`saved-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          <Bookmark size={15} />
          Bookmarks
          <span className="saved-tab-count">{bookmarkIds.length}</span>
        </button>
      </div>

      {status && <p className="status">{status}</p>}

      {isEmpty && ids.length === 0 ? (
        <div className="saved-empty">
          {activeTab === 'favorites' ? <Heart size={40} /> : <Bookmark size={40} />}
          <strong>No {activeTab} yet</strong>
          <p>Tap the {activeTab === 'favorites' ? '♥' : '🔖'} icon while reading a hymn to save it here.</p>
        </div>
      ) : isEmpty ? (
        <div className="saved-empty">
          <p>Could not load details for saved hymns. Open them from the reader.</p>
          <div className="list">
            {ids.map((id) => (
              <button key={id} className="hymn-row" onClick={() => navigate(`/hymns/${id}`)}>
                <span className="hymn-number">–</span>
                <span><strong>{id}</strong><small>Tap to open</small></span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="list">
          {songs.map((song) => (
            <HymnRow key={song.id} song={song} />
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(readLocal<string>('theme', 'light') === 'dark');
  const [fontSize, setFontSize] = useState(Math.max(readLocal('fontSize', 28), 26));
  const [offlineStats, setOfflineStats] = useState<{ collectionsCount: number; songsCount: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState<PrefetchProgress | null>(null);

  // Song submission state
  const [songTitle, setSongTitle] = useState('');
  const [songLyrics, setSongLyrics] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [newSongId, setNewSongId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    writeLocal('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => writeLocal('fontSize', fontSize), [fontSize]);

  useEffect(() => {
    getOfflineStats().then(setOfflineStats).catch(() => {});
    const unsubscribe = onPrefetchProgress((progress) => {
      setPrefetchProgress(progress);
      if (progress.finished) {
        setDownloading(false);
        getOfflineStats().then(setOfflineStats).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Auto-drain offline queued songs when coming back online
    const syncPending = () => {
      drainPendingSongs().catch(() => {});
    };
    window.addEventListener('online', syncPending);
    if (navigator.onLine) syncPending();
    return () => window.removeEventListener('online', syncPending);
  }, []);

  async function handleSyncAllSongs() {
    setDownloading(true);
    try {
      const colls = await apiFetch<Collection[]>('/collections');
      await saveCollectionsIdb(colls as unknown as OfflineCollection[]);
      prefetchAllSongs(colls as unknown as OfflineCollection[], true).catch(() => setDownloading(false));
    } catch {
      const idbColls = await getCollectionsIdb();
      if (idbColls.length > 0) {
        prefetchAllSongs(idbColls, true).catch(() => setDownloading(false));
      } else {
        setDownloading(false);
      }
    }
  }

  async function handleSongSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!songTitle.trim() || !songLyrics.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Please enter both a title and lyrics.');
      return;
    }
    setSubmitStatus('submitting');
    setSubmitMessage('');
    setNewSongId(null);

    const cleanTitle = songTitle.trim();
    const cleanLyrics = songLyrics.trim();

    if (!navigator.onLine) {
      await queuePendingSong(cleanTitle, cleanLyrics);
      setSubmitStatus('success');
      setSubmitMessage(`"${cleanTitle}" saved offline! It will automatically upload when internet connects.`);
      setSongTitle('');
      setSongLyrics('');
      return;
    }

    try {
      const response = await fetch(apiUrl('/collections/sincerite/songs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: cleanTitle, lyrics: cleanLyrics }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Submission failed');
      }
      if (body.data?.id) {
        saveSongIdb({
          id: String(body.data.id),
          songNumber: body.data.songNumber,
          number: body.data.number,
          title: body.data.title || cleanTitle,
          collectionSlug: 'sincerite',
          collectionName: 'Sincérité',
          rawLyrics: cleanLyrics,
          sections: body.data.sections,
          lyrics: body.data.lyrics,
        }).catch(() => {});
      }
      setSubmitStatus('success');
      setSubmitMessage(`"${body.data?.title || cleanTitle}" was added to Sincérité!`);
      setNewSongId(body.data?.id ?? null);
      setSongTitle('');
      setSongLyrics('');
    } catch {
      if (navigator.onLine) {
        setSubmitStatus('error');
        setSubmitMessage('The song could not be saved to the server. Please try again when the service is available.');
        return;
      }

      // Queue only when the browser is genuinely offline.
      await queuePendingSong(cleanTitle, cleanLyrics);
      setSubmitStatus('success');
      setSubmitMessage(`"${cleanTitle}" saved offline! It will automatically upload when internet connects.`);
      setSongTitle('');
      setSongLyrics('');
    }
  }

  function resetForm() {
    setSubmitStatus('idle');
    setSubmitMessage('');
    setNewSongId(null);
  }

  return (
    <section className="page">
      <div className="page-heading"><h1>Settings</h1></div>

      {/* ── Appearance ── */}
      <div className="settings-group">
        <h2 className="settings-group-title">Appearance</h2>
        <div className="settings-form">
          <label className="toggle-line">
            <span><Moon size={18} /> Dark mode</span>
            <input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} />
          </label>
          <label>Reader font size<input type="range" min="22" max="44" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
        </div>
      </div>

      {/* ── Offline Storage ── */}
      <div className="settings-group">
        <h2 className="settings-group-title"><WifiOff size={18} /> Offline Storage</h2>
        <p className="settings-group-desc">
          Download all 13 hymn collections to your device for complete offline access without an internet connection.
        </p>
        <div className="offline-stats-card">
          <div>
            <strong>{offlineStats ? `${offlineStats.songsCount.toLocaleString()} Hymns` : 'Checking...'}</strong>
            <small>{offlineStats ? `${offlineStats.collectionsCount} collections cached` : 'Local database'}</small>
          </div>
          <button className="primary-action" onClick={handleSyncAllSongs} disabled={downloading}>
            <RefreshCw size={16} className={downloading ? 'spin-icon' : ''} />
            {downloading ? 'Downloading...' : 'Download / Sync All Hymns'}
          </button>
        </div>
        {prefetchProgress && !prefetchProgress.finished && (
          <div className="offline-prefetch-banner" style={{ marginTop: '12px' }}>
            <RefreshCw size={16} className="spin-icon" />
            <span>Downloading hymns ({prefetchProgress.done}/{prefetchProgress.total} collections) — {prefetchProgress.current}</span>
          </div>
        )}
      </div>

      {/* ── Add a Song ── */}
      <div className="settings-group">
        <h2 className="settings-group-title"><Send size={18} /> Add a Song</h2>
        <p className="settings-group-desc">
          Submit a new song and it will be added to the <strong>Sincérité</strong> collection, visible to everyone.
        </p>

        {submitStatus === 'success' ? (
          <div className="submit-success">
            <div className="submit-success-icon">✓</div>
            <p>{submitMessage}</p>
            <div className="submit-success-actions">
              {newSongId && (
                <button className="primary-action" onClick={() => navigate(`/hymns/${newSongId}`)}>
                  <BookOpen size={16} /> View Song
                </button>
              )}
              <button className="ghost-action" onClick={resetForm}>Add Another</button>
            </div>
          </div>
        ) : (
          <form className="add-song-form" onSubmit={handleSongSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="song-title">Song Title</label>
              <input
                id="song-title"
                type="text"
                placeholder="Enter the song title…"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                disabled={submitStatus === 'submitting'}
                maxLength={300}
                autoComplete="off"
              />
            </div>
            <div className="form-field">
              <label htmlFor="song-lyrics">Lyrics</label>
              <textarea
                id="song-lyrics"
                placeholder={"Enter the song lyrics here…\n\nUse blank lines to separate verses."}
                value={songLyrics}
                onChange={(e) => setSongLyrics(e.target.value)}
                disabled={submitStatus === 'submitting'}
                rows={12}
              />
            </div>
            {submitStatus === 'error' && (
              <p className="form-error">{submitMessage}</p>
            )}
            <button
              type="submit"
              className="primary-action"
              disabled={submitStatus === 'submitting' || !songTitle.trim() || !songLyrics.trim()}
            >
              {submitStatus === 'submitting' ? (
                <><span className="spinner" /> Submitting…</>
              ) : (
                <><Send size={16} /> Submit Song</>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function AddSongPage() {
  const navigate = useNavigate();
  const [songTitle, setSongTitle] = useState('');
  const [songLyrics, setSongLyrics] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [newSongId, setNewSongId] = useState<string | null>(null);

  useEffect(() => {
    const syncPending = () => {
      drainPendingSongs().catch(() => {});
    };
    window.addEventListener('online', syncPending);
    if (navigator.onLine) syncPending();
    return () => window.removeEventListener('online', syncPending);
  }, []);

  async function handleSongSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!songTitle.trim() || !songLyrics.trim()) {
      setSubmitStatus('error');
      setSubmitMessage('Please enter both a title and lyrics.');
      return;
    }
    setSubmitStatus('submitting');
    setSubmitMessage('');
    setNewSongId(null);

    const cleanTitle = songTitle.trim();
    const cleanLyrics = songLyrics.trim();

    if (!navigator.onLine) {
      await queuePendingSong(cleanTitle, cleanLyrics);
      setSubmitStatus('success');
      setSubmitMessage(`"${cleanTitle}" saved offline! It will automatically upload when internet connects.`);
      setSongTitle('');
      setSongLyrics('');
      return;
    }

    try {
      const response = await fetch(apiUrl('/collections/sincerite/songs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: cleanTitle, lyrics: cleanLyrics }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Submission failed');
      if (body.data?.id) {
        saveSongIdb({
          id: String(body.data.id),
          songNumber: body.data.songNumber,
          number: body.data.number,
          title: body.data.title || cleanTitle,
          collectionSlug: 'sincerite',
          collectionName: 'Sincérité',
          rawLyrics: cleanLyrics,
          sections: body.data.sections,
          lyrics: body.data.lyrics,
        }).catch(() => {});
      }
      setSubmitStatus('success');
      setSubmitMessage(`"${body.data?.title || cleanTitle}" was added to Sincérité!`);
      setNewSongId(body.data?.id ?? null);
      setSongTitle('');
      setSongLyrics('');
    } catch {
      if (navigator.onLine) {
        setSubmitStatus('error');
        setSubmitMessage('The song could not be saved to the server. Please try again when the service is available.');
        return;
      }

      await queuePendingSong(cleanTitle, cleanLyrics);
      setSubmitStatus('success');
      setSubmitMessage(`"${cleanTitle}" saved offline! It will automatically upload when internet connects.`);
      setSongTitle('');
      setSongLyrics('');
    }
  }

  function resetForm() {
    setSubmitStatus('idle');
    setSubmitMessage('');
    setNewSongId(null);
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sincérité Collection</p>
          <h1>Add a Song</h1>
          <p className="home-subtitle">Share a song with the community — it will appear in the <strong>Sincérité</strong> collection for everyone to sing.</p>
        </div>
      </div>

      <div className="settings-group">
        {submitStatus === 'success' ? (
          <div className="submit-success">
            <div className="submit-success-icon">✓</div>
            <p>{submitMessage}</p>
            <div className="submit-success-actions">
              {newSongId && (
                <button className="primary-action" onClick={() => navigate(`/hymns/${newSongId}`)}>
                  <BookOpen size={16} /> View Song
                </button>
              )}
              <button className="ghost-action" onClick={() => navigate('/collections/sincerite')}>
                <Library size={16} /> Browse Sincérité
              </button>
              <button className="ghost-action" onClick={resetForm}>Add Another</button>
            </div>
          </div>
        ) : (
          <form className="add-song-form" onSubmit={handleSongSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="add-song-title">Song Title</label>
              <input
                id="add-song-title"
                type="text"
                placeholder="Enter the song title…"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                disabled={submitStatus === 'submitting'}
                maxLength={300}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="form-field">
              <label htmlFor="add-song-lyrics">Lyrics</label>
              <textarea
                id="add-song-lyrics"
                placeholder={"Enter the song lyrics here…\n\nUse blank lines to separate verses or choruses."}
                value={songLyrics}
                onChange={(e) => setSongLyrics(e.target.value)}
                disabled={submitStatus === 'submitting'}
                rows={14}
              />
            </div>
            {submitStatus === 'error' && (
              <p className="form-error">{submitMessage}</p>
            )}
            <button
              type="submit"
              className="primary-action"
              disabled={submitStatus === 'submitting' || !songTitle.trim() || !songLyrics.trim()}
            >
              {submitStatus === 'submitting' ? (
                <><span className="spinner" /> Submitting…</>
              ) : (
                <><Send size={16} /> Submit Song</>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function SupportPage() {
  const whatsappMessage = encodeURIComponent(
    'Hello, I would like to support Morija Cantiques and would like to know how I can contribute.',
  );
  const whatsappUrl = `https://wa.me/256758567887?text=${whatsappMessage}`;

  return (
    <section className="page support-page">
      <div className="support-intro">
        <p className="eyebrow">Keep the collection available</p>
        <h1>Help Keep This Work Available</h1>
        <p className="support-lead">
          Morija Cantiques exists to preserve and make these songs accessible in a simple digital form.
        </p>
      </div>

      <div className="support-content">
        <div className="support-copy">
          <p>
            The platform requires hosting, storage, maintenance, and other technical resources to remain available and continue serving those who value this collection.
          </p>
          <p>
            If you deem this work important and would like to help, your contribution can help us keep the platform online and maintained.
          </p>
          <p>Every contribution is appreciated.</p>
        </div>

        <section className="support-contact" aria-labelledby="support-contact-title">
          <div className="support-contact-heading">
            <HeartHandshake size={22} />
            <div>
              <p className="eyebrow">Want to support?</p>
              <h2 id="support-contact-title">Let’s talk</h2>
            </div>
          </div>
          <p>
            If you would like to contribute toward the hosting and maintenance of Morija Cantiques, please contact us:
          </p>
          <div className="support-details">
            <a href="https://wa.me/256758567887" target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp: +256 758 567 887</a>
            <a href="tel:+256780246004"><Phone size={18} /> Phone: +256 780 246 004</a>
            <a href="mailto:ritekolo@email.com"><Mail size={18} /> Email: ritekolo@email.com</a>
          </div>
          <a className="primary-action support-whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> Contact Us on WhatsApp
          </a>
        </section>
      </div>

      <section className="developer-section" aria-labelledby="developer-title">
        <div className="developer-photo-wrap">
          <img src="/developer-ritah-kolo.png" alt="Ritah Kolo" className="developer-photo" />
        </div>
        <div className="developer-copy">
          <p className="eyebrow">About the Developer</p>
          <h2 id="developer-title">Built with care by Ritah Kolo</h2>
          <p>
            Morija Cantiques was developed by Ritah Kolo with the desire to use technology to make these songs easier to access, preserve, and share.
          </p>
          <p>
            As a developer, I saw an opportunity to transform the traditional collection of songs into a digital platform that can be accessed conveniently from a computer or mobile device.
          </p>
          <p>
            This work is maintained with the hope that it will continue to be useful to everyone who values these songs and the Message of the hour.
          </p>
        </div>
      </section>

      <footer className="support-footer">
        <p>© 2026 Morija Cantiques</p>
        <p>Developed by Ritah Kolo</p>
      </footer>
    </section>
  );
}

function RouteSwitch() {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/' || path === '/app/home') return <HomePage />;
  if (path === '/collections' || path === '/app/collections') return <CollectionsPage />;
  if (path.startsWith('/collections/') || path.startsWith('/app/collections/')) return <CollectionsPage />;
  if (path === '/search' || path === '/app/search') return <SearchPage />;
  if (path === '/presentations' || path === '/app/presentations') return <PresentationsPage />;
  if (path.startsWith('/hymns/') || path.startsWith('/app/hymns/')) return <ReaderPage />;
  if (path === '/favorites' || path === '/app/favorites') return <FavoritesPage />;
  if (path === '/add-song' || path === '/app/add-song') return <AddSongPage />;
  if (path === '/support' || path === '/app/support') return <SupportPage />;
  if (path === '/settings' || path === '/app/settings') return <SettingsPage />;
  return <HomePage />;
}

export function App() {
  return (
    <Shell>
      <RouteSwitch />
    </Shell>
  );
}

export default App;
