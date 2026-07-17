import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHymn, useAdjacentHymns } from '../hooks/useHymns';
import { useFavoritesStore } from '../store/favorites.store';
import { useBookmarksStore } from '../store/bookmarks.store';
import { useRecentStore } from '../store/recent.store';
import { Spinner } from '../components/ui/Spinner';
import type { SongSection } from '../types';
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  Maximize2,
  Minus,
  Moon,
  Plus,
  Share2,
  Sun,
  X,
  MonitorOff,
} from 'lucide-react';

type ProjectionSection = SongSection & { lines: string[] };

const PROJECTOR_MIN_FONT = 7;
const PROJECTOR_MAX_FONT = 46;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getInitialViewport() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function parseSections(song: { lyrics?: string; sections?: SongSection[] } | undefined): ProjectionSection[] {
  if (Array.isArray(song?.sections) && song.sections.length > 0) {
    return song.sections.map((section, index) => ({
      ...section,
      label: section.label || `Verse ${index + 1}`,
      lines: Array.isArray(section.lines) ? section.lines.map(String) : [],
      order: section.order ?? index + 1,
    }));
  }

  try {
    const parsed = JSON.parse(song?.lyrics || '[]');
    if (Array.isArray(parsed)) {
      return parsed.map((section, index) => ({
        id: section.id ?? index + 1,
        type: section.type || 'verse',
        label: section.label || `Verse ${index + 1}`,
        content: section.content || '',
        lines: Array.isArray(section.lines) ? section.lines.map(String) : [],
        order: section.order ?? index + 1,
      }));
    }
  } catch {
    // Fall through to plain text handling.
  }

  return [{
    id: 1,
    type: 'verse',
    label: 'Hymn Lyrics',
    content: song?.lyrics || '',
    lines: (song?.lyrics || '').split('\n'),
    order: 1,
  }];
}

function sectionWeight(section: ProjectionSection) {
  return section.lines.reduce((total, line) => (
    total + Math.max(1, Math.ceil(line.trim().length / 34))
  ), 2.4);
}

function splitProjectionColumns(sections: ProjectionSection[]) {
  const totalLines = sections.reduce((sum, s) => sum + s.lines.length, 0);

  // 1-column layout for short hymns
  if (totalLines <= 7) {
    return [sections, [], []] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // 3-column layout for exceptionally long/multi-verse hymns
  if (totalLines > 14 || sections.length >= 3) {
    const col1: ProjectionSection[] = [];
    const col2: ProjectionSection[] = [];
    const col3: ProjectionSection[] = [];
    
    const weights = sections.map(sectionWeight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const targetWeight = totalWeight / 3;
    
    let currentWeight = 0;
    for (let i = 0; i < sections.length; i++) {
      if (currentWeight < targetWeight) {
        col1.push(sections[i]);
      } else if (currentWeight < targetWeight * 2) {
        col2.push(sections[i]);
      } else {
        col3.push(sections[i]);
      }
      currentWeight += weights[i];
    }
    
    // Safety checks for balance
    if (col2.length === 0 && col1.length > 1) {
      col2.push(col1.pop()!);
    }
    if (col3.length === 0 && col2.length > 1) {
      col3.push(col2.pop()!);
    }
    
    return [col1, col2, col3] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // 2-column layout (default)
  // If only 1 section that is medium length, split it down the middle
  if (sections.length === 1) {
    const sec = sections[0];
    const midpoint = Math.ceil(sec.lines.length / 2);
    return [
      [{ ...sec, lines: sec.lines.slice(0, midpoint) }],
      [{ ...sec, label: '', lines: sec.lines.slice(midpoint) }],
      []
    ] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // Split 2 sections into 2 columns
  const col1: ProjectionSection[] = [];
  const col2: ProjectionSection[] = [];
  const weights = sections.map(sectionWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const targetWeight = totalWeight / 2;
  
  let currentWeight = 0;
  for (let i = 0; i < sections.length; i++) {
    if (currentWeight + weights[i] / 2 < targetWeight) {
      col1.push(sections[i]);
    } else {
      col2.push(sections[i]);
    }
    currentWeight += weights[i];
  }
  
  if (col2.length === 0 && col1.length > 1) {
    col2.push(col1.pop()!);
  }
  
  return [col1, col2, []] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
}

function estimateFontSize(
  columns: [ProjectionSection[], ProjectionSection[], ProjectionSection[]],
  viewport: { width: number; height: number },
  controlsVisible: boolean,
  zoom: number
) {
  const availableHeight = Math.max(260, viewport.height - (controlsVisible ? 168 : 48));
  const activeCols = columns.filter(col => col.length > 0).length || 1;
  
  let horizontalMarginMultiplier = 0.54; // default (2 cols)
  if (activeCols === 1) {
    horizontalMarginMultiplier = 0.45; // narrow center
  } else if (activeCols === 3) {
    horizontalMarginMultiplier = 0.78; // wider screen usage
  }
  
  const availableWidth = Math.max(320, viewport.width * horizontalMarginMultiplier);
  const columnWidth = Math.max(140, availableWidth / activeCols - 24);
  
  const columnWeights = columns.map((col) => col.reduce((sum, sec) => sum + sectionWeight(sec), 0));
  const maxWeight = Math.max(...columnWeights, 1);
  
  const longestLine = columns.flat(2).reduce((longest, sec) => {
    const maxLine = sec.lines.reduce((max, line) => Math.max(max, line.length), sec.label.length);
    return Math.max(longest, maxLine);
  }, 1);

  const heightLimited = availableHeight / (maxWeight * 1.18);
  const widthLimited = columnWidth / Math.max(1, longestLine * 0.54);
  
  let preferred = PROJECTOR_MAX_FONT;
  if (activeCols === 1) preferred = 50;
  else if (activeCols === 3) preferred = 30;
  
  preferred = preferred * zoom;

  return clamp(Math.floor(Math.min(preferred, heightLimited, widthLimited)), PROJECTOR_MIN_FONT, PROJECTOR_MAX_FONT);
}

function ProjectionColumn({ sections, fontSize }: { sections: ProjectionSection[]; fontSize: number }) {
  return (
    <div className="min-w-0 flex flex-col justify-center gap-[0.7em]">
      {sections.map((section, sectionIndex) => {
        const isChorus = section.type === 'chorus' || section.type === 'refrain';
        return (
          <section
            key={`${section.order}-${section.label}-${sectionIndex}`}
            className={isChorus ? 'border-l-4 border-[#9e2a1b] pl-[0.7em]' : undefined}
          >
            {section.label && (
              <p
                className="mb-[0.3em] font-extrabold uppercase text-[#9e2a1b]/80"
                style={{ fontSize: `${Math.max(10, fontSize * 0.42)}px`, letterSpacing: '0.05em' }}
              >
                {section.label}
              </p>
            )}
            <div className={isChorus ? 'font-bold text-[#9e2a1b]' : 'font-extrabold text-[#1b0a00]'}>
              {section.lines.map((line, lineIndex) => (
                <p key={lineIndex} className="min-h-[1.05em] break-words">
                  {line || ' '}
                </p>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Hymn Detail Page ──────────────────────────────────────
export function HymnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: song, isLoading, error } = useHymn(id || '');
  const { data: adjacent } = useAdjacentHymns(id || '');

  const { favoriteIds, addFavorite, removeFavorite } = useFavoritesStore();
  const { bookmarkIds, addBookmark, removeBookmark } = useBookmarksStore();
  const { addRecent } = useRecentStore();

  const [fontSize, setFontSize] = useState(18);
  const [isLightMode, setIsLightMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [projectorControlsVisible, setProjectorControlsVisible] = useState(true);
  const [projectorZoom, setProjectorZoom] = useState(1);
  const [viewport, setViewport] = useState(getInitialViewport);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const clickTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const sections = useMemo(() => parseSections(song), [song]);
  const projectionColumns = useMemo(() => splitProjectionColumns(sections), [sections]);
  const projectorFontSize = useMemo(
    () => estimateFontSize(projectionColumns, viewport, projectorControlsVisible, projectorZoom),
    [projectionColumns, projectorControlsVisible, projectorZoom, viewport]
  );

  // Track recently read hymns
  useEffect(() => {
    if (song?.id) {
      addRecent(String(song.id));
    }
  }, [song?.id, addRecent]);

  useEffect(() => {
    const updateViewport = () => setViewport(getInitialViewport());
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setIsProjecting(false);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setProjectorControlsVisible(true);
  }, [id]);

  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  // Screen Wake Lock — prevent screen from sleeping during reading
  const toggleWakeLock = useCallback(async () => {
    if (wakeLockActive) {
      try {
        await wakeLockRef.current?.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
      } catch { /* ignore */ }
    } else {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
          wakeLockRef.current!.addEventListener('release', () => {
            setWakeLockActive(false);
            wakeLockRef.current = null;
          });
        }
      } catch { /* ignore */ }
    }
  }, [wakeLockActive]);

  // Release wake lock on unmount
  useEffect(() => () => {
    wakeLockRef.current?.release().catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-10rem)]">
        <Spinner />
        <span className="text-xs text-cream/50 mt-4 uppercase tracking-[0.2em] font-bold">
          Opening Hymn Book...
        </span>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="p-6 text-center mt-10">
        <div className="p-6 bg-red-500/5 border border-red-500/15 rounded-2xl">
          <p className="text-red-400 font-bold text-sm">Hymn not found or failed to load.</p>
        </div>
      </div>
    );
  }

  const isFavorited = favoriteIds.includes(song.id);
  const isBookmarked = bookmarkIds.includes(song.id);

  const toggleFavorite = () => isFavorited ? removeFavorite(song.id) : addFavorite(song.id);
  const toggleBookmark = () => isBookmarked ? removeBookmark(song.id) : addBookmark(song.id);

  const handleCopy = () => {
    const textToCopy = `${song.songNumber}. ${song.title}\n\n` +
      sections.map((section) => `[${section.label}]\n${section.lines.join('\n')}`).join('\n\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const shareData = {
      title: `${song.songNumber}. ${song.title}`,
      text: `Read this hymn: ${song.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const enterProjection = () => {
    setIsProjecting(true);
    setProjectorControlsVisible(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const exitProjection = () => {
    setIsProjecting(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleProjectionClick = () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setProjectorControlsVisible(true);
      clickTimerRef.current = null;
    }, 220);
  };

  const handleProjectionDoubleClick = () => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setProjectorControlsVisible(false);
  };

  const goToAdjacent = (adjacentId: string | undefined) => {
    if (adjacentId) navigate(`/app/hymns/${adjacentId}`);
  };

  // ─── Projection Mode ─────────────────────────────────────
  if (isProjecting) {
    return (
      <div
        className="fixed inset-0 z-[100] overflow-hidden bg-yellow-400 text-[#1b0a00] select-none"
        onClick={handleProjectionClick}
        onDoubleClick={handleProjectionDoubleClick}
        style={{
          cursor: projectorControlsVisible ? 'default' : 'none',
          backgroundImage: `url('/bg-worship.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <header
          className={`absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 bg-black/70 backdrop-blur-md border-b border-white/10 transition-opacity duration-200 ${projectorControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase text-[#E5B83B]">Hymn {song.songNumber}</p>
            <h1 className="truncate text-xl font-extrabold text-cream">{song.title}</h1>
          </div>
          <button
            onClick={exitProjection}
            aria-label="Exit projection"
            className="h-11 w-11 rounded-full bg-white/10 text-cream flex items-center justify-center hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main
          className={`h-dvh w-screen overflow-hidden grid ${
            projectionColumns.filter(c => c.length > 0).length === 1
              ? 'grid-cols-1'
              : projectionColumns.filter(c => c.length > 0).length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2'
          }`}
          style={{
            paddingTop: projectorControlsVisible ? 92 : 28,
            paddingBottom: projectorControlsVisible ? 112 : 28,
            paddingLeft:
              projectionColumns.filter(c => c.length > 0).length === 1
                ? '24%'
                : projectionColumns.filter(c => c.length > 0).length === 3
                ? '16%'
                : '32%',
            paddingRight:
              projectionColumns.filter(c => c.length > 0).length === 1
                ? '24%'
                : projectionColumns.filter(c => c.length > 0).length === 3
                ? '10%'
                : '14%',
            gap:
              projectionColumns.filter(c => c.length > 0).length === 1
                ? '0px'
                : projectionColumns.filter(c => c.length > 0).length === 3
                ? '6%'
                : '10%',
            fontSize: `${projectorFontSize}px`,
            lineHeight: 1.12,
          }}
        >
          {projectionColumns[0] && projectionColumns[0].length > 0 && (
            <ProjectionColumn sections={projectionColumns[0]} fontSize={projectorFontSize} />
          )}
          {projectionColumns[1] && projectionColumns[1].length > 0 && (
            <ProjectionColumn sections={projectionColumns[1]} fontSize={projectorFontSize} />
          )}
          {projectionColumns[2] && projectionColumns[2].length > 0 && (
            <ProjectionColumn sections={projectionColumns[2]} fontSize={projectorFontSize} />
          )}
        </main>

        <footer
          className={`absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-6 py-4 bg-black/70 backdrop-blur-md border-t border-white/10 transition-opacity duration-200 ${projectorControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => goToAdjacent(adjacent?.prev?.id)}
            disabled={!adjacent?.prev}
            aria-label="Previous hymn"
            className="h-11 px-4 rounded-xl bg-white/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-2 font-bold hover:bg-white/15 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" /> Previous
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProjectorZoom((v) => clamp(v - 0.08, 0.7, 1.35))}
              aria-label="Zoom out"
              className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="min-w-14 text-center text-xs font-extrabold text-cream/70">
              {Math.round(projectorZoom * 100)}%
            </span>
            <button
              onClick={() => setProjectorZoom((v) => clamp(v + 0.08, 0.7, 1.35))}
              aria-label="Zoom in"
              className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => goToAdjacent(adjacent?.next?.id)}
            disabled={!adjacent?.next}
            aria-label="Next hymn"
            className="h-11 px-4 rounded-xl bg-white/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-2 font-bold hover:bg-white/15 transition-colors"
          >
            Next <ChevronRight className="w-5 h-5" />
          </button>
        </footer>
      </div>
    );
  }

  // ─── Reader Mode ─────────────────────────────────────────
  // Theme classes
  const textPrimary = isLightMode ? 'text-[#1A1A16]' : 'text-[#2A2A24]';
  const borderColor = isLightMode ? 'border-[#E8E5D5]' : 'border-[#D4D0BC]';
  const glassBg = isLightMode ? 'bg-[#FFFDF5]/90 backdrop-blur-md' : 'bg-[#FAFAF5]/90 backdrop-blur-md';
  const btnHover = isLightMode ? 'hover:bg-[#E8E5D5]/50' : 'hover:bg-black/[0.04]';

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-300 ${textPrimary}`}
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255, 253, 245, 0.72) 0%, rgba(250, 250, 245, 0.88) 100%), url('/bg-worship.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
      }}
    >

      {/* ── Sticky Header / Controls ─────────────────────── */}
      <header
        className={`sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b backdrop-blur-md ${glassBg} ${borderColor}`}
        role="banner"
      >
        {/* Back + Collection name */}
        <div className="flex items-center gap-2.5">
          <Link
            to={song.collection ? `/app/collections/${song.collection.slug}` : '/app/home'}
            aria-label="Back to collection"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover} ${isLightMode ? 'text-[#1C1B17]' : 'text-cream/80'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className={`text-[9px] font-extrabold uppercase tracking-[0.18em] truncate max-w-[100px] ${isLightMode ? 'text-black/40' : 'text-cream/40'}`}>
            {song.collection?.name || 'Hymn'}
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1">
          {/* Font size */}
          <button
            onClick={() => setFontSize((s) => Math.max(13, s - 2))}
            aria-label="Decrease font size"
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs transition-all select-none ${btnHover}`}
          >
            A-
          </button>
          <button
            onClick={() => setFontSize((s) => Math.min(34, s + 2))}
            aria-label="Increase font size"
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-base transition-all select-none ${btnHover}`}
          >
            A+
          </button>

          {/* Wake Lock */}
          {'wakeLock' in navigator && (
            <button
              onClick={toggleWakeLock}
              aria-label={wakeLockActive ? 'Disable screen wake lock' : 'Keep screen on'}
              title={wakeLockActive ? 'Screen stays on — tap to disable' : 'Keep screen on'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover} ${wakeLockActive ? 'text-[#E5B83B]' : isLightMode ? 'text-black/40' : 'text-cream/40'}`}
            >
              <MonitorOff className="w-4 h-4" />
            </button>
          )}

          {/* Projection */}
          <button
            onClick={enterProjection}
            aria-label="Project hymn fullscreen"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover}`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover}`}
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Bookmark */}
          <button
            onClick={toggleBookmark}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover}`}
          >
            <Bookmark className={`w-4 h-4 transition-colors ${isBookmarked ? 'fill-[#E5B83B] text-[#E5B83B]' : ''}`} />
          </button>

          {/* Favorite */}
          <button
            onClick={toggleFavorite}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${btnHover}`}
          >
            <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        </div>
      </header>

      {/* ── Hymn Content ─────────────────────────────────── */}
      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full select-text pb-36" role="main">
        <div className="bg-white/95 border border-[#E8E5D5] rounded-[28px] p-8 md:p-12 shadow-md">
          {/* Hymn Title Block */}
          <div className="text-center mb-10 pb-7 border-b border-[#E8E5D5]">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full mb-5 text-xs font-extrabold uppercase tracking-widest bg-[#E5B83B]/10 text-[#C59828] border border-[#E5B83B]/20">
              Hymn {song.songNumber}
            </div>
            <h1 className="font-display font-extrabold text-3xl leading-tight tracking-tight text-[#1A1A16] px-2">
              {song.title}
            </h1>
            {song.category && (
              <p className="text-[10px] font-extrabold uppercase tracking-widest mt-3 text-[#6B6857]">
                {song.category}
              </p>
            )}
          </div>

          {/* Hymn Lyrics */}
          <div
            className="space-y-7 font-sans leading-relaxed text-center"
            style={{ fontSize: `${fontSize}px` }}
            aria-label="Hymn lyrics"
          >
            {sections.map((section, idx) => {
              const isChorus = section.type === 'chorus' || section.type === 'refrain';
              return (
                <div
                  key={`${section.order}-${idx}`}
                  className={`relative py-4 rounded-2xl transition-all duration-300 ${
                    isChorus
                      ? 'bg-[#E5B83B]/[0.05] border-l-4 border-[#E5B83B] px-5 text-center font-semibold italic'
                      : 'px-2'
                  }`}
                  role="region"
                  aria-label={section.label}
                >
                  <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-3 select-none ${
                    isChorus ? 'text-[#C59828]' : 'text-[#A8A592]'
                  }`}>
                    {section.label}
                  </p>
                  <div className={`space-y-1.5 ${isChorus ? 'text-[#9e2a1b] font-medium' : 'text-[#1A1A16]'}`}>
                    {section.lines.map((line: string, lineIdx: number) => (
                      <p key={lineIdx} className="min-h-[1.5em] leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── Footer: Navigation & Actions ─────────────────── */}
      <footer
        className={`fixed bottom-0 left-0 right-0 md:left-64 z-10 px-4 py-3 flex items-center justify-between border-t backdrop-blur-md max-w-3xl mx-auto ${glassBg} ${borderColor}`}
        role="contentinfo"
      >
        {/* Prev hymn */}
        {adjacent?.prev ? (
          <Link
            to={`/app/hymns/${adjacent.prev.id}`}
            aria-label={`Previous hymn: ${adjacent.prev.songNumber}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 bg-[#FAFAF5] text-[#1A1A16] hover:bg-[#E8E5D5]/50 border border-[#E8E5D5]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{adjacent.prev.songNumber}</span>
          </Link>
        ) : <div className="w-16 h-9 opacity-0 pointer-events-none" />}

        {/* Center actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            aria-label="Copy lyrics to clipboard"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-[#FAFAF5] text-[#1A1A16] hover:bg-[#E8E5D5]/50 border border-[#E8E5D5]"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleShare}
            aria-label="Share hymn"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-[#FAFAF5] text-[#1A1A16] hover:bg-[#E8E5D5]/50 border border-[#E8E5D5]"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Next hymn */}
        {adjacent?.next ? (
          <Link
            to={`/app/hymns/${adjacent.next.id}`}
            aria-label={`Next hymn: ${adjacent.next.songNumber}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 bg-[#FAFAF5] text-[#1A1A16] hover:bg-[#E8E5D5]/50 border border-[#E8E5D5]"
          >
            <span>{adjacent.next.songNumber}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : <div className="w-16 h-9 opacity-0 pointer-events-none" />}
      </footer>
    </div>
  );
}

export default HymnDetailPage;
