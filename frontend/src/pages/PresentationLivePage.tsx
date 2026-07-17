import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationStore } from '../store/presentation.store';
import { useHymn } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Tv,
  X,
  Target,
  Layers,
  Sparkles,
  Sliders,
  Save
} from 'lucide-react';
import type { SongSection } from '../types';

type ProjectionSection = SongSection & { lines: string[] };

// Parse lyrics into sections
function parseSections(song: any): ProjectionSection[] {
  if (!song) return [];
  if (Array.isArray(song.sections) && song.sections.length > 0) {
    return song.sections.map((section: any, index: number) => ({
      ...section,
      label: section.label || `Verse ${index + 1}`,
      lines: Array.isArray(section.lines) ? section.lines.map(String) : [],
      order: section.order ?? index + 1,
    }));
  }

  try {
    const parsed = JSON.parse(song.lyrics || '[]');
    if (Array.isArray(parsed)) {
      return parsed.map((section: any, index: number) => ({
        id: section.id ?? index + 1,
        type: section.type || 'verse',
        label: section.label || `Verse ${index + 1}`,
        content: section.content || '',
        lines: Array.isArray(section.lines) ? section.lines.map(String) : [],
        order: section.order ?? index + 1,
      }));
    }
  } catch {
    // Fall through to plain text
  }

  return [{
    id: 1,
    type: 'verse',
    label: 'Lyrics',
    content: song.lyrics || '',
    lines: (song.lyrics || '').split('\n'),
    order: 1,
  }];
}


// Layout Settings Interface
export interface LayoutSettings {
  isCustom: boolean;
  titleSize: number;
  titlePosition: 'left' | 'center' | 'right';
  titleColor: string;
  titleTopOffset: number;
  lyricsSize: number;
  lyricsAlign: 'left' | 'center' | 'right';
  lineSpacing: number;
  verseSpacing: number;
  columnsCount: 'auto' | 1 | 2 | 3;
  chorusStyle: 'border-italic' | 'pink-card' | 'bold-red' | 'plain';
  bgBrightness: number;
}

export const LOCAL_STORAGE_KEY = 'morija_presentation_default_layout';

export const loadDefaultSettings = (): LayoutSettings => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load layout settings from localStorage', e);
  }
  return {
    isCustom: false,
    titleSize: 56,
    titlePosition: 'center',
    titleColor: '#1B2472',
    titleTopOffset: 10,
    lyricsSize: 28,
    lyricsAlign: 'center',
    lineSpacing: 1.45,
    verseSpacing: 1.2,
    columnsCount: 'auto',
    chorusStyle: 'border-italic',
    bgBrightness: 100,
  };
};

// Calculate sections vertical height weight
function sectionWeight(section: ProjectionSection) {
  return section.lines.reduce((total, line) => (
    total + Math.max(1, Math.ceil(line.trim().length / 32))
  ), 2.2);
}

// Group sections into multiple pages/screens dynamically ONLY when it doesn't fit on one screen
function groupSectionsIntoScreens(
  sections: ProjectionSection[],
  viewport: { width: number; height: number },
  zoom: number,
  forcedColumnsCount?: 1 | 2 | 3
) {
  if (sections.length === 0) return [[]] as ProjectionSection[][];

  // First, see if we can fit everything on a single screen
  const allColumns = splitProjectionColumns(sections, forcedColumnsCount);
  const sizeWithAllOnOnePage = estimateFontSize(allColumns, viewport, zoom);

  // If the font size is comfortable (>= 18px), we keep it all on one screen!
  if (sizeWithAllOnOnePage >= 18) {
    return [sections];
  }

  // Otherwise, split into multiple screens. Group sections so that each screen has at most 3 sections or 12 lines
  const screens: ProjectionSection[][] = [];
  let currentScreen: ProjectionSection[] = [];
  let currentLines = 0;

  for (const sec of sections) {
    const linesCount = sec.lines.length;
    // Split screen if total lines exceed 12 or if we already have 2 sections and adding this would make it too busy
    if ((currentLines + linesCount > 12 && currentScreen.length > 0) || currentScreen.length >= 3) {
      screens.push(currentScreen);
      currentScreen = [sec];
      currentLines = linesCount;
    } else {
      currentScreen.push(sec);
      currentLines += linesCount;
    }
  }

  if (currentScreen.length > 0) {
    screens.push(currentScreen);
  }

  return screens.length > 0 ? screens : [[]];
}

// Split page sections into 1, 2, or 3 columns dynamically to maximize readability
function splitProjectionColumns(sections: ProjectionSection[], forcedCount?: 1 | 2 | 3) {
  const totalLines = sections.reduce((sum, s) => sum + s.lines.length, 0);

  // Forced 1 column override
  if (forcedCount === 1) {
    return [sections, [], []] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // Forced 3 columns override
  if (forcedCount === 3) {
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
    
    if (col2.length === 0 && col1.length > 1) {
      col2.push(col1.pop()!);
    }
    if (col3.length === 0 && col2.length > 1) {
      col3.push(col2.pop()!);
    }
    
    return [col1, col2, col3] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // Forced 2 columns override
  if (forcedCount === 2) {
    if (sections.length === 1) {
      const sec = sections[0];
      const midpoint = Math.ceil(sec.lines.length / 2);
      return [
        [{ ...sec, lines: sec.lines.slice(0, midpoint) }],
        [{ ...sec, label: '', lines: sec.lines.slice(midpoint) }],
        []
      ] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
    }

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

  // Auto layout: 1-column layout for short hymns
  if (totalLines <= 7) {
    return [sections, [], []] as [ProjectionSection[], ProjectionSection[], ProjectionSection[]];
  }

  // Auto layout: 3-column layout for exceptionally long/multi-verse hymns
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

  // Auto layout: 2-column layout (default)
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

// Auto font size estimator based on dimensions & active layout columns (Instruction 10)
function estimateFontSize(
  columns: [ProjectionSection[], ProjectionSection[], ProjectionSection[]],
  viewport: { width: number; height: number },
  zoom: number
) {
  const availableHeight = Math.max(300, viewport.height - 200);
  const activeCols = columns.filter(col => col.length > 0).length || 1;
  
  // Dynamic screen utilization based on columns
  let horizontalMarginMultiplier = 0.54; // 2 cols
  if (activeCols === 1) {
    horizontalMarginMultiplier = 0.45; // narrow center
  } else if (activeCols === 3) {
    horizontalMarginMultiplier = 0.78; // wider screen usage
  }
  
  const availableWidth = Math.max(400, viewport.width * horizontalMarginMultiplier);
  const columnWidth = Math.max(180, availableWidth / activeCols - 24);
  
  const columnWeights = columns.map((col) => col.reduce((sum, sec) => sum + sectionWeight(sec), 0));
  const maxWeight = Math.max(...columnWeights, 1);
  
  const longestLine = columns.flat(2).reduce((longest, sec) => {
    const maxLine = sec.lines.reduce((max, line) => Math.max(max, line.length), sec.label.length);
    return Math.max(longest, maxLine);
  }, 1);

  const heightLimited = availableHeight / (maxWeight * 1.25);
  const widthLimited = columnWidth / (longestLine * 0.55);
  
  // Base default sizes prioritized by layout structure to prevent zooming
  let preferred = 38;
  if (activeCols === 1) preferred = 50; // short hymns get giant font sizes
  else if (activeCols === 3) preferred = 30; // 3 columns get slightly tighter but highly readable font
  
  preferred = preferred * zoom;

  return Math.min(Math.max(Math.floor(Math.min(preferred, heightLimited, widthLimited)), 18), 58);
}

export function PresentationLivePage() {
  const navigate = useNavigate();
  const { queue, activeIndex, setActiveIndex } = usePresentationStore();

  // Redirect back if queue is empty
  useEffect(() => {
    if (queue.length === 0) {
      navigate('/app/present');
    }
  }, [queue, navigate]);

  const activeSong = queue[activeIndex];
  const { data: song, isLoading } = useHymn(activeSong?.id || '');

  // Slide state inside active song
  const [screenIndex, setScreenIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Laser pointer config (Instruction 11)
  const [laserPointer, setLaserPointer] = useState(false);
  const [pointerSize, setPointerSize] = useState<10 | 18 | 28>(18); // Professional sizes
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  
  const [showQueuePicker, setShowQueuePicker] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Custom Presentation Layout Editor States
  const [showEditor, setShowEditor] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(loadDefaultSettings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showControlsRef = useRef(true); // tracks latest showControls for click handler

  // Resolved columns count manual overrides
  const resolvedColsCount = useMemo(() => {
    if (layoutSettings.isCustom && layoutSettings.columnsCount !== 'auto') {
      return layoutSettings.columnsCount;
    }
    return undefined;
  }, [layoutSettings.isCustom, layoutSettings.columnsCount]);

  // Parse and group current hymn's sections
  const sections = useMemo(() => parseSections(song), [song]);
  const screens = useMemo(() => 
    groupSectionsIntoScreens(sections, viewport, zoom, resolvedColsCount), 
    [sections, viewport, zoom, resolvedColsCount]
  );
  const activeScreenSections = useMemo(() => screens[screenIndex] || [], [screens, screenIndex]);
  const columns = useMemo(() => 
    splitProjectionColumns(activeScreenSections, resolvedColsCount), 
    [activeScreenSections, resolvedColsCount]
  );
  
  const fontSize = useMemo(() => estimateFontSize(columns, viewport, zoom), [columns, viewport, zoom]);
  const activeColsCount = useMemo(() => columns.filter(c => c.length > 0).length, [columns]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track Fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Reset screen index when changing active song
  useEffect(() => {
    setScreenIndex(0);
  }, [activeIndex]);

  // Autohide controls — shows controls and resets 4s hide timer
  const resetControlsTimeout = () => {
    showControlsRef.current = true;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      // Don't auto-hide if editor is open!
      if (!showEditor) {
        showControlsRef.current = false;
        setShowControls(false);
        setShowQueuePicker(false);
      }
    }, 4000);
  };


  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [activeIndex, screenIndex, showEditor]);

  const handleMouseMove = (e: React.MouseEvent) => {
    resetControlsTimeout();
    if (laserPointer) {
      setPointerPos({ x: e.clientX, y: e.clientY });
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimeout();
      
      switch (e.key) {
        case 'ArrowRight':
        case 'Space':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (screenIndex > 0) setScreenIndex((s) => s - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (screenIndex < screens.length - 1) setScreenIndex((s) => s + 1);
          break;
        case 'Escape':
          e.preventDefault();
          exitPresentation();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setLaserPointer((p) => !p);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom((z) => Math.min(z + 0.05, 1.5));
          break;
        case '-':
        case '_':
          e.preventDefault();
          setZoom((z) => Math.max(z - 0.05, 0.7));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenIndex, screens.length, activeIndex, laserPointer]);

  // Fullscreen controls
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Single tap: toggle controls. Double tap: fullscreen.
  const handleScreenClick = () => {
    if (clickTimerRef.current) {
      // Second tap arrived quickly — treat as double tap → fullscreen
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      toggleFullscreen();
    } else {
      // First tap — wait 220ms to see if another arrives
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        // Toggle: if visible, hide; if hidden, show
        if (showControlsRef.current) {
          // If editor is open, don't hide controls, just focus content
          if (!showEditor) {
            showControlsRef.current = false;
            setShowControls(false);
            setShowQueuePicker(false);
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          }
        } else {
          resetControlsTimeout();
        }
      }, 220);
    }
  };

  const exitPresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    navigate('/app/present');
  };

  // Queue navigators
  const handleNext = () => {
    if (screenIndex < screens.length - 1) {
      setScreenIndex((s) => s + 1);
    } else if (activeIndex < queue.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (screenIndex > 0) {
      setScreenIndex((s) => s - 1);
    } else if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  // Toggle/Cycle pointer sizes
  const cyclePointerSize = () => {
    setPointerSize(prev => prev === 10 ? 18 : prev === 18 ? 28 : 10);
  };

  // Helper to safely merge customized layout settings
  const setCustomSetting = (updater: (prev: LayoutSettings) => Partial<LayoutSettings>) => {
    setLayoutSettings(prev => {
      const next = { ...prev, ...updater(prev) };
      if (!next.isCustom) {
        next.isCustom = true;
        // Seed initial values from current auto values so there's no sudden layout jump
        next.lyricsSize = prev.lyricsSize || fontSize;
        next.columnsCount = prev.columnsCount === 'auto' ? (activeColsCount as any) : prev.columnsCount;
      }
      return next;
    });
  };

  const handleSaveDefault = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layoutSettings));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save layout settings', err);
    }
  };

  const handleResetAuto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLayoutSettings({
      isCustom: false,
      titleSize: 56,
      titlePosition: 'center',
      titleColor: '#1B2472',
      titleTopOffset: 10,
      lyricsSize: 28,
      lyricsAlign: 'center',
      lineSpacing: 1.45,
      verseSpacing: 1.2,
      columnsCount: 'auto',
      chorusStyle: 'border-italic',
      bgBrightness: 100,
    });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  if (isLoading || !activeSong) {
    return (
      <div className="min-h-screen bg-[#0A0A08] flex flex-col justify-center items-center">
        <Spinner />
        <span className="text-xs text-[#FFFDF0]/50 mt-4 uppercase tracking-[0.2em] font-bold">
          Preparing Presentation Mode...
        </span>
      </div>
    );
  }

  // Resolved Visual Values
  const NAVY = '#1B2472';

  const resolvedTitleSize = layoutSettings.isCustom 
    ? `${layoutSettings.titleSize}px` 
    : `clamp(32px, ${activeColsCount === 1 ? '7vw' : '5.5vw'}, 88px)`;

  const resolvedTitleAlign = layoutSettings.isCustom 
    ? layoutSettings.titlePosition 
    : 'center';

  const resolvedTitleColor = layoutSettings.isCustom 
    ? layoutSettings.titleColor 
    : NAVY;

  const resolvedTitleTopOffset = layoutSettings.isCustom 
    ? `${layoutSettings.titleTopOffset}px` 
    : '4px';

  const resolvedLyricsSize = layoutSettings.isCustom 
    ? layoutSettings.lyricsSize 
    : fontSize;

  const resolvedLyricsAlign = layoutSettings.isCustom 
    ? layoutSettings.lyricsAlign 
    : 'center';

  const resolvedLineSpacing = layoutSettings.isCustom 
    ? layoutSettings.lineSpacing 
    : 1.45;

  const resolvedVerseSpacing = layoutSettings.isCustom 
    ? `${layoutSettings.verseSpacing}em` 
    : '0.55em';

  const resolvedChorusStyle = layoutSettings.isCustom
    ? layoutSettings.chorusStyle
    : 'border-italic';

  // Render a single column of sections with dividers
  const renderColumn = (col: ProjectionSection[], colIndex: number) => {
    if (col.length === 0) return null;
    return (
      <div
        key={`col-${colIndex}`}
        className="flex flex-col justify-center"
        style={{ gap: 0 }}
      >
        {col.map((section, sIdx) => {
          const isChorus = section.type === 'chorus' || section.type === 'refrain';
          const isLast = sIdx === col.length - 1;

          // Chorus visual highlights (Solution 1 / Layout Editor Options)
          let chorusClass = '';
          let chorusStyleObj: React.CSSProperties = {};

          if (isChorus) {
            switch (resolvedChorusStyle) {
              case 'border-italic':
                chorusClass = 'border-l-4 pl-4 italic';
                chorusStyleObj = { borderColor: '#8B1A1A', color: '#8B1A1A' };
                break;
              case 'pink-card':
                chorusClass = 'bg-[#FFF2F4] border border-[#FCE7F3] rounded-[20px] p-5 shadow-sm text-center my-2 transition-all';
                chorusStyleObj = { color: '#C2185B', fontStyle: 'italic' };
                break;
              case 'bold-red':
                chorusClass = 'font-black text-center transition-all';
                chorusStyleObj = { color: '#8B1A1A' };
                break;
              case 'plain':
              default:
                chorusClass = 'text-center';
                chorusStyleObj = {};
                break;
            }
          }

          return (
            <React.Fragment key={`col-${colIndex}-${sIdx}`}>
              <div className={`transition-all duration-300 ${isChorus ? chorusClass : ''}`} style={isChorus ? chorusStyleObj : undefined}>
                <section style={{ textAlign: resolvedLyricsAlign }} className="px-2">
                  {section.label && (
                    <p
                      className="font-extrabold uppercase mb-[0.2em]"
                      style={{
                        fontSize: `${Math.max(11, resolvedLyricsSize * 0.42)}px`,
                        color: isChorus ? 'inherit' : resolvedTitleColor,
                        letterSpacing: '0.08em',
                        opacity: 0.65,
                      }}
                    >
                      {section.label}
                    </p>
                  )}
                  <div
                    style={{
                      fontSize: `${resolvedLyricsSize}px`,
                      color: isChorus ? 'inherit' : resolvedTitleColor,
                      fontWeight: isChorus ? 700 : 600,
                      lineHeight: resolvedLineSpacing,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {section.lines.map((line, lIdx) => (
                      <p key={lIdx} className="break-words">
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </section>
              </div>

              {/* Decorative divider between sections */}
              {!isLast && (
                <div 
                  className="flex items-center gap-2 px-6 transition-all"
                  style={{
                    marginTop: resolvedVerseSpacing,
                    marginBottom: resolvedVerseSpacing,
                  }}
                >
                  <div className="flex-1 h-px" style={{ backgroundColor: `${resolvedTitleColor}22` }} />
                  <span style={{ color: `${resolvedTitleColor}40`, fontSize: '11px' }}>❋</span>
                  <div className="flex-1 h-px" style={{ backgroundColor: `${resolvedTitleColor}22` }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Overall progress
  const totalProgress = queue.length > 0
    ? Math.round(((activeIndex + (screenIndex + 1) / Math.max(screens.length, 1)) / queue.length) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen overflow-hidden select-none flex flex-row"
      onMouseMove={handleMouseMove}
      onClick={handleScreenClick}
      style={{
        backgroundImage: `url('/bg-worship.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        cursor: showControls ? 'default' : 'none',
        backgroundColor: '#E8B830',
      }}
    >
      {/* Background Dimming Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[0] transition-opacity duration-300"
        style={{
          backgroundColor: 'black',
          opacity: (100 - layoutSettings.bgBrightness) / 100,
        }}
      />

      {/* Laser Pointer */}
      {laserPointer && (
        <div
          className="absolute rounded-full bg-red-600/90 border border-red-300 pointer-events-none z-[110] blur-[0.5px] shadow-[0_0_8px_#ef4444,0_0_16px_#ef4444]"
          style={{
            width: `${pointerSize}px`,
            height: `${pointerSize}px`,
            left: pointerPos.x - pointerSize / 2,
            top: pointerPos.y - pointerSize / 2,
            transition: 'left 0.04s ease-out, top 0.04s ease-out',
          }}
        />
      )}

      {/* ── PRESENTATION CONTENT WRAPPER (Left / Main Area) ── */}
      <div className="flex-1 flex flex-col justify-between relative h-full min-w-0 z-10">
        
        {/* HEADER */}
        <header
          className={`relative z-50 flex items-start justify-between px-7 pt-5 pb-2 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div>
            <div
              className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.18em]"
              style={{ color: resolvedTitleColor, opacity: 0.55 }}
            >
              <Tv size={10} strokeWidth={2.5} />
              PRESENTATION
            </div>
            <div
              className="text-[11px] font-bold mt-0.5"
              style={{ color: resolvedTitleColor, opacity: 0.4 }}
            >
              {activeIndex + 1} OF {queue.length}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Edit Layout Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEditor(prev => !prev);
              }}
              className="flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all hover:opacity-85 active:scale-95"
              style={{ backgroundColor: showEditor ? '#D97706' : resolvedTitleColor }}
            >
              <Sliders size={13} strokeWidth={2.5} />
              {showEditor ? 'Close Editor' : 'Edit Layout'}
            </button>

            {/* Exit Button */}
            <button
              onClick={(e) => { e.stopPropagation(); exitPresentation(); }}
              className="flex items-center gap-2 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all hover:opacity-85 active:scale-95"
              style={{ backgroundColor: resolvedTitleColor }}
            >
              <X size={13} strokeWidth={2.5} />
              Exit
            </button>
          </div>
        </header>

        {/* SONG TITLE CONTAINER */}
        {song && (
          <div 
            className="relative z-10 text-center px-10 pb-2 transition-all duration-300"
            style={{ 
              paddingTop: resolvedTitleTopOffset, 
              textAlign: resolvedTitleAlign as any 
            }}
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-1"
              style={{ color: resolvedTitleColor, opacity: 0.5 }}
            >
              {song.collection?.name ? `${song.collection.name.toUpperCase()} / ` : ''}{song.songNumber}
            </p>
            <h1
              className="font-black uppercase leading-none tracking-tight transition-all duration-300"
              style={{
                color: resolvedTitleColor,
                fontFamily: "'Inter', sans-serif",
                fontSize: resolvedTitleSize,
              }}
            >
              {song.title}
            </h1>
          </div>
        )}

        {/* LYRICS COLUMNS */}
        <main
          className={`flex-1 overflow-hidden z-10 grid transition-all duration-300 ${
            activeColsCount === 1 ? 'grid-cols-1' : activeColsCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}
          style={{
            paddingLeft:  activeColsCount === 1 ? '16%' : activeColsCount === 3 ? '3%'  : '5%',
            paddingRight: activeColsCount === 1 ? '16%' : activeColsCount === 3 ? '3%'  : '5%',
            paddingBottom: '2%',
            gap: activeColsCount === 1 ? '0' : activeColsCount === 3 ? '1.5%' : '2%',
            alignItems: 'center',
          }}
        >
          {renderColumn(columns[0], 0)}
          {renderColumn(columns[1], 1)}
          {renderColumn(columns[2], 2)}
        </main>

        {/* FOOTER */}
        <footer
          className={`relative z-50 flex items-center justify-between px-6 py-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            disabled={activeIndex === 0 && screenIndex === 0}
            className="flex items-center gap-2 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md disabled:opacity-30 transition-all hover:opacity-85 active:scale-95"
            style={{ backgroundColor: resolvedTitleColor }}
          >
            <ChevronLeft size={15} strokeWidth={2.5} />
            Previous
          </button>

          <div className="flex-1 mx-6 flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.05, 0.7)); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors hover:bg-white/30 bg-white/20"
              style={{ color: resolvedTitleColor }}
            >
              <Minus size={14} strokeWidth={2.5} />
            </button>
            <span className="text-[11px] font-extrabold w-9 text-center" style={{ color: resolvedTitleColor, opacity: 0.6 }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.05, 1.5)); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors hover:bg-white/30 bg-white/20"
              style={{ color: resolvedTitleColor }}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>

            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${resolvedTitleColor}18` }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalProgress}%`,
                  backgroundColor: '#E5B83B',
                }}
              />
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setLaserPointer(!laserPointer); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                laserPointer ? 'bg-red-500 text-white' : 'bg-white/20 hover:bg-white/30'
              }`}
              style={{ color: laserPointer ? 'white' : resolvedTitleColor }}
              title="Laser Pointer (P)"
            >
              <Target size={14} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              style={{ color: resolvedTitleColor }}
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {screens.length > 1 && (
              <div className="flex gap-1.5 items-center">
                {screens.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setScreenIndex(idx); }}
                    className="rounded-full transition-all"
                    style={{
                      width: screenIndex === idx ? '20px' : '8px',
                      height: '8px',
                      backgroundColor: screenIndex === idx ? resolvedTitleColor : `${resolvedTitleColor}35`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            disabled={activeIndex === queue.length - 1 && screenIndex === screens.length - 1}
            className="flex items-center gap-2 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md disabled:opacity-30 transition-all hover:opacity-85 active:scale-95"
            style={{ backgroundColor: resolvedTitleColor }}
          >
            Next
            <ChevronRight size={15} strokeWidth={2.5} />
          </button>
        </footer>
      </div>

      {/* ── EDIT PANEL (Right Drawer) ── */}
      {showEditor && (
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent closing editor or triggering slides
          className="w-[360px] h-full bg-[#FFFDF5] border-l border-[#E8E5D5] flex flex-col z-[100] shadow-2xl overflow-y-auto text-left select-text relative"
        >
          {/* Editor Header */}
          <div className="sticky top-0 bg-[#FFFDF5] border-b border-[#E8E5D5] p-5 flex items-center justify-between z-10">
            <div>
              <h2 className="font-display font-extrabold text-base text-[#1A1A16]">Layout Editor</h2>
              <p className="text-[10px] text-[#A8A592] uppercase font-bold mt-0.5 tracking-wider">Adjust Presentation Live</p>
            </div>
            <button 
              onClick={() => setShowEditor(false)}
              className="w-8 h-8 rounded-lg hover:bg-[#E8E5D5]/50 flex items-center justify-center text-[#6B6857] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Editor Options */}
          <div className="p-5 space-y-6 flex-1 text-[#1A1A16]">
            
            {/* Category: Title Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#C59828] border-b border-[#E8E5D5] pb-1.5">Song Title</h3>
              
              {/* Title Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Font Size</span>
                  <span>{layoutSettings.titleSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="24" 
                  max="100" 
                  value={layoutSettings.titleSize}
                  onChange={(e) => setCustomSetting(() => ({ titleSize: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>

              {/* Title Top Offset */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Top Offset</span>
                  <span>{layoutSettings.titleTopOffset}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="120" 
                  value={layoutSettings.titleTopOffset}
                  onChange={(e) => setCustomSetting(() => ({ titleTopOffset: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>

              {/* Title Position (Alignment) */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#6B6857]">Alignment</span>
                <div className="flex rounded-lg bg-[#FAFAF5] border border-[#E8E5D5] p-1 gap-1">
                  {(['left', 'center', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setCustomSetting(() => ({ titlePosition: pos }))}
                      className={`flex-1 py-1 text-[10px] font-extrabold uppercase rounded transition-all ${
                        layoutSettings.titlePosition === pos
                          ? 'bg-[#C59828] text-white shadow-sm'
                          : 'text-[#6B6857] hover:bg-[#E8E5D5]/50'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Accent Color */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#6B6857]">Brand Color</span>
                <div className="flex gap-2">
                  {['#1B2472', '#C59828', '#8B1A1A', '#000000', '#C2185B'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setCustomSetting(() => ({ titleColor: color }))}
                      className="w-7 h-7 rounded-full border border-black/10 flex items-center justify-center relative transition-transform hover:scale-110 active:scale-95"
                      style={{ backgroundColor: color }}
                    >
                      {layoutSettings.titleColor === color && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category: Lyrics Settings */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#C59828] border-b border-[#E8E5D5] pb-1.5">Hymn Lyrics</h3>
              
              {/* Lyrics Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Font Size</span>
                  <span>{layoutSettings.lyricsSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="14" 
                  max="72" 
                  value={layoutSettings.lyricsSize}
                  onChange={(e) => setCustomSetting(() => ({ lyricsSize: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>

              {/* Lyrics Align */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#6B6857]">Alignment</span>
                <div className="flex rounded-lg bg-[#FAFAF5] border border-[#E8E5D5] p-1 gap-1">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => setCustomSetting(() => ({ lyricsAlign: align }))}
                      className={`flex-1 py-1 text-[10px] font-extrabold uppercase rounded transition-all ${
                        layoutSettings.lyricsAlign === align
                          ? 'bg-[#C59828] text-white shadow-sm'
                          : 'text-[#6B6857] hover:bg-[#E8E5D5]/50'
                      }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line height */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Line Spacing</span>
                  <span>{layoutSettings.lineSpacing}</span>
                </div>
                <input 
                  type="range" 
                  min="1.1" 
                  max="2.2" 
                  step="0.05"
                  value={layoutSettings.lineSpacing}
                  onChange={(e) => setCustomSetting(() => ({ lineSpacing: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>

              {/* Verse spacing */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Verse Spacing</span>
                  <span>{layoutSettings.verseSpacing}em</span>
                </div>
                <input 
                  type="range" 
                  min="0.2" 
                  max="3.0" 
                  step="0.1"
                  value={layoutSettings.verseSpacing}
                  onChange={(e) => setCustomSetting(() => ({ verseSpacing: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>
            </div>

            {/* Category: Columns & Highlights */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#C59828] border-b border-[#E8E5D5] pb-1.5">Columns & Chorus</h3>
              
              {/* Columns Count */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#6B6857]">Columns</span>
                <div className="flex rounded-lg bg-[#FAFAF5] border border-[#E8E5D5] p-1 gap-1">
                  {(['auto', 1, 2, 3] as const).map((colOpt) => (
                    <button
                      key={colOpt}
                      onClick={() => setCustomSetting(() => ({ columnsCount: colOpt }))}
                      className={`flex-1 py-1 text-[10px] font-extrabold uppercase rounded transition-all ${
                        layoutSettings.columnsCount === colOpt
                          ? 'bg-[#C59828] text-white shadow-sm'
                          : 'text-[#6B6857] hover:bg-[#E8E5D5]/50'
                      }`}
                    >
                      {colOpt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chorus Style */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#6B6857]">Chorus Highlight Style</span>
                <select
                  value={layoutSettings.chorusStyle}
                  onChange={(e) => setCustomSetting(() => ({ chorusStyle: e.target.value as any }))}
                  className="w-full bg-[#FAFAF5] border border-[#E8E5D5] rounded-lg px-3 py-2 text-xs font-bold text-[#6B6857] focus:outline-none focus:border-[#C59828]"
                >
                  <option value="border-italic">Navy Border & Italic</option>
                  <option value="pink-card">Joyful Pink Pastel Card</option>
                  <option value="bold-red">Deep Red & Extra Bold Text</option>
                  <option value="plain">No Styling (Same as Verse)</option>
                </select>
              </div>
            </div>

            {/* Category: Background Dimming */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#C59828] border-b border-[#E8E5D5] pb-1.5">Presentation Screen</h3>
              
              {/* Background Brightness */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#6B6857]">
                  <span>Background Brightness</span>
                  <span>{layoutSettings.bgBrightness}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  value={layoutSettings.bgBrightness}
                  onChange={(e) => setCustomSetting(() => ({ bgBrightness: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-[#E8E5D5] rounded-lg appearance-none cursor-pointer accent-[#C59828]"
                />
              </div>
            </div>
          </div>

          {/* Sticky Editor Footer Actions */}
          <div className="sticky bottom-0 bg-[#FFFDF5] border-t border-[#E8E5D5] p-5 flex gap-2 z-10">
            <button
              onClick={handleSaveDefault}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#C59828] hover:bg-[#A37B1E] text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md active:scale-95"
            >
              <Save size={13} />
              {saveStatus === 'saved' ? 'Saved!' : 'Save as Default'}
            </button>
            <button
              onClick={handleResetAuto}
              className="flex-1 flex items-center justify-center bg-[#FAFAF5] border border-[#E8E5D5] text-[#6B6857] hover:bg-[#E8E5D5]/40 text-xs font-bold py-3 rounded-xl transition-all active:scale-95"
            >
              Reset to Auto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PresentationLivePage;
