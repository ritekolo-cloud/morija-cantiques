import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentState {
  recentSongIds: string[];
  addRecent: (songId: string) => void;
  clearRecent: () => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      recentSongIds: [],
      addRecent: (songId) => set((state) => {
        const filtered = state.recentSongIds.filter(id => id !== songId);
        return { recentSongIds: [songId, ...filtered].slice(0, 50) };
      }),
      clearRecent: () => set({ recentSongIds: [] })
    }),
    { name: 'morija-recent' }
  )
);
