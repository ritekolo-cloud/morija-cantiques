import { create } from 'zustand';

export interface QueueItem {
  id: string;
  songNumber: number;
  title: string;
  collectionName: string;
  collectionSlug: string;
}

interface PresentationState {
  queue: QueueItem[];
  activeIndex: number;
  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (id: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  setActiveIndex: (index: number) => void;
  clearQueue: () => void;
  isInQueue: (id: string) => boolean;
}

export const usePresentationStore = create<PresentationState>()((set, get) => ({
  queue: [],
  activeIndex: 0,

  addToQueue: (item) =>
    set((state) => {
      if (state.queue.some((q) => q.id === item.id)) return state;
      return { queue: [...state.queue, item] };
    }),

  removeFromQueue: (id) =>
    set((state) => {
      const newQueue = state.queue.filter((q) => q.id !== id);
      const newIndex = Math.min(state.activeIndex, Math.max(0, newQueue.length - 1));
      return { queue: newQueue, activeIndex: newIndex };
    }),

  reorderQueue: (fromIndex, toIndex) =>
    set((state) => {
      const newQueue = [...state.queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      return { queue: newQueue };
    }),

  setActiveIndex: (index) => set({ activeIndex: index }),

  clearQueue: () => set({ queue: [], activeIndex: 0 }),

  isInQueue: (id) => get().queue.some((q) => q.id === id),
}));
