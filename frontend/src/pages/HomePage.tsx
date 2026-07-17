import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCollections } from '../hooks/useHymns';
import { CollectionCard } from '../components/CollectionCard';
import { Spinner } from '../components/ui/Spinner';
import { Search, ChevronRight } from 'lucide-react';
import { useRecentStore } from '../store/recent.store';
import * as songsApi from '../api/songs.api';

export function HomePage() {
  const navigate = useNavigate();
  const { data: collections, isLoading, isError } = useCollections();
  const { recentSongIds } = useRecentStore();
  
  const [quickSearch, setQuickSearch] = useState('');
  const [recentSongs, setRecentSongs] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  useEffect(() => {
    const fetchRecentSongs = async () => {
      const ids = recentSongIds.slice(0, 4); // Display up to 4 recent hymns
      if (ids.length === 0) {
        setRecentSongs([]);
        return;
      }
      
      setIsLoadingRecent(true);
      try {
        const promises = ids.map(id => songsApi.getSongById(id));
        const results = await Promise.all(promises);
        setRecentSongs(results.filter(Boolean));
      } catch (err) {
        console.error('Failed to load recent hymns:', err);
      } finally {
        setIsLoadingRecent(false);
      }
    };

    fetchRecentSongs();
  }, [recentSongIds]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim().length > 1) {
      navigate(`/app/search?q=${encodeURIComponent(quickSearch.trim())}`);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Hero Welcome Banner - Elegant Black & Gold Contrast */}
      <header className="relative overflow-hidden rounded-[24px] p-8 bg-gradient-to-br from-[#1A1A16] to-[#2D2D2A] text-white border border-black/10 shadow-lg select-none flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#E5B83B]/5 blur-3xl pointer-events-none" />
        <div className="space-y-3 flex-1">
          <span className="inline-block text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#E5B83B] bg-[#E5B83B]/10 px-3 py-1 rounded-full border border-[#E5B83B]/20">
            Hymn Reader Mode
          </span>
          <h1 className="font-display text-4xl font-extrabold text-white leading-tight">
            Morija Cantiques
          </h1>
          <p className="text-sm text-white/60 uppercase tracking-wider font-bold">
            Browse collections, search, and study hymns
          </p>
        </div>
        
        {/* Quick Search */}
        <form onSubmit={handleQuickSearch} className="relative w-full md:w-96 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search hymns by title, lyrics, number..."
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E5B83B] focus:ring-1 focus:ring-[#E5B83B] transition-all"
          />
        </form>
      </header>

      {/* Recent Hymns Section - Warm Light Cards */}
      {recentSongs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#1A1A16]/60 select-none">
            Recently Read
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentSongs.map((song) => (
              <Link
                key={song.id}
                to={`/app/hymns/${song.id}`}
                className="flex items-center gap-4 p-4 bg-white border border-[#E8E5D5] rounded-xl hover:border-[#E5B83B]/40 hover:bg-[#FAFAF5] active:scale-[0.99] transition-all duration-200 group shadow-sm"
              >
                {/* Badge */}
                <div className="w-11 h-9 rounded-lg bg-[#E5B83B]/10 border border-[#E5B83B]/20 text-[#C59828] flex items-center justify-center font-sans font-extrabold text-xs shrink-0">
                  {song.songNumber}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-sm text-[#1A1A16] leading-snug truncate group-hover:text-[#C59828] transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-[9px] font-semibold text-[#6B6857] uppercase tracking-wider mt-0.5">
                    {song.collection?.name || 'Hymnal'}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-[#A8A592] group-hover:text-[#6B6857] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hymn Collections Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#1A1A16]/60 select-none">
          Hymn Collections
        </h2>
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <Spinner />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-center text-red-500 font-semibold p-6 bg-white border border-red-200 rounded-2xl">
            Failed to load collections. Check backend connection.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (!collections || collections.length === 0) && (
          <div className="text-center text-[#6B6857] py-12">
            No collections found.
          </div>
        )}

        {/* Success state */}
        {!isLoading && !isError && collections && collections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collections.map((collection: any) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HomePage;