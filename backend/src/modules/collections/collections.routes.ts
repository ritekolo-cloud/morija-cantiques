import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated, parsePagination, buildPaginationMeta } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// All collection routes are public
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const collections = await prisma.collection.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { songs: true } } },
    });
    sendSuccess(res, collections);
  } catch (err) { next(err); }
});

router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { songs: true } } },
    });
    if (!collection) throw new AppError('Collection not found', 404);
    sendSuccess(res, collection);
  } catch (err) { next(err); }
});

router.get('/:slug/songs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { slug: req.params.slug },
    });
    if (!collection) throw new AppError('Collection not found', 404);

    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where: { collectionId: collection.id },
        orderBy: { songNumber: 'asc' },
        skip,
        take: limit,
        select: {
          id: true, songNumber: true, title: true, language: true,
          category: true, collectionId: true,
        },
      }),
      prisma.song.count({ where: { collectionId: collection.id } }),
    ]);

    sendSuccess(res, { collection, songs }, 'Songs retrieved', 200, buildPaginationMeta(total, page, limit));
  } catch (err) { next(err); }
});

export default router;
