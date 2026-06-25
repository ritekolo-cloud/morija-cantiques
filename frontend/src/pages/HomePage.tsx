import React from 'react';
import { useCollections } from '../hooks/useHymns';
import { CollectionCard } from '../components/CollectionCard';
import { Spinner } from '../components/ui/Spinner';

export function HomePage() {
  const { data: collections, isLoading, isError } = useCollections();

  return (
    <div className="p-6 pb-24 animate-fade-in">
      
      {/* Header */}
      <header className="mb-8 pt-6 text-center">
        <h1 className="font-sans font-extrabold text-3xl tracking-tight text-yellow uppercase">
          Morija Cantiques
        </h1>
        <p className="text-sm font-semibold text-cream/60 mt-1 uppercase tracking-widest">
          Digital Hymnal
        </p>
      </header>

      {/* Content */}
      <section className="mb-10">
        
        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center h-48">
            <Spinner />
          </div>
        )}

        {/* Error state (IMPORTANT FIX) */}
        {isError && (
          <div className="text-center text-red-400 font-semibold">
            Failed to load collections. Check backend connection.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && (!collections || collections.length === 0) && (
          <div className="text-center text-cream/50">
            No collections found.
          </div>
        )}

        {/* Success state */}
        {!isLoading && !isError && collections && collections.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {collections.map((collection: any) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}

      </section>
    </div>
  );
}