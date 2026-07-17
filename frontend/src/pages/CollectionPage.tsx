import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCollectionSongs } from '../hooks/useHymns';
import { useFavoritesStore } from '../store/favorites.store';
import { Spinner } from '../components/ui/Spinner';
import { ChevronLeft, ChevronRight, Book, Heart, Globe, Search } from 'lucide-react';

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
        <span className="text-xs text-[#6B6857] mt-4 uppercase tracking-[0.2em] font-bold">
          Loading Hymns...
        </span>
      </div>
    );
  }

  if (error || !response?.success) {
    return (
      <div className="p-6 text-center mt-10">
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-red-600 font-bold text-sm">Failed to load collection hymns.</p>
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
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-[#E8E5D5] rounded-[24px] p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/app/home"
            aria-label="Back to home"
            className="w-10 h-10 rounded-xl bg-[#FAFAF5] border border-[#E8E5D5] flex items-center justify-center text-[#1A1A16]/70 hover:bg-[#E8E5D5]/50 hover:text-[#1A1A16] active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-2xl text-[#1A1A16] leading-tight truncate">
              {collection.name}
            </h1>
            {langLabel && (
              <div className="flex items-center gap-1.5 mt-1">
                <Globe className="w-3.5 h-3.5 text-[#E5B83B]" />
                <span className="text-[10px] font-bold text-[#6B6857] uppercase tracking-widest">
                  {langLabel}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Side: Info + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="self-start sm:self-auto shrink-0 text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-[#E5B83B]/10 text-[#C59828] border border-[#E5B83B]/20 uppercase tracking-wider">
            {meta?.total ?? songs?.length ?? 0} Hymns
          </span>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A592]" />
            <input
              type="text"
              placeholder="Search in this book..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search hymns"
              className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAF5] border border-[#E8E5D5] rounded-xl text-sm text-[#1A1A16] font-medium placeholder-[#A8A592] focus:outline-none focus:border-[#E5B83B] focus:ring-1 focus:ring-[#E5B83B]/30 transition-all"
            />
          </div>
        </div>
      </header>

      {/* Songs List Grid */}
      <div>
        {filteredSongs && filteredSongs.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6" role="list" aria-label="Hymns list">
            {filteredSongs.map((song: any) => {
              const isFav = favoriteIds.includes(song.id);
              return (
                <li key={song.id} className="relative group">
                  <Link
                    to={`/app/hymns/${song.id}`}
                    className="flex items-center gap-4 p-4 bg-white border border-[#E8E5D5] rounded-2xl hover:border-[#E5B83B]/40 hover:bg-[#FAFAF5] active:scale-[0.99] transition-all duration-150 pr-16 shadow-sm"
                  >
                    {/* Hymn Number Badge */}
                    <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                      <span className="font-sans font-extrabold text-sm text-[#C59828] leading-none">
                        {song.songNumber}
                      </span>
                    </div>

                    {/* Hymn Title */}
                    <div className="text-left flex-1 min-w-0">
                      <h3 className="font-sans font-semibold text-sm md:text-base text-[#1A1A16] leading-snug truncate group-hover:text-[#C59828] transition-colors">
                        {song.title}
                      </h3>
                    </div>
                  </Link>

                  {/* Favorite toggle overlaid on the right side */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      isFav ? removeFavorite(song.id) : addFavorite(song.id);
                    }}
                    aria-label={isFav ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl hover:bg-[#FAFAF5] border border-transparent hover:border-[#E8E5D5] flex items-center justify-center text-[#A8A592] hover:text-[#B91C1C] transition-colors z-10"
                  >
                    <Heart
                      className={`w-4.5 h-4.5 transition-colors ${isFav ? 'fill-[#B91C1C] text-[#B91C1C]' : ''}`}
                      strokeWidth={2}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-16 text-center text-[#A8A592] bg-white border border-[#E8E5D5] rounded-2xl">
            <Book className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No hymns match your search.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 p-4 bg-white border border-[#E8E5D5] rounded-2xl shadow-sm">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!meta.hasPrev}
              aria-label="Previous page"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAFAF5] border border-[#E8E5D5] text-xs font-bold text-[#1A1A16] hover:bg-[#E8E5D5]/35 disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <span className="text-xs font-extrabold text-[#6B6857] uppercase tracking-widest">
              Page {meta.page} of {meta.totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={!meta.hasNext}
              aria-label="Next page"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAFAF5] border border-[#E8E5D5] text-xs font-bold text-[#1A1A16] hover:bg-[#E8E5D5]/35 disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
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
