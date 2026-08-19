import { Router } from 'express';
import healthRoutes from './health.js';
import jobsRoutes from './jobs.js';
import metricsRoutes from './metrics.js';

const router = Router();

router.use(healthRoutes);
router.use(jobsRoutes);
router.use(metricsRoutes);

export default router;
