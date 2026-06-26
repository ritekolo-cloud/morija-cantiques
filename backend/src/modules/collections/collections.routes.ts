import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, parsePagination, buildPaginationMeta } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import { categoryCodeFromSlug, toCollection, toSong } from '../../utils/hymnMapper';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
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
    const collection = await prisma.hymnCategory.findUnique({
      where: { code: categoryCodeFromSlug(req.params.slug) },
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
    const collection = await prisma.hymnCategory.findUnique({
      where: { code: categoryCodeFromSlug(req.params.slug) },
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

export default router;
