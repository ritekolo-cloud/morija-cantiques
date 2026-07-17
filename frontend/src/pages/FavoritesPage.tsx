import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFavoritesStore } from '../store/favorites.store';
import { useBookmarksStore } from '../store/bookmarks.store';
import * as songsApi from '../api/songs.api';
import { Spinner } from '../components/ui/Spinner';
import { Heart, Bookmark, ChevronRight } from 'lucide-react';
import type { Song } from '../types';

export function FavoritesPage() {
  const { favoriteIds } = useFavoritesStore();
  const { bookmarkIds } = useBookmarksStore();

  const [activeTab, setActiveTab] = useState<'favorites' | 'bookmarks'>('favorites');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchHymns = async () => {
      const ids = activeTab === 'favorites' ? favoriteIds : bookmarkIds;

      if (ids.length === 0) {
        setSongs([]);
        return;
      }

      setIsLoading(true);
      setError(false);

      try {
        const promises = ids.map(id => songsApi.getSongById(id));
        const results = await Promise.all(promises);
        setSongs(results.filter(Boolean));
      } catch (err) {
        console.error('Error fetching favorites/bookmarks:', err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHymns();
  }, [activeTab, favoriteIds, bookmarkIds]);

  const isEmpty = !isLoading && !error && songs.length === 0;

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="bg-white border border-[#E8E5D5] rounded-[24px] p-6 shadow-sm">
        <h1 className="font-display font-extrabold text-2xl text-[#1A1A16] leading-tight">Saved Hymns</h1>
        <p className="text-xs font-bold text-[#A8A592] uppercase tracking-widest mt-1">
          Your personal collection of favorite & bookmarked hymns
        </p>

        {/* Tab Switcher */}
        <div className="flex gap-3 mt-5 p-1.5 bg-[#FAFAF5] border border-[#E8E5D5] rounded-2xl" role="tablist" aria-label="Saved hymns tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'favorites'}
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'favorites'
                ? 'bg-white border border-[#E5B83B]/30 text-[#C59828] shadow-sm'
                : 'text-[#6B6857] hover:text-[#1A1A16]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === 'favorites' ? 'fill-[#E5B83B] text-[#C59828]' : ''}`} />
            Favorites
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'favorites'
                ? 'bg-[#E5B83B]/15 text-[#C59828]'
                : 'bg-[#E8E5D5] text-[#6B6857]'
            }`}>
              {favoriteIds.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'bookmarks'}
            onClick={() => setActiveTab('bookmarks')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'bookmarks'
                ? 'bg-white border border-[#E5B83B]/30 text-[#C59828] shadow-sm'
                : 'text-[#6B6857] hover:text-[#1A1A16]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${activeTab === 'bookmarks' ? 'fill-[#E5B83B] text-[#C59828]' : ''}`} />
            Bookmarks
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'bookmarks'
                ? 'bg-[#E5B83B]/15 text-[#C59828]'
                : 'bg-[#E8E5D5] text-[#6B6857]'
            }`}>
              {bookmarkIds.length}
            </span>
          </button>
        </div>
      </header>

      {/* List */}
      <div role="tabpanel" aria-label={activeTab === 'favorites' ? 'Favorites list' : 'Bookmarks list'}>
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-[24px] text-center">
            <p className="text-red-600 font-bold text-sm">Failed to load saved hymns.</p>
          </div>
        ) : isEmpty ? (
          <div className="py-20 text-center bg-white border border-[#E8E5D5] rounded-[24px]">
            {activeTab === 'favorites'
              ? <Heart className="w-14 h-14 mx-auto mb-4 text-[#E5B83B]/30" />
              : <Bookmark className="w-14 h-14 mx-auto mb-4 text-[#E5B83B]/30" />
            }
            <p className="font-bold text-sm text-[#6B6857]">
              No {activeTab === 'favorites' ? 'favorites' : 'bookmarks'} yet.
            </p>
            <p className="text-xs mt-1 text-[#A8A592]">
              Tap the {activeTab === 'favorites' ? '♥ heart' : '🔖 bookmark'} icon on any hymn to save it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {songs.map((song) => (
              <li key={song.id}>
                <Link
                  to={`/app/hymns/${song.id}`}
                  className="flex items-center gap-4 p-4 bg-white border border-[#E8E5D5] rounded-2xl hover:border-[#E5B83B]/40 hover:bg-[#FFFDF5] active:scale-[0.99] transition-all duration-150 group shadow-sm"
                >
                  {/* Number Badge */}
                  <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                    <span className="font-sans font-extrabold text-sm text-[#C59828] leading-none">
                      {song.songNumber}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-sans font-semibold text-sm text-[#1A1A16] leading-snug truncate group-hover:text-[#C59828] transition-colors">
                      {song.title}
                    </h3>
                    <p className="text-[9px] font-bold text-[#6B6857] uppercase tracking-wider mt-0.5">
                      {(song as any).collection?.name || 'Hymnal'}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#A8A592] group-hover:text-[#6B6857] transition-colors shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FavoritesPage;
