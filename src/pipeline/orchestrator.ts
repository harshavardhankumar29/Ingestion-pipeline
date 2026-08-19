import crypto from 'crypto';
import { CONFIG } from '../config/config.js';
import { fetchWithPacing } from '../fetcher/fetcher.js';
import { CircuitBreaker, CircuitState, type CircuitBreakerMetrics } from '../resilience/circuitBreaker.js';
import { validateJobListings, type JobListing } from '../schema/jobSchema.js';

// Circuit breaker instance configured from environment
const circuitBreaker = new CircuitBreaker(
  CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
  CONFIG.CIRCUIT_BREAKER.COOLDOWN_MS
);

// In-memory cache for resilient fallback (Plan B)
let cachedSuccessfulPayload: any[] | null = null;
let lastCacheUpdateTime: string | null = null;

// Cross-run deduplication store with bounded memory capacity
const globalSeenHashes = new Set<string>();
const MAX_GLOBAL_HASH_ENTRIES = 10000;

export interface IngestionResult {
  sourceUsed: 'PRIMARY' | 'FALLBACK_CACHE' | 'FALLBACK_SYNTHETIC';
  circuitState: CircuitState;
  totalRaw: number;
  validCount: number;
  invalidCount: number;
  dedupedCount: number;
  cacheAgeSeconds?: number | undefined;
  jobs: JobListing[];
}

export interface PipelineMetrics {
  circuitBreaker: CircuitBreakerMetrics;
  deduplication: {
    totalHashesStored: number;
    maxCapacity: number;
  };
  cache: {
    hasCachedPayload: boolean;
    cachedItemCount: number;
    lastCacheUpdate: string | null;
  };
}

/**
 * Generates an MD5 content hash for cross-cycle deduplication
 */
export function generateListingHash(job: JobListing): string {
  const normCompany = job.company.toLowerCase().trim();
  const normTitle = job.title.toLowerCase().trim();
  return crypto.createHash('md5').update(`${normCompany}:${normTitle}`).digest('hex');
}

/**
 * Clears deduplication memory (useful for testing or cache resets)
 */
export function resetDeduplicationStore(): void {
  globalSeenHashes.clear();
}

/**
 * Returns pipeline metrics and resilience statistics for observability
 */
export function getPipelineMetrics(): PipelineMetrics {
  return {
    circuitBreaker: circuitBreaker.getMetrics(),
    deduplication: {
      totalHashesStored: globalSeenHashes.size,
      maxCapacity: MAX_GLOBAL_HASH_ENTRIES,
    },
    cache: {
      hasCachedPayload: cachedSuccessfulPayload !== null,
      cachedItemCount: cachedSuccessfulPayload ? cachedSuccessfulPayload.length : 0,
      lastCacheUpdate: lastCacheUpdateTime,
    },
  };
}

export async function runIngestionPipeline(): Promise<IngestionResult> {
  let sourceUsed: 'PRIMARY' | 'FALLBACK_CACHE' | 'FALLBACK_SYNTHETIC' = 'PRIMARY';

  // Task 1: Primary fetch with pacing, modern headers, and UA rotation
  const primaryTask = async () => {
    sourceUsed = 'PRIMARY';
    const rawData = await fetchWithPacing<any[]>({
      url: CONFIG.PRIMARY_SOURCE_URL,
      baseDelayMs: CONFIG.FETCHER.BASE_DELAY_MS
    });

    // RemoteOK and similar APIs may return legal/metadata headers in the first element
    const items = Array.isArray(rawData) ? rawData.filter(item => item && typeof item === 'object' && item.id) : [];

    if (items.length > 0) {
      // Refresh cache on success for smart fallback
      cachedSuccessfulPayload = items;
      lastCacheUpdateTime = new Date().toISOString();
    }
    return items;
  };

  // Task 2: Smart fallback (Plan B: serves cached real data or synthetic sandbox)
  const fallbackTask = async () => {
    if (cachedSuccessfulPayload && cachedSuccessfulPayload.length > 0) {
      sourceUsed = 'FALLBACK_CACHE';
      console.warn(`[Orchestrator] Primary target failed. Serving ${cachedSuccessfulPayload.length} items from resilient snapshot cache (Updated: ${lastCacheUpdateTime}).`);
      return cachedSuccessfulPayload;
    }

    sourceUsed = 'FALLBACK_SYNTHETIC';
    console.warn(`[Orchestrator] Primary target failed & no cache present. Executing synthetic sandbox fallback...`);
    return [
      {
        id: 'fallback-101',
        title: 'Senior Backend Engineer (Resilient Sandbox)',
        company: 'Resilient Systems Corp',
        location: 'Remote',
        url: 'https://example.com/jobs/101',
        tags: ['typescript', 'node.js', 'docker']
      },
      {
        id: 'fallback-102',
        title: 'Full Stack Infrastructure Engineer (Resilient Sandbox)',
        company: 'Cloud Resilience Ltd',
        location: 'Remote',
        url: 'https://example.com/jobs/102',
        tags: ['resilience', 'distributed-systems']
      }
    ];
  };

  // Execute fetch wrapped in Circuit Breaker
  const rawItems = await circuitBreaker.execute(primaryTask, fallbackTask);

  // Validate Schema & Handle Data Drift
  const { valid, invalidCount } = validateJobListings(rawItems);

  // Deduplicate within the current run AND track against historical cross-run seen set
  const dedupedJobs: JobListing[] = [];
  const currentBatchSeen = new Set<string>();

  for (const job of valid) {
    const hash = generateListingHash(job);
    if (!currentBatchSeen.has(hash)) {
      currentBatchSeen.add(hash);

      // Add to global seen store (with simple eviction if max capacity exceeded)
      if (globalSeenHashes.size >= MAX_GLOBAL_HASH_ENTRIES) {
        const firstKey = globalSeenHashes.keys().next().value;
        if (firstKey) globalSeenHashes.delete(firstKey);
      }
      globalSeenHashes.add(hash);

      dedupedJobs.push(job);
    }
  }

  const cacheAgeSeconds = lastCacheUpdateTime
    ? Math.floor((Date.now() - new Date(lastCacheUpdateTime).getTime()) / 1000)
    : undefined;

  return {
    sourceUsed,
    circuitState: circuitBreaker.getState(),
    totalRaw: rawItems.length,
    validCount: valid.length,
    invalidCount,
    dedupedCount: dedupedJobs.length,
    cacheAgeSeconds,
    jobs: dedupedJobs
  };
}
