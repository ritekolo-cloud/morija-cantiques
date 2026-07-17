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

// Redesigned to use a cohesive pastel worship palette that complements the yellow/pink theme (Instruction 15)
const getLanguageStyle = (collection: any) => {
  const lang = (collection.language || collection.languageName || '').toLowerCase().trim();
  if (lang.includes('english') || lang === 'en') {
    return {
      card: 'bg-gradient-to-br from-[#FFFDF0] to-[#FFF5D0] border-[#E5B83B]/30 shadow-[0_4px_12px_rgba(229,184,59,0.06)] hover:shadow-[0_8px_20px_rgba(229,184,59,0.12)]',
      badge: 'bg-[#E5B83B]/10 text-[#C59828] border-[#E5B83B]/20',
      label: 'ENGLISH',
    };
  }
  if (lang.includes('french') || lang === 'fr') {
    return {
      card: 'bg-gradient-to-br from-[#FFF5F7] to-[#FCE7F3] border-[#F9A8C9]/35 shadow-[0_4px_12px_rgba(249,168,201,0.06)] hover:shadow-[0_8px_20px_rgba(249,168,201,0.12)]',
      badge: 'bg-[#F9A8C9]/20 text-[#D84B83] border-[#F9A8C9]/30',
      label: 'FRANÇAIS',
    };
  }
  if (lang.includes('swahili') || lang.includes('kiswahili') || lang === 'sw') {
    return {
      card: 'bg-gradient-to-br from-[#F0FDF4] to-[#E2FBE9] border-[#86EFAC]/45 shadow-[0_4px_12px_rgba(134,239,172,0.06)] hover:shadow-[0_8px_20px_rgba(134,239,172,0.12)]',
      badge: 'bg-[#86EFAC]/20 text-[#166534] border-[#86EFAC]/30',
      label: 'SWAHILI',
    };
  }
  // Mixed / Others
  return {
    card: 'bg-gradient-to-br from-[#FAFAFA] to-[#F3F4F6] border-[#E5E7EB] shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)]',
    badge: 'bg-black/5 text-[#6B6857] border-black/10',
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
        "group relative block overflow-hidden rounded-[24px] p-6 border text-[#1A1A16] transition-all duration-300 hover:scale-[1.04] active:scale-[0.98] select-none leather-shimmer hover:border-[#E5B83B]/50",
        langStyle.card,
        className
      )}
    >
      <div className="flex flex-col justify-between h-full min-h-[140px] relative z-10">
        {/* Top row with Book icon & Language pill */}
        <div className="flex justify-between items-center w-full">
          <div className="w-10 h-10 rounded-xl bg-white/60 border border-black/[0.04] flex items-center justify-center text-[#1A1A16]/70 group-hover:text-[#1A1A16] transition-colors shadow-sm">
            <BookOpen className="w-5 h-5" strokeWidth={2} />
          </div>
          <span className={cn("text-[9px] font-extrabold px-2.5 py-1 rounded-full border tracking-wider", langStyle.badge)}>
            {langStyle.label}
          </span>
        </div>
        
        {/* Bottom row - Name & Song count */}
        <div className="text-left mt-8 space-y-1">
          <h3 className="font-sans font-extrabold text-lg md:text-xl leading-snug tracking-tight text-[#1A1A16] group-hover:text-[#C59828] transition-colors line-clamp-2">
            {collection.name}
          </h3>
          <p className="text-xs font-bold text-[#C59828] uppercase tracking-wider">
            {songCount} Hymns
          </p>
        </div>
      </div>

      {/* Elegant vertical spine accent representing a premium book cover spine */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/[0.04] via-white/[0.08] to-transparent border-r border-black/[0.02]" />
    </Link>
  );
}

export default CollectionCard;
