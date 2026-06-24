import * as repo from './songs.repository';
import { AppError } from '../../middleware/error.middleware';
import { parsePagination, buildPaginationMeta } from '../../utils/response';
import { parsePagination, buildPaginationMeta } from '../../utils/response';

export async function getAllSongs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const { songs, total } = await repo.findAll({
    skip,
    limit,
    collectionId: query.collectionId as string | undefined,
    language: query.language as string | undefined,
  });
  return { songs, meta: buildPaginationMeta(total, page, limit) };
}

export async function getSongById(id: string) {
  const song = await repo.findById(id);
  if (!song) throw new AppError('Song not found', 404);
  return song;
}

export async function getSongByNumber(collectionSlug: string, number: number) {
  const song = await repo.findByNumber(collectionSlug, number);
  if (!song) throw new AppError('Song not found', 404);
  return song;
}

export async function searchSongs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const q = String(query.q ?? '');
  const type = String(query.type ?? 'all');
  const collectionSlug = query.collectionSlug as string | undefined;

  const { songs, total } = await repo.search({ query: q, type, skip, limit, collectionSlug });
  return { songs, meta: buildPaginationMeta(total, page, limit) };
}

export async function getSongsByCollection(slug: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const { songs, total } = await repo.findByCollection(slug, { skip, limit });
  return { songs, meta: buildPaginationMeta(total, page, limit) };
}


export async function getAdjacentSongs(id: string) {
  const song = await getSongById(id);
  return repo.getAdjacentSongs(song.collectionId, song.songNumber);
}
