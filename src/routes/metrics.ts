import { Router } from 'express';
import { getPipelineMetrics } from '../pipeline/orchestrator.js';

const router = Router();

/**
 * GET /api/metrics
 * Real-time observability endpoint: circuit breaker telemetry, dedup cache stats, pipeline health
 */
router.get('/metrics', (req, res) => {
  const metrics = getPipelineMetrics();
  res.json({
    status: 'ACTIVE',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    telemetry: metrics
  });
});

export default router;
