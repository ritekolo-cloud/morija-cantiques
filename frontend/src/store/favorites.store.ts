import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  favoriteIds: string[];
  addFavorite: (songId: string) => void;
  removeFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      addFavorite: (songId) => set((state) => {
        if (!state.favoriteIds.includes(songId)) {
          return { favoriteIds: [...state.favoriteIds, songId] };
        }
        return state;
      }),
      removeFavorite: (songId) => set((state) => ({
        favoriteIds: state.favoriteIds.filter(id => id !== songId)
      })),
      isFavorite: (songId) => get().favoriteIds.includes(songId)
    }),
    { name: 'morija-favorites' }
  )
);
