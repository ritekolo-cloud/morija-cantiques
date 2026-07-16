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

  const currentIds = activeTab === 'favorites' ? favoriteIds : bookmarkIds;
  const isEmpty = !isLoading && !error && songs.length === 0;

  return (
    <div className="pb-28 animate-fade-in">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <h1 className="font-display font-extrabold text-2xl text-cream leading-tight">Saved</h1>
        <p className="text-[9px] font-bold text-cream/40 uppercase tracking-widest mt-0.5">
          Your personal saved hymns
        </p>
      </header>

      {/* Tab Switcher */}
      <div className="px-6 mb-5 select-none" role="tablist" aria-label="Saved hymns tabs">
        <div className="flex gap-3 p-1.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
          <button
            role="tab"
            aria-selected={activeTab === 'favorites'}
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'favorites'
                ? 'bg-[#E5B83B]/15 border border-[#E5B83B]/30 text-[#E5B83B]'
                : 'text-cream/40 hover:text-cream/70'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Favorites
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'favorites'
                ? 'bg-[#E5B83B]/20 text-[#E5B83B]'
                : 'bg-white/[0.08] text-cream/40'
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
                ? 'bg-[#E5B83B]/15 border border-[#E5B83B]/30 text-[#E5B83B]'
                : 'text-cream/40 hover:text-cream/70'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            Bookmarks
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'bookmarks'
                ? 'bg-[#E5B83B]/20 text-[#E5B83B]'
                : 'bg-white/[0.08] text-cream/40'
            }`}>
              {bookmarkIds.length}
            </span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-6" role="tabpanel" aria-label={activeTab === 'favorites' ? 'Favorites list' : 'Bookmarks list'}>
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-5 bg-red-500/5 border border-red-500/15 rounded-2xl text-center">
            <p className="text-red-400 font-bold text-sm">Failed to load saved hymns.</p>
          </div>
        ) : isEmpty ? (
          <div className="py-20 text-center text-cream/25">
            {activeTab === 'favorites'
              ? <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              : <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
            }
            <p className="font-bold text-sm text-cream/35">
              No {activeTab === 'favorites' ? 'favorites' : 'bookmarks'} yet.
            </p>
            <p className="text-xs mt-1 text-cream/25">
              Tap the {activeTab === 'favorites' ? '♥ heart' : '🔖 bookmark'} icon on any hymn to save it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {songs.map((song) => (
              <li key={song.id}>
                <Link
                  to={`/app/hymns/${song.id}`}
                  className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/[0.04] rounded-2xl hover:bg-white/[0.06] hover:border-white/[0.08] active:scale-[0.99] transition-all duration-150 group"
                >
                  {/* Number Badge */}
                  <div className="w-12 h-10 rounded-xl bg-[#E5B83B]/10 border border-[#E5B83B]/20 flex items-center justify-center shrink-0">
                    <span className="font-sans font-extrabold text-xs text-[#E5B83B] leading-none">
                      {song.songNumber}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-sans font-semibold text-sm text-cream leading-snug truncate group-hover:text-[#E5B83B] transition-colors">
                      {song.title}
                    </h3>
                    <p className="text-[9px] font-bold text-cream/40 uppercase tracking-wider mt-0.5">
                      {(song as any).collection?.name || 'Hymnal'}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-cream/15 group-hover:text-cream/40 transition-colors shrink-0" />
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
