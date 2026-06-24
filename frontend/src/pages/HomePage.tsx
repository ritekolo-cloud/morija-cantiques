import React from 'react';
import { useCollections } from '../hooks/useHymns';
import { CollectionCard } from '../components/CollectionCard';
import { Spinner } from '../components/ui/Spinner';

export function HomePage() {
  const { data: collections, isLoading } = useCollections();

  return (
    <div className="p-6 pb-24 animate-in fade-in duration-300">
      <header className="mb-8 pt-6 text-center">
        <h1 className="font-sans font-extrabold text-3xl tracking-tight text-yellow uppercase">
          Morija Cantiques
        </h1>
        <p className="text-sm font-semibold text-cream/60 mt-1 uppercase tracking-widest">
          Digital Hymnal
        </p>
      </header>

      <section className="mb-10">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {collections?.map((collection: any) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
