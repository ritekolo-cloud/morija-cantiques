import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookmarksState {
  bookmarkIds: string[];
  addBookmark: (songId: string) => void;
  removeBookmark: (songId: string) => void;
  isBookmarked: (songId: string) => boolean;
}

export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      bookmarkIds: [],
      addBookmark: (songId) => set((state) => {
        if (!state.bookmarkIds.includes(songId)) {
          return { bookmarkIds: [...state.bookmarkIds, songId] };
        }
        return state;
      }),
      removeBookmark: (songId) => set((state) => ({
        bookmarkIds: state.bookmarkIds.filter(id => id !== songId)
      })),
      isBookmarked: (songId) => get().bookmarkIds.includes(songId)
    }),
    { name: 'morija-bookmarks' }
  )
);
