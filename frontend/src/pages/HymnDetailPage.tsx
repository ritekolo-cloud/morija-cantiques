import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useHymn, useAdjacentHymns } from '../hooks/useHymns';
import { useFavoritesStore } from '../store/favorites.store';
import { useBookmarksStore } from '../store/bookmarks.store';
import { Spinner } from '../components/ui/Spinner';
import { 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  Bookmark, 
  Copy, 
  Share2, 
  Type, 
  Sun, 
  Moon,
  Check
} from 'lucide-react';

export function HymnDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: song, isLoading, error } = useHymn(id || '');
  const { data: adjacent } = useAdjacentHymns(id || '');
  
  const { favoriteIds, addFavorite, removeFavorite } = useFavoritesStore();
  const { bookmarkIds, addBookmark, removeBookmark } = useBookmarksStore();

  const [fontSize, setFontSize] = useState(18); // default font size in px
  const [isLightMode, setIsLightMode] = useState(false); // reader-only light/dark toggle
  const [copied, setCopied] = useState(false);

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

  // Toggle favorite
  const toggleFavorite = () => {
    if (isFavorited) {
      removeFavorite(song.id);
    } else {
      addFavorite(song.id);
    }
  };

  // Toggle bookmark
  const toggleBookmark = () => {
    if (isBookmarked) {
      removeBookmark(song.id);
    } else {
      addBookmark(song.id);
    }
  };

  // Parse lyrics
  let sections: any[] = [];
  try {
    sections = JSON.parse(song.lyrics || '[]');
  } catch (e) {
    if (typeof song.lyrics === 'string') {
      sections = [{ type: 'verse', label: 'Hymn Lyrics', lines: song.lyrics.split('\n') }];
    }
  }

  // Copy lyrics
  const handleCopy = () => {
    const textToCopy = `${song.songNumber}. ${song.title}\n\n` + 
      sections.map(s => `[${s.label}]\n${s.lines.join('\n')}`).join('\n\n');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Share hymn
  const handleShare = () => {
    const shareData = {
      title: `${song.songNumber}. ${song.title}`,
      text: `Read this hymn: ${song.title}`,
      url: window.location.href,
    };
    
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      // Fallback
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-all duration-300 ${isLightMode ? 'bg-[#FFFDF0] text-black' : 'bg-[#140622] text-cream'}`}>
      
      {/* Reader Controls Header */}
      <header className={`sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md ${isLightMode ? 'bg-[#FFFDF0]/80 border-black/10' : 'bg-[#140622]/80 border-white/10'}`}>
        <div className="flex items-center gap-3">
          <Link 
            to={song.collection ? `/app/collections/${song.collection.slug}` : '/app/home'} 
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isLightMode ? 'bg-black/5 text-black hover:bg-black/10' : 'bg-white/5 text-cream hover:bg-white/10'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs font-extrabold uppercase tracking-widest opacity-60">
            {song.collection?.name || 'Hymn'}
          </span>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* FontSize adjust buttons */}
          <button 
            onClick={() => setFontSize(s => Math.max(14, s - 2))}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Decrease font size"
          >
            <span className="font-extrabold text-sm select-none">A-</span>
          </button>
          <button 
            onClick={() => setFontSize(s => Math.min(32, s + 2))}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Increase font size"
          >
            <span className="font-extrabold text-lg select-none">A+</span>
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={() => setIsLightMode(!isLightMode)}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Toggle theme"
          >
            {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* Bookmark Toggle */}
          <button 
            onClick={toggleBookmark}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Bookmark"
          >
            <Bookmark className={`w-5 h-5 transition-colors ${isBookmarked ? 'fill-yellow text-yellow stroke-[2px]' : ''}`} />
          </button>

          {/* Favorite Toggle */}
          <button 
            onClick={toggleFavorite}
            className={`p-2 rounded-xl transition-colors ${isLightMode ? 'hover:bg-black/5' : 'hover:bg-white/5'}`}
            title="Favorite"
          >
            <Heart className={`w-5 h-5 transition-colors ${isFavorited ? 'fill-red-500 text-red-500 stroke-[2.5px]' : ''}`} />
          </button>
        </div>
      </header>

      {/* Reader Content Body */}
      <main className="flex-1 px-6 py-8 overflow-y-auto max-w-[430px] mx-auto w-full select-text pb-28">
        
        {/* Title Block */}
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

        {/* Lyrics display */}
        <div 
          className="space-y-8 font-sans leading-relaxed tracking-wide text-center"
          style={{ fontSize: `${fontSize}px` }}
        >
          {sections.map((section, idx) => {
            const isChorus = section.type === 'chorus' || section.type === 'refrain';
            return (
              <div 
                key={idx} 
                className={`py-3 rounded-2xl transition-all duration-300 ${
                  isChorus 
                    ? isLightMode 
                      ? 'bg-black/5 border-l-4 border-yellow px-4 font-bold text-center' 
                      : 'bg-white/5 border-l-4 border-yellow px-4 font-bold text-center' 
                    : ''
                }`}
              >
                {/* Section Label (e.g. Verse 1, Chorus) */}
                <p className="text-xs font-extrabold uppercase tracking-widest opacity-40 mb-3 select-none">
                  {section.label}
                </p>
                {/* Section Lines */}
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

      {/* Reader Bottom Actions & Song Navigation */}
      <footer className={`fixed bottom-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between border-t backdrop-blur-md max-w-[430px] mx-auto ${
        isLightMode ? 'bg-[#FFFDF0]/90 border-black/10' : 'bg-[#140622]/90 border-white/10'
      }`}>
        
        {/* Adjacent song: Prev */}
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

        {/* Middle copy/share utility buttons */}
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

        {/* Adjacent song: Next */}
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
