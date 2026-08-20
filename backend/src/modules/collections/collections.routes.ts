import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, parsePagination, buildPaginationMeta } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { categoryCodeFromSlug, toCollection, toSong } from '../../utils/hymnMapper';
import { z } from 'zod';

const router = Router();

// Ensure the Sincérité category exists (user submission collection)
export async function ensureSinceriteCategory() {
  const existing = await prisma.hymnCategory.findUnique({
    where: { code: 'sincerite' },
    include: { _count: { select: { hymns: true } } },
  });

  const count = existing?._count?.hymns ?? 0;
  const data = {
    code: 'sincerite',
    name: 'Sincérité',
    description: 'Chansons ajoutées par les utilisateurs',
    language: 'fr',
    languageName: 'Français',
    sourceOrder: 99,
    sourceDeclaredCount: null,
    hymnCount: count,
  };

  return prisma.hymnCategory.upsert({
    where: { code: 'sincerite' },
    create: data,
    update: {
      name: data.name,
      description: data.description,
      hymnCount: count,
    },
  });
}

ensureSinceriteCategory().catch(() => {/* best-effort at startup */});

const submitSongSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  lyrics: z.string().min(1, 'Lyrics are required'),
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureSinceriteCategory().catch(() => {});
    const collections = await prisma.hymnCategory.findMany({
      orderBy: { sourceOrder: 'asc' },
      include: { _count: { select: { hymns: true } } },
    });

    sendSuccess(res, collections.map(toCollection));
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = categoryCodeFromSlug(req.params.slug);
    if (code === 'sincerite') {
      await ensureSinceriteCategory().catch(() => {});
    }

    const collection = await prisma.hymnCategory.findUnique({
      where: { code },
      include: { _count: { select: { hymns: true } } },
    });

    if (!collection) throw new AppError('Collection not found', 404);
    sendSuccess(res, toCollection(collection));
  } catch (err) {
    next(err);
  }
});

router.get('/:slug/songs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = categoryCodeFromSlug(req.params.slug);
    if (code === 'sincerite') {
      await ensureSinceriteCategory().catch(() => {});
    }

    const collection = await prisma.hymnCategory.findUnique({
      where: { code },
      include: { _count: { select: { hymns: true } } },
    });

    if (!collection) throw new AppError('Collection not found', 404);

    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const [hymns, total] = await Promise.all([
      prisma.hymn.findMany({
        where: { categoryId: collection.id },
        include: { category: true },
        orderBy: [{ categoryOrder: 'asc' }, { duplicateIndex: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.hymn.count({ where: { categoryId: collection.id } }),
    ]);

    sendSuccess(
      res,
      { collection: toCollection(collection), songs: hymns.map(toSong) },
      'Songs retrieved',
      200,
      buildPaginationMeta(total, page, limit)
    );
  } catch (err) {
    next(err);
  }
});

// POST /collections/sincerite/songs — user song submission
router.post('/sincerite/songs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = submitSongSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      res.status(400).json({ success: false, message: 'Validation failed', errors });
      return;
    }

    const { title, lyrics } = parsed.data;

    // Ensure category exists
    await ensureSinceriteCategory();

    const category = await prisma.hymnCategory.findUnique({ where: { code: 'sincerite' } });
    if (!category) throw new AppError('Sincérité collection not found', 500);

    // Determine next song number
    const lastHymn = await prisma.hymn.findFirst({
      where: { categoryId: category.id },
      orderBy: { categoryOrder: 'desc' },
      select: { categoryOrder: true, sourceOrder: true },
    });

    const globalMax = await prisma.hymn.findFirst({
      orderBy: { sourceOrder: 'desc' },
      select: { sourceOrder: true },
    });

    const nextCategoryOrder = (lastHymn?.categoryOrder ?? 0) + 1;
    const nextSourceOrder = (globalMax?.sourceOrder ?? 0) + 1;
    const songNumber = String(nextCategoryOrder);
    const sourceId = `sincerite:user:${Date.now()}`;

    // Build lyrics lines and verses from raw text
    const lyricsLines = lyrics.split('\n');
    const verses = lyricsLines
      .join('\n')
      .split(/\n\s*\n/)
      .map((block, index) => ({
        index: index + 1,
        text: block.trim(),
        lines: block.trim().split('\n').map((l) => l.trim()).filter(Boolean),
      }));

    const hymn = await prisma.hymn.create({
      data: {
        sourceId,
        sourceOrder: nextSourceOrder,
        categoryOrder: nextCategoryOrder,
        categoryId: category.id,
        categoryCode: 'sincerite',
        number: songNumber,
        numberNumeric: nextCategoryOrder,
        numberSuffix: null,
        duplicateIndex: 1,
        title: title.trim().toUpperCase(),
        gamme: null,
        author: null,
        lyrics,
        lyricsLines,
        verses,
      },
      include: { category: true },
    });

    // Update category hymn count
    await prisma.hymnCategory.update({
      where: { id: category.id },
      data: { hymnCount: nextCategoryOrder },
    });

    sendCreated(res, toSong(hymn), 'Song submitted successfully');
  } catch (err) {
    next(err);
  }
});

export default router;

