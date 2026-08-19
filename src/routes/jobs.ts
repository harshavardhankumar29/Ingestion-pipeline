import { Router } from 'express';
import { runIngestionPipeline } from '../pipeline/orchestrator.js';

const router = Router();

/**
 * GET /api/jobs
 * Triggers the full ingestion pipeline: fetch → validate → deduplicate → serve
 */
router.get('/jobs', async (req, res) => {
  try {
    const result = await runIngestionPipeline();
    res.json({
      success: true,
      metrics: {
        sourceUsed: result.sourceUsed,
        circuitState: result.circuitState,
        totalRaw: result.totalRaw,
        validListings: result.validCount,
        invalidListings: result.invalidCount,
        dedupedListings: result.dedupedCount,
        ...(result.cacheAgeSeconds !== undefined && { cacheAgeSeconds: result.cacheAgeSeconds })
      },
      data: result.jobs
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Pipeline execution error'
    });
  }
});

export default router;
