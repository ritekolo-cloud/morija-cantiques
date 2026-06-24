import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHymnSearch } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import { Search, Book, HelpCircle } from 'lucide-react';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'title' | 'number' | 'lyrics'>('all');
  
  // Debounce search query internally or trigger on change.
  // Given react-query enables when query.length > 1, we can pass it directly.
  const { data: songs, isLoading, isError } = useHymnSearch(query, scope);

  const handleScopeChange = (newScope: 'all' | 'title' | 'number' | 'lyrics') => {
    setScope(newScope);
  };

  return (
    <div className="p-6 pb-24 animate-in fade-in duration-300">
      <header className="mb-6 pt-4 text-left">
        <h1 className="font-sans font-extrabold text-3xl text-cream tracking-tight">
          Search
        </h1>
        <p className="text-xs font-semibold text-cream/50 uppercase tracking-widest mt-1">
          Find hymns across all collections
        </p>
      </header>

      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/40" />
        <input
          type="text"
          placeholder="Type song title, lyrics, or number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-cream font-medium placeholder-cream/40 focus:outline-none focus:border-yellow focus:ring-1 focus:ring-yellow transition-all"
        />
      </div>

      {/* Scope Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 select-none">
        {(['all', 'title', 'number', 'lyrics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleScopeChange(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-all ${
              scope === tab
                ? 'bg-yellow border-yellow text-black'
                : 'bg-white/5 border-white/5 text-cream hover:bg-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Results */}
      <div className="flex flex-col gap-2.5">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : query.length <= 1 ? (
          <div className="py-12 text-center text-cream/35">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">Enter at least 2 characters to search.</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-red-500 font-medium">
            Error searching hymns. Please try again.
          </div>
        ) : songs?.data && songs.data.length > 0 ? (
          songs.data.map((result: any) => {
            const song = result.song;
            return (
              <Link
                key={song.id}
                to={`/app/hymns/${song.id}`}
                className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all duration-150 group"
              >
                {/* Hymn Number */}
                <div className="w-12 h-10 rounded-xl bg-yellow text-black flex items-center justify-center font-sans font-extrabold text-base shadow-sm shrink-0">
                  {song.songNumber}
                </div>
                
                {/* Song Details */}
                <div className="text-left flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-base text-cream leading-snug truncate group-hover:text-yellow transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-[10px] font-bold text-cream/40 uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                    <span>{song.collection?.name || 'Hymnal'}</span>
                    {song.category && (
                      <>
                        <span>•</span>
                        <span>{song.category}</span>
                      </>
                    )}
                  </p>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="py-12 text-center text-cream/35">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">No results match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
