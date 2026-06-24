import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCollectionSongs } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import { ChevronLeft, ChevronRight, Search, Book } from 'lucide-react';

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data: response, isLoading, error } = useCollectionSongs(slug || '', page, 100);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-10rem)]">
        <Spinner />
        <span className="text-sm text-cream/60 mt-4 uppercase tracking-widest font-semibold">
          Loading Hymn List...
        </span>
      </div>
    );
  }

  if (error || !response?.success) {
    return (
      <div className="p-6 text-center text-red-500 font-bold mt-10">
        Failed to load collection songs.
      </div>
    );
  }

  const { collection, songs } = response.data;
  const meta = response.meta;

  // Filter songs locally for quick search within the loaded page
  const filteredSongs = songs?.filter((song: any) =>
    song.title.toLowerCase().includes(search.toLowerCase()) ||
    song.songNumber.toString().includes(search)
  );

  return (
    <div className="p-6 pb-24 animate-in fade-in duration-300">
      {/* Header Row */}
      <header className="mb-6 pt-4 flex items-center gap-3">
        <Link 
          to="/app/home" 
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-cream hover:bg-white/10 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="text-left">
          <h1 className="font-sans font-extrabold text-2xl text-cream leading-tight">
            {collection.name}
          </h1>
          <p className="text-xs font-semibold text-cream/50 uppercase tracking-widest mt-0.5">
            {collection.language} Collection
          </p>
        </div>
      </header>

      {/* Local Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-cream/40" />
        <input
          type="text"
          placeholder="Search by number or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-cream font-medium placeholder-cream/40 focus:outline-none focus:border-yellow focus:ring-1 focus:ring-yellow transition-all"
        />
      </div>

      {/* Songs List */}
      <div className="flex flex-col gap-2.5 mb-8">
        {filteredSongs && filteredSongs.length > 0 ? (
          filteredSongs.map((song: any) => (
            <Link
              key={song.id}
              to={`/app/hymns/${song.id}`}
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all duration-150 group"
            >
              {/* Hymn Number Badge */}
              <div className="w-12 h-10 rounded-xl bg-yellow text-black flex items-center justify-center font-sans font-extrabold text-base shadow-sm">
                {song.songNumber}
              </div>
              
              {/* Hymn Title */}
              <div className="text-left flex-1 min-w-0">
                <h3 className="font-sans font-bold text-base text-cream leading-snug truncate group-hover:text-yellow transition-colors">
                  {song.title}
                </h3>
                {song.category && (
                  <span className="inline-block text-[10px] font-bold text-cream/40 uppercase tracking-wider mt-0.5">
                    {song.category}
                  </span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="p-12 text-center text-cream/40 font-medium">
            <Book className="w-12 h-12 mx-auto mb-3 opacity-30" />
            No hymns found in this list.
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!meta.hasPrev}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-bold text-cream hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          
          <span className="text-xs font-bold text-cream/60 uppercase tracking-wider">
            Page {meta.page} of {meta.totalPages}
          </span>

          <button
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
            disabled={!meta.hasNext}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-bold text-cream hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
