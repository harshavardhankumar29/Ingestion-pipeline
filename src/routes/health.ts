import { Router } from 'express';

const router = Router();

/**
 * GET /api/health
 * System health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export default router;
