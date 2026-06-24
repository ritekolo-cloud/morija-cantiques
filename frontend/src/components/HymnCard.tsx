import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { cn } from '../utils/utils';
import { Song } from '../types';
import { useFavoritesStore } from '../store/favorites.store';

interface HymnCardProps {
  song: Pick<Song, 'id' | 'songNumber' | 'title' | 'collection'>;
  className?: string;
}

export function HymnCard({ song, className }: HymnCardProps) {
  const { favoriteIds, addFavorite, removeFavorite } = useFavoritesStore();
  const isFav = favoriteIds.includes(song.id);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isFav) {
      removeFavorite(song.id);
    } else {
      addFavorite(song.id);
    }
  };

  return (
    <Link 
      to={`/app/hymns/${song.id}`}
      className={cn(
        "group block w-full bg-white/5 border border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md hover:bg-white/10 hover:border-white/10 transition-all duration-300 active:scale-[0.98]",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Song Number Badge */}
        <div className="w-12 h-10 rounded-xl bg-yellow text-black flex items-center justify-center font-sans font-extrabold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
          {song.songNumber}
        </div>
        
        <div className="flex-1 min-w-0 text-left">
          <h4 className="font-sans font-bold text-base text-cream truncate mb-0.5 group-hover:text-yellow transition-colors">
            {song.title}
          </h4>
          <p className="text-xs text-cream/50 truncate">
            {song.collection?.name}
          </p>
        </div>

        <button 
          onClick={handleFavoriteClick}
          className="p-2 -mr-2 rounded-full text-cream/20 hover:text-red-500 hover:bg-white/5 transition-all"
        >
          <Heart className={cn("w-5 h-5", isFav && "fill-red-500 text-red-500")} />
        </button>
      </div>
    </Link>
  );
}
