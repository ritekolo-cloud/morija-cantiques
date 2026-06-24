import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import type { CreateSongInput, UpdateSongInput } from './songs.validator';

const SONG_SELECT = {
  id: true,
  songNumber: true,
  title: true,
  lyrics: true,
  category: true,
  keySignature: true,
  language: true,
  collectionId: true,
  createdAt: true,
  updatedAt: true,
  collection: {
    select: { id: true, slug: true, name: true, language: true },
  },
} as const;

export async function findAll(params: {
  skip: number;
  limit: number;
  collectionId?: string;
  language?: string;
}) {
  const where: Prisma.SongWhereInput = {};
  if (params.collectionId) where.collectionId = params.collectionId;
  if (params.language) where.language = params.language;

  const [songs, total] = await Promise.all([
    prisma.song.findMany({
      where,
      select: SONG_SELECT,
      orderBy: [{ collection: { order: 'asc' } }, { songNumber: 'asc' }],
      skip: params.skip,
      take: params.limit,
    }),
    prisma.song.count({ where }),
  ]);

  return { songs, total };
}

export async function findById(id: string) {
  return prisma.song.findUnique({ where: { id }, select: SONG_SELECT });
}

export async function findByNumber(collectionSlug: string, number: number) {
  const collection = await prisma.collection.findUnique({
    where: { slug: collectionSlug },
  });
  if (!collection) return null;

  return prisma.song.findUnique({
    where: {
      collectionId_songNumber: { collectionId: collection.id, songNumber: number },
    },
    select: SONG_SELECT,
  });
}

export async function search(params: {
  query: string;
  type: string;
  skip: number;
  limit: number;
  collectionSlug?: string;
}) {
  const { query, type, skip, limit, collectionSlug } = params;

  const collectionWhere: Prisma.SongWhereInput['collection'] = collectionSlug
    ? { slug: collectionSlug }
    : undefined;

  let where: Prisma.SongWhereInput = {};

  if (collectionWhere) where.collection = collectionWhere;

  // Number search
  const asNumber = parseInt(query, 10);
  if (type === 'number' && !isNaN(asNumber)) {
    where.songNumber = asNumber;
  } else if (type === 'title') {
    where.title = { contains: query, mode: 'insensitive' };
  } else if (type === 'lyrics') {
    where.lyrics = { contains: query, mode: 'insensitive' };
  } else {
    // 'all' — search across number, title, lyrics
    const orConditions: Prisma.SongWhereInput[] = [
      { title: { contains: query, mode: 'insensitive' } },
      { lyrics: { contains: query, mode: 'insensitive' } },
    ];
    if (!isNaN(asNumber)) orConditions.push({ songNumber: asNumber });
    where = { ...where, OR: orConditions };
  }

  const [songs, total] = await Promise.all([
    prisma.song.findMany({
      where,
      select: SONG_SELECT,
      orderBy: { songNumber: 'asc' },
      skip,
      take: limit,
    }),
    prisma.song.count({ where }),
  ]);

  return { songs, total };
}

export async function findByCollection(collectionSlug: string, params: {
  skip: number;
  limit: number;
}) {
  const collection = await prisma.collection.findUnique({
    where: { slug: collectionSlug },
    select: { id: true },
  });
  if (!collection) return { songs: [], total: 0 };

  const [songs, total] = await Promise.all([
    prisma.song.findMany({
      where: { collectionId: collection.id },
      select: SONG_SELECT,
      orderBy: { songNumber: 'asc' },
      skip: params.skip,
      take: params.limit,
    }),
    prisma.song.count({ where: { collectionId: collection.id } }),
  ]);

  return { songs, total };
}

export async function create(data: CreateSongInput) {
  return prisma.song.create({
    data: {
      songNumber: data.songNumber,
      title: data.title,
      lyrics: data.lyrics,
      collectionId: data.collectionId,
      category: data.category,
      keySignature: data.keySignature,
      language: data.language,
    },
    select: SONG_SELECT,
  });
}

export async function update(id: string, data: UpdateSongInput) {
  return prisma.song.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.lyrics && { lyrics: data.lyrics }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.keySignature !== undefined && { keySignature: data.keySignature }),
      ...(data.language && { language: data.language }),
    },
    select: SONG_SELECT,
  });
}

export async function remove(id: string) {
  return prisma.song.delete({ where: { id } });
}

export async function getAdjacentSongs(collectionId: string, currentNumber: number) {
  const [prev, next] = await Promise.all([
    prisma.song.findFirst({
      where: { collectionId, songNumber: { lt: currentNumber } },
      orderBy: { songNumber: 'desc' },
      select: { id: true, songNumber: true, title: true },
    }),
    prisma.song.findFirst({
      where: { collectionId, songNumber: { gt: currentNumber } },
      orderBy: { songNumber: 'asc' },
      select: { id: true, songNumber: true, title: true },
    }),
  ]);
  return { prev, next };
}
