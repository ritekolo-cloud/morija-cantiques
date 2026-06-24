import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Collection } from '../types';
import { cn } from '../utils/utils';

interface CollectionCardProps {
  collection: Collection & { _count?: { songs: number } };
  className?: string;
}

const getSongCount = (collection: any) => {
  if (collection.subtitle) {
    const match = collection.subtitle.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return collection._count?.songs || collection.songCount || 0;
};

export function CollectionCard({ collection, className }: CollectionCardProps) {
  const songCount = getSongCount(collection);

  return (
    <Link 
      to={`/app/collections/${collection.slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-[20px] p-6 bg-[#FFF000] text-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-yellow-400 select-none",
        className
      )}
    >
      <div className="flex flex-col justify-between h-full min-h-[110px]">
        {/* Top row with Book icon */}
        <div className="flex justify-between items-start">
          <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black">
            <BookOpen className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
        </div>
        
        {/* Bottom row - Name & Song count */}
        <div className="text-left mt-4">
          <h3 className="font-sans font-extrabold text-lg md:text-xl leading-tight tracking-tight text-black group-hover:text-black/90">
            {collection.name}
          </h3>
          <p className="text-sm font-bold text-black/70 mt-1">
            {songCount} Hymns
          </p>
        </div>
      </div>
    </Link>
  );
}

