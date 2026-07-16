import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCollectionSongs } from '../hooks/useHymns';
import { useFavoritesStore } from '../store/favorites.store';
import { Spinner } from '../components/ui/Spinner';
import { ChevronLeft, ChevronRight, Search, Book, Heart, Globe } from 'lucide-react';

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: response, isLoading, error } = useCollectionSongs(slug || '', page, 100);
  const { favoriteIds, addFavorite, removeFavorite } = useFavoritesStore();

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-10rem)]">
        <Spinner />
        <span className="text-xs text-cream/50 mt-4 uppercase tracking-[0.2em] font-bold">
          Loading Hymns...
        </span>
      </div>
    );
  }

  if (error || !response?.success) {
    return (
      <div className="p-6 text-center mt-10">
        <div className="p-6 bg-red-500/5 border border-red-500/15 rounded-2xl">
          <p className="text-red-400 font-bold text-sm">Failed to load collection hymns.</p>
        </div>
      </div>
    );
  }

  const { collection, songs } = response.data;
  const meta = response.meta;

  const filteredSongs = songs?.filter((song: any) =>
    song.title.toLowerCase().includes(search.toLowerCase()) ||
    song.songNumber.toString().includes(search)
  );

  const langLabel = collection.languageName || collection.language || '';

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0d0119]/90 backdrop-blur-md border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/app/home"
            aria-label="Back to home"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-cream/70 hover:bg-white/[0.08] hover:text-cream active:scale-95 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-extrabold text-xl text-cream leading-tight truncate">
              {collection.name}
            </h1>
            {langLabel && (
              <div className="flex items-center gap-1 mt-0.5">
                <Globe className="w-3 h-3 text-cream/40" />
                <span className="text-[9px] font-bold text-cream/40 uppercase tracking-widest">
                  {langLabel}
                </span>
              </div>
            )}
          </div>
          {/* Hymn count badge */}
          <span className="shrink-0 text-[9px] font-extrabold px-2.5 py-1 rounded-full bg-[#E5B83B]/10 text-[#E5B83B] border border-[#E5B83B]/20 uppercase tracking-wider">
            {meta?.total ?? songs?.length ?? 0} Hymns
          </span>
        </div>

        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/35" />
          <input
            type="text"
            placeholder="Search by number or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search hymns"
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-xl text-sm text-cream font-medium placeholder-cream/35 focus:outline-none focus:border-[#E5B83B]/50 focus:ring-1 focus:ring-[#E5B83B]/30 transition-all"
          />
        </div>
      </header>

      {/* Songs List */}
      <div className="px-6 pt-4">
        {filteredSongs && filteredSongs.length > 0 ? (
          <ul className="flex flex-col gap-2 mb-6" role="list" aria-label="Hymns list">
            {filteredSongs.map((song: any) => {
              const isFav = favoriteIds.includes(song.id);
              return (
                <li key={song.id} className="relative group">
                  <Link
                    to={`/app/hymns/${song.id}`}
                    className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/[0.04] rounded-2xl hover:bg-white/[0.06] hover:border-white/[0.08] active:scale-[0.99] transition-all duration-150"
                  >
                    {/* Hymn Number Badge */}
                    <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                      <span className="font-sans font-extrabold text-xs text-[#E5B83B] leading-none">
                        {song.songNumber}
                      </span>
                    </div>

                    {/* Hymn Title */}
                    <div className="text-left flex-1 min-w-0">
                      <h3 className="font-sans font-semibold text-sm text-cream leading-snug truncate group-hover:text-[#E5B83B] transition-colors">
                        {song.title}
                      </h3>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-4 h-4 text-cream/15 group-hover:text-cream/40 transition-colors shrink-0" />
                  </Link>

                  {/* Favorite toggle overlaid on the right side */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      isFav ? removeFavorite(song.id) : addFavorite(song.id);
                    }}
                    aria-label={isFav ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
                    className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-cream/20 hover:text-red-400 transition-colors z-10"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${isFav ? 'fill-red-500 text-red-500' : ''}`}
                      strokeWidth={2}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-16 text-center text-cream/30">
            <Book className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No hymns match your search.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mb-8 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
              aria-label="Previous page"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-cream hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <span className="text-[10px] font-bold text-cream/50 uppercase tracking-widest">
              {meta.page} / {meta.totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
              aria-label="Next page"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-cream hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CollectionPage;
