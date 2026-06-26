import apiClient from './client';
import type { Song, PaginatedApiResponse, ApiResponse, SongQueryParams, SearchParams, SearchResult } from '@/types';

/** Get paginated list of songs */
export async function getAllSongs(params?: SongQueryParams): Promise<PaginatedApiResponse<Song>['data']> {
  const { data } = await apiClient.get<PaginatedApiResponse<Song>>('/songs', { params });
  return data.data;
}

/** Get single song by ID */
export async function getSongById(id: string): Promise<Song> {
  const { data } = await apiClient.get<ApiResponse<Song>>(`/songs/${id}`);
  return data.data;
}

/** Get song by number within a collection */
export async function getSongByNumber(collectionSlug: string, number: number): Promise<Song> {
  const { data } = await apiClient.get<ApiResponse<Song>>(
    `/songs/collection/${collectionSlug}/number/${number}`
  );
  return data.data;
}

/** Search songs */
export async function searchSongs(params: SearchParams): Promise<PaginatedApiResponse<SearchResult>['data']> {
  const { data } = await apiClient.get<PaginatedApiResponse<SearchResult>>('/songs/search', {
    params,
  });
  return data.data;
}

/** Get adjacent (previous and next) songs in collection */
export async function getAdjacentSongs(id: string): Promise<ApiResponse<{
  prev: { id: string; songNumber: number; title: string } | null;
  next: { id: string; songNumber: number; title: string } | null;
}>['data']> {
  const { data } = await apiClient.get<ApiResponse<{
    prev: { id: string; songNumber: number; title: string } | null;
    next: { id: string; songNumber: number; title: string } | null;
  }>>(`/songs/${id}/adjacent`);
  return data.data;
}
