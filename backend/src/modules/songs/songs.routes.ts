import { Router } from 'express';
import * as ctrl from './songs.controller';
import { searchLimiter } from '../../middleware/rateLimit.middleware';

const router = Router();

// Public routes
router.get('/', ctrl.getAll);
router.get('/search', searchLimiter, ctrl.search);
router.get('/collection/:slug', ctrl.getByCollection);
router.get('/:id/adjacent', ctrl.adjacent);
router.get('/collection/:slug/number/:number', ctrl.getByNumber);
router.get('/:id', ctrl.getById);

export default router;
