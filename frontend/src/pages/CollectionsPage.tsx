import React from 'react';
import { Link } from 'react-router-dom';
import { useCollections } from '../hooks/useHymns';
import { Spinner } from '../components/ui/Spinner';
import { Book, ChevronRight } from 'lucide-react';

const collectionMetaMap: Record<string, { code: string; langEmoji: string; langCode: string; colorClass: string }> = {
  'only-believe': { code: 'OB', langEmoji: '🇬🇧', langCode: 'EN', colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  'crois-seulement': { code: 'CS', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  'hosanna': { code: 'HOS', langEmoji: '🇬🇧', langCode: 'EN', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'autres-cantiques': { code: 'AC', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'collection-des-cantiques': { code: 'CC', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  'chant-de-victoire': { code: 'CV', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'nyimbo-za-mungu': { code: 'NM', langEmoji: '🇹🇿', langCode: 'SW', colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  'nyimbo-za-wokovu': { code: 'NW', langEmoji: '🇹🇿', langCode: 'SW', colorClass: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20' },
  'roc-seculaire': { code: 'RS', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  'quel-temps-glorieux': { code: 'QTG', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  'sacred-songs-and-solos': { code: 'SSS', langEmoji: '🇬🇧', langCode: 'EN', colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  'only-believe-2': { code: 'OB2', langEmoji: '🇬🇧', langCode: 'EN', colorClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  'roc-seculaire-paris': { code: 'RSP2', langEmoji: '🇫🇷', langCode: 'FR', colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
};

const getCollectionMeta = (slug: string, language: string) => {
  const meta = collectionMetaMap[slug];
  if (meta) return meta;
  
  const isFrench = language.toLowerCase().startsWith('fr');
  const isSwahili = language.toLowerCase().startsWith('sw') || language.toLowerCase().startsWith('ki');
  const code = slug.split('-').map(w => w[0]).join('').toUpperCase().substring(0, 3);
  return {
    code: code || 'HYMN',
    langEmoji: isFrench ? '🇫🇷' : isSwahili ? '🇹🇿' : '🇬🇧',
    langCode: isFrench ? 'FR' : isSwahili ? 'SW' : 'EN',
    colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  };
};

const getSongCount = (collection: any) => {
  if (collection.subtitle) {
    const match = collection.subtitle.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return collection._count?.songs || collection.songCount || 0;
};

export function CollectionsPage() {
  const { data: collections, isLoading, error } = useCollections();

  if (isLoading) {
    return (
      <div className="p-6 pt-10 flex justify-center items-center h-[calc(100vh-10rem)]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 pt-10 text-center text-red-500 font-medium">
        Failed to load collections.
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8 pt-4">
        <h1 className="font-playfair text-3xl font-bold text-black dark:text-cream mb-1">
          Collections
        </h1>
        <p className="text-black/60 dark:text-cream/60 font-medium">
          Browse all hymnals and song books
        </p>
      </header>

      <div className="flex flex-col gap-3 pb-24">
        {collections?.map((collection: any) => {
          const meta = getCollectionMeta(collection.slug, collection.language);
          const songCount = getSongCount(collection);

          return (
            <Link
              key={collection.id}
              to={`/app/collections/${collection.slug}`}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 shadow-sm hover:bg-white/10 hover:border-white/10 transition-all duration-200 active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                {/* Code Badge */}
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-bold text-xs leading-none shadow-sm ${meta.colorClass}`}>
                  <span className="mb-0.5 tracking-wider font-extrabold">{meta.code}</span>
                  <span className="text-[10px] opacity-75">{meta.langEmoji}</span>
                </div>
                
                <div className="text-left">
                  <h3 className="font-sans font-bold text-base text-cream leading-tight group-hover:text-yellow transition-colors">
                    {collection.name}
                  </h3>
                  <p className="text-xs text-cream/50 mt-1 flex items-center gap-1.5 font-medium">
                    <Book className="w-3.5 h-3.5" />
                    <span>{songCount} hymns</span>
                    <span className="opacity-30">•</span>
                    <span className="uppercase tracking-wider text-[10px]">{collection.language}</span>
                  </p>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-cream/20 group-hover:text-cream transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
