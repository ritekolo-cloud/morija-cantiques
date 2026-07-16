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

const getLanguageStyle = (collection: any) => {
  const lang = (collection.language || collection.languageName || '').toLowerCase().trim();
  if (lang.includes('english') || lang === 'en') {
    return {
      card: 'bg-leather-navy border-blue-900/40 shadow-[0_8px_20px_rgba(22,39,69,0.2)] hover:shadow-[0_12px_28px_rgba(22,39,69,0.35)]',
      badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      label: 'ENGLISH',
    };
  }
  if (lang.includes('french') || lang === 'fr') {
    return {
      card: 'bg-leather-wine border-purple-950/40 shadow-[0_8px_20px_rgba(64,14,38,0.2)] hover:shadow-[0_12px_28px_rgba(64,14,38,0.35)]',
      badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      label: 'FRANÇAIS',
    };
  }
  if (lang.includes('swahili') || lang.includes('kiswahili') || lang === 'sw') {
    return {
      card: 'bg-leather-emerald border-emerald-950/40 shadow-[0_8px_20px_rgba(10,51,28,0.2)] hover:shadow-[0_12px_28px_rgba(10,51,28,0.35)]',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      label: 'SWAHILI',
    };
  }
  return {
    card: 'bg-leather-charcoal border-neutral-800/40 shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)]',
    badge: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20',
    label: 'MIXED',
  };
};

export function CollectionCard({ collection, className }: CollectionCardProps) {
  const songCount = getSongCount(collection);
  const langStyle = getLanguageStyle(collection);

  return (
    <Link 
      to={`/app/collections/${collection.slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-[20px] p-5 border text-cream transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] select-none leather-shimmer hover:border-yellow/30",
        langStyle.card,
        className
      )}
    >
      <div className="flex flex-col justify-between h-full min-h-[120px] relative z-10">
        {/* Top row with Book icon & Language pill */}
        <div className="flex justify-between items-center w-full">
          <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-cream/70 group-hover:text-cream transition-colors">
            <BookOpen className="w-4.5 h-4.5" strokeWidth={2} />
          </div>
          <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded-full border tracking-wide", langStyle.badge)}>
            {langStyle.label}
          </span>
        </div>
        
        {/* Bottom row - Name & Song count */}
        <div className="text-left mt-6">
          <h3 className="font-sans font-extrabold text-base md:text-lg leading-tight tracking-tight text-cream group-hover:text-[#E5B83B] transition-colors line-clamp-2">
            {collection.name}
          </h3>
          <p className="text-xs font-bold text-[#E5B83B]/80 mt-1.5 uppercase tracking-wider">
            {songCount} Hymns
          </p>
        </div>
      </div>

      {/* Elegant embossed vertical bar representing a book spine accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-r from-black/20 via-white/5 to-transparent border-r border-white/5" />
    </Link>
  );
}

export default CollectionCard;

