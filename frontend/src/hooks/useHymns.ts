import { useQuery } from '@tanstack/react-query';
import * as songsApi from '../api/songs.api';
import * as collectionsApi from '../api/collections.api';

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.getCollections().then(res => {
      const body = res.data;
      if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
        return body.data;
      }
      return (body as any) || [];
    }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useCollection(slug: string) {
  return useQuery({
    queryKey: ['collections', slug],
    queryFn: () => collectionsApi.getCollection(slug).then(res => {
      const body = res.data;
      if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
        return body.data;
      }
      return body;
    }),
    enabled: !!slug,
  });
}

export function useCollectionSongs(slug: string, page = 1, limit = 100) {
  return useQuery({
    queryKey: ['collections', slug, 'songs', page, limit],
    queryFn: () => collectionsApi.getCollectionSongs(slug, { page, limit }).then(res => {
      return res.data; // Returns the full envelope containing { success, data: { collection, songs }, meta }
    }),
    enabled: !!slug,
  });
}

export function useHymns(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['hymns', params],
    queryFn: () => songsApi.getAllSongs(params),
  });
}

export function useHymn(id: string) {
  return useQuery({
    queryKey: ['hymn', id],
    queryFn: () => songsApi.getSongById(id),
    enabled: !!id,
  });
}

export function useHymnByNumber(collectionSlug: string, number: number) {
  return useQuery({
    queryKey: ['hymn', collectionSlug, number],
    queryFn: () => songsApi.getSongByNumber(collectionSlug, number),
    enabled: !!collectionSlug && !!number,
  });
}

export function useHymnSearch(query: string, type: 'all' | 'title' | 'number' | 'lyrics' = 'all', page = 1) {
  return useQuery({
    queryKey: ['hymns', 'search', query, type, page],
    queryFn: () => songsApi.searchSongs({ q: query, scope: type, page, limit: 50 }),
    enabled: query.length > 1,
  });
}

export function useAdjacentHymns(id: string) {
  return useQuery({
    queryKey: ['hymn', id, 'adjacent'],
    queryFn: () => songsApi.getAdjacentSongs(id).then(res => {
      const body = res.data;
      if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
        return body.data;
      }
      return body as any;
    }),
    enabled: !!id,
  });
}

