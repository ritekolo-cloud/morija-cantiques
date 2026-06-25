import apiClient from './client';
import type { Collection, ApiResponse } from '@/types';

export async function getCollections(): Promise<ApiResponse<Collection[]>> {
  const res = await apiClient.get('/collections');
  return res.data;
}

export async function getCollection(slug: string): Promise<ApiResponse<Collection>> {
  const res = await apiClient.get(`/collections/${slug}`);
  return res.data;
}

export async function getCollectionSongs(slug: string, params: any): Promise<ApiResponse<any>> {
  const res = await apiClient.get(`/collections/${slug}/songs`, { params });
  return res.data;
}