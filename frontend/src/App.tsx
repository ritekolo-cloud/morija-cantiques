import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  Home,
  Library,
  ListMusic,
  LogIn,
  Minus,
  Monitor,
  Moon,
  Plus,
  Play,
  Search,
  Send,
  Settings,
  Share2,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

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

const COLLECTIONS_CACHE_KEY = 'collections:v2';
const PRESENTATION_SONGS_KEY = 'presentation:songs:v1';
const PRESENTATION_ZOOM_KEY = 'presentation:zoom:v1';
const DOUBLE_TAP_DELAY_MS = 320;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function randomId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function collectionCode(collection?: Collection) {
  return (collection?.code || collection?.slug || '').toUpperCase();
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
  const response = await fetch(`/api${path}`, {
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
    writeLocal(cacheKey, data);
    return { data, offline: false };
  } catch (error) {
    const cached = readLocal<CollectionSongs | null>(cacheKey, null);
    if (cached) return { data: cached, offline: true };
    throw error;
  }
}

async function getSearchResults(query: string) {
  const data = await apiFetch<{ data: Array<{ song?: Song } | Song> }>(
    `/songs/search?q=${encodeURIComponent(query)}&limit=80`,
  );
  return data.data.map((item) => ('song' in item && item.song ? item.song : item as Song));
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          <BookOpen size={26} />
          <strong>Morija Cantiques</strong>
        </button>
        <nav className="topnav">
          <NavButton to="/" icon={Home} active={path === '/'} onClick={navigate}>Home</NavButton>
          <NavButton to="/search" icon={Search} active={path === '/search'} onClick={navigate}>Search</NavButton>
          <NavButton to="/presentations" icon={ListMusic} active={path === '/presentations'} onClick={navigate}>Presentations</NavButton>
          <NavButton to="/favorites" icon={Heart} active={path === '/favorites'} onClick={navigate}>Favorites</NavButton>
          <NavButton to="/settings" icon={Settings} active={path === '/settings'} onClick={navigate}>Settings</NavButton>
        </nav>
        <div className="account-actions">
          <button className="nav-link" onClick={() => navigate('/settings')}>
            <LogIn size={18} />
            <span>Sign in</span>
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}

function CollectionGrid({ collections }: { collections: Collection[] }) {
  const navigate = useNavigate();
  return (
    <div className="collection-grid">
      {collections.map((collection) => (
        <button
          key={collection.id || collection.slug}
          className="collection-card"
          onClick={() => navigate(`/collections/${collection.slug || collection.code}`)}
        >
          <span className="collection-code">{collectionCode(collection)}</span>
          <strong>{collection.name}</strong>
          <small>{collectionCount(collection)} Hymns</small>
        </button>
      ))}
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

  useEffect(() => {
    let cancelled = false;
    apiFetchCached<Collection[]>('/collections', COLLECTIONS_CACHE_KEY)
      .then(({ data, offline }) => {
        if (cancelled) return;
        setCollections(data);
        setStatus(offline ? 'Offline' : '');
      })
      .catch((error: Error) => !cancelled && setStatus(error.message));
    return () => {
      cancelled = true;
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
        <button className="primary-action" onClick={() => navigate('/search')}>
          <Search size={18} />
          Search
        </button>
      </div>
      {status && <p className="status">{status}</p>}
      <CollectionGrid collections={collections} />
    </section>
  );
}

function CollectionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.pathname.match(/^\/(?:app\/)?collections\/([^/]+)/);
  const slug = match?.[1] || '';
  const [collections, setCollections] = useState<Collection[]>([]);
  const [data, setData] = useState<CollectionSongs | null>(null);
  const [status, setStatus] = useState('Loading');

  useEffect(() => {
    let cancelled = false;
    const key = slug ? `collection-songs:${slug}:v2` : COLLECTIONS_CACHE_KEY;
    const request = slug
      ? getCollectionSongsCached(slug, key)
      : apiFetchCached<Collection[]>('/collections', key);

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
      .catch((error: Error) => !cancelled && setStatus(error.message));

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
    Promise.all([
      apiFetchCached<Song>(`/songs/${id}`, `song:${id}`),
      apiFetch<AdjacentSongs>(`/songs/${id}/adjacent`).catch(() => null),
    ])
      .then(([songResponse, adjacentResponse]) => {
        if (cancelled) return;
        setSong(songResponse.data);
        setAdjacent(adjacentResponse);
        setStatus(songResponse.offline ? 'Offline' : '');
      })
      .catch((error: Error) => !cancelled && setStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!song || !readerLyricsRef.current) return undefined;
    const lyricsElement = readerLyricsRef.current;
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

  return (
    <section className={`reader-page ${immersive ? 'immersive' : ''}`} {...readerTapHandlers}>
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
    try {
      const songs = await getSearchResults(trimmed);
      setResults(songs);
      writeLocal(`search:${trimmed}`, songs);
      setStatus('');
    } catch (error) {
      const cached = readLocal<Song[] | null>(`search:${trimmed}`, null);
      if (cached) {
        setResults(cached);
        setStatus('Offline');
      } else {
        setStatus(error instanceof Error ? error.message : 'Search failed');
      }
    }
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
  const [songs, setSongs] = usePresentationSongs();
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
  const [projectionZoom, setProjectionZoom] = useState(() => (
    clampNumber(Math.max(readLocal(PRESENTATION_ZOOM_KEY, 1.18), 1.18), 1.05, 1.55)
  ));
  const [isPresentationFullscreen, setIsPresentationFullscreen] = useState(false);
  const presentationSlideRef = useRef<HTMLElement | null>(null);
  const projectionLyricsRef = useRef<HTMLDivElement | null>(null);
  const slideSong = songs[selectedIndex] || null;
  const presentationTapHandlers = useDoubleTapFullscreen(() => {
    if (document.fullscreenElement) exitAppFullscreen().catch(() => {});
    else requestAppFullscreen().catch(() => {});
  });
  const projectionLyricColumns = useMemo(
    () => splitProjectionLyrics(normalizePlainLyrics(slideSong)),
    [slideSong],
  );

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
    document.documentElement.dataset.presentation = presenting ? 'on' : 'off';
    document.documentElement.dataset.projection = presenting ? 'on' : 'off';
    return () => {
      document.documentElement.dataset.presentation = 'off';
      document.documentElement.dataset.projection = 'off';
    };
  }, [presenting]);

  useEffect(() => {
    writeLocal(PRESENTATION_ZOOM_KEY, projectionZoom);
  }, [projectionZoom]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsPresentationFullscreen(Boolean(document.fullscreenElement));
    };
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!presenting) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (document.fullscreenElement) exitAppFullscreen().catch(() => {});
        else setPresenting(false);
      } else if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, songs.length - 1));
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, songs.length]);

  useEffect(() => {
    if (!presenting) return;
    presentationSlideRef.current?.scrollTo({ top: 0, left: 0 });
    projectionLyricsRef.current?.scrollTo({ top: 0, left: 0 });
  }, [presenting, slideSong?.id]);

  useEffect(() => {
    if (!presenting || !projectionLyricsRef.current) return undefined;
    const lyricsElement = projectionLyricsRef.current;
    let frameId = 0;
    const fitLyrics = () => {
      window.cancelAnimationFrame(frameId);
      lyricsElement.style.setProperty('--projection-fit-scale', '1');
      frameId = window.requestAnimationFrame(() => {
        let scale = 1;
        const isOverflowing = () => (
          lyricsElement.scrollHeight > lyricsElement.clientHeight + 2 ||
          lyricsElement.scrollWidth > lyricsElement.clientWidth + 2
        );
        while (isOverflowing() && scale > 0.82) {
          scale = Math.max(0.82, scale - 0.035);
          lyricsElement.style.setProperty('--projection-fit-scale', scale.toFixed(2));
        }
      });
    };
    fitLyrics();
    window.addEventListener('resize', fitLyrics);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', fitLyrics);
    };
  }, [presenting, slideSong?.id, projectionZoom]);

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

  if (presenting && slideSong) {
    return (
      <section className="presentation-show" {...presentationTapHandlers}>
        {isPresentationFullscreen && (
          <button
            className="presentation-fullscreen-exit"
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
            onClick={() => exitAppFullscreen().catch(() => {})}
          >
            <X size={18} />
          </button>
        )}
        <header className="presentation-show-top">
          <div className="presentation-show-status">
            <p className="presentation-show-label">
              <Monitor size={18} strokeWidth={2.6} />
              <span>Presentation</span>
            </p>
            <strong>{selectedIndex + 1} of {songs.length}</strong>
          </div>
        </header>
        <article ref={presentationSlideRef} className="presentation-slide">
          <p className="presentation-song-meta">{slideSong.collectionName} / {songNumberLabel(slideSong)}</p>
          <h1>{slideSong.title}</h1>
          <div
            ref={projectionLyricsRef}
            className={`projection-lyrics columns-${projectionLyricColumns.length}`}
            style={{ '--projection-zoom': projectionZoom } as React.CSSProperties}
          >
            {projectionLyricColumns.map((column, index) => (
              <div className="projection-lyric-column" key={`${slideSong.id}-column-${index}`}>
                {column.map((stanza, stanzaIndex) => (
                  <div className="projection-stanza-group" key={`${slideSong.id}-stanza-${index}-${stanzaIndex}`}>
                    <div className={`projection-stanza ${isProjectionChorus(stanza) ? 'projection-stanza-chorus' : ''}`}>
                      {stanza.map((line, lineIndex) => (
                        <p key={`${line}-${lineIndex}`}>{line || String.fromCharCode(160)}</p>
                      ))}
                    </div>
                    {stanzaIndex < column.length - 1 && (
                      <div className="projection-divider" aria-hidden="true">
                        <span />
                        <b>✣</b>
                        <span />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
        <footer className="presentation-controls">
          <button className="presentation-nav-button" disabled={selectedIndex === 0} onClick={() => setSelectedIndex(selectedIndex - 1)}>
            <ChevronLeft size={18} /> Previous
          </button>
          <button className="presentation-nav-button" disabled={selectedIndex >= songs.length - 1} onClick={() => setSelectedIndex(selectedIndex + 1)}>
            Next <ChevronRight size={18} />
          </button>
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
          <button className="primary-action" disabled={!songs.length} onClick={() => setPresenting(true)}><Play size={18} /> Start</button>
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
            {collections.map((collection) => (
              <button
                key={collection.id || collection.slug}
                className={`presentation-collection-button ${(collection.slug || collection.code) === browseCode ? 'active' : ''}`}
                onClick={() => setBrowseCode(collection.slug || collection.code || '')}
              >
                <strong>{collectionCode(collection)}</strong>
                <span>{collection.name}</span>
              </button>
            ))}
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
    Promise.all(ids.map((id) => apiFetchCached<Song>(`/songs/${id}`, `song:${id}`)))
      .then((results) => { setSongs(results.map((r) => r.data).filter(Boolean)); setStatus(''); })
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
  const [dark, setDark] = useState(readLocal<string>('theme', 'light') === 'dark');
  const [fontSize, setFontSize] = useState(Math.max(readLocal('fontSize', 28), 26));

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    writeLocal('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => writeLocal('fontSize', fontSize), [fontSize]);

  return (
    <section className="page">
      <div className="page-heading"><h1>Settings</h1></div>
      <div className="settings-form">
        <label className="toggle-line">
          <span><Moon size={18} /> Dark mode</span>
          <input type="checkbox" checked={dark} onChange={(event) => setDark(event.target.checked)} />
        </label>
        <label>Reader font size<input type="range" min="22" max="44" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
      </div>
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
