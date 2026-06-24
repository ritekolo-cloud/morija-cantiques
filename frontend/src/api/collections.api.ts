import apiClient from './client';
import type { Collection, ApiResponse } from '@/types';

export async function getCollections(): Promise<ApiResponse<Collection[]>> {
  return apiClient.get('/collections');
}

export async function getCollection(slug: string): Promise<ApiResponse<Collection>> {
  return apiClient.get(`/collections/${slug}`);
}

export async function getCollectionSongs(slug: string, params: any): Promise<ApiResponse<any>> {
  return apiClient.get(`/collections/${slug}/songs`, { params });
}
