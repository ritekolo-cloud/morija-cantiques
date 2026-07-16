import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useHymnSearch } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import { Search, X } from 'lucide-react';

const SCOPES = ['all', 'title', 'number', 'lyrics'] as const;
type Scope = typeof SCOPES[number];

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'All',
  title: 'Title',
  number: '#',
  lyrics: 'Lyrics',
};

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: songs, isLoading, isError } = useHymnSearch(query, scope);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0d0119]/90 backdrop-blur-md border-b border-white/[0.04] px-6 py-4">
        <div className="mb-4">
          <h1 className="font-display font-extrabold text-xl text-cream leading-tight">Search</h1>
          <p className="text-[9px] font-bold text-cream/40 uppercase tracking-widest mt-0.5">
            Find hymns across all collections
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search titles, lyrics, or number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search hymns"
            className="w-full pl-10 pr-10 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-xl text-sm text-cream font-medium placeholder-cream/35 focus:outline-none focus:border-[#E5B83B]/50 focus:ring-1 focus:ring-[#E5B83B]/30 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-cream/60 hover:bg-white/20 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Scope Filter Pills */}
        <div className="flex gap-2 mt-3" role="group" aria-label="Search scope">
          {SCOPES.map((tab) => (
            <button
              key={tab}
              onClick={() => setScope(tab)}
              aria-pressed={scope === tab}
              className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
                scope === tab
                  ? 'bg-[#E5B83B]/15 border-[#E5B83B]/40 text-[#E5B83B]'
                  : 'bg-white/[0.03] border-white/[0.06] text-cream/50 hover:bg-white/[0.07]'
              }`}
            >
              {SCOPE_LABELS[tab]}
            </button>
          ))}
        </div>
      </header>

      {/* Results */}
      <div className="px-6 pt-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner />
          </div>
        ) : query.length <= 1 ? (
          <div className="py-16 text-center text-cream/30">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm text-cream/40">Type at least 2 characters to search.</p>
          </div>
        ) : isError ? (
          <div className="p-5 bg-red-500/5 border border-red-500/15 rounded-2xl text-center mt-4">
            <p className="text-red-400 font-bold text-sm">Search failed. Please try again.</p>
          </div>
        ) : songs?.data && songs.data.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list" aria-label="Search results">
            {songs.data.map((result: any) => {
              const song = result.song;
              return (
                <li key={song.id}>
                  <Link
                    to={`/app/hymns/${song.id}`}
                    className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/[0.04] rounded-2xl hover:bg-white/[0.06] hover:border-white/[0.08] active:scale-[0.99] transition-all duration-150 group"
                  >
                    <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                      <span className="font-sans font-extrabold text-xs text-[#E5B83B] leading-none">
                        {song.songNumber}
                      </span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <h3 className="font-sans font-semibold text-sm text-cream leading-snug truncate group-hover:text-[#E5B83B] transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-[9px] font-bold text-cream/40 uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                        <span>{song.collection?.name || 'Hymnal'}</span>
                        {song.category && (<><span>·</span><span>{song.category}</span></>)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-16 text-center text-cream/30">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm text-cream/40">No results for "{query}".</p>
            <p className="text-xs mt-1 text-cream/25">Try a different keyword or scope.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
