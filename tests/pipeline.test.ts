import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitState } from '../src/resilience/circuitBreaker.js';
import { validateJobListings, JobListingSchema, type JobListing } from '../src/schema/jobSchema.js';
import { getRandomUserAgent, getBrowserHeaders } from '../src/fetcher/fetcher.js';
import { generateListingHash } from '../src/pipeline/orchestrator.js';

describe('Circuit Breaker Resilience Engine', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    // 3 failure threshold, 50ms cooldown for fast test execution
    cb = new CircuitBreaker(3, 50);
  });

  it('starts in CLOSED state with 0 failures', () => {
    assert.equal(cb.getState(), CircuitState.CLOSED);
    const metrics = cb.getMetrics();
    assert.equal(metrics.failureCount, 0);
    assert.equal(metrics.tripCount, 0);
  });

  it('executes primary task successfully and records telemetry', async () => {
    const primary = async () => 'primary_data';
    const fallback = async () => 'fallback_data';

    const result = await cb.execute(primary, fallback);
    assert.equal(result, 'primary_data');
    assert.equal(cb.getState(), CircuitState.CLOSED);
    assert.equal(cb.getMetrics().successfulPrimaryCalls, 1);
  });

  it('trips to OPEN after reaching failure threshold and routes to fallback', async () => {
    const failingPrimary = async () => { throw new Error('429 Too Many Requests'); };
    const fallback = async () => 'fallback_data';

    // 1st failure
    await cb.execute(failingPrimary, fallback);
    assert.equal(cb.getState(), CircuitState.CLOSED);
    assert.equal(cb.getMetrics().failureCount, 1);

    // 2nd failure
    await cb.execute(failingPrimary, fallback);
    assert.equal(cb.getState(), CircuitState.CLOSED);
    assert.equal(cb.getMetrics().failureCount, 2);

    // 3rd failure -> Trips circuit
    const result3 = await cb.execute(failingPrimary, fallback);
    assert.equal(result3, 'fallback_data');
    assert.equal(cb.getState(), CircuitState.OPEN);
    assert.equal(cb.getMetrics().tripCount, 1);

    // Subsequent call in OPEN state should not even call primary
    let primaryCalled = false;
    const guardedPrimary = async () => { primaryCalled = true; return 'data'; };
    const result4 = await cb.execute(guardedPrimary, fallback);

    assert.equal(result4, 'fallback_data');
    assert.equal(primaryCalled, false, 'Primary should NOT be invoked while circuit is OPEN');
  });

  it('transitions from OPEN to HALF_OPEN after cooldown expires', async () => {
    const failingPrimary = async () => { throw new Error('Network Error'); };
    const fallback = async () => 'fallback_data';

    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      await cb.execute(failingPrimary, fallback);
    }
    assert.equal(cb.getState(), CircuitState.OPEN);

    // Wait for cooldown (50ms)
    await new Promise(res => setTimeout(res, 60));

    // Next check should show HALF_OPEN
    assert.equal(cb.getState(), CircuitState.HALF_OPEN);

    // Successful canary resets circuit to CLOSED
    const successPrimary = async () => 'canary_success';
    const result = await cb.execute(successPrimary, fallback);
    assert.equal(result, 'canary_success');
    assert.equal(cb.getState(), CircuitState.CLOSED);
  });
});

describe('Zod Schema & Data Drift Resilience', () => {
  it('parses fully compliant job payload', () => {
    const raw = {
      id: 'job-123',
      title: 'Senior Software Engineer',
      company: 'TechCorp',
      location: 'Remote, US',
      url: 'https://example.com/job/123',
      date: '2026-08-19T10:00:00Z',
      tags: ['typescript', 'node']
    };

    const parsed = JobListingSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.id, 'job-123');
      assert.equal(parsed.data.title, 'Senior Software Engineer');
      assert.equal(parsed.data.company, 'TechCorp');
    }
  });

  it('handles field alias data drift (position -> title)', () => {
    const driftedPayload = {
      id: 9988,
      position: 'Staff DevOps Architect', // Drifted field key
      company: 'Cloud Scale Inc',
      tags: ['kubernetes', 'terraform']
    };

    const parsed = JobListingSchema.safeParse(driftedPayload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.id, '9988'); // Numeric ID converted to string
      assert.equal(parsed.data.title, 'Staff DevOps Architect'); // Successfully aliased
      assert.equal(parsed.data.location, 'Remote'); // Default value applied
      assert.equal(parsed.data.url, 'https://remoteok.com'); // Default URL applied
    }
  });

  it('separates valid items from corrupted items without throwing', () => {
    const rawItems = [
      { id: '1', title: 'Frontend Developer', company: 'Acme' },
      null, // Corrupted
      { invalid_structure: true }, // Missing id
      { id: '2', position: 'Backend Developer', company: 'Beta' },
      'random_string_payload' // Corrupted
    ];

    const { valid, invalidCount } = validateJobListings(rawItems as any);
    assert.equal(valid.length, 2);
    assert.equal(invalidCount, 3);
    assert.equal(valid[0]?.title, 'Frontend Developer');
    assert.equal(valid[1]?.title, 'Backend Developer');
  });
});

describe('Anti-Bot Evasion & Header Builder', () => {
  it('selects a valid User-Agent string from the pool', () => {
    const ua = getRandomUserAgent();
    assert.ok(typeof ua === 'string' && ua.length > 20);
    assert.match(ua, /Mozilla\/5\.0/);
  });

  it('generates realistic browser client hint and Sec-Fetch headers', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36';
    const headers = getBrowserHeaders(ua);

    assert.equal(headers['User-Agent'], ua);
    assert.equal(headers['Sec-Fetch-Dest'], 'empty');
    assert.equal(headers['Sec-Fetch-Mode'], 'cors');
    assert.equal(headers['Sec-Fetch-Site'], 'same-origin');
    assert.equal(headers['Sec-Ch-Ua-Platform'], '"macOS"');
  });
});

describe('Content Hash & Deduplication', () => {
  it('generates deterministic MD5 hashes invariant of whitespace/casing', () => {
    const job1: JobListing = {
      id: '1',
      title: 'Senior Engineer',
      company: 'Google',
      location: 'Remote',
      url: 'https://google.com',
      date: undefined,
      tags: []
    };

    const job2: JobListing = {
      id: '2',
      title: '  SENIOR ENGINEER  ',
      company: 'google  ',
      location: 'New York',
      url: 'https://different-url.com',
      date: undefined,
      tags: ['different']
    };

    const hash1 = generateListingHash(job1);
    const hash2 = generateListingHash(job2);

    assert.equal(hash1, hash2, 'Normalized company:title should generate identical MD5 hash');
  });
});
