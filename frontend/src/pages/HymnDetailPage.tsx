import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHymn, useAdjacentHymns } from '../hooks/useHymns';
import { useFavoritesStore } from '../store/favorites.store';
import { useBookmarksStore } from '../store/bookmarks.store';
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
} from 'lucide-react';

type ProjectionSection = SongSection & {
  lines: string[];
};

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

function splitOneSection(section: ProjectionSection): [ProjectionSection[], ProjectionSection[]] {
  const midpoint = Math.ceil(section.lines.length / 2);
  return [
    [{ ...section, lines: section.lines.slice(0, midpoint) }],
    [{ ...section, label: '', lines: section.lines.slice(midpoint) }],
  ];
}

function splitProjectionColumns(sections: ProjectionSection[]) {
  if (sections.length === 0) return [[], []] as [ProjectionSection[], ProjectionSection[]];
  if (sections.length === 1 && sections[0].lines.length > 8) return splitOneSection(sections[0]);
  if (sections.length === 1) return [sections, []] as [ProjectionSection[], ProjectionSection[]];

  const weights = sections.map(sectionWeight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let bestSplit = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  let leftWeight = 0;

  for (let index = 1; index < sections.length; index += 1) {
    leftWeight += weights[index - 1];
    const diff = Math.abs(total - leftWeight * 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = index;
    }
  }

  return [sections.slice(0, bestSplit), sections.slice(bestSplit)] as [ProjectionSection[], ProjectionSection[]];
}

function estimateFontSize(
  columns: [ProjectionSection[], ProjectionSection[]],
  viewport: { width: number; height: number },
  controlsVisible: boolean,
  zoom: number
) {
  const availableHeight = Math.max(260, viewport.height - (controlsVisible ? 168 : 48));
  const availableWidth = Math.max(320, viewport.width - 80);
  const columnWidth = Math.max(140, availableWidth / 2 - 24);
  const columnWeights = columns.map((column) => column.reduce((sum, section) => sum + sectionWeight(section), 0));
  const longestLine = columns.flat(2).reduce((longest, section) => {
    const sectionLongest = section.lines.reduce((max, line) => Math.max(max, line.length), section.label.length);
    return Math.max(longest, sectionLongest);
  }, 1);
  const heightLimited = availableHeight / (Math.max(...columnWeights, 1) * 1.18);
  const widthLimited = columnWidth / Math.max(1, longestLine * 0.54);
  const preferred = PROJECTOR_MAX_FONT * zoom;

  return clamp(Math.floor(Math.min(preferred, heightLimited, widthLimited)), PROJECTOR_MIN_FONT, PROJECTOR_MAX_FONT);
}

function ProjectionColumn({ sections, fontSize }: { sections: ProjectionSection[]; fontSize: number }) {
  return (
    <div className="min-w-0 flex flex-col justify-center gap-[0.75em]">
      {sections.map((section, sectionIndex) => {
        const isChorus = section.type === 'chorus' || section.type === 'refrain';

        return (
          <section
            key={`${section.order}-${section.label}-${sectionIndex}`}
            className={isChorus ? 'border-l-4 border-yellow pl-[0.65em]' : undefined}
          >
            {section.label && (
              <p
                className="mb-[0.4em] font-extrabold uppercase text-yellow/70"
                style={{ fontSize: `${Math.max(8, fontSize * 0.42)}px`, letterSpacing: 0 }}
              >
                {section.label}
              </p>
            )}
            <div className={isChorus ? 'font-bold text-cream' : 'font-semibold text-cream/90'}>
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

export function HymnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: song, isLoading, error } = useHymn(id || '');
  const { data: adjacent } = useAdjacentHymns(id || '');

  const { favoriteIds, addFavorite, removeFavorite } = useFavoritesStore();
  const { bookmarkIds, addBookmark, removeBookmark } = useBookmarksStore();

  const [fontSize, setFontSize] = useState(18);
  const [isLightMode, setIsLightMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProjecting, setIsProjecting] = useState(false);
  const [projectorControlsVisible, setProjectorControlsVisible] = useState(true);
  const [projectorZoom, setProjectorZoom] = useState(1);
  const [viewport, setViewport] = useState(getInitialViewport);
  const clickTimerRef = useRef<number | null>(null);

  const sections = useMemo(() => parseSections(song), [song]);
  const projectionColumns = useMemo(() => splitProjectionColumns(sections), [sections]);
  const projectorFontSize = useMemo(
    () => estimateFontSize(projectionColumns, viewport, projectorControlsVisible, projectorZoom),
    [projectionColumns, projectorControlsVisible, projectorZoom, viewport]
  );

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

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-10rem)]">
        <Spinner />
        <span className="text-sm text-cream/60 mt-4 uppercase tracking-widest font-semibold">
          Opening Hymn Book...
        </span>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="p-6 text-center text-red-500 font-bold mt-10">
        Hymn not found or failed to load.
      </div>
    );
  }

  const isFavorited = favoriteIds.includes(song.id);
  const isBookmarked = bookmarkIds.includes(song.id);

  const toggleFavorite = () => {
    if (isFavorited) {
      removeFavorite(song.id);
    } else {
      addFavorite(song.id);
    }
  };

  const toggleBookmark = () => {
    if (isBookmarked) {
      removeBookmark(song.id);
    } else {
      addBookmark(song.id);
    }
  };

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
      alert('Link copied to clipboard!');
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

  if (isProjecting) {
    return (
      <div
        className="fixed inset-0 z-[100] overflow-hidden bg-[#050505] text-cream select-none"
        onClick={handleProjectionClick}
        onDoubleClick={handleProjectionDoubleClick}
        style={{ cursor: projectorControlsVisible ? 'default' : 'none' }}
      >
        <header
          className={`absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 bg-black/70 backdrop-blur-md border-b border-white/10 transition-opacity duration-200 ${projectorControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase text-yellow">
              Hymn {song.songNumber}
            </p>
            <h1 className="truncate text-xl font-extrabold text-cream">
              {song.title}
            </h1>
          </div>
          <button
            onClick={exitProjection}
            className="h-11 w-11 rounded-full bg-white/10 text-cream flex items-center justify-center hover:bg-white/15 transition-colors"
            title="Exit projection"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main
          className="h-dvh w-screen overflow-hidden grid grid-cols-2"
          style={{
            gap: `${Math.max(24, viewport.width * 0.035)}px`,
            paddingTop: projectorControlsVisible ? 92 : 28,
            paddingBottom: projectorControlsVisible ? 112 : 28,
            paddingLeft: Math.max(28, viewport.width * 0.045),
            paddingRight: Math.max(28, viewport.width * 0.045),
            fontSize: `${projectorFontSize}px`,
            lineHeight: 1.12,
          }}
        >
          <ProjectionColumn sections={projectionColumns[0]} fontSize={projectorFontSize} />
          <ProjectionColumn sections={projectionColumns[1]} fontSize={projectorFontSize} />
        </main>

        <footer
          className={`absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-6 py-4 bg-black/70 backdrop-blur-md border-t border-white/10 transition-opacity duration-200 ${projectorControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => goToAdjacent(adjacent?.prev?.id)}
            disabled={!adjacent?.prev}
            className="h-11 px-4 rounded-xl bg-white/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-2 font-bold hover:bg-white/15 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProjectorZoom((value) => clamp(value - 0.08, 0.7, 1.35))}
              className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
              title="Zoom out"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="min-w-14 text-center text-xs font-extrabold text-cream/70">
              {Math.round(projectorZoom * 100)}%
            </span>
            <button
              onClick={() => setProjectorZoom((value) => clamp(value + 0.08, 0.7, 1.35))}
              className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
              title="Zoom in"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => goToAdjacent(adjacent?.next?.id)}
            disabled={!adjacent?.next}
            className="h-11 px-4 rounded-xl bg-white/10 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-2 font-bold hover:bg-white/15 transition-colors"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-all duration-300 ${isLightMode ? 'bg-[#FFFDF0] text-black' : 'bg-[#140622] text-cream'}`}>
      <header className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md ${isLightMode ? 'bg-[#FFFDF0]/80 border-black/10' : 'bg-[#140622]/80 border-white/10'}`}>
        <div className="flex items-center gap-3">
          <Link
            to={song.collection ? `/app/collections/${song.collection.slug}` : '/app/home'}
            className={`w-9 h-9 rounded-full bg-black/5 flex items-center justify-center transition-all ${isLightMode ? 'text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs font-extrabold uppercase tracking-widest opacity-60">
            {song.collection?.name || 'Hymn'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFontSize((size) => Math.max(14, size - 2))}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Decrease font size"
          >
            <span className="font-extrabold text-sm select-none">A-</span>
          </button>
          <button
            onClick={() => setFontSize((size) => Math.min(32, size + 2))}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Increase font size"
          >
            <span className="font-extrabold text-lg select-none">A+</span>
          </button>
          <button
            onClick={enterProjection}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Project hymn"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Toggle theme"
          >
            {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Bookmark"
          >
            <Bookmark className={`w-5 h-5 transition-colors ${isBookmarked ? 'fill-yellow text-yellow stroke-[2px]' : ''}`} />
          </button>
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Favorite"
          >
            <Heart className={`w-5 h-5 transition-colors ${isFavorited ? 'fill-red-500 text-red-500 stroke-[2.5px]' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 overflow-y-auto max-w-[430px] mx-auto w-full select-text pb-28">
        <div className="text-center mb-8 border-b pb-6 border-current/10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-yellow text-black font-sans font-extrabold text-base mb-4 shadow-sm">
            Hymn {song.songNumber}
          </div>
          <h1 className="font-sans font-extrabold text-3xl leading-tight tracking-tight px-2">
            {song.title}
          </h1>
          {song.category && (
            <p className="text-xs font-extrabold uppercase tracking-widest opacity-55 mt-3">
              {song.category}
            </p>
          )}
        </div>

        <div
          className="space-y-8 font-sans leading-relaxed tracking-wide text-center"
          style={{ fontSize: `${fontSize}px` }}
        >
          {sections.map((section, idx) => {
            const isChorus = section.type === 'chorus' || section.type === 'refrain';
            return (
              <div
                key={`${section.order}-${idx}`}
                className={`py-3 rounded-2xl transition-all duration-300 ${
                  isChorus
                    ? isLightMode
                      ? 'bg-black/5 border-l-4 border-yellow px-4 font-bold text-center'
                      : 'bg-white/5 border-l-4 border-yellow px-4 font-bold text-center'
                    : ''
                }`}
              >
                <p className="text-xs font-extrabold uppercase tracking-widest opacity-40 mb-3 select-none">
                  {section.label}
                </p>
                <div className="space-y-2">
                  {section.lines.map((line: string, lineIdx: number) => (
                    <p key={lineIdx} className="min-h-[1.5em]">{line}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className={`fixed bottom-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between border-t backdrop-blur-md max-w-[430px] mx-auto ${
        isLightMode ? 'bg-[#FFFDF0]/90 border-black/10' : 'bg-[#140622]/90 border-white/10'
      }`}>
        {adjacent?.prev ? (
          <Link
            to={`/app/hymns/${adjacent.prev.id}`}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-extrabold transition-all active:scale-95 ${
              isLightMode ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{adjacent.prev.songNumber}</span>
          </Link>
        ) : (
          <div className="w-16 h-9 opacity-0 pointer-events-none" />
        )}

        <div className="flex gap-4">
          <button
            onClick={handleCopy}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isLightMode ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'
            }`}
            title="Copy Lyrics"
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
          </button>
          <button
            onClick={handleShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isLightMode ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'
            }`}
            title="Share Hymn"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {adjacent?.next ? (
          <Link
            to={`/app/hymns/${adjacent.next.id}`}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-extrabold transition-all active:scale-95 ${
              isLightMode ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'
            }`}
          >
            <span>{adjacent.next.songNumber}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <div className="w-16 h-9 opacity-0 pointer-events-none" />
        )}
      </footer>
    </div>
  );
}
