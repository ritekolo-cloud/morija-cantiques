import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHymnSearch, useCollections } from '../hooks/useHymns';
import { usePresentationStore, QueueItem } from '../store/presentation.store';
import { Spinner } from '../components/ui/Spinner';
import { Search, Plus, Trash2, Play, GripVertical, Check, ArrowRight, X, Tv } from 'lucide-react';

export function PresentationPage() {
  const navigate = useNavigate();
  const { data: collections } = useCollections();
  
  // Search state
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'title' | 'number' | 'lyrics'>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: songsData, isLoading } = useHymnSearch(query, scope);
  
  // Queue state
  const { queue, addToQueue, removeFromQueue, reorderQueue, clearQueue, isInQueue } = usePresentationStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Focus search input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter songs by selected collection slug
  const songs = songsData?.data || [];
  const filteredSongs = selectedCollection === 'all'
    ? songs
    : songs.filter((s: any) => s.song?.collection?.slug === selectedCollection);

  // Handle HTML5 drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    reorderQueue(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const startPresentation = () => {
    if (queue.length > 0) {
      navigate('/app/present/live');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-[#E8E5D5] rounded-[24px] p-6 shadow-sm">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-[#1A1A16] leading-tight">
            Presentation Workspace
          </h1>
          <p className="text-xs text-[#6B6857] uppercase tracking-widest mt-1">
            Build and arrange your worship service song list
          </p>
        </div>
        {queue.length > 0 && (
          <button
            onClick={startPresentation}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#E5B83B] to-[#F3D070] text-[#1A1A16] font-bold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Presenting</span>
          </button>
        )}
      </header>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Search & Browse */}
        <section className="lg:col-span-7 bg-white border border-[#E8E5D5] rounded-[24px] p-6 flex flex-col min-h-[600px] shadow-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#C59828] mb-4 select-none">
            Search & Browse Hymns
          </h2>

          {/* Search bar & scope selection */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#A8A592]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type title, lyrics or hymn number..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-[#FAFAF5] border border-[#E8E5D5] rounded-xl text-sm text-[#1A1A16] placeholder-[#A8A592] focus:outline-none focus:border-[#E5B83B] focus:ring-1 focus:ring-[#E5B83B]/30 transition-all font-medium"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A8A592] hover:text-[#1A1A16] transition-colors"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              )}
            </div>

            {/* Scope filters */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'title', 'number', 'lyrics'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setScope(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
                    scope === tab
                      ? 'bg-[#E5B83B]/10 border-[#E5B83B]/40 text-[#C59828]'
                      : 'bg-[#FAFAF5] border-[#E8E5D5] text-[#6B6857] hover:bg-[#E8E5D5]/35'
                  }`}
                >
                  {tab === 'all' ? 'All Fields' : tab}
                </button>
              ))}
            </div>

            {/* Collection Filter Pill List */}
            {collections && collections.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none border-t border-[#E8E5D5] pt-3">
                <button
                  onClick={() => setSelectedCollection('all')}
                  className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all ${
                    selectedCollection === 'all'
                      ? 'bg-[#1A1A16] text-white border border-transparent'
                      : 'bg-[#FAFAF5] text-[#6B6857] border border-[#E8E5D5] hover:text-[#1A1A16]'
                  }`}
                >
                  All Books
                </button>
                {collections.map((col: any) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedCollection(col.slug)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all ${
                      selectedCollection === col.slug
                        ? 'bg-[#E5B83B]/15 text-[#C59828] border border-[#E5B83B]/30'
                        : 'bg-[#FAFAF5] text-[#6B6857] border border-[#E8E5D5] hover:text-[#1A1A16]'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="flex-1 mt-6 overflow-y-auto max-h-[480px] scrollbar-thin">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Spinner />
              </div>
            ) : query.length <= 1 ? (
              <div className="py-20 text-center text-[#A8A592] border border-dashed border-[#E8E5D5] rounded-2xl bg-[#FAFAF5]/50">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Search for hymns above to add to your queue.</p>
              </div>
            ) : filteredSongs.length > 0 ? (
              <ul className="space-y-2">
                {filteredSongs.map((result: any) => {
                  const song = result.song;
                  const alreadyInQueue = isInQueue(song.id);
                  return (
                    <li
                      key={song.id}
                      className="flex items-center justify-between p-3 bg-[#FAFAF5] border border-[#E8E5D5] rounded-xl hover:bg-[#E8E5D5]/15 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-8.5 rounded-lg bg-[#E5B83B]/10 border border-[#E5B83B]/20 text-[#C59828] flex items-center justify-center font-sans font-extrabold text-xs shrink-0">
                          {song.songNumber}
                        </div>
                        <div className="text-left min-w-0">
                          <h3 className="font-sans font-bold text-sm text-[#1A1A16] truncate">{song.title}</h3>
                          <p className="text-[9px] font-bold text-[#6B6857] uppercase tracking-wider mt-0.5">
                            {song.collection?.name || 'Hymn'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (!alreadyInQueue) {
                            addToQueue({
                              id: song.id,
                              songNumber: song.songNumber,
                              title: song.title,
                              collectionName: song.collection?.name || 'Hymn',
                              collectionSlug: song.collection?.slug || '',
                            });
                          }
                        }}
                        disabled={alreadyInQueue}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                          alreadyInQueue
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                            : 'bg-white border border-[#E8E5D5] text-[#1A1A16]/75 hover:bg-[#E5B83B]/10 hover:border-[#E5B83B]/30 hover:text-[#C59828] active:scale-95'
                        }`}
                      >
                        {alreadyInQueue ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="py-20 text-center text-[#A8A592]">
                <p className="text-sm font-medium">No results matched your search query.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Section: Presentation Queue */}
        <section className="lg:col-span-5 bg-white border border-[#E8E5D5] rounded-[24px] p-6 flex flex-col min-h-[600px] shadow-sm">
          <div className="flex items-center justify-between mb-4 select-none">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#C59828]">
              Presentation Queue ({queue.length})
            </h2>
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Queue List with Drag & Drop */}
          <div className="flex-1 overflow-y-auto max-h-[460px] scrollbar-thin">
            {queue.length > 0 ? (
              <ul className="space-y-2">
                {queue.map((item, index) => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between p-3.5 bg-[#FAFAF5] border border-[#E8E5D5] rounded-xl hover:bg-[#E8E5D5]/15 transition-all cursor-grab active:cursor-grabbing ${
                      draggedIndex === index ? 'opacity-40 scale-[0.98]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-[#A8A592] hover:text-[#6B6857] cursor-row-resize shrink-0">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="w-9 h-8 rounded-lg bg-white border border-[#E8E5D5] flex items-center justify-center font-sans font-extrabold text-xs text-[#1A1A16]/70 shrink-0">
                        {index + 1}
                      </div>
                      <div className="text-left min-w-0">
                        <h3 className="font-sans font-bold text-sm text-[#1A1A16] truncate">{item.title}</h3>
                        <p className="text-[9px] font-bold text-[#6B6857] uppercase tracking-wider mt-0.5">
                          {item.collectionName} • #{item.songNumber}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="w-8 h-8 rounded-lg hover:bg-red-500/10 hover:text-red-600 flex items-center justify-center text-[#A8A592] transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col justify-center items-center py-24 text-center text-[#A8A592] border border-dashed border-[#E8E5D5] rounded-2xl bg-[#FAFAF5]/50">
                <Tv className="w-12 h-12 mb-3 opacity-20 text-[#E5B83B]" />
                <p className="text-sm font-medium">Your queue is empty.</p>
                <p className="text-xs mt-1 text-[#6B6857]/70">Add songs from the search results to build your playlist.</p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          {queue.length > 0 && (
            <div className="border-t border-[#E8E5D5] pt-4 mt-4 space-y-3">
              <button
                onClick={startPresentation}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#E5B83B] to-[#F3D070] text-[#1A1A16] font-bold text-sm shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                <span>Go Live with Service Queue</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PresentationPage;
