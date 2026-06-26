import { Router } from 'express';
import songsRoutes from '../modules/songs/songs.routes';
import collectionsRoutes from '../modules/collections/collections.routes';
import { prisma } from '../config/database';

const router = Router();

router.use('/songs', songsRoutes);
router.use('/hymns', songsRoutes);
router.use('/collections', collectionsRoutes);

router.get('/health', async (_req, res, next) => {
  try {
    const [collections, hymns] = await Promise.all([
      prisma.hymnCategory.count(),
      prisma.hymn.count(),
    ]);

    res.json({
      success: true,
      message: 'Morija-Cantiques API is running',
      database: 'connected',
      collections,
      hymns,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
