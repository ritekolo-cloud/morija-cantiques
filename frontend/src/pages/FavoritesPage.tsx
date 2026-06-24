import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFavoritesStore } from '../store/favorites.store';
import { useBookmarksStore } from '../store/bookmarks.store';
import * as songsApi from '../api/songs.api';
import { Spinner } from '../components/ui/Spinner';
import { Heart, Bookmark, ChevronRight, BookOpen } from 'lucide-react';
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

  return (
    <div className="p-6 pb-24 animate-in fade-in duration-300">
      <header className="mb-6 pt-4 text-left">
        <h1 className="font-sans font-extrabold text-3xl text-cream tracking-tight">
          Saved Hymns
        </h1>
        <p className="text-xs font-semibold text-cream/50 uppercase tracking-widest mt-1">
          Access your personal saved list
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-3 mb-6 select-none">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider border flex items-center justify-center gap-2 transition-all ${
            activeTab === 'favorites'
              ? 'bg-yellow border-yellow text-black'
              : 'bg-white/5 border-white/5 text-cream hover:bg-white/10'
          }`}
        >
          <Heart className="w-4 h-4" />
          Favorites ({favoriteIds.length})
        </button>

        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider border flex items-center justify-center gap-2 transition-all ${
            activeTab === 'bookmarks'
              ? 'bg-yellow border-yellow text-black'
              : 'bg-white/5 border-white/5 text-cream hover:bg-white/10'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Bookmarks ({bookmarkIds.length})
        </button>
      </div>

      {/* List Container */}
      <div>
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500 font-medium">
            Failed to load saved hymns.
          </div>
        ) : songs.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {songs.map((song) => (
              <Link
                key={song.id}
                to={`/app/hymns/${song.id}`}
                className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 active:scale-[0.99] transition-all duration-150 group"
              >
                {/* Badge */}
                <div className="w-12 h-10 rounded-xl bg-yellow text-black flex items-center justify-center font-sans font-extrabold text-base shadow-sm shrink-0">
                  {song.songNumber}
                </div>

                {/* Details */}
                <div className="text-left flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-base text-cream leading-snug truncate group-hover:text-yellow transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-[10px] font-bold text-cream/40 uppercase tracking-wider mt-0.5">
                    {song.collection?.name || 'Hymnal'}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-cream/20 group-hover:text-cream transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-cream/30">
            {activeTab === 'favorites' ? (
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-25" />
            ) : (
              <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-25" />
            )}
            <p className="font-bold text-sm">
              Your {activeTab === 'favorites' ? 'favorites' : 'bookmarks'} list is empty.
            </p>
            <p className="text-xs mt-1 text-cream/40">
              Tap the {activeTab === 'favorites' ? 'heart' : 'bookmark'} icon on any hymn to save it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
