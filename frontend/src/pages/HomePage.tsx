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
      const ids = recentSongIds.slice(0, 3); // Display top 3 recent hymns
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
    <div className="p-6 pb-28 animate-fade-in text-left">
      {/* Hero Welcome Banner */}
      <header className="relative overflow-hidden rounded-[24px] p-6 bg-gradient-to-br from-[#240e38] to-[#0f0418] border border-white/5 mb-8 shadow-xl select-none">
        <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-[#E5B83B]/5 blur-3xl pointer-events-none" />
        <span className="inline-block text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#E5B83B] bg-[#E5B83B]/10 px-3 py-1 rounded-full border border-[#E5B83B]/20">
          Digital Hymnal & Songbook
        </span>
        <h1 className="font-display text-3xl font-extrabold text-cream mt-4 leading-tight">
          Morija Cantiques
        </h1>
        <p className="text-xs text-cream/50 mt-1 uppercase tracking-wider font-bold">
          13 Collections • 6,209 Hymns
        </p>
        
        {/* Quick Search */}
        <form onSubmit={handleQuickSearch} className="relative mt-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40" />
          <input
            type="text"
            placeholder="Quick search hymns..."
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-cream placeholder-cream/40 focus:outline-none focus:border-[#E5B83B] focus:ring-1 focus:ring-[#E5B83B] transition-all"
          />
        </form>
      </header>

      {/* Recent Hymns Section */}
      {recentSongs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#E5B83B] mb-3.5 select-none">
            Recently Read
          </h2>
          <div className="flex flex-col gap-2.5">
            {recentSongs.map((song) => (
              <Link
                key={song.id}
                to={`/app/hymns/${song.id}`}
                className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.99] transition-all duration-200 group"
              >
                {/* Badge */}
                <div className="w-11 h-9 rounded-lg bg-[#E5B83B]/10 border border-[#E5B83B]/20 text-[#E5B83B] flex items-center justify-center font-sans font-extrabold text-xs shrink-0">
                  {song.songNumber}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-sm text-cream leading-snug truncate group-hover:text-[#E5B83B] transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-[9px] font-semibold text-cream/40 uppercase tracking-wider mt-0.5">
                    {song.collection?.name || 'Hymnal'}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-cream/20 group-hover:text-cream/50 transition-colors" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hymn Collections Section */}
      <section className="mb-10">
        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#E5B83B] mb-4 select-none">
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
          <div className="text-center text-red-400 font-semibold p-6 bg-white/[0.02] border border-red-500/10 rounded-2xl">
            Failed to load collections. Check backend connection.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (!collections || collections.length === 0) && (
          <div className="text-center text-cream/40 py-12">
            No collections found.
          </div>
        )}

        {/* Success state */}
        {!isLoading && !isError && collections && collections.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
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