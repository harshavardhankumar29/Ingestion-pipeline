import express from 'express';
import { CONFIG } from './config/config.js';
import apiRoutes from './routes/index.js';

const app = express();
const PORT = CONFIG.PORT;

app.use(express.json());

// Mount all API routes under /api prefix
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(` Resilient Ingestion Server running on port ${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   - Ingestion:  http://localhost:${PORT}/api/jobs`);
  console.log(`   - Metrics:    http://localhost:${PORT}/api/metrics`);
  console.log(`   - Health:     http://localhost:${PORT}/api/health`);
  console.log(`================================================`);
});
