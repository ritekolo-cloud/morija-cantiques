import { Router } from 'express';
import songsRoutes from '../modules/songs/songs.routes';
import collectionsRoutes from '../modules/collections/collections.routes';
import { prisma } from '../config/database';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/users.routes';
import presentationsRoutes from '../modules/presentations/presentations.routes';

const router = Router();

router.use('/songs', songsRoutes);
router.use('/hymns', songsRoutes);
router.use('/collections', collectionsRoutes);
router.use('/auth', authRoutes);
router.use('/me', userRoutes);
router.use('/presentations', presentationsRoutes);

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
