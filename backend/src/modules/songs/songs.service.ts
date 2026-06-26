import * as repo from './songs.repository';
import { AppError } from '../../middleware/error.middleware';
import { buildPaginationMeta, parsePagination } from '../../utils/response';

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    data: items,
    ...buildPaginationMeta(total, page, limit),
  };
}

export async function getAllSongs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const { songs, total } = await repo.findAll({
    skip,
    limit,
    collectionId: query.collectionId as string | undefined,
    language: query.language as string | undefined,
    search: query.search as string | undefined,
  });

  return paginated(songs, total, page, limit);
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
  const q = String(query.q ?? '').trim();
  const type = String(query.type ?? query.scope ?? 'all');
  const collectionSlug = (query.collectionSlug ?? query.collectionId) as string | undefined;

  if (!q) return paginated([], 0, page, limit);

  const { songs, total } = await repo.search({ query: q, type, skip, limit, collectionSlug });
  return paginated(songs, total, page, limit);
}

export async function getSongsByCollection(slug: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const { songs, total } = await repo.findByCollection(slug, { skip, limit });
  return {
    songs,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export async function getAdjacentSongs(id: string) {
  return repo.getAdjacentSongs(id);
}
