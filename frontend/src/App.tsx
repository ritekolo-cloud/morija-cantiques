import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Download,
  FileText,
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
  Save,
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
import { PresentationEditorShell } from './PresentationEditorShell';
import { AdvancedSlideObjects } from './AdvancedSlideObjects';
import { MediaSlideObjects } from './MediaSlideObjects';
import { MEDIA_MAX_BYTES, savePresentationAsset, supportedMediaType } from './presentationAssets';
import { exportPresentationToPptx, getPptxExportLimitations, importPptx } from './pptxInterop';
import { usePresentationDocument } from './presentationStore';
import { createStableId, fitPresentationZoomPercent, isValidHyperlink, presentationSlideToTextSlide, serializePresentationDocument, type AudioObject, type VideoObject, type DrawingObject, type PresentationDocument, type SlideAnimation, type SlideComment, type SlideLayout, type SupportedTransitionType } from './presentationModel';
import { deleteSlide, duplicateSlide, getVisibleSlideId, insertSlide, nextSlideSelection, reorderSlides, updateSlide } from './presentationCommands';
import { ShapeEditorOverlay, type ShapeKind } from './ShapeEditorOverlay';
import { ImageEditorOverlay } from './ImageEditorOverlay';
import { TextEditorOverlay } from './TextEditorOverlay';
import { effectiveTextFontSize, fitPresentationText, runsToSlideHtml } from './textModel';
import { alignObjects, alignShapes, arrangeObjects, arrangeShapes, boundsOfObjects, distributeObjects, distributeShapes, flipGroup, groupShapes, rotateGroup, rotateObjects, rotateShapes, ungroup } from './objectManipulationCommands';
import { authRequest, login as loginAccount, logout as logoutAccount, onSessionExpired, register as registerAccount, restoreSession, type AuthUser } from './authClient';
import { createCloudPresentation, isRevisionConflict, listCloudPresentations, loadCloudPresentation, updateCloudPresentation, listCloudShares, listCloudVersions, restoreCloudVersion, revokeCloudShare, shareCloudPresentation, updateCloudShare, type CloudPresentationSummary, type CloudShare, type CloudVersion } from './presentationCloud';
import { startSongProjection } from './songProjection';
import { audienceCloseMode } from './projectionLifecycle';

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

type GeneralSlideLayout = 'title-body' | 'title-only' | 'full-text' | 'scripture' | 'quote' | 'announcement';
type GeneralTextAlign = 'left' | 'center' | 'right';

type GeneralSlide = {
  id: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  reference: string;
  layout: GeneralSlideLayout;
  presentationLayout?: import('./presentationModel').SlideLayout;
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
  subtitleFontSize: number;
  textColor: string;
  titleColor: string;
  subtitleColor: string;
  highlightColor: string;
  titleAlign: GeneralTextAlign;
  subtitleAlign: GeneralTextAlign;
  bodyAlign: GeneralTextAlign;
  titleOffsetX: number;
  titleOffsetY: number;
  subtitleOffsetX: number;
  subtitleOffsetY: number;
  titleWidth: number;
  titleHeight: number;
  subtitleWidth: number;
  subtitleHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
  background: string;
  transitionType?: SupportedTransitionType;
  transitionDurationMs?: number;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showBody?: boolean;
  shapeObjects?: import('./presentationModel').ShapeObject[];
  groupObjects?: import('./presentationModel').GroupObject[];
  imageObjects?: import('./presentationModel').ImageObject[];
  textObjects?: import('./presentationModel').TextObject[];
  drawingObjects?: DrawingObject[];
  tableObjects?: import('./presentationModel').TableObject[];
  chartObjects?: import('./presentationModel').ChartObject[];
  diagramObjects?: import('./presentationModel').DiagramObject[];
  audioObjects?: import('./presentationModel').AudioObject[];
  videoObjects?: import('./presentationModel').VideoObject[];
  comments?: SlideComment[];
  rehearsalDurationMs?: number;
  animationObjectIds?: string[];
  animations?: SlideAnimation[];
  updatedAt: number;
};

type PresentationTextSlide = GeneralSlide & {
  entryId: string;
  type: 'text';
};

type PresentationItem =
  | { type: 'song'; entryId: string; song: PresentationSong }
  | { type: 'text'; entryId: string; slide: GeneralSlide };

type SavedTextDocument = {
  id: string;
  title: string;
  slides: GeneralSlide[];
  updatedAt: number;
};

type PresentationPointerMode = 'off' | 'laser' | 'spotlight' | 'ink';

type ProjectionState = {
  type: 'presentation-state';
  items: PresentationItem[];
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
  command: 'end-projection' | 'audience-closed';
};

type ProjectionAudienceEvent = {
  type: 'presentation-audience-event';
  event: 'scroll-progress';
  scrollProgress?: number;
};

type ProjectionReadyMessage = {
  type: 'morija-projection-ready';
  audience: 'songs';
  fullscreen: boolean;
};

type ProjectionMessage = ProjectionState | ProjectionCommand | ProjectionAudienceEvent | ProjectionReadyMessage;

type TextProjectionMessage = ProjectionCommand | { type: 'morija-text-projection-ready'; audience: 'text-slides'; fullscreen: boolean } | { type: 'morija-text-audience-closed'; audience: 'text-slides' };

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
const PRESENTATION_ITEMS_KEY = 'presentation:items:v1';
const TEXT_SLIDES_ITEMS_KEY = 'text-slides:items:v1';
const GENERAL_DOCUMENTS_KEY = 'general-text:documents:v1';
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

async function requestProjectionFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
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

  return [
    'popup=yes',
    'toolbar=no',
    'menubar=no',
    'location=no',
    'status=no',
    'scrollbars=no',
    'resizable=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
  ].join(',');
}

async function requestAudienceWindowFullscreen(audienceWindow: Window) {
  try {
    if (!audienceWindow.document.fullscreenElement) {
      await audienceWindow.document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    }
    return Boolean(audienceWindow.document.fullscreenElement);
  } catch {
    // A popup opened by window.open does not inherit the presenter's user activation.
    // Keep this opportunistic for installed-app contexts, but never make it a required
    // second action in the audience window.
    return false;
  }
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

function hymnIdForApi(value: Song | string | number) {
  const candidate = typeof value === 'object' ? value.id : value;
  return /^\d+$/.test(String(candidate)) ? String(candidate) : null;
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

function createGeneralSlide(overrides: Partial<GeneralSlide> = {}): GeneralSlide {
  return {
    id: randomId(),
    title: '',
    subtitle: '',
    bodyHtml: '',
    reference: '',
    layout: 'title-body',
    fontFamily: 'Georgia, serif',
    fontSize: 30,
    titleFontSize: 44,
    subtitleFontSize: 22,
    textColor: '#24104f',
    titleColor: '#24104f',
    subtitleColor: '#4c4473',
    highlightColor: '#ddd6fe',
    titleAlign: 'center',
    subtitleAlign: 'center',
    bodyAlign: 'left',
    titleOffsetX: 0,
    titleOffsetY: 0,
    subtitleOffsetX: 0,
    subtitleOffsetY: 0,
    titleWidth: 90,
    titleHeight: 120,
    subtitleWidth: 72,
    subtitleHeight: 54,
    bodyWidth: 100,
    bodyHeight: 260,
    bodyOffsetX: 0,
    bodyOffsetY: 0,
    background: '#ffffff',
    transitionType: 'none',
    transitionDurationMs: 400,
    showTitle: true,
    showSubtitle: true,
    showBody: true,
    animationObjectIds: [],
    animations: [],
    drawingObjects: [],
    tableObjects: [],
    chartObjects: [],
    diagramObjects: [],
    comments: [],
    updatedAt: Date.now(),
    ...overrides,
  };
}

function normalizeGeneralBodyHtml(html: string) {
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const allowed = ['background-color', 'color', 'font-weight', 'font-style', 'text-decoration', 'text-align'];
    [...element.style].forEach((property) => {
      if (!allowed.includes(property)) element.style.removeProperty(property);
    });
    if (!element.getAttribute('style')) element.removeAttribute('style');
  });
  return container.innerHTML;
}

function compactGeneralBodyHtml(html: string) {
  if (typeof document === 'undefined') return html;
  const container = document.createElement('div');
  container.innerHTML = normalizeGeneralBodyHtml(html);
  container.querySelectorAll('p, div').forEach((element) => {
    if (!element.textContent?.trim() && !element.querySelector('img')) element.remove();
  });
  return container.innerHTML;
}

function presentationTextSlideFromSlide(slide: GeneralSlide): PresentationTextSlide {
  return { ...slide, entryId: randomId(), type: 'text' };
}

function readSavedTextDocuments() {
  const documents = readLocal<SavedTextDocument[]>(GENERAL_DOCUMENTS_KEY, []);
  return Array.isArray(documents) ? documents : [];
}

function writeSavedTextDocuments(documents: SavedTextDocument[]) {
  writeLocal(GENERAL_DOCUMENTS_KEY, documents);
  window.dispatchEvent(new CustomEvent('generaltextchange'));
}

function readPresentationItems(): PresentationItem[] {
  const stored = readLocal<PresentationItem[]>(PRESENTATION_ITEMS_KEY, []);
  if (Array.isArray(stored) && stored.length > 0) return stored;

  // Preserve queues created by older versions that stored songs directly.
  const songs = readLocal<PresentationSong[]>(PRESENTATION_SONGS_KEY, []);
  return Array.isArray(songs)
    ? songs.map((song) => ({ type: 'song' as const, entryId: song.entryId, song }))
    : [];
}

function migrateTextSlidesOutOfPresentation() {
  if (typeof window === 'undefined' || window.localStorage.getItem(TEXT_SLIDES_ITEMS_KEY) !== null) return;
  const stored = readLocal<PresentationItem[]>(PRESENTATION_ITEMS_KEY, []);
  const legacyTextSlides = Array.isArray(stored) ? stored.filter((item): item is Extract<PresentationItem, { type: 'text' }> => item.type === 'text') : [];
  const songItems = Array.isArray(stored) ? stored.filter((item): item is Extract<PresentationItem, { type: 'song' }> => item.type === 'song') : [];
  if (legacyTextSlides.length > 0) writeLocal(TEXT_SLIDES_ITEMS_KEY, legacyTextSlides);
  else writeLocal(TEXT_SLIDES_ITEMS_KEY, []);
  if (Array.isArray(stored) && stored.some((item) => item.type === 'text')) {
    writeLocal(PRESENTATION_ITEMS_KEY, songItems);
    writeLocal(PRESENTATION_SONGS_KEY, songItems.map((item) => item.song));
  }
}

function readTextSlideItems(): Extract<PresentationItem, { type: 'text' }>[] {
  migrateTextSlidesOutOfPresentation();
  const stored = readLocal<PresentationItem[]>(TEXT_SLIDES_ITEMS_KEY, []);
  return Array.isArray(stored) ? stored.filter((item): item is Extract<PresentationItem, { type: 'text' }> => item.type === 'text') : [];
}

function writeTextSlideItems(items: Extract<PresentationItem, { type: 'text' }>[]) {
  writeLocal(TEXT_SLIDES_ITEMS_KEY, items);
  window.dispatchEvent(new CustomEvent('textslideschange'));
}

function writePresentationItems(items: PresentationItem[]) {
  writeLocal(PRESENTATION_ITEMS_KEY, items);
  writeLocal(PRESENTATION_SONGS_KEY, items.filter((item): item is Extract<PresentationItem, { type: 'song' }> => item.type === 'song').map((item) => item.song));
  window.dispatchEvent(new CustomEvent('presentationchange'));
}

function addPresentationSong(song: Song) {
  const items = readPresentationItems();
  if (items.some((item) => item.type === 'song' && item.song.id === song.id)) return { added: false, items };
  const next = [...items, { type: 'song' as const, entryId: randomId(), song: presentationSongFromSong(song) }];
  writePresentationItems(next);
  return { added: true, items: next };
}

function usePresentationSongs() {
  migrateTextSlidesOutOfPresentation();
  const [songs, setSongs] = useState(readPresentationItems);

  useEffect(() => {
    const refresh = () => setSongs(readPresentationItems());
    window.addEventListener('storage', refresh);
    window.addEventListener('presentationchange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('presentationchange', refresh);
    };
  }, []);

  function save(next: PresentationItem[]) {
    setSongs(next);
    writePresentationItems(next);
  }

  return [songs, save] as const;
}

function useTextSlides() {
  const [items, setItems] = useState(readTextSlideItems);

  useEffect(() => {
    const refresh = () => setItems(readTextSlideItems());
    window.addEventListener('storage', refresh);
    window.addEventListener('textslideschange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('textslideschange', refresh);
    };
  }, []);

  function save(next: Extract<PresentationItem, { type: 'text' }>[]) {
    setItems(next);
    writeTextSlideItems(next);
  }

  return [items, save] as const;
}

function presentationItemTitle(item: PresentationItem) {
  return item.type === 'song' ? item.song.title : item.slide.title || 'Untitled text slide';
}

function presentationItemSubtitle(item: PresentationItem) {
  return item.type === 'song'
    ? `${songNumberLabel(item.song)} · ${item.song.collectionName}`
    : '';
}

function presentationItemKind(item: PresentationItem) {
  return item.type === 'song' ? 'Song' : 'Text';
}

function generalSlidePreview(slide: GeneralSlide) {
  const text = slide.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || 'Empty body';
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

function GeneralSlideCanvas({
  slide,
  projection = false,
  onChange,
}: {
  slide: GeneralSlide;
  projection?: boolean;
  onChange?: (slide: GeneralSlide) => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleRef = useRef<HTMLParagraphElement | null>(null);
  const [fitSizes, setFitSizes] = useState({ title: slide.titleFontSize || 44, subtitle: slide.subtitleFontSize || 22, body: slide.fontSize || 30 });

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const title = titleRef.current;
    const subtitle = subtitleRef.current;
    if (!body && !title && !subtitle) return;
    const fitElement = (element: HTMLElement | null, preferredSize: number, minimumSize: number, hasContent: boolean) => {
      if (!element || !hasContent) return { fontSize: preferredSize, overflow: false };
      const availableHeight = element.clientHeight;
      const previousSize = element.style.fontSize;
      const result = fitPresentationText({
        preferredSize,
        minimumSize,
        availableHeight,
        measureHeight: (fontSize) => {
          element.style.fontSize = `${fontSize}px`;
          return element.scrollHeight;
        },
      });
      element.style.fontSize = previousSize;
      return result;
    };
    const fitAll = () => {
      const next = {
        title: fitElement(title, slide.titleFontSize || 44, 24, Boolean(slide.title)).fontSize,
        subtitle: fitElement(subtitle, slide.subtitleFontSize || 22, 16, Boolean(slide.subtitle)).fontSize,
        body: fitElement(body, slide.fontSize || 30, 18, Boolean(slide.bodyHtml?.replace(/<[^>]*>/g, '').trim())).fontSize,
      };
      setFitSizes((previous) => Math.abs(previous.title - next.title) > 0.1 || Math.abs(previous.subtitle - next.subtitle) > 0.1 || Math.abs(previous.body - next.body) > 0.1 ? next : previous);
    };
    fitAll();
    const observer = new ResizeObserver(fitAll);
    [body, title, subtitle].filter(Boolean).forEach((element) => observer.observe(element as HTMLElement));
    return () => observer.disconnect();
  }, [slide.bodyHtml, slide.fontSize, slide.bodyWidth, slide.bodyHeight, slide.title, slide.subtitle, slide.titleFontSize, slide.subtitleFontSize, slide.showBody, slide.showTitle, slide.showSubtitle, projection]);

  return (
    <article
      className={`general-slide-canvas general-slide-layout-${slide.presentationLayout || slide.layout} ${projection ? 'general-slide-projection' : ''} ${projection && slide.transitionType && slide.transitionType !== 'none' ? `general-slide-transition-${slide.transitionType}` : ''}`}
      style={{
        background: slide.background,
        color: slide.textColor,
        fontFamily: slide.fontFamily,
        '--general-slide-font-size': `${slide.fontSize}px`,
        '--general-title-font-size': `${slide.titleFontSize || 72}px`,
      '--general-subtitle-font-size': `${slide.subtitleFontSize || 28}px`,
      } as React.CSSProperties}
    >
      {slide.reference && <p className="general-slide-reference">{slide.reference}</p>}
      {[...(slide.shapeObjects || []).map((item) => ({ kind: 'shape' as const, item })), ...(slide.imageObjects || []).map((item) => ({ kind: 'image' as const, item })), ...(slide.textObjects || []).map((item) => ({ kind: 'text' as const, item }))].sort((a, b) => a.item.geometry.zIndex - b.item.geometry.zIndex).map(({ kind, item }) => { const animation = projection ? slide.animations?.find((candidate) => candidate.objectId === item.id) : undefined; const className = animation ? ` general-slide-animated general-slide-animation-${animation.type}` : ''; const animationStyle = animation ? { '--animation-duration': `${Math.max(0, animation.durationMs)}ms`, '--animation-delay': `${Math.max(0, animation.delayMs)}ms`, '--animation-direction': animation.direction || 'left' } as React.CSSProperties : undefined; return kind === 'shape' ? <div key={item.id} className={`general-slide-shape general-slide-shape-${item.style.shape}${className}`} style={{ left: `${item.geometry.x / 1280 * 100}%`, top: `${item.geometry.y / 720 * 100}%`, width: `${item.geometry.width / 1280 * 100}%`, height: `${item.geometry.height / 720 * 100}%`, transform: `rotate(${item.geometry.rotation}deg)`, zIndex: item.geometry.zIndex, background: item.style.backgroundColor === 'transparent' ? 'transparent' : item.style.backgroundColor, border: `${item.style.outlineWidth ?? 2}px solid ${item.style.outlineColor || '#1e3a8a'}`, opacity: item.style.opacity ?? 1, ...animationStyle } as React.CSSProperties} /> : kind === 'image' ? <img key={item.id} className={`general-slide-image${className}`} src={item.src} alt={item.alt} style={{ left: `${item.geometry.x / 1280 * 100}%`, top: `${item.geometry.y / 720 * 100}%`, width: `${item.geometry.width / 1280 * 100}%`, height: `${item.geometry.height / 720 * 100}%`, transform: `rotate(${item.geometry.rotation}deg) scale(${item.flipHorizontal ? -1 : 1}, ${item.flipVertical ? -1 : 1})`, zIndex: item.geometry.zIndex, opacity: item.style.opacity ?? 1, ...animationStyle }} /> : <div key={item.id} className={`general-slide-text${className}`} style={{ left: `${item.geometry.x / 1280 * 100}%`, top: `${item.geometry.y / 720 * 100}%`, width: `${item.geometry.width / 1280 * 100}%`, height: `${item.geometry.height / 720 * 100}%`, transform: `rotate(${item.geometry.rotation}deg)`, zIndex: item.geometry.zIndex, fontFamily: item.style.fontFamily, fontSize: `${effectiveTextFontSize(item)}px`, color: item.style.color, backgroundColor: item.style.backgroundColor || 'transparent', textAlign: item.style.textAlign || 'left', fontWeight: item.style.fontWeight, fontStyle: item.style.fontStyle, textDecoration: item.style.textDecoration, opacity: item.style.opacity ?? 1, ...animationStyle, padding: `${item.margins?.top ?? 10}px ${item.margins?.right ?? 12}px ${item.margins?.bottom ?? 10}px ${item.margins?.left ?? 12}px`, display: 'flex', alignItems: item.verticalAlign === 'middle' ? 'center' : item.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start' }} dangerouslySetInnerHTML={{ __html: runsToSlideHtml(item.runs || [{ text: item.text }], item.paragraphs) }} />; })}
      <svg className="general-slide-drawings" viewBox="0 0 1280 720" aria-hidden="true">{(slide.drawingObjects || []).map((drawing) => <polyline key={drawing.id} points={drawing.points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={drawing.style.color} strokeWidth={drawing.style.width} strokeLinecap="round" strokeLinejoin="round" opacity={drawing.style.opacity ?? 1} />)}</svg>
      <MediaSlideObjects audio={slide.audioObjects} video={slide.videoObjects} editable={false} />
      <AdvancedSlideObjects table={slide.tableObjects} chart={slide.chartObjects} diagram={slide.diagramObjects} readonly={projection || !onChange} onTableChange={(tableObjects) => onChange?.({ ...slide, tableObjects })} onChartChange={(chartObjects) => onChange?.({ ...slide, chartObjects })} onDiagramChange={(diagramObjects) => onChange?.({ ...slide, diagramObjects })} />
      {slide.showTitle !== false && slide.title && <h1 ref={titleRef} style={{ width: `${slide.titleWidth || 90}%`, height: `${slide.titleHeight || 120}px`, color: slide.titleColor || slide.textColor, textAlign: slide.titleAlign || 'center', fontSize: `${fitSizes.title}px`, transform: `translate(${slide.titleOffsetX || 0}px, ${slide.titleOffsetY || 0}px)` }}>{slide.title}</h1>}
      {slide.showSubtitle !== false && slide.subtitle && <p ref={subtitleRef} className="general-slide-subtitle" style={{ width: `${slide.subtitleWidth || 72}%`, height: `${slide.subtitleHeight || 54}px`, color: slide.subtitleColor || slide.textColor, textAlign: slide.subtitleAlign || 'center', fontSize: `${fitSizes.subtitle}px`, transform: `translate(${slide.subtitleOffsetX || 0}px, ${slide.subtitleOffsetY || 0}px)` }}>{slide.subtitle}</p>}
      {slide.showBody !== false && <div ref={bodyRef} className="general-slide-body" style={{ width: `${slide.bodyWidth || 100}%`, maxWidth: 'none', minHeight: projection ? 0 : `${slide.bodyHeight || 260}px`, fontSize: `${fitSizes.body}px`, textAlign: slide.bodyAlign || 'left', transform: `translate(${slide.bodyOffsetX || 0}px, ${slide.bodyOffsetY || 0}px)` }} dangerouslySetInnerHTML={{ __html: compactGeneralBodyHtml(slide.bodyHtml || '<p></p>') }} />}
    </article>
  );
}

function DrawingOverlay({ drawings, active, color, width, onChange }: { drawings: DrawingObject[]; active: boolean; color: string; width: number; onChange: (drawings: DrawingObject[]) => void }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const draft = useRef<Array<{ x: number; y: number }> | null>(null);
  const [settings, setSettings] = useState({ active, color, width });
  const [preview, setPreview] = useState<Array<{ x: number; y: number }> | null>(null);
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ active: boolean; color: string; width: number }>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('drawing-mode-change', sync);
    return () => window.removeEventListener('drawing-mode-change', sync);
  }, []);
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / rect.width * 1280, y: (event.clientY - rect.top) / rect.height * 720 };
  };
  const finish = () => {
    if (draft.current && draft.current.length > 1) {
      const points = draft.current;
      const minX = Math.min(...points.map((item) => item.x));
      const minY = Math.min(...points.map((item) => item.y));
      const maxX = Math.max(...points.map((item) => item.x));
      const maxY = Math.max(...points.map((item) => item.y));
      onChange([...drawings, { id: createStableId('drawing'), type: 'drawing', geometry: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), rotation: 0, zIndex: 50 }, points, style: { color: settings.color, width: settings.width, opacity: 1 } }]);
    }
    draft.current = null;
    setPreview(null);
  };
  return <svg ref={ref} className={`general-editor-drawing-overlay ${settings.active ? 'active' : ''}`} viewBox="0 0 1280 720" aria-label="Drawing canvas" onPointerDown={(event) => { if (!settings.active) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); draft.current = [point(event)]; setPreview(draft.current); }} onPointerMove={(event) => { if (!draft.current) return; draft.current = [...draft.current, point(event)]; setPreview(draft.current); }} onPointerUp={finish} onPointerCancel={finish}>{drawings.map((drawing) => <polyline key={drawing.id} points={drawing.points.map((item) => `${item.x},${item.y}`).join(' ')} fill="none" stroke={drawing.style.color} strokeWidth={drawing.style.width} strokeLinecap="round" strokeLinejoin="round" opacity={drawing.style.opacity ?? 1} />)}{preview && <polyline points={preview.map((item) => `${item.x},${item.y}`).join(' ')} fill="none" stroke={settings.color} strokeWidth={settings.width} strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />}</svg>;
}

function GeneralSlideEditor({
  slide,
  onChange,
  shapeInsertKind = null,
  selectedShapeIds = [],
  selectedGroupIds = [],
  selectedImageIds = [],
  selectedTextIds = [],
  selectedMediaIds = [],
  textInsertMode = false,
  onImageSelectionChange,
  onTextSelectionChange,
  onMediaSelectionChange,
  onImageInsert,
  onTextInsertComplete,
  snapEnabled = true,
  onShapeSelectionChange,
  onGroupSelectionChange,
  onShapeInsertComplete,
  onUndo,
  onRedo,
  onHistoryStart,
  onHistoryCommit,
  onHistoryCancel,
  drawingMode = false,
  drawingColor = '#ef4444',
  drawingWidth = 4,
}: {
  slide: GeneralSlide;
  onChange: (next: GeneralSlide) => void;
  shapeInsertKind?: ShapeKind | null;
  selectedShapeIds?: string[];
  selectedGroupIds?: string[];
  selectedImageIds?: string[];
  selectedTextIds?: string[];
  selectedMediaIds?: string[];
  textInsertMode?: boolean;
  onImageSelectionChange?: (ids: string[], additive?: boolean) => void;
  onTextSelectionChange?: (ids: string[], additive?: boolean) => void;
  onMediaSelectionChange?: (ids: string[]) => void;
  onImageInsert?: (file: File) => void;
  onTextInsertComplete?: () => void;
  snapEnabled?: boolean;
  onShapeSelectionChange?: (ids: string[], additive?: boolean) => void;
  onGroupSelectionChange?: (ids: string[]) => void;
  onShapeInsertComplete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onHistoryStart?: () => void;
  onHistoryCommit?: () => void;
  onHistoryCancel?: () => void;
  drawingMode?: boolean;
  drawingColor?: string;
  drawingWidth?: number;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    target: 'title' | 'subtitle' | 'body';
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const resizeRef = useRef<{
    target: 'title' | 'subtitle' | 'body';
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    startX: number;
    startY: number;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    currentWidth: number;
    currentHeight: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [dragOffsets, setDragOffsets] = useState({
    titleX: slide.titleOffsetX || 0,
    titleY: slide.titleOffsetY || 0,
    subtitleX: slide.subtitleOffsetX || 0,
    subtitleY: slide.subtitleOffsetY || 0,
    bodyX: slide.bodyOffsetX || 0,
    bodyY: slide.bodyOffsetY || 0,
  });
  const [boxSizes, setBoxSizes] = useState({
    titleWidth: slide.titleWidth || 90,
    titleHeight: slide.titleHeight || 120,
    subtitleWidth: slide.subtitleWidth || 72,
    subtitleHeight: slide.subtitleHeight || 54,
    bodyWidth: slide.bodyWidth || 100,
    bodyHeight: slide.bodyHeight || 260,
  });
  const [sizeDrafts, setSizeDrafts] = useState({
    body: String(slide.fontSize || 30),
    title: String(slide.titleFontSize || 44),
    subtitle: String(slide.subtitleFontSize || 22),
  });
  const [fitSizes, setFitSizes] = useState({ title: slide.titleFontSize || 44, subtitle: slide.subtitleFontSize || 22, body: slide.fontSize || 30 });
  const [fitWarnings, setFitWarnings] = useState({ title: false, subtitle: false, body: false });
  const [activePlaceholder, setActivePlaceholder] = useState<'title' | 'subtitle' | 'body' | null>(null);

  function fitPlaceholders() {
    const elements = { title: titleRef.current, subtitle: subtitleRef.current, body: editorRef.current };
    const values = {
      title: { preferredSize: slide.titleFontSize || 44, minimumSize: 24, content: Boolean(slide.title) },
      subtitle: { preferredSize: slide.subtitleFontSize || 22, minimumSize: 16, content: Boolean(slide.subtitle) },
      body: { preferredSize: slide.fontSize || 30, minimumSize: 18, content: Boolean(editorRef.current?.textContent?.trim()) },
    } as const;
    const nextSizes = { title: values.title.preferredSize, subtitle: values.subtitle.preferredSize, body: values.body.preferredSize };
    const nextWarnings = { title: false, subtitle: false, body: false };
    (Object.keys(values) as Array<keyof typeof values>).forEach((key) => {
      const element = elements[key];
      if (!element || !values[key].content) return;
      const previousSize = element.style.fontSize;
      const result = fitPresentationText({
        preferredSize: values[key].preferredSize,
        minimumSize: values[key].minimumSize,
        availableHeight: element.clientHeight,
        measureHeight: (fontSize) => {
          element.style.fontSize = `${fontSize}px`;
          return element.scrollHeight;
        },
      });
      element.style.fontSize = previousSize;
      nextSizes[key] = result.fontSize;
      nextWarnings[key] = result.overflow;
    });
    setFitSizes((previous) => Math.abs(previous.title - nextSizes.title) > 0.1 || Math.abs(previous.subtitle - nextSizes.subtitle) > 0.1 || Math.abs(previous.body - nextSizes.body) > 0.1 ? nextSizes : previous);
    setFitWarnings((previous) => previous.title !== nextWarnings.title || previous.subtitle !== nextWarnings.subtitle || previous.body !== nextWarnings.body ? nextWarnings : previous);
  }

  useEffect(() => {
    setDragOffsets({
      titleX: slide.titleOffsetX || 0,
      titleY: slide.titleOffsetY || 0,
      subtitleX: slide.subtitleOffsetX || 0,
      subtitleY: slide.subtitleOffsetY || 0,
      bodyX: slide.bodyOffsetX || 0,
      bodyY: slide.bodyOffsetY || 0,
    });
    setBoxSizes({
      titleWidth: slide.titleWidth || 90,
      titleHeight: slide.titleHeight || 120,
      subtitleWidth: slide.subtitleWidth || 72,
      subtitleHeight: slide.subtitleHeight || 54,
      bodyWidth: slide.bodyWidth || 100,
      bodyHeight: slide.bodyHeight || 260,
    });
    setSizeDrafts({
      body: String(slide.fontSize || 30),
      title: String(slide.titleFontSize || 44),
      subtitle: String(slide.subtitleFontSize || 22),
    });
  }, [slide.id, slide.titleOffsetX, slide.titleOffsetY, slide.subtitleOffsetX, slide.subtitleOffsetY, slide.titleWidth, slide.titleHeight, slide.subtitleWidth, slide.subtitleHeight, slide.bodyWidth, slide.bodyHeight, slide.bodyOffsetX, slide.bodyOffsetY]);

  // These are intentionally uncontrolled while focused. Writing React children or
  // innerHTML after every input destroys the browser's native caret and selection.
  // Synchronize only when changing slides or when an external update arrives while
  // the corresponding editor is not focused.
  useLayoutEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current && titleRef.current.textContent !== slide.title) {
      titleRef.current.textContent = slide.title;
    }
    if (subtitleRef.current && document.activeElement !== subtitleRef.current && subtitleRef.current.textContent !== slide.subtitle) {
      subtitleRef.current.textContent = slide.subtitle;
    }
    if (editorRef.current && document.activeElement !== editorRef.current && editorRef.current.innerHTML !== slide.bodyHtml) {
      editorRef.current.innerHTML = slide.bodyHtml;
    }
  }, [slide.id, slide.title, slide.subtitle, slide.bodyHtml, activePlaceholder]);

  useLayoutEffect(() => {
    const body = editorRef.current;
    const stage = stageRef.current;
    if (!body || !stage) return;
    fitPlaceholders();
    const observer = new ResizeObserver(fitPlaceholders);
    observer.observe(stage);
    observer.observe(body);
    return () => observer.disconnect();
  }, [slide.id, slide.title, slide.subtitle, slide.bodyHtml, slide.fontSize, slide.titleFontSize, slide.subtitleFontSize, slide.titleWidth, slide.titleHeight, slide.subtitleWidth, slide.subtitleHeight, slide.bodyWidth, slide.bodyHeight, slide.showTitle, slide.showSubtitle, slide.showBody]);

  function update(patch: Partial<GeneralSlide>) {
    onChange({ ...slide, ...patch, updatedAt: Date.now() });
  }

  function changeSize(key: 'body' | 'title' | 'subtitle', field: 'fontSize' | 'titleFontSize' | 'subtitleFontSize', rawValue: string, min: number, max: number) {
    setSizeDrafts((previous) => ({ ...previous, [key]: rawValue }));
    const numericValue = Number(rawValue);
    if (rawValue.trim() && Number.isFinite(numericValue)) {
      update({ [field]: clampNumber(numericValue, min, max) } as Partial<GeneralSlide>);
    }
  }

  function commitSize(key: 'body' | 'title' | 'subtitle', field: 'fontSize' | 'titleFontSize' | 'subtitleFontSize', min: number, max: number, fallback: number) {
    const numericValue = Number(sizeDrafts[key]);
    const nextValue = Number.isFinite(numericValue) ? clampNumber(numericValue, min, max) : fallback;
    setSizeDrafts((previous) => ({ ...previous, [key]: String(nextValue) }));
    update({ [field]: nextValue } as Partial<GeneralSlide>);
  }

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    if (command === 'createLink') {
      const url = window.prompt('Enter a web address (https://, http://, or mailto:):', 'https://');
      if (!url || !isValidHyperlink(url)) return;
      document.execCommand('createLink', false, url.trim());
    } else {
      document.execCommand(command, false, value);
    }
    update({ bodyHtml: normalizeGeneralBodyHtml(editorRef.current?.innerHTML || '') });
  }

  function selectAllEditable(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    event.stopPropagation();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(event.currentTarget);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function finishDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    update(drag.target === 'title'
      ? { titleOffsetX: drag.currentX, titleOffsetY: drag.currentY }
      : drag.target === 'subtitle'
        ? { subtitleOffsetX: drag.currentX, subtitleOffsetY: drag.currentY }
        : { bodyOffsetX: drag.currentX, bodyOffsetY: drag.currentY });
    dragRef.current = null;
    window.removeEventListener('pointermove', moveDraggedText);
    window.removeEventListener('pointerup', finishDrag);
  }

  function moveDraggedText(event: PointerEvent) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const bounds = stage.getBoundingClientRect();
    const currentX = clampNumber(drag.offsetX + event.clientX - drag.startX, -bounds.width * 0.42, bounds.width * 0.42);
    const currentY = clampNumber(drag.offsetY + event.clientY - drag.startY, -bounds.height * 0.42, bounds.height * 0.42);
    drag.currentX = currentX;
    drag.currentY = currentY;
    setDragOffsets((previous) => drag.target === 'title'
      ? { ...previous, titleX: currentX, titleY: currentY }
      : drag.target === 'subtitle'
        ? { ...previous, subtitleX: currentX, subtitleY: currentY }
        : { ...previous, bodyX: currentX, bodyY: currentY });
  }

  function beginDrag(target: 'title' | 'subtitle' | 'body', event: React.PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const offsetX = target === 'title' ? (slide.titleOffsetX || 0) : target === 'subtitle' ? (slide.subtitleOffsetX || 0) : (slide.bodyOffsetX || 0);
    const offsetY = target === 'title' ? (slide.titleOffsetY || 0) : target === 'subtitle' ? (slide.subtitleOffsetY || 0) : (slide.bodyOffsetY || 0);
    dragRef.current = { target, startX: event.clientX, startY: event.clientY, offsetX, offsetY, currentX: offsetX, currentY: offsetY };
    window.addEventListener('pointermove', moveDraggedText);
    window.addEventListener('pointerup', finishDrag);
  }

  function finishResize() {
    const resize = resizeRef.current;
    if (!resize) return;
    update(resize.target === 'title'
      ? { titleWidth: resize.currentWidth, titleHeight: resize.currentHeight, titleOffsetX: resize.currentX, titleOffsetY: resize.currentY }
      : resize.target === 'subtitle'
        ? { subtitleWidth: resize.currentWidth, subtitleHeight: resize.currentHeight, subtitleOffsetX: resize.currentX, subtitleOffsetY: resize.currentY }
        : { bodyWidth: resize.currentWidth, bodyHeight: resize.currentHeight, bodyOffsetX: resize.currentX, bodyOffsetY: resize.currentY });
    resizeRef.current = null;
    window.removeEventListener('pointermove', resizeTextBox);
    window.removeEventListener('pointerup', finishResize);
  }

  function resizeTextBox(event: PointerEvent) {
    const resize = resizeRef.current;
    const stage = stageRef.current;
    if (!resize || !stage) return;
    const bounds = stage.getBoundingClientRect();
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    const isLeft = resize.corner.includes('left');
    const isTop = resize.corner.includes('top');
    const currentWidth = clampNumber(resize.width + (isLeft ? -deltaX : deltaX) / bounds.width * 100, 25, 100);
    const currentHeight = clampNumber(resize.height + (isTop ? -deltaY : deltaY), 32, 620);
    const currentX = resize.offsetX + (isLeft ? deltaX : 0);
    const currentY = resize.offsetY + (isTop ? deltaY : 0);
    resize.currentWidth = currentWidth;
    resize.currentHeight = currentHeight;
    resize.currentX = currentX;
    resize.currentY = currentY;
    setBoxSizes((previous) => resize.target === 'title'
      ? { ...previous, titleWidth: currentWidth, titleHeight: currentHeight }
      : resize.target === 'subtitle'
        ? { ...previous, subtitleWidth: currentWidth, subtitleHeight: currentHeight }
        : { ...previous, bodyWidth: currentWidth, bodyHeight: currentHeight });
  }

  function beginResize(target: 'title' | 'subtitle' | 'body', corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right', event: React.PointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    const width = target === 'title' ? (slide.titleWidth || 90) : target === 'subtitle' ? (slide.subtitleWidth || 72) : (slide.bodyWidth || 100);
    const height = target === 'title' ? (slide.titleHeight || 120) : target === 'subtitle' ? (slide.subtitleHeight || 54) : (slide.bodyHeight || 260);
    const offsetX = target === 'title' ? (slide.titleOffsetX || 0) : target === 'subtitle' ? (slide.subtitleOffsetX || 0) : (slide.bodyOffsetX || 0);
    const offsetY = target === 'title' ? (slide.titleOffsetY || 0) : target === 'subtitle' ? (slide.subtitleOffsetY || 0) : (slide.bodyOffsetY || 0);
    resizeRef.current = { target, corner, startX: event.clientX, startY: event.clientY, width, height, offsetX, offsetY, currentWidth: width, currentHeight: height, currentX: offsetX, currentY: offsetY };
    window.addEventListener('pointermove', resizeTextBox);
    window.addEventListener('pointerup', finishResize);
  }

  function resetLayout() {
    update({
      titleOffsetX: 0,
      titleOffsetY: 0,
      subtitleOffsetX: 0,
      subtitleOffsetY: 0,
      bodyOffsetX: 0,
      bodyOffsetY: 0,
      titleWidth: 90,
      titleHeight: 120,
      subtitleWidth: 72,
      subtitleHeight: 54,
      bodyWidth: 100,
      bodyHeight: 260,
    });
    setDragOffsets({ titleX: 0, titleY: 0, subtitleX: 0, subtitleY: 0, bodyX: 0, bodyY: 0 });
    setBoxSizes({ titleWidth: 90, titleHeight: 120, subtitleWidth: 72, subtitleHeight: 54, bodyWidth: 100, bodyHeight: 260 });
  }

  return (
    <section className="general-slide-editor">
      <div className="general-editor-heading">
        <div>
          <p className="eyebrow">Text slide editor</p>
          <h2>Edit slide</h2>
          <p className="general-editor-help">Type directly in the slide. Drag the visible Move handles to reposition a title, subtitle, or text area.</p>
        </div>
        <select value={slide.layout} aria-label="Slide layout" onChange={(event) => update({ layout: event.target.value as GeneralSlideLayout })}>
          <option value="title-body">Title + body</option>
          <option value="title-only">Title only</option>
          <option value="full-text">Full-screen text</option>
          <option value="scripture">Scripture</option>
          <option value="quote">Quote / message</option>
          <option value="announcement">Announcement</option>
        </select>
      </div>
      <div className="general-editor-fields">
        <input value={slide.reference} aria-label="Slide reference" placeholder="Reference, for example Matthew 6:9-13" onChange={(event) => update({ reference: event.target.value })} />
      </div>
      <div className="general-editor-toolbar" aria-label="Text formatting">
        <div className="editor-tool-group">
          <span className="editor-tool-label">Body</span>
          <button type="button" title="Bold" onMouseDown={(event) => { event.preventDefault(); format('bold'); }}><strong>B</strong></button>
          <button type="button" title="Italic" onMouseDown={(event) => { event.preventDefault(); format('italic'); }}><em>I</em></button>
          <button type="button" title="Underline" onMouseDown={(event) => { event.preventDefault(); format('underline'); }}><u>U</u></button>
          <button type="button" className="highlight-action" title="Highlight selected text" onMouseDown={(event) => { event.preventDefault(); format('hiliteColor', slide.highlightColor); }}>Highlight</button>
          <button type="button" title="Add hyperlink to selected text" onMouseDown={(event) => { event.preventDefault(); format('createLink'); }}>Link</button>
          <button type="button" title="Remove hyperlink from selected text" onMouseDown={(event) => { event.preventDefault(); format('unlink'); }}>Unlink</button>
          <button type="button" title="Align left" onMouseDown={(event) => { event.preventDefault(); format('justifyLeft'); }}>L</button>
          <button type="button" title="Align center" onMouseDown={(event) => { event.preventDefault(); format('justifyCenter'); }}>C</button>
          <button type="button" title="Align right" onMouseDown={(event) => { event.preventDefault(); format('justifyRight'); }}>R</button>
          <button type="button" title="Undo" onMouseDown={(event) => { event.preventDefault(); format('undo'); }}>↶</button>
          <button type="button" title="Redo" onMouseDown={(event) => { event.preventDefault(); format('redo'); }}>↷</button>
          <select title="Body font family" value={slide.fontFamily} onChange={(event) => update({ fontFamily: event.target.value })}>
            <option value="Georgia, serif">Georgia</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
          </select>
          <input title="Body font size" aria-label="Body font size" type="number" inputMode="numeric" min="20" max="96" value={sizeDrafts.body} onChange={(event) => changeSize('body', 'fontSize', event.target.value, 20, 96)} onBlur={() => commitSize('body', 'fontSize', 20, 96, 30)} />
          <label className="editor-color-picker"><span>Body color</span><input title="Body text color" aria-label="Body text color" type="color" value={slide.textColor} onChange={(event) => update({ textColor: event.target.value })} /></label>
          <label className="editor-color-picker"><span>Highlight</span><input title="Highlight color" aria-label="Highlight color" type="color" value={slide.highlightColor} onChange={(event) => update({ highlightColor: event.target.value })} /></label>
        </div>
        <div className="editor-tool-group">
          <span className="editor-tool-label">Title</span>
          <input title="Title font size" aria-label="Title font size" type="number" inputMode="numeric" min="24" max="120" value={sizeDrafts.title} onChange={(event) => changeSize('title', 'titleFontSize', event.target.value, 24, 120)} onBlur={() => commitSize('title', 'titleFontSize', 24, 120, 44)} />
          <select title="Title alignment" aria-label="Title alignment" value={slide.titleAlign || 'center'} onChange={(event) => update({ titleAlign: event.target.value as GeneralTextAlign })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
          <label className="editor-color-picker"><span>Color</span><input title="Title color" aria-label="Title color" type="color" value={slide.titleColor || slide.textColor} onChange={(event) => update({ titleColor: event.target.value })} /></label>
        </div>
        <div className="editor-tool-group">
          <span className="editor-tool-label">Subtitle</span>
          <input title="Subtitle font size" aria-label="Subtitle font size" type="number" inputMode="numeric" min="16" max="72" value={sizeDrafts.subtitle} onChange={(event) => changeSize('subtitle', 'subtitleFontSize', event.target.value, 16, 72)} onBlur={() => commitSize('subtitle', 'subtitleFontSize', 16, 72, 22)} />
          <select title="Subtitle alignment" aria-label="Subtitle alignment" value={slide.subtitleAlign || 'center'} onChange={(event) => update({ subtitleAlign: event.target.value as GeneralTextAlign })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
          <label className="editor-color-picker"><span>Color</span><input title="Subtitle color" aria-label="Subtitle color" type="color" value={slide.subtitleColor || slide.textColor} onChange={(event) => update({ subtitleColor: event.target.value })} /></label>
        </div>
        <div className="editor-tool-group">
          <span className="editor-tool-label">Slide</span>
          <select title="Body alignment" aria-label="Body alignment" value={slide.bodyAlign || 'left'} onChange={(event) => update({ bodyAlign: event.target.value as GeneralTextAlign })}>
            <option value="left">Body left</option><option value="center">Body center</option><option value="right">Body right</option>
          </select>
          <label className="editor-color-picker"><span>Background</span><input title="Slide background" aria-label="Slide background" type="color" value={slide.background} onChange={(event) => update({ background: event.target.value })} /></label>
          {slide.showTitle === false ? <button type="button" title="Add title box" onClick={() => update({ showTitle: true })}>Add title box</button> : <button type="button" title="Delete title box" onClick={() => update({ showTitle: false, title: '' })}>Delete title box</button>}
          {slide.showSubtitle === false ? <button type="button" title="Add subtitle box" onClick={() => update({ showSubtitle: true })}>Add subtitle box</button> : <button type="button" title="Delete subtitle box" onClick={() => update({ showSubtitle: false, subtitle: '' })}>Delete subtitle box</button>}
          {slide.showBody === false ? <button type="button" title="Add body box" onClick={() => update({ showBody: true })}>Add body box</button> : <button type="button" title="Delete body box" onClick={() => update({ showBody: false, bodyHtml: '' })}>Delete body box</button>}
          <button type="button" title="Reset slide layout" onClick={resetLayout}><RefreshCw size={14} /> Reset layout</button>
        </div>
      </div>
      <div ref={stageRef} className={`general-editor-stage general-slide-layout-${slide.presentationLayout || slide.layout} ${shapeInsertKind || selectedShapeIds.length ? 'shape-editing' : ''}`} style={{ background: slide.background, color: slide.textColor, fontFamily: slide.fontFamily, '--general-slide-font-size': `${slide.fontSize}px` } as React.CSSProperties} aria-label="Editable slide canvas">
         <MediaSlideObjects audio={slide.audioObjects} video={slide.videoObjects} editable selectedIds={selectedMediaIds} onSelectionChange={onMediaSelectionChange} onChange={(audioObjects, videoObjects) => onChange({ ...slide, audioObjects, videoObjects })} />
         <AdvancedSlideObjects table={slide.tableObjects} chart={slide.chartObjects} diagram={slide.diagramObjects} readonly={false} onTableChange={(tableObjects) => onChange({ ...slide, tableObjects })} onChartChange={(chartObjects) => onChange({ ...slide, chartObjects })} onDiagramChange={(diagramObjects) => onChange({ ...slide, diagramObjects })} />
         <ShapeEditorOverlay shapes={slide.shapeObjects || []} images={slide.imageObjects || []} texts={slide.textObjects || []} groups={slide.groupObjects || []} selectedIds={selectedShapeIds} selectedGroupIds={selectedGroupIds} insertKind={shapeInsertKind} snapEnabled={snapEnabled} onChange={(shapeObjects, groupObjects, imageObjects, textObjects) => onChange({ ...slide, shapeObjects, ...(groupObjects ? { groupObjects } : {}), ...(imageObjects ? { imageObjects } : {}), ...(textObjects ? { textObjects } : {}) })} onSelectionChange={onShapeSelectionChange || (() => undefined)} onGroupSelectionChange={onGroupSelectionChange} onInsertComplete={onShapeInsertComplete} onUndo={onUndo} onRedo={onRedo} />
         <ImageEditorOverlay images={slide.imageObjects || []} selectedIds={selectedImageIds} onSelectionChange={onImageSelectionChange || (() => undefined)} onChange={(imageObjects) => onChange({ ...slide, imageObjects })} />
         <TextEditorOverlay texts={slide.textObjects || []} selectedIds={selectedTextIds} insertMode={textInsertMode} onChange={(textObjects) => onChange({ ...slide, textObjects })} onSelectionChange={onTextSelectionChange || (() => undefined)} onInsertComplete={onTextInsertComplete} onHistoryStart={onHistoryStart} onHistoryCommit={onHistoryCommit} onHistoryCancel={onHistoryCancel} />
         <DrawingOverlay drawings={slide.drawingObjects || []} active={drawingMode} color={drawingColor} width={drawingWidth} onChange={(drawingObjects) => onChange({ ...slide, drawingObjects })} />
        {slide.showTitle !== false && <div className="general-editor-text-box general-editor-title-box" style={{ width: `${boxSizes.titleWidth}%`, height: `${boxSizes.titleHeight}px`, transform: `translate(${dragOffsets.titleX}px, ${dragOffsets.titleY}px)` }}>
          <span className="general-editor-move-handle" title="Move title box" aria-label="Move title box" onPointerDown={(event) => beginDrag('title', event)}>Move</span>
          <div
            ref={titleRef}
            className={`general-editor-placeholder ${activePlaceholder === 'title' ? 'is-editing' : ''}`}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Click to add a title"
            onInput={(event) => update({ title: event.currentTarget.textContent || '' })}
            onKeyDown={selectAllEditable}
            onFocus={() => setActivePlaceholder('title')}
            onBlur={() => setActivePlaceholder(null)}
            style={{ color: slide.titleColor || slide.textColor, fontSize: `${fitSizes.title}px`, textAlign: slide.titleAlign || 'center' }}
            role="textbox"
            aria-label="Slide title"
          />
          {fitWarnings.title && <span className="general-editor-overflow-warning general-editor-overflow-warning-title" role="status">Title is below the readable fitting limit.</span>}
          <span className="general-editor-resize-handle general-editor-resize-bottom-right" title="Resize title box" aria-label="Resize title box" onPointerDown={(event) => beginResize('title', 'bottom-right', event)} />
        </div>}
        {slide.showSubtitle !== false && <div className="general-editor-text-box general-editor-subtitle-box" style={{ width: `${boxSizes.subtitleWidth}%`, height: `${boxSizes.subtitleHeight}px`, transform: `translate(${dragOffsets.subtitleX}px, ${dragOffsets.subtitleY}px)` }}>
          <span className="general-editor-move-handle" title="Move subtitle box" aria-label="Move subtitle box" onPointerDown={(event) => beginDrag('subtitle', event)}>Move</span>
          <div
            ref={subtitleRef}
            className={`general-editor-placeholder ${activePlaceholder === 'subtitle' ? 'is-editing' : ''}`}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Click to add a subtitle"
            onInput={(event) => update({ subtitle: event.currentTarget.textContent || '' })}
            onKeyDown={selectAllEditable}
            onFocus={() => setActivePlaceholder('subtitle')}
            onBlur={() => setActivePlaceholder(null)}
            style={{ color: slide.subtitleColor || slide.textColor, fontSize: `${fitSizes.subtitle}px`, textAlign: slide.subtitleAlign || 'center' }}
            role="textbox"
            aria-label="Slide subtitle"
          />
          <span className="general-editor-resize-handle general-editor-resize-bottom-right" title="Resize subtitle box" aria-label="Resize subtitle box" onPointerDown={(event) => beginResize('subtitle', 'bottom-right', event)} />
        </div>}
        {slide.showBody !== false && <div className="general-editor-body-box" style={{ width: `${boxSizes.bodyWidth}%`, minHeight: `${boxSizes.bodyHeight}px`, transform: `translate(${dragOffsets.bodyX}px, ${dragOffsets.bodyY}px)` }}>
          <span className="general-editor-move-handle" title="Move body box" aria-label="Move body box" onPointerDown={(event) => beginDrag('body', event)}>Move</span>
          <div
            ref={editorRef}
            className={`general-editor-content ${activePlaceholder === 'body' ? 'is-editing' : ''}`}
            contentEditable
            suppressContentEditableWarning
            onInput={(event) => {
              update({ bodyHtml: normalizeGeneralBodyHtml(event.currentTarget.innerHTML) });
              window.requestAnimationFrame(fitPlaceholders);
            }}
            onKeyDown={selectAllEditable}
            onFocus={() => setActivePlaceholder('body')}
            onBlur={() => setActivePlaceholder(null)}
            data-placeholder="Click to add text"
            style={{ fontSize: `${fitSizes.body}px` }}
            role="textbox"
            aria-label="Slide body"
          />
          {fitWarnings.body && <span className="general-editor-overflow-warning" role="status">Text exceeds the readable slide limit. Shorten it or continue on another slide.</span>}
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
            <span key={corner} className={`general-editor-resize-handle general-editor-resize-${corner}`} title={`Resize body box from ${corner}`} aria-label={`Resize body box from ${corner}`} onPointerDown={(event) => beginResize('body', corner, event)} />
          ))}
        </div>}
      </div>
    </section>
  );
}

type AuthContextValue = { user: AuthUser | null; loading: boolean; error: string; sessionExpired: boolean; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string, displayName: string) => Promise<void>; logout: () => Promise<void>; };
const AuthContext = createContext<AuthContextValue | null>(null);
function AuthProvider({ children }: { children: React.ReactNode }) { const [user, setUser] = useState<AuthUser | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [sessionExpired, setSessionExpired] = useState(false); useEffect(() => onSessionExpired(() => { setUser(null); setSessionExpired(true); setError('Your session expired. Please sign in again.'); }), []); useEffect(() => { restoreSession().then((restoredUser) => { setUser(restoredUser); setSessionExpired(false); }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, []); async function login(email: string, password: string) { setError(''); setSessionExpired(false); try { setUser((await loginAccount(email, password)).user); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); throw reason; } } async function register(email: string, password: string, displayName: string) { setError(''); setSessionExpired(false); try { setUser((await registerAccount(email, password, displayName)).user); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create account.'); throw reason; } } async function logout() { await logoutAccount(); setUser(null); setSessionExpired(false); } return <AuthContext.Provider value={{ user, loading, error, sessionExpired, login, register, logout }}>{children}</AuthContext.Provider>; }
function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is missing'); return value; }
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
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const auth = useAuth();

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

  useEffect(() => {
    let cancelled = false;
    const checkBackend = () => {
      fetch(apiUrl('/health'), { headers: { Accept: 'application/json' } })
        .then((response) => {
          if (!cancelled) setBackendStatus(response.ok ? 'connected' : 'unavailable');
        })
        .catch(() => !cancelled && setBackendStatus('unavailable'));
    };
    checkBackend();
    const intervalId = window.setInterval(checkBackend, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
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
              <NavButton to="/text-slides" icon={FileText} active={path === '/text-slides'} onClick={navigate}>Text Slides</NavButton>
              <NavButton to="/favorites" icon={Heart} active={path === '/favorites'} onClick={navigate}>Favorites</NavButton>

              <NavButton to="/playlists" icon={ListMusic} active={path === '/playlists'} onClick={navigate}>Playlists</NavButton>
              <NavButton to="/account" icon={Settings} active={path === '/account'} onClick={navigate}>Account</NavButton>              <NavButton to="/support" icon={HeartHandshake} active={path === '/support'} onClick={navigate}>Support the work</NavButton>
              <NavButton to="/settings" icon={Settings} active={path === '/settings'} onClick={navigate}>Settings</NavButton>
            </nav>
            <div className="account-actions">
              <span className={`backend-badge backend-${backendStatus}`} title={`Backend: ${backendStatus}`}>
                <Wifi size={14} /> {backendStatus === 'checking' ? 'Backend...' : backendStatus === 'connected' ? 'Backend connected' : 'Backend unavailable'}
              </span>
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
  const { user } = useAuth();
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
        if (user) {
          const hymnId = hymnIdForApi(id);
          authRequest<Array<{ hymnId: number | string }>>('/me/favorites').then((items) => setFavorites(items.map((item) => String(item.hymnId)))).catch(() => {});
          if (hymnId) authRequest('/me/history/' + hymnId, { method: 'POST' }).catch(() => {});
        }

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
  }, [id, user]);

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

  async function toggleFavorite() {
    if (!user) { setStatus('Sign in to sync favorites.'); navigate('/account'); return; }
    const hymnId = hymnIdForApi(currentSong);
    if (!hymnId) { setStatus('This hymn cannot be synced because it has no server ID.'); return; }
    try { await authRequest('/me/favorites/' + hymnId, { method: isFavorited ? 'DELETE' : 'PUT' }); setFavorites(isFavorited ? favorites.filter((item) => item !== currentSong.id) : [...favorites, currentSong.id]); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to update favorite.'); }
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
  const isProjectionWindow = new URLSearchParams(location.search).get('projection') === '1' || location.pathname === '/presentations/audience' || location.pathname === '/app/presentations/audience';
  const [songs, setSongs] = usePresentationSongs();
  const [projectionItems, setProjectionItems] = useState<PresentationItem[]>(readPresentationItems);
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
  const [audienceFallbackUrl, setAudienceFallbackUrl] = useState<string | null>(null);
  const [presenterFullscreen, setPresenterFullscreen] = useState(false);
  const [showSlideOverview, setShowSlideOverview] = useState(false);
  const [projectionEnded, setProjectionEnded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [documentName, setDocumentName] = useState('');
  const presenterRef = useRef<HTMLElement | null>(null);
  const audienceWindowRef = useRef<Window | null>(null);
  const projectionChannelRef = useRef<BroadcastChannel | null>(null);
  const audienceReceiverReadyRef = useRef(false);
  const projectionStateRef = useRef<ProjectionState | null>(null);
  const selectedItem = songs[selectedIndex] || null;
  const slideSong = selectedItem?.type === 'song' ? selectedItem.song : null;
  const slideText = selectedItem?.type === 'text' ? selectedItem.slide : null;
  const projectionItem = projectionItems[selectedIndex] || projectionItems[0] || null;

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
    let readyTimer: number | undefined;
    const sendReady = () => {
      if (!isProjectionWindow) return;
      const message: ProjectionReadyMessage = { type: 'morija-projection-ready', audience: 'songs', fullscreen: Boolean(document.fullscreenElement) };
      channel?.postMessage(message);
      window.opener?.postMessage(message, window.location.origin);
    };
    const onMessage = (event: MessageEvent<ProjectionMessage>) => {
      if (event.origin && event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'morija-projection-ready' && message.audience === 'songs' && !isProjectionWindow) {
        audienceReceiverReadyRef.current = true;
        setAudienceWindowOpen(true);
        setStatus(message.fullscreen
          ? 'Song audience is ready in browser fullscreen.'
          : 'Song audience is ready, but browser fullscreen was not granted. Use the browser fullscreen control or F11 if needed.');
        if (audienceWindowRef.current && !audienceWindowRef.current.closed) {
          void requestAudienceWindowFullscreen(audienceWindowRef.current);
        }
        sendProjectionState();
        return;
      }

      if (message.type === 'presentation-command') {
        if (message.command === 'audience-closed' && !isProjectionWindow) {
          audienceReceiverReadyRef.current = false;
          audienceWindowRef.current = null;
          setAudienceWindowOpen(false);
          return;
        }

        if (message.command === 'end-projection') {
          if (isProjectionWindow) {
            setPointerMode('off');
            const closeMode = audienceCloseMode(Boolean(window.opener));
            if (closeMode === 'close-window') {
              // This window was created by the presenter. Close it immediately so
              // cancellation cannot leave a blank audience page on the projector.
              window.close();
            } else {
              // An Edge --app window normally has no opener and may reject
              // window.close(). Try it, then leave a clear local fallback.
              window.close();
              if (!window.closed) {
                void exitAppFullscreen().finally(() => setProjectionEnded(true));
              }
            }
          } else {
            setPresenting(false);
            setAudienceWindowOpen(false);
            setShowSlideOverview(false);
            setStatus('Projection cancelled.');
          }
          return;
        }
        return;
      }

      if (message.type === 'presentation-audience-event' && !isProjectionWindow) {
        if (message.event === 'scroll-progress' && typeof message.scrollProgress === 'number') {
          setPresentationScrollProgress(clampNumber(message.scrollProgress, 0, 1));
        }
        return;
      }

      if (message.type !== 'presentation-state' || !isProjectionWindow) return;
      const state = message;
      if (readyTimer !== undefined) {
        window.clearInterval(readyTimer);
        readyTimer = undefined;
      }
      setProjectionEnded(false);
      setProjectionItems(state.items);
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
    if (isProjectionWindow) document.addEventListener('fullscreenchange', sendReady);
    sendReady();
    if (isProjectionWindow) readyTimer = window.setInterval(sendReady, 1000);
    return () => {
      if (readyTimer !== undefined) window.clearInterval(readyTimer);
      channel?.close();
      projectionChannelRef.current = null;
      window.removeEventListener('message', onMessage);
      if (isProjectionWindow) document.removeEventListener('fullscreenchange', sendReady);
    };
  // The channel is intentionally created once per window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectionWindow]);

  function getProjectionState(selectedIndexOverride = selectedIndex): ProjectionState {
    return {
      type: 'presentation-state',
      items: songs,
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
    const onStorage = () => setProjectionItems(readPresentationItems());
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
      if (!isProjectionWindow) {
        setPresenterFullscreen(fullscreen);
      }
    };
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isProjectionWindow]);

  useEffect(() => {
    if (isProjectionWindow || !audienceWindowOpen) return undefined;
    const checkAudienceWindow = () => {
      if (!audienceWindowRef.current || audienceWindowRef.current.closed) {
        audienceWindowRef.current = null;
        setAudienceWindowOpen(false);
      }
    };
    const intervalId = window.setInterval(checkAudienceWindow, 800);
    return () => window.clearInterval(intervalId);
  }, [audienceWindowOpen, isProjectionWindow]);

  useEffect(() => {
    if (!isProjectionWindow) return undefined;

    let fullscreenRetryTimer: number | undefined;
    const enterFullscreen = () => {
      if (document.fullscreenElement) return;
      void requestProjectionFullscreen().catch(() => {});
    };
    const retryFromUserActivation = () => {
      enterFullscreen();
      if (document.fullscreenElement && fullscreenRetryTimer !== undefined) {
        window.clearTimeout(fullscreenRetryTimer);
        fullscreenRetryTimer = undefined;
      }
    };

    // Opening a popup does not transfer fullscreen permission consistently across browsers.
    // Try immediately, then use the first interaction in the audience window as a guaranteed retry.
    enterFullscreen();
    window.addEventListener('focus', enterFullscreen);
    window.addEventListener('pointerdown', retryFromUserActivation, true);
    window.addEventListener('keydown', retryFromUserActivation, true);
    fullscreenRetryTimer = window.setTimeout(enterFullscreen, 250);

    return () => {
      window.removeEventListener('focus', enterFullscreen);
      window.removeEventListener('pointerdown', retryFromUserActivation, true);
      window.removeEventListener('keydown', retryFromUserActivation, true);
      if (fullscreenRetryTimer !== undefined) window.clearTimeout(fullscreenRetryTimer);
    };
  }, [isProjectionWindow]);

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

  function saveSongs(next: PresentationItem[]) {
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

  function dropPresentationItem(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const next = [...songs];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    saveSongs(next);
    setSelectedIndex(targetIndex);
    setDraggedIndex(null);
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
    saveSongs(result.items);
    if (result.added) setSelectedIndex(result.items.length - 1);
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  function addSearchSong(song: Song) {
    const result = addPresentationSong(song);
    saveSongs(result.items);
    if (result.added) setSelectedIndex(result.items.length - 1);
    setStatus(result.added ? 'Added to presentation' : 'Already in presentation');
  }

  function addTextSlide(slide = createGeneralSlide()) {
    const item: PresentationItem = { type: 'text', entryId: randomId(), slide: presentationTextSlideFromSlide(slide) };
    const next = [...songs, item];
    saveSongs(next);
    setSelectedIndex(next.length - 1);
    setStatus('Text slide added to the presentation.');
  }

  function duplicateTextSlide(index: number) {
    const source = songs[index];
    if (!source || source.type !== 'text') return;
    const next = [...songs];
    next.splice(index + 1, 0, { type: 'text', entryId: randomId(), slide: presentationTextSlideFromSlide({ ...source.slide, id: randomId(), title: `${source.slide.title} copy` }) });
    saveSongs(next);
    setSelectedIndex(index + 1);
  }

  function saveCurrentTextDocument() {
    const textSlides = songs.filter((item): item is Extract<PresentationItem, { type: 'text' }> => item.type === 'text').map((item) => item.slide);
    if (textSlides.length === 0) {
      setStatus('Add a text slide before saving a document.');
      return;
    }
    const documents = readSavedTextDocuments();
    const title = documentName.trim() || textSlides[0].title || 'Untitled text document';
    const existing = documents.find((document) => document.title === title);
    const nextDocument: SavedTextDocument = { id: existing?.id || randomId(), title, slides: textSlides, updatedAt: Date.now() };
    writeSavedTextDocuments([nextDocument, ...documents.filter((document) => document.id !== nextDocument.id)]);
    setDocumentName(title);
    setStatus(`Saved text document: ${title}`);
  }

  function downloadTextDocument(document: SavedTextDocument) {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${document.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'morija-text-document'}.morija.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${document.title}.`);
  }

  function downloadCurrentTextDocument() {
    const textSlides = songs.filter((item): item is Extract<PresentationItem, { type: 'text' }> => item.type === 'text').map((item) => item.slide);
    if (textSlides.length === 0) {
      setStatus('Add a text slide before downloading a document.');
      return;
    }
    const title = documentName.trim() || textSlides[0].title || 'Untitled text document';
    downloadTextDocument({ id: randomId(), title, slides: textSlides, updatedAt: Date.now() });
  }

  function addSavedTextDocument(document: SavedTextDocument) {
    const additions = document.slides.map((slide) => ({
      type: 'text' as const,
      entryId: randomId(),
      slide: presentationTextSlideFromSlide(slide),
    }));
    const next = [...songs, ...additions];
    saveSongs(next);
    setSelectedIndex(Math.max(next.length - additions.length, 0));
    setStatus(`Added ${additions.length} slides from ${document.title}.`);
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
  const savedTextDocuments = readSavedTextDocuments();
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
    if (audienceReceiverReadyRef.current) {
      setAudienceWindowOpen(true);
      setPresenting(true);
      sendProjectionState(initialState);
      setStatus('Connected to the open audience window.');
      return;
    }

    const projectionUrl = `${window.location.origin}${window.location.pathname.startsWith('/app/') ? '/app/presentations/audience' : '/presentations/audience'}?projection=1`;
    setAudienceFallbackUrl(projectionUrl);
    const existing = audienceWindowRef.current;
    const audienceWindow = existing && !existing.closed
      ? existing
      : window.open(projectionUrl, 'morija-audience', audienceWindowFeatures());

    if (!audienceWindow) {
      setStatus('The audience window was blocked. Allow pop-ups, or open the audience route manually.');
      setPresenting(false);
      setAudienceWindowOpen(false);
      return;
    }

    audienceWindowRef.current = audienceWindow;
    setAudienceWindowOpen(true);
    setPresenting(true);
    audienceWindow.focus();
    void requestAudienceWindowFullscreen(audienceWindow);
    setStatus('Audience screen opened. Browser fullscreen may require the audience window’s fullscreen control or F11.');
    moveAudienceWindowToPresentationDisplay(audienceWindow)
      .then((moved) => {
        if (moved) {
          audienceWindow.focus();
          void requestAudienceWindowFullscreen(audienceWindow);
          setStatus('Audience screen moved to the external display.');
        }
      })
      .catch(() => {});
    window.setTimeout(() => sendProjectionState(initialState), 500);
  }

  function cancelProjection() {
    const audienceWindow = audienceWindowRef.current;
    sendProjectionCommand('end-projection');
    if (audienceWindow && !audienceWindow.closed) {
      window.setTimeout(() => {
        if (!audienceWindow.closed) audienceWindow.close();
      }, 150);
    }
    audienceWindowRef.current = null;
    setAudienceWindowOpen(false);
    setPresenting(false);
    setShowSlideOverview(false);
    setProjectionEnded(false);
    setPresentationScrollProgress(0);
    setPointerMode('off');
    setStatus('Projection cancelled.');
  }

  function startPresentation(index: number) {
    const position = startSongProjection(songs.length, index, index !== 0);
    const initialState = getProjectionState(position.selectedIndex);
    setSelectedIndex(position.selectedIndex);
    setPresenting(true);
    openAudienceWindow(initialState);
  }

  function selectPresentationSlide(index: number) {
    setSelectedIndex(index);
    setPresentationScrollProgress(0);
    setShowSlideOverview(false);
  }

  async function togglePresenterTaskbar() {
    if (document.fullscreenElement) {
      await exitAppFullscreen().catch(() => {});
      setPresenterFullscreen(false);
      setStatus('Taskbar shown on this screen.');
      return;
    }

    try {
      const fullscreenTarget = presenterRef.current ?? document.documentElement;
      const requestFullscreen = fullscreenTarget.requestFullscreen;
      if (!requestFullscreen) {
        setStatus('Fullscreen is not available in this browser.');
        return;
      }
      await requestFullscreen.call(fullscreenTarget);
      setPresenterFullscreen(true);
      setStatus('Taskbar hidden on this screen.');
    } catch {
      setStatus('Your browser blocked fullscreen. Click Hide taskbar again from this presenter screen.');
    }
  }

  if (isProjectionWindow) {
    return (
      <section className="presentation-projection-window">
        {projectionEnded ? (
          <div className="projection-ended-state">
            <MonitorUp size={34} />
            <p>Projection cancelled</p>
          </div>
        ) : projectionItem?.type === 'song' ? (
          <PresentationSlideCanvas
            song={projectionItem.song}
            background={presentationBackground}
            zoom={presentationScreenZoom}
            zoomOrigin={presentationZoomOrigin}
            scrollProgress={presentationScrollProgress}
            onScrollProgressChange={handleAudienceScrollProgress}
            pointer={pointer}
            pointerMode={pointerMode}
          />
        ) : projectionItem?.type === 'text' ? (
          <GeneralSlideCanvas slide={projectionItem.slide} projection />
        ) : (
          <div className="projection-empty-state">
            <MonitorUp size={34} />
            <p>Waiting for presenter</p>
          </div>
        )}
      </section>
    );
  }

  if (presenting && selectedItem) {
    return (
      <section ref={presenterRef} className="presentation-presenter" onWheel={handlePresentationWheel}>
        <header className="presentation-presenter-header">
          <div>
            <p className="eyebrow"><Presentation size={16} /> Presenter view</p>
            <h1>{presentationItemTitle(selectedItem)}</h1>
            <span>{selectedIndex + 1} of {songs.length} · {presentationItemKind(selectedItem)}</span>
          </div>
          <div className="presentation-presenter-actions">
            <button className={`secondary-action ${showSlideOverview ? 'is-live' : ''}`} onClick={() => setShowSlideOverview((visible) => !visible)}>
              <ListMusic size={17} />
              {showSlideOverview ? 'Hide slides' : 'All slides'}
            </button>
            <button className={`secondary-action ${audienceWindowOpen ? 'is-live' : ''}`} onClick={() => openAudienceWindow()}>
              {audienceWindowOpen ? <Radio size={17} /> : <MonitorUp size={17} />}
              {audienceWindowOpen ? 'Audience live' : 'Open audience'}
            </button>
            <button className="secondary-action" disabled={!audienceWindowOpen} onClick={sendAudienceToProjector}>
              <Monitor size={17} />
              Send to projector
            </button>
            <button className="secondary-action" onClick={togglePresenterTaskbar}>
              {presenterFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              {presenterFullscreen ? 'Show taskbar' : 'Hide taskbar'}
            </button>
            <button className="ghost-action" onClick={cancelProjection}><X size={17} /> Cancel projection</button>
          </div>
        </header>

        {showSlideOverview && (
          <div className="presenter-slide-overview-backdrop" onClick={() => setShowSlideOverview(false)}>
            <section className="presenter-slide-overview" aria-label="All presentation slides" onClick={(event) => event.stopPropagation()}>
              <div className="presenter-slide-overview-header">
                <div>
                  <p className="eyebrow">All slides</p>
                  <h2>{songs.length} items in this presentation</h2>
                </div>
                <button className="icon-button" title="Close all slides" onClick={() => setShowSlideOverview(false)}><X size={17} /></button>
              </div>
              <div className="presenter-slide-overview-grid">
                {songs.map((item, index) => (
                  <button
                    key={item.entryId}
                    className={`presenter-slide-overview-item ${index === selectedIndex ? 'active' : ''}`}
                    onClick={() => selectPresentationSlide(index)}
                  >
                    <span>{index + 1}</span>
                    <strong>{presentationItemTitle(item)}</strong>
                    {presentationItemSubtitle(item) && <small>{presentationItemSubtitle(item)}</small>}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {selectedItem.type === 'text' && (
          <div className="general-presenter-editor">
            <GeneralSlideEditor
              slide={selectedItem.slide}
              onChange={(slide) => saveSongs(songs.map((item, index) => index === selectedIndex ? { ...item, slide, entryId: item.entryId } : item))}
            />
          </div>
        )}

        <div className="presentation-presenter-grid">
          <section className="presenter-main-panel">
            <div className="presenter-panel-label"><span>Now showing</span><span className="live-dot">LIVE</span></div>
            {selectedItem.type === 'song' ? (
              <PresentationSlideCanvas
                song={selectedItem.song}
                background={presentationBackground}
                zoom={presentationScreenZoom}
                zoomOrigin={presentationZoomOrigin}
                scrollProgress={presentationScrollProgress}
                onScrollProgressChange={setPresentationScrollProgress}
                pointer={pointer}
                pointerMode={pointerMode}
                onPointerMove={handleSlidePointerMove}
              />
            ) : (
              <GeneralSlideCanvas slide={selectedItem.slide} />
            )}
          </section>
          <aside className="presenter-side-panel">
            <div className="presenter-next-card">
              <div className="presenter-panel-label"><span>Next up</span><span>{selectedIndex < songs.length - 1 ? selectedIndex + 2 : 'End'}</span></div>
              {songs[selectedIndex + 1] ? (
                <button className="presenter-next-preview" onClick={() => selectPresentationSlide(selectedIndex + 1)}>
                  <strong>{presentationItemTitle(songs[selectedIndex + 1])}</strong>
                  <span>{presentationItemKind(songs[selectedIndex + 1])} / {presentationItemSubtitle(songs[selectedIndex + 1])}</span>
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
          <button className="presentation-nav-button" disabled={selectedIndex === 0} onClick={() => selectPresentationSlide(selectedIndex - 1)}><ChevronLeft size={18} /> Previous</button>
          <div className="presenter-slide-strip">
            {songs.map((item, index) => (
              <button key={item.entryId} className={index === selectedIndex ? 'active' : ''} onClick={() => selectPresentationSlide(index)} title={presentationItemTitle(item)}><span>{index + 1}</span><small>{presentationItemTitle(item)}</small></button>
            ))}
          </div>
          <button className="presentation-nav-button" disabled={selectedIndex >= songs.length - 1} onClick={() => selectPresentationSlide(selectedIndex + 1)}>Next <ChevronRight size={18} /></button>
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
          <button className="primary-action" disabled={!songs.length} onClick={() => startPresentation(0)}><Play size={18} /> Present</button>
          <button className="secondary-action" disabled={!songs.length} onClick={() => startPresentation(selectedIndex)}><MonitorUp size={18} /> From current</button>
          <button className="ghost-action" disabled={!songs.length} onClick={clearPresentation}><Trash2 size={18} /> Clear</button>
        </div>
      </div>
      {status && <p className="status">{status}</p>}
      {audienceFallbackUrl && !audienceWindowOpen && (
        <p className="status"><a href={audienceFallbackUrl} target="_blank" rel="noreferrer">Open the audience screen manually</a></p>
      )}
      <div className="presentation-builder">
        <section className="presentation-list">
          <div className="presentation-panel-heading">
            <h2>Slide order</h2>
            <span className="count-pill">{songs.length} items</span>
          </div>
          {songs.length === 0 ? (
            <div className="presentation-empty">
              <Library size={36} />
              <strong>No presentation items yet</strong>
            </div>
          ) : (
            <div className="presentation-song-list">
              {songs.map((item, index) => (
                <div
                  key={item.entryId}
                  className={`presentation-song presentation-item-${item.type} ${index === selectedIndex ? 'active' : ''}`}
                  draggable
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropPresentationItem(index)}
                >
                  <button className="presentation-song-main" onClick={() => setSelectedIndex(index)}>
                    {item.type === 'text' && (
                      <span className="presentation-slide-thumbnail" aria-hidden="true">
                        <strong>{item.slide.title || 'Untitled'}</strong>
                        <small>{item.slide.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'Empty body'}</small>
                      </span>
                    )}
                    <span className="slide-number">{index + 1}</span>
                    <span>
                      <strong>{item.type === 'song' ? '🎵 ' : '📄 '}{presentationItemTitle(item)}</strong>
                      {presentationItemSubtitle(item) && <small>{presentationItemSubtitle(item)}</small>}
                    </span>
                  </button>
                  <div className="presentation-song-tools">
                    <button className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveSong(index, -1)}><ArrowUp size={17} /></button>
                    <button className="icon-button" title="Move down" disabled={index === songs.length - 1} onClick={() => moveSong(index, 1)}><ArrowDown size={17} /></button>
                    {item.type === 'text' && <button className="icon-button" title="Duplicate text slide" onClick={() => duplicateTextSlide(index)}><Copy size={17} /></button>}
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

function TextSlideProjectionView({ document: presentation, selectedSlideId, onSelectSlide }: { document: PresentationDocument; selectedSlideId: string | null; onSelectSlide: (id: string | null) => void }) {
  const visibleSlides = useMemo(() => presentation.slides.filter((item) => !item.hidden), [presentation.slides]);
  const initialIndex = Math.max(0, visibleSlides.findIndex((item) => item.id === selectedSlideId));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);
  const slide = visibleSlides[currentIndex] ?? visibleSlides[0] ?? null;

  useEffect(() => {
    const nextIndex = visibleSlides.findIndex((item) => item.id === selectedSlideId);
    if (nextIndex >= 0 && nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }
  }, [visibleSlides, selectedSlideId]);

  useEffect(() => {
    window.document.documentElement.dataset.projection = 'on';
    const requestFullscreen = window.document.documentElement.requestFullscreen;
    if (requestFullscreen) void requestFullscreen.call(window.document.documentElement, { navigationUI: 'hide' }).catch(() => {});
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('morija-text-presentation');
    let readyTimer: number | undefined;
    const sendReady = () => {
      const message: TextProjectionMessage = { type: 'morija-text-projection-ready', audience: 'text-slides', fullscreen: Boolean(document.fullscreenElement) };
      channel?.postMessage(message);
      window.opener?.postMessage(message, window.location.origin);
    };
    const syncActiveSlide = () => {
      const id = window.localStorage.getItem('text-slides:active-slide:v1');
      if (id && visibleSlides.some((item) => item.id === id)) onSelectSlide(id);
    };
    const handleProjectionKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest('input,textarea,button,a,[contenteditable="true"]'))) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        const message: TextProjectionMessage = { type: 'presentation-command', command: 'end-projection' };
        channel?.postMessage(message);
        window.opener?.postMessage(message, window.location.origin);
        if (window.opener) window.close();
        else {
          window.close();
          if (!window.closed) window.history.back();
        }
        return;
      }
      const direction = event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ' ? 1
        : event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1
        : 0;
      if (!direction) return;
      const nextSlideId = getVisibleSlideId(presentation, slide?.id || null, direction as -1 | 1);
      const nextIndex = visibleSlides.findIndex((candidate) => candidate.id === nextSlideId);
      const nextSlide = visibleSlides[nextIndex];
      if (nextSlide && nextIndex !== currentIndexRef.current) {
        event.preventDefault();
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        onSelectSlide(nextSlide.id);
      }
    };
    const handleWindowKey = (event: KeyboardEvent) => {
      handleProjectionKey(event);
    };
    const handleProjectionCommand = (event: MessageEvent<TextProjectionMessage>) => {
      if (event.origin && event.origin !== window.location.origin) return;
      if (event.data?.type !== 'presentation-command' || event.data.command !== 'end-projection') return;
      if (window.opener) window.close();
      else {
        window.close();
        if (!window.closed) window.history.back();
      }
    };
    window.addEventListener('storage', syncActiveSlide);
    window.addEventListener('keydown', handleWindowKey);
    window.addEventListener('message', handleProjectionCommand);
    channel?.addEventListener('message', handleProjectionCommand);
    document.addEventListener('fullscreenchange', sendReady);
    sendReady();
    readyTimer = window.setInterval(sendReady, 1000);
    const notifyClosed = () => {
      const message: TextProjectionMessage = { type: 'morija-text-audience-closed', audience: 'text-slides' };
      channel?.postMessage(message);
      window.opener?.postMessage(message, window.location.origin);
    };
    window.addEventListener('pagehide', notifyClosed);
    return () => {
      window.removeEventListener('storage', syncActiveSlide);
      window.removeEventListener('keydown', handleWindowKey);
      window.removeEventListener('message', handleProjectionCommand);
      channel?.removeEventListener('message', handleProjectionCommand);
      document.removeEventListener('fullscreenchange', sendReady);
      window.removeEventListener('pagehide', notifyClosed);
      if (readyTimer !== undefined) window.clearInterval(readyTimer);
      channel?.close();
      window.document.documentElement.dataset.projection = 'off';
    };
  }, [visibleSlides, onSelectSlide]);

  return <main className="text-slide-audience-view" aria-label="Text slide audience view" tabIndex={0} autoFocus>
    {slide ? <GeneralSlideCanvas key={`${slide.id}:${slide.transition.type}`} slide={presentationSlideToTextSlide(slide, createGeneralSlide({ id: slide.id }))} projection /> : <div className="projection-empty-state">No slide selected.</div>}
  </main>;
}

function TextSlideSorter({ items, selectedId, onSelect, onMove, onDuplicate, onDelete }: { items: Array<{ entryId: string; slide: GeneralSlide }>; selectedId: string | null; onSelect: (id: string) => void; onMove: (from: number, to: number) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  return <section className="text-slide-sorter" aria-label="Slide sorter">
    <div className="text-slide-sorter-heading"><div><span className="eyebrow">VIEW</span><h2>Slide sorter</h2></div><span>{items.length} slides</span></div>
    <div className="text-slide-sorter-grid">
      {items.map((item, index) => <article key={item.entryId} className={`text-slide-sorter-card ${item.entryId === selectedId ? 'active' : ''}`}>
        <button type="button" className="text-slide-sorter-preview" aria-label={`Select slide ${index + 1}`} onClick={() => onSelect(item.entryId)}><span className="text-slide-sorter-number">{index + 1}</span><GeneralSlideCanvas slide={item.slide} /></button>
        <div className="text-slide-sorter-meta"><strong>{item.slide.title || 'Untitled slide'}</strong><span>{item.slide.layout.replace('-', ' ')}</span></div>
        <div className="text-slide-sorter-actions"><button type="button" aria-label={`Move slide ${index + 1} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑</button><button type="button" aria-label={`Move slide ${index + 1} down`} disabled={index === items.length - 1} onClick={() => onMove(index, index + 1)}>↓</button><button type="button" aria-label={`Duplicate slide ${index + 1}`} onClick={() => onDuplicate(item.entryId)}>Duplicate</button><button type="button" aria-label={`Delete slide ${index + 1}`} disabled={items.length <= 1} onClick={() => onDelete(item.entryId)}>Delete</button></div>
      </article>)}
    </div>
  </section>;
}

function PrintPresentation({ presentation }: { presentation: PresentationDocument }) {
  return <main className="presentation-print-root" aria-label="Print-ready presentation">
    {presentation.slides.map((slide, index) => <section className="presentation-print-page" key={slide.id} aria-label={`Slide ${index + 1}`}>
      <GeneralSlideCanvas slide={presentationSlideToTextSlide(slide, createGeneralSlide({ id: slide.id }))} />
    </section>)}
  </main>;
}

function TextSlidesPage() {
  const editor = usePresentationDocument();
  const { user } = useAuth();
  const [cloudItems, setCloudItems] = useState<CloudPresentationSummary[]>([]);
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [cloudRevision, setCloudRevision] = useState<number | null>(null);
  const [cloudCanEdit, setCloudCanEdit] = useState(false);
  const [cloudState, setCloudState] = useState<'offline' | 'saved' | 'saving' | 'failed' | 'conflict'>('offline');
  const cloudSnapshotRef = useRef('');
  const cloudRequestRef = useRef(false);
  const [cloudShares, setCloudShares] = useState<CloudShare[]>([]);
  const [cloudVersions, setCloudVersions] = useState<CloudVersion[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [cloudPanelStatus, setCloudPanelStatus] = useState('');
  const isProjectionWindow = new URLSearchParams(window.location.search).get('projection') === '1' || window.location.pathname === '/text-slides/audience' || window.location.pathname === '/app/text-slides/audience';
  const [zoom, setZoom] = useState(65);
  const [viewMode, setViewMode] = useState<'editor' | 'sorter'>('editor');
  const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);
  const slideSelectionAnchorRef = useRef<string | null>(null);
  const [fitMode, setFitMode] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);
  const [fileStatus, setFileStatus] = useState('');
  const [textAudienceOpen, setTextAudienceOpen] = useState(false);
  const textAudienceWindowRef = useRef<Window | null>(null);
  const textAudienceReceiverReadyRef = useRef(false);
  const textProjectionChannelRef = useRef<BroadcastChannel | null>(null);
  const [shapeInsertKind, setShapeInsertKind] = useState<ShapeKind | null>(null);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [selectedTextIds, setSelectedTextIds] = useState<string[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [textInsertMode, setTextInsertMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#ef4444');
  const [drawingWidth, setDrawingWidth] = useState(4);
  const [commentDraft, setCommentDraft] = useState('');
  const [rehearsal, setRehearsal] = useState(() => ({ active: false, startedAt: 0, slideStartedAt: 0, elapsed: 0, durations: Object.fromEntries(editor.document.slides.filter((slide) => (slide.rehearsalDurationMs || 0) > 0).map((slide) => [slide.id, slide.rehearsalDurationMs || 0])) as Record<string, number> }));
  const rehearsalSlideRef = useRef<string | null>(null);
  const textItems = editor.document.slides.map((slide) => ({ type: 'text' as const, entryId: slide.id, slide: presentationSlideToTextSlide(slide, createGeneralSlide({ id: slide.id })) }));
  const selectedItem = textItems.find((item) => item.entryId === editor.selectedSlideId) ?? textItems[0] ?? null;
  const selectedShape = selectedItem?.slide.shapeObjects?.find((shape) => selectedShapeIds.includes(shape.id));
  const selectedAnimation = selectedItem?.slide.animations?.find((animation) => [...selectedShapeIds, ...selectedImageIds, ...selectedTextIds].includes(animation.objectId));
  const selectedAnimationType = selectedAnimation?.type === 'appear' || selectedAnimation?.type === 'fade' || selectedAnimation?.type === 'fly-in' ? selectedAnimation.type : 'none';
  const selectedAnimationDuration = selectedAnimation?.durationMs || 420;
  const slideIds = textItems.map((item) => item.entryId);
  useEffect(() => {
    if (!user) { setCloudItems([]); setCloudId(null); setCloudRevision(null); setCloudCanEdit(false); setCloudState('offline'); return; }
    let cancelled = false;
    listCloudPresentations().then((items) => { if (!cancelled) setCloudItems(items); }).catch(() => { if (!cancelled) setCloudState('failed'); });
    return () => { cancelled = true; };
  }, [user]);

  async function saveCloudNow() {
    if (!user || cloudRequestRef.current) return;
    cloudRequestRef.current = true; setCloudState('saving');
    const snapshot = JSON.stringify(editor.document);
    try {
      const result = cloudId && cloudRevision !== null ? await updateCloudPresentation(cloudId, cloudRevision, editor.document, editor.document.metadata.title) : await createCloudPresentation(editor.document.metadata.title || 'Untitled presentation', editor.document);
      setCloudId(result.id); setCloudRevision(result.revision); setCloudCanEdit(result.canEdit); cloudSnapshotRef.current = snapshot; editor.save(); setCloudState('saved');
      setCloudItems((items) => [{ id: result.id, title: result.title, revision: result.revision, ownerId: result.ownerId, permission: result.permission, createdAt: result.createdAt, updatedAt: result.updatedAt }, ...items.filter((item) => item.id !== result.id)]);
    } catch (error) { setCloudState(isRevisionConflict(error) ? 'conflict' : 'failed'); } finally { cloudRequestRef.current = false; }
  }

  async function openCloudPresentation(id: string) {
    try { const result = await loadCloudPresentation(id); await editor.importDocument(result.document); setCloudId(result.id); setCloudRevision(result.revision); setCloudCanEdit(result.canEdit); cloudSnapshotRef.current = JSON.stringify(result.document); setCloudState('saved'); setFileStatus(`Opened cloud presentation: ${result.title}`); }
    catch (error) { setFileStatus(error instanceof Error ? error.message : 'Unable to open cloud presentation'); }
  }

  async function reloadCloudPresentation() {
    if (!cloudId) return;
    try { const result = await loadCloudPresentation(cloudId); await editor.importDocument(result.document); setCloudRevision(result.revision); cloudSnapshotRef.current = JSON.stringify(result.document); setCloudState('saved'); setFileStatus('Reloaded the latest cloud revision.'); }
    catch (error) { setFileStatus(error instanceof Error ? error.message : 'Unable to reload cloud presentation'); }
  }

  async function loadCloudDetails() {
    if (!cloudId) return;
    setCloudPanelStatus('Loading cloud details…');
    try { const isOwner = cloudItems.find((item) => item.id === cloudId)?.permission === 'OWNER'; const versions = await listCloudVersions(cloudId); const shares = isOwner ? await listCloudShares(cloudId) : []; setCloudShares(shares); setCloudVersions(versions); setCloudPanelStatus(''); }
    catch (error) { setCloudPanelStatus(error instanceof Error ? error.message : 'Unable to load cloud details.'); }
  }
  async function addCloudShare() {
    if (!cloudId || !shareEmail.trim()) return;
    try { const share = await shareCloudPresentation(cloudId, shareEmail.trim(), sharePermission); setCloudShares((items) => [...items.filter((item) => item.id !== share.id && item.recipient.email !== shareEmail.trim()), share]); setShareEmail(''); setCloudPanelStatus('Collaborator access saved.'); }
    catch (error) { setCloudPanelStatus(error instanceof Error ? error.message : 'Unable to share presentation.'); }
  }
  async function changeCloudShare(share: CloudShare, permission: 'VIEW' | 'EDIT') {
    if (!cloudId) return;
    try { const updated = await updateCloudShare(cloudId, share.id, permission); setCloudShares((items) => items.map((item) => item.id === share.id ? updated : item)); }
    catch (error) { setCloudPanelStatus(error instanceof Error ? error.message : 'Unable to change permission.'); }
  }
  async function removeCloudShare(share: CloudShare) {
    if (!cloudId) return;
    try { await revokeCloudShare(cloudId, share.id); setCloudShares((items) => items.filter((item) => item.id !== share.id)); }
    catch (error) { setCloudPanelStatus(error instanceof Error ? error.message : 'Unable to revoke access.'); }
  }
  async function restoreVersion(version: CloudVersion) {
    if (!cloudId || cloudRevision === null || editor.saveState === 'unsaved') { setCloudPanelStatus('Save or keep your local edits before restoring a version.'); return; }
    try { const result = await restoreCloudVersion(cloudId, version.revision, cloudRevision); await editor.importDocument(result.document); setCloudRevision(result.revision); cloudSnapshotRef.current = JSON.stringify(result.document); setCloudVersions(await listCloudVersions(cloudId)); setCloudPanelStatus('Restored as revision ' + result.revision + '.'); }
    catch (error) { setCloudPanelStatus(isRevisionConflict(error) ? 'Restore conflict: your local document was preserved.' : error instanceof Error ? error.message : 'Unable to restore version.'); }
  }

  useEffect(() => {
    if (!user || !cloudId || !cloudCanEdit || cloudRevision === null || editor.saveState !== 'unsaved' || cloudRequestRef.current) return;
    const snapshot = JSON.stringify(editor.document);
    if (snapshot === cloudSnapshotRef.current) return;
    const timer = window.setTimeout(async () => {
      cloudRequestRef.current = true; setCloudState('saving');
      try { const result = await updateCloudPresentation(cloudId, cloudRevision, editor.document, editor.document.metadata.title); setCloudRevision(result.revision); cloudSnapshotRef.current = snapshot; editor.save(); setCloudState('saved'); }
      catch (error) { setCloudState(isRevisionConflict(error) ? 'conflict' : 'failed'); }
      finally { cloudRequestRef.current = false; }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [editor.document, editor.saveState, user, cloudId, cloudRevision]);

  function exportPresentation() {
    try {
      const blob = new Blob([serializePresentationDocument(editor.document)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${editor.document.metadata.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'presentation'}.morija.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      const mediaCount = editor.document.slides.reduce((count, slide) => count + slide.objects.filter((object) => object.type === 'audio' || object.type === 'video').length, 0); setFileStatus(mediaCount ? 'Presentation exported. Media metadata is included; media binaries remain in this browser IndexedDB store.' : 'Presentation exported');
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : 'Unable to export presentation');
    }
  }

  async function exportPowerPoint() {
    try {
      const blob = await exportPresentationToPptx(editor.document);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = (editor.document.metadata.title || 'presentation').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.pptx'; anchor.click(); URL.revokeObjectURL(url);
      const limitations = getPptxExportLimitations(editor.document); setFileStatus(limitations.length ? ('PowerPoint exported. ' + limitations.join(' ')) : 'PowerPoint exported.');
    } catch (error) { setFileStatus(error instanceof Error ? error.message : 'Unable to export PowerPoint'); }
  }

  async function importPowerPoint(file: File) {
    try {
      const result = await importPptx(await file.arrayBuffer());
      editor.importDocument(result.document);
      setFileStatus('PowerPoint imported. ' + result.limitations.join(' '));
    } catch (error) { setFileStatus(error instanceof Error ? error.message : 'Unable to import PowerPoint'); }
  }

  async function importPresentation(file: File) {
    try {
      editor.importDocument(await file.text());
      setFileStatus('Presentation imported');
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : 'Unable to import presentation');
    }
  }

  useEffect(() => {
    if (!fitMode || viewMode !== 'editor') return;
    const area = document.querySelector('.text-slides-editor-area');
    if (!(area instanceof HTMLElement)) return;
    const measure = () => {
      const nextZoom = fitPresentationZoomPercent(area.clientWidth, area.clientHeight);
      setZoom((previous) => previous === nextZoom ? previous : nextZoom);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [fitMode, viewMode]);

  useEffect(() => {
    setSelectedShapeIds([]); setSelectedGroupIds([]); setSelectedImageIds([]); setSelectedTextIds([]); setSelectedMediaIds([]); setTextInsertMode(false); setDrawingMode(false);
    if (rehearsal.active && rehearsalSlideRef.current && rehearsalSlideRef.current !== editor.selectedSlideId) {
      const elapsed = Math.max(0, Date.now() - rehearsal.slideStartedAt);
      editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === rehearsalSlideRef.current ? { ...slide, rehearsalDurationMs: (slide.rehearsalDurationMs || 0) + elapsed } : slide) }));
      setRehearsal((previous) => ({ ...previous, slideStartedAt: Date.now() }));
    }
    rehearsalSlideRef.current = editor.selectedSlideId;
  }, [editor.selectedSlideId]);

  useEffect(() => {
    if (!rehearsal.active) return;
    const timer = window.setInterval(() => setRehearsal((previous) => ({ ...previous, elapsed: Date.now() - previous.startedAt })), 250);
    return () => window.clearInterval(timer);
  }, [rehearsal.active]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('drawing-mode-change', { detail: { active: drawingMode, color: drawingColor, width: drawingWidth } }));
  }, [drawingMode, drawingColor, drawingWidth]);

  function insertTable() {
    if (!selectedItem) return;
    const tableId = createStableId('table');
    const rows = 3; const columns = 3;
    const cells = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => ({ id: tableId + '-r' + row + '-c' + column, text: row === 0 ? 'Column ' + (column + 1) : 'Value' })));
    const table = { id: tableId, type: 'table' as const, geometry: { x: 180, y: 180, width: 700, height: 260, rotation: 0, zIndex: 20 }, rows, columns, cells, headerRow: true, borderColor: '#64748b', borderWidth: 1 };
    updateSelectedSlide({ ...selectedItem.slide, tableObjects: [...(selectedItem.slide.tableObjects || []), table] });
  }

  function insertChart() {
    if (!selectedItem) return;
    const chart = { id: createStableId('chart'), type: 'chart' as const, geometry: { x: 220, y: 150, width: 620, height: 340, rotation: 0, zIndex: 21 }, chartType: 'bar' as const, title: 'Chart title', data: [{ label: 'A', value: 42 }, { label: 'B', value: 68 }, { label: 'C', value: 51 }], color: '#24104f' };
    updateSelectedSlide({ ...selectedItem.slide, chartObjects: [...(selectedItem.slide.chartObjects || []), chart] });
  }

  function insertDiagram() {
    if (!selectedItem) return;
    const diagramId = createStableId('diagram');
    const nodes = [{ id: diagramId + '-start', label: 'Start', kind: 'start-end' as const, x: 30, y: 120, width: 150, height: 60 }, { id: diagramId + '-process', label: 'Process', kind: 'process' as const, x: 230, y: 120, width: 170, height: 60 }, { id: diagramId + '-end', label: 'End', kind: 'start-end' as const, x: 450, y: 120, width: 150, height: 60 }];
    const diagram = { id: diagramId, type: 'diagram' as const, geometry: { x: 180, y: 190, width: 660, height: 300, rotation: 0, zIndex: 22 }, layout: 'flowchart' as const, nodes, connectors: [{ id: diagramId + '-c1', from: nodes[0].id, to: nodes[1].id }, { id: diagramId + '-c2', from: nodes[1].id, to: nodes[2].id }] };
    updateSelectedSlide({ ...selectedItem.slide, diagramObjects: [...(selectedItem.slide.diagramObjects || []), diagram] });
  }

  async function insertMedia(file: File, kind: 'audio' | 'video') {
    if (!selectedItem) return;
    if (!supportedMediaType(kind, file.type)) { setFileStatus(`Unsupported ${kind} format: ${file.type || 'unknown type'}`); return; }
    if (file.size > MEDIA_MAX_BYTES) { setFileStatus(`${kind} exceeds the ${Math.round(MEDIA_MAX_BYTES / 1024 / 1024)} MB limit`); return; }
    const assetId = createStableId('media-asset');
    try {
      await savePresentationAsset({ id: assetId, blob: file, name: file.name, mimeType: file.type, size: file.size, createdAt: Date.now() });
      const zIndex = Math.max(0, ...[...(selectedItem.slide.shapeObjects || []), ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || []), ...(selectedItem.slide.tableObjects || []), ...(selectedItem.slide.chartObjects || []), ...(selectedItem.slide.diagramObjects || []), ...(selectedItem.slide.audioObjects || []), ...(selectedItem.slide.videoObjects || [])].map((object) => object.geometry.zIndex)) + 1;
      const object = (kind === 'audio'
        ? { id: createStableId('audio'), type: 'audio' as const, assetId, mimeType: file.type, name: file.name, assetSource: 'indexeddb' as const, src: URL.createObjectURL(file), geometry: { x: 420, y: 620, width: 360, height: 58, rotation: 0, zIndex }, autoplay: false, loop: false }
        : { id: createStableId('video'), type: 'video' as const, assetId, mimeType: file.type, name: file.name, assetSource: 'indexeddb' as const, src: URL.createObjectURL(file), geometry: { x: 280, y: 160, width: 640, height: 360, rotation: 0, zIndex }, autoplay: false, loop: false, muted: false }) as AudioObject | VideoObject;
      updateSelectedSlide({ ...selectedItem.slide, audioObjects: kind === 'audio' ? [...(selectedItem.slide.audioObjects || []), object as AudioObject] : selectedItem.slide.audioObjects, videoObjects: kind === 'video' ? [...(selectedItem.slide.videoObjects || []), object as VideoObject] : selectedItem.slide.videoObjects });
      setSelectedMediaIds([object.id]); setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedTextIds([]); setSelectedGroupIds([]);
      setFileStatus(`${kind === 'audio' ? 'Audio' : 'Video'} inserted`);
    } catch (error) { setFileStatus(error instanceof Error ? error.message : `Unable to save ${kind} asset`); }
  }

  function insertImage(file: File) {
    if (!selectedItem || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) return;
      const probe = new Image();
      probe.onload = () => {
        const maxWidth = 520; const maxHeight = 360; const scale = Math.min(maxWidth / probe.naturalWidth, maxHeight / probe.naturalHeight, 1);
        const width = Math.max(24, probe.naturalWidth * scale); const height = Math.max(24, probe.naturalHeight * scale);
        const zIndex = Math.max(0, ...(selectedItem.slide.shapeObjects || []).map((item) => item.geometry.zIndex), ...(selectedItem.slide.imageObjects || []).map((item) => item.geometry.zIndex)) + 1;
        const image = { id: createStableId('image'), type: 'image' as const, src, alt: file.name, geometry: { x: (1280 - width) / 2, y: (720 - height) / 2, width, height, rotation: 0, zIndex }, style: { opacity: 1 } };
        updateSelectedSlide({ ...selectedItem.slide, imageObjects: [...(selectedItem.slide.imageObjects || []), image] });
        setSelectedImageIds([image.id]); setSelectedShapeIds([]); setSelectedGroupIds([]);
      };
      probe.onerror = () => undefined;
      probe.src = src;
    };
    reader.readAsDataURL(file);
  }

  function insertTextBox() {
    setTextInsertMode(true);
    setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedGroupIds([]); setSelectedTextIds([]);
  }

  useEffect(() => {
    if (!editor.selectedSlideId && editor.document.slides[0]) editor.selectSlide(editor.document.slides[0].id);
    if (editor.selectedSlideId && !editor.document.slides.some((slide) => slide.id === editor.selectedSlideId)) editor.selectSlide(editor.document.slides[0]?.id ?? null);
  }, [editor.document.slides, editor.selectedSlideId, editor.selectSlide]);

  useEffect(() => {
    setSelectedSlideIds((current) => {
      const valid = current.filter((id) => slideIds.includes(id));
      return valid.length || !editor.selectedSlideId ? valid : [editor.selectedSlideId];
    });
  }, [editor.selectedSlideId, slideIds.join('|')]);

  function handleSlideSelection(id: string, event: React.MouseEvent<HTMLButtonElement>) {
    const additive = event.ctrlKey || event.metaKey;
    const rangeAnchor = event.shiftKey ? slideSelectionAnchorRef.current : null;
    setSelectedSlideIds((current) => nextSlideSelection(slideIds, current, id, { additive, rangeAnchor }));
    slideSelectionAnchorRef.current = id;
    editor.selectSlide(id);
  }

  function handleSlideListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[contenteditable="true"], input, textarea, select')) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedSlideIds(slideIds);
    slideSelectionAnchorRef.current = editor.selectedSlideId || slideIds[0] || null;
  }

  function addTextSlide() {
    const source = createGeneralSlide();
    editor.updateDocument((current) => {
      const result = insertSlide(current, source);
      return result.document;
    });
    editor.selectSlide(source.id);
  }

  function updateSelectedSlide(source: GeneralSlide) {
    if (!selectedItem) return;
    editor.updateDocument((current) => updateSlide(current, selectedItem.entryId, source));
  }

  function duplicateSelectedSlide() {
    if (!editor.selectedSlide) return;
    const duplicatedSlideId = createStableId('slide');
    editor.updateDocument((current) => {
      const result = duplicateSlide(current, editor.selectedSlideId || '', duplicatedSlideId);
      return result.document;
    });
    editor.selectSlide(duplicatedSlideId);
  }

  function removeSelectedSlide() {
    if (!editor.selectedSlide || editor.document.slides.length <= 1) return;
    const next = editor.document.slides.filter((slide) => slide.id !== editor.selectedSlideId);
    editor.updateDocument((current) => deleteSlide(current, editor.selectedSlideId || ''));
    editor.selectSlide(next[0]?.id ?? null);
  }

  function moveSlide(fromIndex: number, toIndex: number) {
    editor.updateDocument((current) => reorderSlides(current, fromIndex, toIndex));
  }

  function duplicateSlideById(slideId: string) {
    const duplicatedSlideId = createStableId('slide');
    editor.updateDocument((current) => duplicateSlide(current, slideId, duplicatedSlideId).document);
    editor.selectSlide(duplicatedSlideId);
  }

  function deleteSlideById(slideId: string) {
    if (editor.document.slides.length <= 1) return;
    const index = editor.document.slides.findIndex((slide) => slide.id === slideId);
    const fallback = editor.document.slides[index + 1]?.id || editor.document.slides[index - 1]?.id || null;
    editor.updateDocument((current) => deleteSlide(current, slideId));
    if (editor.selectedSlideId === slideId) editor.selectSlide(fallback);
  }

  function setSlideBackground(color: string) {
    if (!editor.selectedSlideId) return;
    editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, background: { ...slide.background, color } } : slide) }));
  }

  function setSlideLayout(layout: SlideLayout) {
    if (!editor.selectedSlideId) return;
    editor.updateDocument((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, layout } : slide),
    }));
  }

  function setSlideTransition(type: SupportedTransitionType) {
    if (!editor.selectedSlideId) return;
    editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, transition: { ...slide.transition, type } } : slide) }));
  }

  function setSlideTransitionDuration(duration: number) {
    if (!editor.selectedSlideId) return;
    editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, transition: { ...slide.transition, durationMs: Math.max(0, Math.min(3000, duration)) } } : slide) }));
  }

  function toggleSelectedSlideHidden() {
    if (!editor.selectedSlideId) return;
    if (!editor.selectedSlide?.hidden && editor.document.slides.filter((slide) => !slide.hidden).length <= 1) return;
    editor.updateDocument((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, hidden: !slide.hidden } : slide),
    }));
  }

  function setSelectedAnimation(type: 'appear' | 'fade' | 'fly-in' | 'clear') {
    if (!selectedItem) return;
    const selectedIds = new Set([...selectedShapeIds, ...selectedImageIds, ...selectedTextIds]);
    const current = selectedItem.slide.animations || [];
    const next = type === 'clear'
      ? current.filter((animation) => !selectedIds.has(animation.objectId))
      : [...current.filter((animation) => !selectedIds.has(animation.objectId)), ...[...selectedIds].map((objectId, index) => ({ id: createStableId('animation'), objectId, type, order: current.length + index, durationMs: 420, delayMs: 0, direction: type === 'fly-in' ? 'left' as const : undefined }))];
    updateSelectedSlide({ ...selectedItem.slide, animations: next, animationObjectIds: next.filter((animation) => animation.type === 'fade').map((animation) => animation.objectId) });
  }

  function setSelectedAnimationDuration(duration: number) {
    if (!selectedItem) return;
    const selectedIds = new Set([...selectedShapeIds, ...selectedImageIds, ...selectedTextIds]);
    updateSelectedSlide({ ...selectedItem.slide, animations: (selectedItem.slide.animations || []).map((animation) => selectedIds.has(animation.objectId) ? { ...animation, durationMs: Math.max(0, Math.min(3000, duration)) } : animation) });
  }

  function setDrawingCommand(command: 'toggle' | 'clear') {
    if (command === 'toggle') { setDrawingMode((active) => !active); return; }
    if (!selectedItem) return;
    updateSelectedSlide({ ...selectedItem.slide, drawingObjects: [] });
    setDrawingMode(false);
  }

  function addComment() {
    if (!selectedItem || !commentDraft.trim()) return;
    const comment: SlideComment = { id: createStableId('comment'), text: commentDraft.trim(), author: 'You', createdAt: Date.now(), resolved: false };
    updateSelectedSlide({ ...selectedItem.slide, comments: [...(selectedItem.slide.comments || []), comment] });
    setCommentDraft('');
  }

  function resolveComment(id: string) {
    if (!selectedItem) return;
    updateSelectedSlide({ ...selectedItem.slide, comments: (selectedItem.slide.comments || []).map((comment) => comment.id === id ? { ...comment, resolved: !comment.resolved } : comment) });
  }

  function deleteComment(id: string) {
    if (!selectedItem) return;
    updateSelectedSlide({ ...selectedItem.slide, comments: (selectedItem.slide.comments || []).filter((comment) => comment.id !== id) });
  }

  function rehearsalCommand(command: 'start' | 'stop' | 'reset') {
    if (command === 'reset') {
      editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => ({ ...slide, rehearsalDurationMs: 0 })) }));
      setRehearsal({ active: false, startedAt: 0, slideStartedAt: 0, elapsed: 0, durations: {} });
      return;
    }
    if (command === 'start') {
      const now = Date.now();
      rehearsalSlideRef.current = editor.selectedSlideId;
      setRehearsal({ active: true, startedAt: now, slideStartedAt: now, elapsed: 0, durations: {} });
      return;
    }
    const elapsed = rehearsalSlideRef.current ? Math.max(0, Date.now() - rehearsal.slideStartedAt) : 0;
    if (rehearsalSlideRef.current) editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === rehearsalSlideRef.current ? { ...slide, rehearsalDurationMs: (slide.rehearsalDurationMs || 0) + elapsed } : slide) }));
    setRehearsal((previous) => ({ ...previous, active: false, durations: rehearsalSlideRef.current ? { ...previous.durations, [rehearsalSlideRef.current]: (previous.durations[rehearsalSlideRef.current] || 0) + elapsed } : previous.durations }));
  }

  function updateNotes(text: string) {
    if (!editor.selectedSlide) return;
    editor.updateDocument((current) => ({ ...current, slides: current.slides.map((slide) => slide.id === editor.selectedSlideId ? { ...slide, notes: { text, updatedAt: Date.now() } } : slide) }));
  }

  function startTextSlideShow(fromCurrent: boolean) {
    const slideId = fromCurrent ? editor.selectedSlideId : editor.document.slides[0]?.id;
    if (slideId) editor.selectSlide(slideId);
    editor.save();
    if (textAudienceReceiverReadyRef.current) {
      setTextAudienceOpen(true);
      setFileStatus('Connected to the open text-slide audience window.');
      return;
    }
    const audiencePath = window.location.pathname.startsWith('/app/') ? '/app/text-slides/audience' : '/text-slides/audience';
    const existing = textAudienceWindowRef.current;
    const audience = existing && !existing.closed
      ? existing
      : window.open(`${window.location.origin}${audiencePath}?projection=1`, 'morija-text-audience', audienceWindowFeatures());
    if (!audience) {
      textAudienceWindowRef.current = null;
      setTextAudienceOpen(false);
      setFileStatus('The audience window was blocked. Allow pop-ups, or open the audience route manually.');
      return;
    }
    textAudienceWindowRef.current = audience;
    setTextAudienceOpen(true);
    setFileStatus('Audience slideshow opened. Browser fullscreen may require the audience window’s fullscreen control or F11.');
    audience.focus();
    void requestAudienceWindowFullscreen(audience);
    window.setTimeout(() => void requestAudienceWindowFullscreen(audience), 250);
  }

  function cancelTextSlideShow() {
    const audience = textAudienceWindowRef.current;
    const message: TextProjectionMessage = { type: 'presentation-command', command: 'end-projection' };
    textProjectionChannelRef.current?.postMessage(message);
    if (audience && !audience.closed) {
      audience.postMessage(message, window.location.origin);
      window.setTimeout(() => { if (!audience.closed) audience.close(); }, 150);
    }
    textAudienceWindowRef.current = null;
    setTextAudienceOpen(false);
    setFileStatus('Projection cancelled.');
  }

  useEffect(() => {
    if (isProjectionWindow) return undefined;
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('morija-text-presentation');
    textProjectionChannelRef.current = channel;
    const onMessage = (event: MessageEvent<TextProjectionMessage>) => {
      if (event.origin && event.origin !== window.location.origin) return;
      if (event.data?.type === 'morija-text-projection-ready' && event.data.audience === 'text-slides') {
        textAudienceReceiverReadyRef.current = true;
        setTextAudienceOpen(true);
        setFileStatus(event.data.fullscreen
          ? 'Text-slide audience is ready in browser fullscreen.'
          : 'Text-slide audience is ready, but browser fullscreen was not granted. Use the browser fullscreen control or F11 if needed.');
        const audience = textAudienceWindowRef.current;
        if (audience && !audience.closed) void requestAudienceWindowFullscreen(audience);
      } else if (event.data?.type === 'morija-text-audience-closed' && event.data.audience === 'text-slides') {
        textAudienceReceiverReadyRef.current = false;
        textAudienceWindowRef.current = null;
        setTextAudienceOpen(false);
      }
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('message', onMessage);
    const intervalId = window.setInterval(() => {
      if (textAudienceWindowRef.current && textAudienceWindowRef.current.closed) {
        textAudienceWindowRef.current = null;
        setTextAudienceOpen(false);
      }
    }, 800);
    return () => {
      window.removeEventListener('message', onMessage);
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      textProjectionChannelRef.current = null;
      window.clearInterval(intervalId);
    };
  }, [isProjectionWindow]);

  function updateSelectedShapes(updater: (shape: NonNullable<GeneralSlide['shapeObjects']>[number]) => NonNullable<GeneralSlide['shapeObjects']>[number]) {
    if (!selectedItem) return;
    updateSelectedSlide({ ...selectedItem.slide, shapeObjects: (selectedItem.slide.shapeObjects || []).map((shape) => selectedShapeIds.includes(shape.id) ? updater(shape) : shape) });
  }

  function setSelectedTextBoxFill(color: string) {
    if (!selectedItem || !selectedTextIds.length) return;
    updateSelectedSlide({ ...selectedItem.slide, textObjects: (selectedItem.slide.textObjects || []).map((text) => selectedTextIds.includes(text.id) ? { ...text, style: { ...text.style, backgroundColor: color === 'transparent' ? undefined : color } } : text) });
  }

  function shapeCommand(command: string, value?: string) {
    const selectedObjectIds = [...selectedShapeIds, ...selectedImageIds, ...selectedTextIds];
    if (!selectedItem || (!selectedObjectIds.length && !selectedMediaIds.length && !selectedGroupIds.length)) return;
    if (command === 'group' && selectedObjectIds.length >= 2) {
      const objects = [...(selectedItem.slide.shapeObjects || []), ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])];
      const bounds = boundsOfObjects(objects, selectedObjectIds);
      if (bounds) {
        const group = { id: createStableId('group'), type: 'group' as const, geometry: { ...bounds, rotation: 0, zIndex: Math.max(...objects.map((item) => item.geometry.zIndex), 0) + 1 }, childIds: selectedObjectIds, name: 'Group' };
        updateSelectedSlide({ ...selectedItem.slide, groupObjects: [...(selectedItem.slide.groupObjects || []), group] }); setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedTextIds([]); setSelectedGroupIds([group.id]);
      }
      return;
    }
    if (command === 'group' && selectedShapeIds.length >= 2) {
      const result = groupShapes({ shapes: selectedItem.slide.shapeObjects || [], groups: selectedItem.slide.groupObjects || [] }, selectedShapeIds);
      if (result.group) { updateSelectedSlide({ ...selectedItem.slide, shapeObjects: result.state.shapes, groupObjects: result.state.groups }); setSelectedShapeIds([]); setSelectedGroupIds([result.group.id]); }
      return;
    }
    if (command === 'ungroup' && selectedGroupIds.length) {
      const next = ungroup({ shapes: selectedItem.slide.shapeObjects || [], groups: selectedItem.slide.groupObjects || [] }, selectedGroupIds[0]);
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: next.shapes, groupObjects: next.groups }); setSelectedGroupIds([]); return;
    }
    if (selectedObjectIds.length >= 2 && ['alignLeft', 'alignCenter', 'alignRight', 'alignTop', 'alignMiddle', 'alignBottom'].includes(command)) {
      const alignmentModes = { alignLeft: 'left', alignCenter: 'center', alignRight: 'right', alignTop: 'top', alignMiddle: 'middle', alignBottom: 'bottom' } as const;
      const mode = alignmentModes[command as keyof typeof alignmentModes];
      const objects = alignObjects([...selectedItem.slide.shapeObjects || [], ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])], selectedObjectIds, mode);
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: objects.filter((item) => item.type === 'shape') as GeneralSlide['shapeObjects'], imageObjects: objects.filter((item) => item.type === 'image') as GeneralSlide['imageObjects'], textObjects: objects.filter((item) => item.type === 'text') as GeneralSlide['textObjects'] }); return;
    }
    if (selectedObjectIds.length >= 3 && (command === 'distributeHorizontal' || command === 'distributeVertical')) {
      const objects = distributeObjects([...selectedItem.slide.shapeObjects || [], ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])], selectedObjectIds, command === 'distributeHorizontal' ? 'horizontal' : 'vertical');
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: objects.filter((item) => item.type === 'shape') as GeneralSlide['shapeObjects'], imageObjects: objects.filter((item) => item.type === 'image') as GeneralSlide['imageObjects'], textObjects: objects.filter((item) => item.type === 'text') as GeneralSlide['textObjects'] }); return;
    }
    if (['rotateRight', 'rotateLeft', 'flipHorizontal', 'flipVertical'].includes(command)) {
      const action = ({ rotateRight: 'right', rotateLeft: 'left', flipHorizontal: 'flip-horizontal', flipVertical: 'flip-vertical' } as const)[command as 'rotateRight' | 'rotateLeft' | 'flipHorizontal' | 'flipVertical'];
      if (selectedGroupIds.length) {
        const state = action === 'right' ? rotateGroup({ shapes: selectedItem.slide.shapeObjects || [], groups: selectedItem.slide.groupObjects || [] }, selectedGroupIds[0], 90) : action === 'left' ? rotateGroup({ shapes: selectedItem.slide.shapeObjects || [], groups: selectedItem.slide.groupObjects || [] }, selectedGroupIds[0], -90) : flipGroup({ shapes: selectedItem.slide.shapeObjects || [], groups: selectedItem.slide.groupObjects || [] }, selectedGroupIds[0], action === 'flip-horizontal' ? 'horizontal' : 'vertical');
        updateSelectedSlide({ ...selectedItem.slide, shapeObjects: state.shapes, groupObjects: state.groups }); return;
      }
      const objects = rotateObjects([...selectedItem.slide.shapeObjects || [], ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])], selectedObjectIds, action);
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: objects.filter((item) => item.type === 'shape') as GeneralSlide['shapeObjects'], imageObjects: objects.filter((item) => item.type === 'image') as GeneralSlide['imageObjects'], textObjects: objects.filter((item) => item.type === 'text') as GeneralSlide['textObjects'] }); return;
    }
    if (['bringForward', 'sendBackward'].includes(command)) {
      const objects = arrangeObjects([...selectedItem.slide.shapeObjects || [], ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])], selectedObjectIds, command === 'bringForward' ? 'forward' : 'backward');
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: objects.filter((item) => item.type === 'shape') as GeneralSlide['shapeObjects'], imageObjects: objects.filter((item) => item.type === 'image') as GeneralSlide['imageObjects'], textObjects: objects.filter((item) => item.type === 'text') as GeneralSlide['textObjects'] }); return;
    }
    if (command === 'fill') updateSelectedShapes((shape) => ({ ...shape, style: { ...shape.style, backgroundColor: value || 'transparent' } }));
    if (command === 'outline') updateSelectedShapes((shape) => ({ ...shape, style: { ...shape.style, outlineColor: value || '#1e3a8a' } }));
    if (command === 'outlineWidth') updateSelectedShapes((shape) => ({ ...shape, style: { ...shape.style, outlineWidth: Number(value) || 0 } }));
    if (command === 'delete') { updateSelectedSlide({ ...selectedItem.slide, shapeObjects: (selectedItem.slide.shapeObjects || []).filter((shape) => !selectedShapeIds.includes(shape.id)), imageObjects: (selectedItem.slide.imageObjects || []).filter((image) => !selectedImageIds.includes(image.id)), textObjects: (selectedItem.slide.textObjects || []).filter((text) => !selectedTextIds.includes(text.id)), audioObjects: (selectedItem.slide.audioObjects || []).filter((audio) => !selectedMediaIds.includes(audio.id)), videoObjects: (selectedItem.slide.videoObjects || []).filter((video) => !selectedMediaIds.includes(video.id)) }); setSelectedMediaIds([]); }
    if (command === 'bringToFront' || command === 'sendToBack') {
      const selected = new Set(selectedObjectIds);
      const ordered = [...(selectedItem.slide.shapeObjects || []), ...(selectedItem.slide.imageObjects || []), ...(selectedItem.slide.textObjects || [])].sort((a, b) => a.geometry.zIndex - b.geometry.zIndex);
      const moving = ordered.filter((shape) => selected.has(shape.id));
      const remaining = ordered.filter((shape) => !selected.has(shape.id));
      const next = command === 'bringToFront' ? [...remaining, ...moving] : [...moving, ...remaining];
      const normalized = next.map((object, index) => ({ ...object, geometry: { ...object.geometry, zIndex: index } }));
      updateSelectedSlide({ ...selectedItem.slide, shapeObjects: normalized.filter((item) => item.type === 'shape') as GeneralSlide['shapeObjects'], imageObjects: normalized.filter((item) => item.type === 'image') as GeneralSlide['imageObjects'], textObjects: normalized.filter((item) => item.type === 'text') as GeneralSlide['textObjects'] });
    }
  }

  async function formatCurrentText(command: string, value?: string) {
    const activeTextEditor = selectedTextIds.length > 0 || (document.activeElement instanceof HTMLElement && document.activeElement.closest('.text-object-content'));
    if (command === 'createLink') {
      const url = window.prompt('Enter a web address (https://, http://, or mailto:):', 'https://');
      if (!url || !isValidHyperlink(url)) { setFileStatus('Enter a valid http, https, or mailto link'); return; }
      window.dispatchEvent(new CustomEvent('text-format-command', { detail: { command, value: url.trim() } }));
      return;
    }
    if (activeTextEditor) {
      window.dispatchEvent(new CustomEvent('text-format-command', { detail: { command, value } }));
      return;
    }
    if (command === 'paste') {
      try {
        const text = await navigator.clipboard.readText();
        document.execCommand('insertText', false, text);
      } catch {
        document.execCommand('paste');
      }
      return;
    }
    if (command === 'increaseFontSize' || command === 'decreaseFontSize') {
      document.execCommand('fontSize', false, command === 'increaseFontSize' ? '5' : '2');
      return;
    }
    const browserCommand = command === 'textColor' ? 'foreColor' : command;
    document.execCommand(browserCommand, false, value);
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') { event.preventDefault(); addTextSlide(); }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  useEffect(() => {
    if (!printRequested) return;
    const handleAfterPrint = () => setPrintRequested(false);
    window.addEventListener('afterprint', handleAfterPrint);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printRequested]);

  if (isProjectionWindow) return <TextSlideProjectionView document={editor.document} selectedSlideId={editor.selectedSlideId} onSelectSlide={editor.selectSlide} />;
  if (printRequested) return <PrintPresentation presentation={editor.document} />;

  return (
    <section className="page text-slides-page">
      <PresentationEditorShell
        title={editor.document.metadata.title}
        saveState={editor.saveState}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onTitleChange={(title) => editor.updateDocument((current) => ({ ...current, metadata: { ...current.metadata, title } }))}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSave={editor.save}
        onExport={exportPresentation}
        onExportPowerPoint={exportPowerPoint}
        onImport={importPresentation}
        onImportPowerPoint={importPowerPoint}
        statusMessage={fileStatus}
        onNewSlide={addTextSlide}
        onDuplicateSlide={duplicateSelectedSlide}
        onRemoveSlide={removeSelectedSlide}
        onFormat={formatCurrentText}
        shapeInsertKind={shapeInsertKind}
        shapeSelected={selectedShapeIds.length > 0}
        objectSelected={selectedShapeIds.length > 0 || selectedImageIds.length > 0 || selectedTextIds.length > 0 || selectedMediaIds.length > 0}
        selectedObjectCount={selectedShapeIds.length + selectedImageIds.length + selectedTextIds.length + selectedMediaIds.length}
        groupSelected={selectedGroupIds.length > 0}
        shapeFill={selectedShape?.style.backgroundColor || '#dbeafe'}
        shapeOutline={selectedShape?.style.outlineColor || '#1e3a8a'}
        shapeOutlineWidth={selectedShape?.style.outlineWidth ?? 2}
        textBoxFill={selectedTextIds.length ? (selectedItem?.slide.textObjects?.find((text) => selectedTextIds.includes(text.id))?.style.backgroundColor || 'transparent') : ''}
        onTextBoxFill={setSelectedTextBoxFill}
        textColor={selectedItem?.slide.textObjects?.find((text) => selectedTextIds.includes(text.id))?.style.color || selectedItem?.slide.textColor || '#24104f'}
        onShapeInsert={setShapeInsertKind}
        onImageInsert={insertImage}
        onAudioInsert={(file) => void insertMedia(file, 'audio')}
        onVideoInsert={(file) => void insertMedia(file, 'video')}
        onTextInsert={insertTextBox}
        onInsertTable={insertTable}
        onInsertChart={insertChart}
        onInsertDiagram={insertDiagram}
        onStartSlideShow={startTextSlideShow}
        onCancelSlideShow={cancelTextSlideShow}
        slideShowOpen={textAudienceOpen}
        viewMode={viewMode}
        onViewMode={setViewMode}
        slideBackground={editor.selectedSlide?.background.color || '#ffffff'}
        onSlideBackground={setSlideBackground}
        slideLayout={editor.selectedSlide?.layout || 'title-and-content'}
        onSlideLayout={setSlideLayout}
        transitionType={(editor.selectedSlide?.transition.type === 'fade' || editor.selectedSlide?.transition.type === 'push' || editor.selectedSlide?.transition.type === 'wipe' ? editor.selectedSlide.transition.type : 'none')}
        onTransitionChange={setSlideTransition}
        transitionDuration={editor.selectedSlide?.transition.durationMs || 400}
        onTransitionDurationChange={setSlideTransitionDuration}
        animationSelected={Boolean(selectedAnimation)}
        animationType={selectedAnimationType}
        animationDuration={selectedAnimationDuration}
        onAnimationDurationChange={setSelectedAnimationDuration}
        onAnimationCommand={setSelectedAnimation}
        onFitToWindow={() => { setFitMode(true); setViewMode('editor'); }}
        onPrint={() => setPrintRequested(true)}
        slideHidden={editor.selectedSlide?.hidden ?? false}
        onToggleSlideHidden={toggleSelectedSlideHidden}
        drawingMode={drawingMode}
        drawingColor={drawingColor}
        drawingWidth={drawingWidth}
        onDrawingChange={setDrawingCommand}
        onDrawingColor={setDrawingColor}
        onDrawingWidth={setDrawingWidth}
        comments={selectedItem?.slide.comments || []}
        commentDraft={commentDraft}
        onCommentDraft={setCommentDraft}
        onAddComment={addComment}
        onResolveComment={resolveComment}
        onDeleteComment={deleteComment}
        rehearsalActive={rehearsal.active}
        rehearsalElapsed={rehearsal.elapsed}
        rehearsalDurations={rehearsal.durations}
        onRehearsalCommand={rehearsalCommand}
        onShapeCommand={shapeCommand}
        snapEnabled={snapEnabled}
        onSnapToggle={setSnapEnabled}
      >
        {viewMode === 'sorter' ? <TextSlideSorter items={textItems} selectedId={editor.selectedSlideId} onSelect={(id) => { editor.selectSlide(id); setViewMode('editor'); }} onMove={moveSlide} onDuplicate={duplicateSlideById} onDelete={deleteSlideById} /> : <div className="text-slides-workspace">
          <aside className="text-slides-sidebar">
            <div className="presentation-panel-heading"><h2>Slides</h2><span className="count-pill">{textItems.length}</span></div>
            <div className="text-slides-list" tabIndex={0} aria-label="Slide navigator" aria-multiselectable="true" onKeyDown={handleSlideListKeyDown}>
              {textItems.map((item, index) => { const active = item.entryId === editor.selectedSlideId; const selected = selectedSlideIds.includes(item.entryId); return <button key={item.entryId} title={item.slide.title || 'Untitled text slide'} aria-pressed={selected} className={`text-slide-list-item ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} onClick={(event) => handleSlideSelection(item.entryId, event)}><span className="text-slide-thumbnail"><GeneralSlideCanvas slide={item.slide} /></span><span className="text-slide-list-copy"><span className="text-slide-list-number">{index + 1}</span><strong>{item.slide.title || 'Untitled text slide'}</strong><small>{generalSlidePreview(item.slide)}</small></span></button>; })}
            </div>
            <p className="text-slides-sidebar-note">Text slides use a separate document from song presentations. Use Ctrl+M to add another slide.</p>
<section className="cloud-presentation-panel" aria-label="Cloud presentations">
              <div className="presentation-panel-heading"><h2>Cloud</h2><span className="count-pill">{cloudItems.length}</span></div>
              {!user ? <p className="text-slides-sidebar-note">Sign in to save and open presentations across devices.</p> : <>
                <button type="button" className="primary-action cloud-save-button" onClick={() => void saveCloudNow()} disabled={cloudState === 'saving'}>{cloudState === 'saving' ? 'Saving…' : cloudId ? 'Save to cloud' : 'Create cloud copy'}</button>
                <p className={`cloud-status cloud-status-${cloudState}`} role="status">{cloudState === 'saved' ? 'Saved' : cloudState === 'saving' ? 'Saving…' : cloudState === 'conflict' ? 'Conflict: local edits are preserved.' : cloudState === 'failed' ? 'Save failed; local draft is safe.' : 'Not connected'}</p>
                {cloudState === 'conflict' && <div className="cloud-conflict-actions"><button type="button" className="ghost-action" onClick={() => void reloadCloudPresentation()}>Reload latest</button><button type="button" className="ghost-action" onClick={() => setCloudState('failed')}>Keep local</button></div>}
                <div className="cloud-presentation-list">{cloudItems.map((item) => <button type="button" className={`cloud-presentation-item ${item.id === cloudId ? 'active' : ''}`} key={item.id} onClick={() => void openCloudPresentation(item.id)}><strong>{item.title || 'Untitled presentation'}</strong><small>{item.permission.toLowerCase()} · revision {item.revision}</small></button>)}</div>
                <CloudManagementPanel cloudId={cloudId} cloudCanEdit={cloudCanEdit} isOwner={cloudItems.find((item) => item.id === cloudId)?.permission === 'OWNER'} shares={cloudShares} versions={cloudVersions} currentRevision={cloudRevision} status={cloudPanelStatus} email={shareEmail} permission={sharePermission} onEmail={setShareEmail} onPermission={setSharePermission} onLoad={loadCloudDetails} onShare={addCloudShare} onPermissionChange={changeCloudShare} onRevoke={removeCloudShare} onRestore={restoreVersion} />
                <p className="text-slides-sidebar-note">Media binaries remain in this browser’s IndexedDB; cloud snapshots preserve media metadata only.</p>
              </>}
            </section>
          </aside>
          <main className="text-slides-editor-area" style={{ zoom: `${zoom}%` }}>
             {selectedItem ? <GeneralSlideEditor slide={selectedItem.slide} onChange={updateSelectedSlide} shapeInsertKind={shapeInsertKind} selectedShapeIds={selectedShapeIds} selectedGroupIds={selectedGroupIds} selectedImageIds={selectedImageIds} selectedTextIds={selectedTextIds} selectedMediaIds={selectedMediaIds} textInsertMode={textInsertMode} snapEnabled={snapEnabled} onShapeSelectionChange={(ids, additive) => { setSelectedShapeIds(ids); if (!additive && ids.length) { setSelectedGroupIds([]); setSelectedImageIds([]); setSelectedTextIds([]); } }} onGroupSelectionChange={(ids) => { setSelectedGroupIds(ids); if (ids.length) { setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedTextIds([]); } }} onImageSelectionChange={(ids, additive) => { setSelectedImageIds(ids); if (!additive && ids.length) { setSelectedGroupIds([]); setSelectedTextIds([]); setSelectedShapeIds([]); } }} onTextSelectionChange={(ids, additive) => { setSelectedTextIds(ids); if (!additive && ids.length) { setSelectedGroupIds([]); setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedMediaIds([]); } }} onMediaSelectionChange={(ids) => { setSelectedMediaIds(ids); if (ids.length) { setSelectedGroupIds([]); setSelectedShapeIds([]); setSelectedImageIds([]); setSelectedTextIds([]); } }} onShapeInsertComplete={() => setShapeInsertKind(null)} onTextInsertComplete={() => setTextInsertMode(false)} onUndo={editor.undo} onRedo={editor.redo} onHistoryStart={editor.beginHistoryTransaction} onHistoryCommit={editor.commitHistoryTransaction} onHistoryCancel={editor.cancelHistoryTransaction} /> : <div className="text-slides-editor-empty"><FileText size={44} /><h2>Build a slide from your text</h2><button className="primary-action" onClick={addTextSlide}><Plus size={18} /> New text slide</button></div>}
            {editor.selectedSlide && <section className="presentation-notes-panel"><label htmlFor="slide-notes">Notes</label><textarea id="slide-notes" value={editor.selectedSlide.notes.text} onChange={(event) => updateNotes(event.target.value)} placeholder="Click to add notes" /></section>}
          </main>
        </div>}
        <footer className="presentation-editor-statusbar"><span>Slide {Math.max(1, textItems.findIndex((item) => item.entryId === editor.selectedSlideId) + 1)} of {textItems.length}</span><span>English (Uganda)</span><span>Notes</span><span className="presentation-view-controls"><button type="button" className={viewMode === 'editor' ? 'active' : ''} title="Normal view" onClick={() => setViewMode('editor')}>Normal</button><button type="button" className={viewMode === 'sorter' ? 'active' : ''} title="Slide sorter" onClick={() => setViewMode('sorter')}>Sorter</button><label>Zoom <input aria-label="Zoom" type="range" min="25" max="150" value={zoom} onChange={(event) => { setFitMode(false); setZoom(Number(event.target.value)); }} /> {zoom}%</label></span></footer>
      </PresentationEditorShell>
    </section>
  );
}

type CloudManagementPanelProps = {
  cloudId: string | null;
  cloudCanEdit: boolean;
  isOwner: boolean;
  shares: CloudShare[];
  versions: CloudVersion[];
  currentRevision: number | null;
  status: string;
  email: string;
  permission: 'VIEW' | 'EDIT';
  onEmail: (value: string) => void;
  onPermission: (value: 'VIEW' | 'EDIT') => void;
  onLoad: () => void;
  onShare: () => void;
  onPermissionChange: (share: CloudShare, permission: 'VIEW' | 'EDIT') => void;
  onRevoke: (share: CloudShare) => void;
  onRestore: (version: CloudVersion) => void;
};
function CloudManagementPanel(props: CloudManagementPanelProps) {
  if (!props.cloudId || !props.cloudCanEdit) return null;
  return <div className="cloud-management-panel">
    <button type="button" className="ghost-action" onClick={props.onLoad}>Refresh history & collaborators</button>
    {props.status && <p className="cloud-status" role="status">{props.status}</p>}
    {props.isOwner && <div>
      <label className="cloud-field-label" htmlFor="cloud-share-email">Share with registered user</label>
      <div className="cloud-share-form"><input id="cloud-share-email" type="email" value={props.email} onChange={(event) => props.onEmail(event.target.value)} placeholder="user@example.com" /><select aria-label="Share permission" value={props.permission} onChange={(event) => props.onPermission(event.target.value as 'VIEW' | 'EDIT')}><option value="VIEW">View</option><option value="EDIT">Edit</option></select><button type="button" className="primary-action" onClick={props.onShare} disabled={!props.email.trim()}>Share</button></div>
      <div className="cloud-share-list">{props.shares.map((share) => <div className="cloud-share-row" key={share.id}><span><strong>{share.recipient.displayName || share.recipient.email}</strong><small>{share.recipient.email}</small></span><select aria-label={'Permission for ' + share.recipient.email} value={share.permission} onChange={(event) => props.onPermissionChange(share, event.target.value as 'VIEW' | 'EDIT')}><option value="VIEW">View</option><option value="EDIT">Edit</option></select><button type="button" className="ghost-action" onClick={() => props.onRevoke(share)}>Revoke</button></div>)}</div>
    </div>}
    <div className="cloud-history-list"><strong>Version history</strong>{props.versions.length === 0 ? <small>No saved revisions loaded.</small> : props.versions.map((version) => <div className="cloud-version-row" key={version.id}><span><strong>Revision {version.revision}</strong><small>{new Date(version.createdAt).toLocaleString()} {version.author?.displayName ? '· ' + version.author.displayName : ''}</small></span>{version.revision !== props.currentRevision && <button type="button" className="ghost-action" onClick={() => props.onRestore(version)}>Restore</button>}</div>)}</div>
  </div>;
}

function AccountPage() {
  const { user, loading, error, login, register, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setMessage(''); if (password.length < 8 || (mode === 'register' && !displayName.trim())) { setMessage('Use a valid email, an 8-character password, and a display name when registering.'); return; } setBusy(true); try { if (mode === 'login') await login(email, password); else await register(email, password, displayName); } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to complete the request.'); } finally { setBusy(false); } }
  if (loading) return <section className="page"><p className="status">Restoring session…</p></section>;
  if (user) return <section className="page"><div className="page-heading"><div><p className="eyebrow">Account</p><h1>Welcome, {user.displayName}</h1><p>{user.email}</p></div></div><button className="ghost-action" type="button" onClick={() => logout().catch(() => setMessage('Unable to sign out.'))}>Sign out</button>{(error || message) && <p className="form-error">{error || message}</p>}</section>;
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">Private account</p><h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1><p>Favorites, history, playlists, and submissions sync securely with your account.</p></div></div><form className="add-song-form" onSubmit={submit} noValidate>{mode === 'register' && <div className="form-field"><label htmlFor="account-name">Display name</label><input id="account-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></div>}<div className="form-field"><label htmlFor="account-email">Email</label><input id="account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div><div className="form-field"><label htmlFor="account-password">Password</label><input id="account-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></div>{(error || message) && <p className="form-error">{error || message}</p>}<button className="primary-action" type="submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button><button className="ghost-action" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create an account' : 'Use existing account'}</button></form></section>;
}
function FavoritesPage() {
  const navigate = useNavigate(); const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'favorites' | 'bookmarks' | 'recent'>('favorites'); const [songs, setSongs] = useState<Song[]>([]); const [status, setStatus] = useState('');
  const localIds = readLocal<string[]>(activeTab === 'bookmarks' ? 'bookmarks' : 'favorites', []);
  useEffect(() => {
    let cancelled = false;
    if (activeTab === 'bookmarks') { Promise.all(localIds.map((id) => getSongByIdCached(id).catch(() => null))).then((items) => { if (!cancelled) setSongs(items.filter(Boolean).map((item) => item!.data)); }); return () => { cancelled = true; }; }
    if (!user) { setSongs([]); setStatus('Sign in to view synced hymns.'); return () => { cancelled = true; }; }
    setStatus('Loading…'); const path = activeTab === 'recent' ? '/me/history' : '/me/favorites';
    authRequest<Array<{ hymn?: Song; hymnId?: string | number }>>(path).then((items) => { if (cancelled) return; setSongs(items.map((item) => item.hymn || ({ id: String(item.hymnId), title: 'Saved hymn' } as Song))); setStatus(''); }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : 'Unable to load saved hymns.'); });
    return () => { cancelled = true; };
  }, [activeTab, user]);
  const title = activeTab === 'recent' ? 'Recent Hymns' : activeTab === 'bookmarks' ? 'Bookmarks' : 'Favorites';
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">Personal library</p><h1>{title}</h1></div></div><div className="saved-tabs" role="tablist"><button role="tab" aria-selected={activeTab === 'favorites'} className={activeTab === 'favorites' ? 'saved-tab active' : 'saved-tab'} onClick={() => setActiveTab('favorites')}><Heart size={15} />Favorites</button><button role="tab" aria-selected={activeTab === 'recent'} className={activeTab === 'recent' ? 'saved-tab active' : 'saved-tab'} onClick={() => setActiveTab('recent')}><RefreshCw size={15} />Recent</button><button role="tab" aria-selected={activeTab === 'bookmarks'} className={activeTab === 'bookmarks' ? 'saved-tab active' : 'saved-tab'} onClick={() => setActiveTab('bookmarks')}><Bookmark size={15} />Bookmarks</button></div>{status && <p className="status">{status}</p>}{!status && songs.length === 0 ? <div className="saved-empty"><Heart size={40} /><strong>No {title.toLowerCase()} yet</strong><p>{user ? 'Open a hymn to add it to your library.' : 'Sign in to sync your personal library.'}</p>{!user && <button className="primary-action" onClick={() => navigate('/account')}>Sign in</button>}</div> : <div className="list">{songs.map((song) => <HymnRow key={song.id} song={song} />)}</div>}</section>;
}
function PlaylistsPage() {
  const navigate = useNavigate(); const { user } = useAuth(); const [playlists, setPlaylists] = useState<Array<{ id: number; name: string; description?: string; _count?: { items: number } }>>([]); const [selected, setSelected] = useState<{ id: number; name: string; items: Array<{ hymnId: number; hymn?: Song }> } | null>(null); const [name, setName] = useState(''); const [rename, setRename] = useState(''); const [hymnId, setHymnId] = useState(''); const [status, setStatus] = useState('');
  async function load() { try { setPlaylists(await authRequest('/playlists')); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to load playlists.'); } }
  useEffect(() => { if (user) load(); else setStatus('Sign in to use playlists.'); }, [user]);
  async function create(event: React.FormEvent) { event.preventDefault(); if (!name.trim()) return; try { await authRequest('/playlists', { method: 'POST', body: JSON.stringify({ name: name.trim() }) }); setName(''); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to create playlist.'); } }
  async function open(id: number) { try { setSelected(await authRequest('/playlists/' + id)); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to open playlist.'); } }
  async function renamePlaylist() { if (!selected || !rename.trim()) return; try { await authRequest('/playlists/' + selected.id, { method: 'PATCH', body: JSON.stringify({ name: rename.trim() }) }); setRename(''); await open(selected.id); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to rename playlist.'); } }
  async function addHymn() { if (!selected || !hymnId.trim()) return; try { await authRequest('/playlists/' + selected.id + '/items/' + hymnId.trim(), { method: 'PUT' }); setHymnId(''); await open(selected.id); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to add hymn.'); } }
  async function removePlaylist(id: number) { if (!window.confirm('Delete this playlist?')) return; try { await authRequest('/playlists/' + id, { method: 'DELETE' }); if (selected?.id === id) setSelected(null); await load(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to delete playlist.'); } }
  if (!user) return <section className="page"><h1>Playlists</h1><p className="status">Sign in to create and manage playlists.</p><button className="primary-action" onClick={() => navigate('/account')}>Sign in</button></section>;
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">Personal library</p><h1>Playlists</h1></div></div>{status && <p className="status">{status}</p>}<form className="search-bar" onSubmit={create}><input aria-label="New playlist name" value={name} onChange={(event) => setName(event.target.value)} placeholder="New playlist name" /><button className="primary-action" type="submit">Create</button></form><div className="list">{playlists.map((playlist) => <div className="playlist-card" key={playlist.id}><button className="hymn-row" onClick={() => open(playlist.id)}><span><strong>{playlist.name}</strong><small>{playlist._count?.items || 0} hymns</small></span></button><button className="ghost-action" onClick={() => removePlaylist(playlist.id)}>Delete</button></div>)}</div>{selected && <section className="settings-group"><h2>{selected.name}</h2><form className="search-bar" onSubmit={(event) => { event.preventDefault(); renamePlaylist(); }}><input aria-label="New playlist name" value={rename} onChange={(event) => setRename(event.target.value)} placeholder="Rename playlist" /><button className="ghost-action" type="submit" disabled={!rename.trim()}>Rename</button></form><div className="search-bar"><input aria-label="Hymn ID" value={hymnId} onChange={(event) => setHymnId(event.target.value)} placeholder="Hymn ID to add" /><button className="primary-action" onClick={addHymn}>Add hymn</button></div><div className="list">{selected.items.map((item) => <div className="hymn-row" key={item.hymnId}><span>{item.hymn?.title || 'Hymn ' + item.hymnId}</span><button className="ghost-action" onClick={() => authRequest('/playlists/' + selected.id + '/items/' + item.hymnId, { method: 'DELETE' }).then(() => open(selected.id)).catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to remove hymn.'))}>Remove</button></div>)}</div></section>}</section>;
}
function SettingsPage() {
  const { user } = useAuth();
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
    if (!user) { setSubmitStatus('error'); setSubmitMessage('Sign in before submitting a song.'); return; }
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
      const body = await authRequest<{ id?: string; title?: string; songNumber?: number; number?: string; sections?: SongSection[]; lyrics?: string }>('/collections/sincerite/songs', { method: 'POST', body: JSON.stringify({ title: cleanTitle, lyrics: cleanLyrics }) });
      if (body?.id) { saveSongIdb({ id: String(body.id), songNumber: body.songNumber, number: body.number, title: body.title || cleanTitle, collectionSlug: 'sincerite', collectionName: 'Sincérité', rawLyrics: cleanLyrics, sections: body.sections, lyrics: body.lyrics }).catch(() => {}); }
      setSubmitStatus('success'); setSubmitMessage((body?.title || cleanTitle) + ' was added to Sincérité!'); setNewSongId(body?.id ?? null); setSongTitle(''); setSongLyrics('');
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
  const { user } = useAuth();
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
    if (!user) { setSubmitStatus('error'); setSubmitMessage('Sign in before submitting a song.'); return; }
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

    if (!navigator.onLine) { setSubmitStatus('error'); setSubmitMessage('Reconnect to the internet before submitting a song.'); return; }
    try {
      const body = await authRequest<{ id?: string; title?: string; songNumber?: number; number?: string; sections?: SongSection[]; lyrics?: string }>('/collections/sincerite/songs', { method: 'POST', body: JSON.stringify({ title: cleanTitle, lyrics: cleanLyrics }) });
      if (body?.id) { saveSongIdb({ id: String(body.id), songNumber: body.songNumber, number: body.number, title: body.title || cleanTitle, collectionSlug: 'sincerite', collectionName: 'Sincérité', rawLyrics: cleanLyrics, sections: body.sections, lyrics: body.lyrics }).catch(() => {}); }
      setSubmitStatus('success'); setSubmitMessage((body?.title || cleanTitle) + ' was added to Sincérité!'); setNewSongId(body?.id ?? null); setSongTitle(''); setSongLyrics('');
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
  if (path === '/presentations/audience' || path === '/app/presentations/audience' || path === '/presentations' || path === '/app/presentations') return <PresentationsPage />;
  if (path === '/text-slides/audience' || path === '/app/text-slides/audience' || path === '/text-slides' || path === '/app/text-slides') return <TextSlidesPage />;
  if (path.startsWith('/hymns/') || path.startsWith('/app/hymns/')) return <ReaderPage />;
  if (path === '/account' || path === '/app/account') return <AccountPage />;
  if (path === '/favorites' || path === '/app/favorites') return <FavoritesPage />;
  if (path === '/playlists' || path === '/app/playlists') return <PlaylistsPage />;
  if (path === '/add-song' || path === '/app/add-song') return <AddSongPage />;
  if (path === '/support' || path === '/app/support') return <SupportPage />;
  if (path === '/settings' || path === '/app/settings') return <SettingsPage />;
  return <HomePage />;
}

export function App() {
  return (
    <AuthProvider>
      <Shell>
      <RouteSwitch />
      </Shell>
    </AuthProvider>
  );
}

export default App;
