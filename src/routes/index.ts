import { Router } from 'express';
import analyzerRoutes from './analyzer.route';

const router = Router();

// Analyzer routes - Dependency analysis endpoints
router.use('/analyzer', analyzerRoutes);

// Add other routes here
// router.use('/users', userRoutes);
// router.use('/auth', authRoutes);

export default router;
