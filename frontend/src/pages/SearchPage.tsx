import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHymnSearch } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import { Search, X, ChevronRight } from 'lucide-react';

const SCOPES = ['all', 'title', 'number', 'lyrics'] as const;
type Scope = typeof SCOPES[number];

const SCOPE_LABELS: Record<Scope, string> = {
  all: 'All Fields',
  title: 'Title',
  number: 'Number',
  lyrics: 'Lyrics',
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<Scope>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: songs, isLoading, isError } = useHymnSearch(query, scope);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync query to URL params
  useEffect(() => {
    if (query.trim().length > 1) {
      setSearchParams({ q: query }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [query]);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="bg-white border border-[#E8E5D5] rounded-[24px] p-6 shadow-sm">
        <div className="space-y-1 mb-5">
          <h1 className="font-display font-extrabold text-2xl text-[#1A1A16] leading-tight">Search Hymns</h1>
          <p className="text-xs font-bold text-[#A8A592] uppercase tracking-widest">
            Find hymns across all collections
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#A8A592]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search titles, lyrics, or number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search hymns"
            className="w-full pl-12 pr-10 py-3.5 bg-[#FAFAF5] border border-[#E8E5D5] rounded-xl text-sm text-[#1A1A16] font-medium placeholder-[#A8A592] focus:outline-none focus:border-[#E5B83B] focus:ring-1 focus:ring-[#E5B83B]/30 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#E8E5D5] hover:bg-[#D4D0BC] flex items-center justify-center text-[#6B6857] transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scope Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Search scope">
          {SCOPES.map((tab) => (
            <button
              key={tab}
              onClick={() => setScope(tab)}
              aria-pressed={scope === tab}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
                scope === tab
                  ? 'bg-[#E5B83B]/10 border-[#E5B83B]/40 text-[#C59828]'
                  : 'bg-[#FAFAF5] border-[#E8E5D5] text-[#6B6857] hover:bg-[#E8E5D5]/35'
              }`}
            >
              {SCOPE_LABELS[tab]}
            </button>
          ))}
        </div>
      </header>

      {/* Results */}
      <div>
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner />
          </div>
        ) : query.length <= 1 ? (
          <div className="py-20 text-center bg-white border border-[#E8E5D5] rounded-[24px]">
            <Search className="w-12 h-12 mx-auto mb-4 text-[#E5B83B]/30" />
            <p className="font-semibold text-sm text-[#6B6857]">Type at least 2 characters to search.</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-[24px] text-center">
            <p className="text-red-600 font-bold text-sm">Search failed. Please try again.</p>
          </div>
        ) : songs?.data && songs.data.length > 0 ? (
          <ul className="flex flex-col gap-2" role="list" aria-label="Search results">
            {songs.data.map((result: any) => {
              const song = result.song;
              return (
                <li key={song.id}>
                  <Link
                    to={`/app/hymns/${song.id}`}
                    className="flex items-center gap-4 p-4 bg-white border border-[#E8E5D5] rounded-2xl hover:border-[#E5B83B]/40 hover:bg-[#FFFDF5] active:scale-[0.99] transition-all duration-150 group shadow-sm"
                  >
                    <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                      <span className="font-sans font-extrabold text-sm text-[#C59828] leading-none">
                        {song.songNumber}
                      </span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <h3 className="font-sans font-semibold text-sm text-[#1A1A16] leading-snug truncate group-hover:text-[#C59828] transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-[9px] font-bold text-[#6B6857] uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                        <span>{song.collection?.name || 'Hymnal'}</span>
                        {song.category && (<><span>·</span><span>{song.category}</span></>)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A8A592] group-hover:text-[#6B6857] shrink-0 transition-colors" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-20 text-center bg-white border border-[#E8E5D5] rounded-[24px]">
            <Search className="w-12 h-12 mx-auto mb-4 text-[#E5B83B]/30" />
            <p className="font-semibold text-sm text-[#6B6857]">No results for "{query}".</p>
            <p className="text-xs mt-1 text-[#A8A592]">Try a different keyword or scope.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
