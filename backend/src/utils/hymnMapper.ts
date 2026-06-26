import type { Hymn, HymnCategory } from '@prisma/client';

type CategoryWithCount = HymnCategory & {
  _count?: { hymns?: number };
};

type HymnWithCategory = Hymn & {
  category?: HymnCategory;
};

const SLUG_BY_CODE: Record<string, string> = {
  ob: 'only-believe',
  cs: 'crois-seulement',
  hos: 'hosanna',
  ac: 'autres-cantiques',
  cc: 'collection-des-cantiques',
  cv: 'chant-de-victoire',
  nm: 'nyimbo-za-mungu',
  nw: 'nyimbo-za-wokovu',
  rs: 'roc-seculaire',
  qtg: 'quel-temps-glorieux',
  sss: 'sacred-songs-and-solos',
  ob2: 'only-believe-2',
  rsp2: 'roc-seculaire-paris',
};

const CODE_BY_SLUG = Object.fromEntries(
  Object.entries(SLUG_BY_CODE).map(([code, slug]) => [slug, code])
);

export function slugForCategory(code: string): string {
  return SLUG_BY_CODE[code] ?? code;
}

export function categoryCodeFromSlug(slugOrCode: string): string {
  return CODE_BY_SLUG[slugOrCode] ?? slugOrCode;
}

export function toCollection(category: CategoryWithCount) {
  const songCount = category._count?.hymns ?? category.hymnCount ?? 0;

  return {
    id: String(category.id),
    code: category.code,
    slug: slugForCategory(category.code),
    name: category.name,
    subtitle: `${songCount} Hymns`,
    language: category.languageName ?? category.language ?? 'Mixed',
    description: category.description ?? undefined,
    songCount,
    importedHymnCount: songCount,
    sourceOrder: category.sourceOrder,
    _count: { songs: songCount },
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function getSongNumber(hymn: Pick<Hymn, 'number' | 'numberNumeric' | 'categoryOrder'>): number {
  const parsed = hymn.numberNumeric ?? Number.parseInt(hymn.number, 10);
  return Number.isFinite(parsed) ? parsed : hymn.categoryOrder;
}

function getVerseLines(verse: unknown): string[] {
  if (!verse || typeof verse !== 'object') return [];
  const candidate = verse as { lines?: unknown; text?: unknown };
  if (Array.isArray(candidate.lines)) return candidate.lines.map(String);
  if (typeof candidate.text === 'string') return candidate.text.split(/\r?\n/);
  return [];
}

function getVerseIndex(verse: unknown, fallback: number): number {
  if (!verse || typeof verse !== 'object') return fallback;
  const candidate = verse as { index?: unknown };
  return typeof candidate.index === 'number' ? candidate.index : fallback;
}

function toLyricSections(hymn: Pick<Hymn, 'lyrics' | 'verses'>) {
  const verses = Array.isArray(hymn.verses) ? hymn.verses : [];
  const source = verses.length > 0
    ? verses
    : [{ index: 1, lines: String(hymn.lyrics ?? '').split(/\r?\n/) }];

  return source.map((verse, index) => {
    const lines = getVerseLines(verse);
    const firstLine = lines.find((line) => line.trim().length > 0)?.trim().toLowerCase() ?? '';
    const isChorus =
      firstLine.includes('chorus') ||
      firstLine.includes('choeur') ||
      firstLine.includes('chœur') ||
      firstLine.includes('refrain');
    const order = index + 1;

    return {
      id: order,
      type: isChorus ? 'chorus' : 'verse',
      label: isChorus ? 'Chorus' : `Verse ${getVerseIndex(verse, order)}`,
      content: lines.join('\n'),
      lines,
      order,
    };
  });
}

export function toSong(hymn: HymnWithCategory) {
  const collection = hymn.category ? toCollection(hymn.category) : undefined;
  const sections = toLyricSections(hymn);

  return {
    id: String(hymn.id),
    sourceId: hymn.sourceId,
    songNumber: getSongNumber(hymn),
    number: hymn.number,
    duplicateIndex: hymn.duplicateIndex,
    title: hymn.title,
    language: collection?.language ?? hymn.categoryCode,
    category: hymn.gamme ?? undefined,
    keySignature: hymn.gamme ?? undefined,
    collectionId: String(hymn.categoryId),
    collection,
    sections,
    lyrics: JSON.stringify(sections),
    rawLyrics: hymn.lyrics,
    author: hymn.author ?? undefined,
    createdAt: hymn.createdAt,
    updatedAt: hymn.updatedAt,
  };
}

export function toSearchResult(hymn: HymnWithCategory, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const title = hymn.title.toLowerCase();
  const lyrics = hymn.lyrics.toLowerCase();
  const matchType = hymn.number === query || String(hymn.numberNumeric ?? '') === query
    ? 'number'
    : title.includes(normalizedQuery)
      ? 'title'
      : lyrics.includes(normalizedQuery)
        ? 'lyrics'
        : 'title';

  return {
    song: toSong(hymn),
    matchType,
    matchPreview: matchType === 'lyrics' ? buildLyricPreview(hymn.lyrics, normalizedQuery) : undefined,
    score: matchType === 'number' ? 1 : matchType === 'title' ? 0.8 : 0.5,
  };
}

function buildLyricPreview(lyrics: string, query: string): string {
  const index = lyrics.toLowerCase().indexOf(query);
  if (index < 0) return lyrics.slice(0, 160);
  const start = Math.max(0, index - 70);
  const end = Math.min(lyrics.length, index + query.length + 90);
  return lyrics.slice(start, end).replace(/\s+/g, ' ').trim();
}
