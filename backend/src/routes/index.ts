import { Router } from 'express';
import songsRoutes from '../modules/songs/songs.routes';
import collectionsRoutes from '../modules/collections/collections.routes';

const router = Router();

router.use('/songs', songsRoutes);
router.use('/collections', collectionsRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Morija-Cantiques API is running 🎵', timestamp: new Date().toISOString() });
});

export default router;
