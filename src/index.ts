import express from 'express';
import { CONFIG } from './config/config.js';
import { runIngestionPipeline, getPipelineMetrics } from './pipeline/orchestrator.js';

const app = express();
const PORT = CONFIG.PORT;

app.use(express.json());

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Real-Time Observability & Metrics Endpoint
app.get('/api/metrics', (req, res) => {
  const metrics = getPipelineMetrics();
  res.json({
    status: 'ACTIVE',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    telemetry: metrics
  });
});

// Live Data Ingestion Trigger Endpoint
app.get('/api/jobs', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(` Resilient Ingestion Server running on port ${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   - Ingestion:  http://localhost:${PORT}/api/jobs`);
  console.log(`   - Metrics:    http://localhost:${PORT}/api/metrics`);
  console.log(`   - Health:     http://localhost:${PORT}/api/health`);
  console.log(`================================================`);
});
