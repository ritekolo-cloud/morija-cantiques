import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { categoryCodeFromSlug, toSearchResult, toSong } from '../../utils/hymnMapper';

const HYMN_INCLUDE = {
  category: true,
} as const;

function collectionWhere(slugOrCode?: string): Prisma.HymnWhereInput {
  if (!slugOrCode) return {};
  const code = categoryCodeFromSlug(slugOrCode);
  if (/^\d+$/.test(slugOrCode)) return { categoryId: Number(slugOrCode) };
  return { categoryCode: code };
}

export async function findAll(params: {
  skip: number;
  limit: number;
  collectionId?: string;
  language?: string;
  search?: string;
}) {
  const where: Prisma.HymnWhereInput = {
    ...collectionWhere(params.collectionId),
  };

  if (params.language) {
    where.category = { language: params.language };
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { lyrics: { contains: params.search, mode: 'insensitive' } },
      { number: params.search },
    ];
  }

  const [hymns, total] = await Promise.all([
    prisma.hymn.findMany({
      where,
      include: HYMN_INCLUDE,
      orderBy: [{ sourceOrder: 'asc' }],
      skip: params.skip,
      take: params.limit,
    }),
    prisma.hymn.count({ where }),
  ]);

  return { songs: hymns.map(toSong), total };
}

export async function findById(id: string) {
  const hymnId = Number(id);
  if (!Number.isInteger(hymnId)) return null;

  const hymn = await prisma.hymn.findUnique({
    where: { id: hymnId },
    include: HYMN_INCLUDE,
  });

  return hymn ? toSong(hymn) : null;
}

export async function findByNumber(collectionSlug: string, number: number) {
  const hymn = await prisma.hymn.findFirst({
    where: {
      ...collectionWhere(collectionSlug),
      number: String(number),
    },
    include: HYMN_INCLUDE,
    orderBy: [{ duplicateIndex: 'asc' }],
  });

  return hymn ? toSong(hymn) : null;
}

export async function search(params: {
  query: string;
  type: string;
  skip: number;
  limit: number;
  collectionSlug?: string;
}) {
  const { query, type, skip, limit, collectionSlug } = params;
  const where: Prisma.HymnWhereInput = {
    ...collectionWhere(collectionSlug),
  };
  const asNumber = Number.parseInt(query, 10);

  if (type === 'number' && Number.isFinite(asNumber)) {
    where.OR = [{ number: query }, { numberNumeric: asNumber }];
  } else if (type === 'title') {
    where.title = { contains: query, mode: 'insensitive' };
  } else if (type === 'lyrics') {
    where.lyrics = { contains: query, mode: 'insensitive' };
  } else {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { lyrics: { contains: query, mode: 'insensitive' } },
    ];
    if (Number.isFinite(asNumber)) {
      where.OR.push({ number: query }, { numberNumeric: asNumber });
    }
  }

  const [hymns, total] = await Promise.all([
    prisma.hymn.findMany({
      where,
      include: HYMN_INCLUDE,
      orderBy: [{ sourceOrder: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.hymn.count({ where }),
  ]);

  return { songs: hymns.map((hymn) => toSearchResult(hymn, query)), total };
}

export async function findByCollection(collectionSlug: string, params: {
  skip: number;
  limit: number;
}) {
  const where = collectionWhere(collectionSlug);
  const [hymns, total] = await Promise.all([
    prisma.hymn.findMany({
      where,
      include: HYMN_INCLUDE,
      orderBy: [{ categoryOrder: 'asc' }, { duplicateIndex: 'asc' }],
      skip: params.skip,
      take: params.limit,
    }),
    prisma.hymn.count({ where }),
  ]);

  return { songs: hymns.map(toSong), total };
}

export async function getAdjacentSongs(id: string) {
  const hymnId = Number(id);
  if (!Number.isInteger(hymnId)) return { prev: null, next: null };

  const current = await prisma.hymn.findUnique({
    where: { id: hymnId },
    select: { categoryId: true, categoryOrder: true, duplicateIndex: true },
  });

  if (!current) return { prev: null, next: null };

  const [prev, next] = await Promise.all([
    prisma.hymn.findFirst({
      where: {
        categoryId: current.categoryId,
        OR: [
          { categoryOrder: { lt: current.categoryOrder } },
          { categoryOrder: current.categoryOrder, duplicateIndex: { lt: current.duplicateIndex } },
        ],
      },
      orderBy: [{ categoryOrder: 'desc' }, { duplicateIndex: 'desc' }],
      include: HYMN_INCLUDE,
    }),
    prisma.hymn.findFirst({
      where: {
        categoryId: current.categoryId,
        OR: [
          { categoryOrder: { gt: current.categoryOrder } },
          { categoryOrder: current.categoryOrder, duplicateIndex: { gt: current.duplicateIndex } },
        ],
      },
      orderBy: [{ categoryOrder: 'asc' }, { duplicateIndex: 'asc' }],
      include: HYMN_INCLUDE,
    }),
  ]);

  return {
    prev: prev ? toSong(prev) : null,
    next: next ? toSong(next) : null,
  };
}
