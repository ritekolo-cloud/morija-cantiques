import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

interface PlaylistsState {
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
}

export const usePlaylistsStore = create<PlaylistsState>()(
  persist(
    (set) => ({
      playlists: [],
      createPlaylist: (name) => set((state) => ({
        playlists: [
          ...state.playlists,
          { id: Math.random().toString(36).substring(7), name, songIds: [], createdAt: Date.now() }
        ]
      })),
      deletePlaylist: (id) => set((state) => ({
        playlists: state.playlists.filter(p => p.id !== id)
      })),
      addSongToPlaylist: (playlistId, songId) => set((state) => ({
        playlists: state.playlists.map(p => {
          if (p.id === playlistId && !p.songIds.includes(songId)) {
            return { ...p, songIds: [...p.songIds, songId] };
          }
          return p;
        })
      })),
      removeSongFromPlaylist: (playlistId, songId) => set((state) => ({
        playlists: state.playlists.map(p => {
          if (p.id === playlistId) {
            return { ...p, songIds: p.songIds.filter(id => id !== songId) };
          }
          return p;
        })
      }))
    }),
    { name: 'morija-playlists' }
  )
);
