import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateJobListings, JobListingSchema } from '../../src/schema/jobSchema.js';

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
      position: 'Staff DevOps Architect',
      company: 'Cloud Scale Inc',
      tags: ['kubernetes', 'terraform']
    };

    const parsed = JobListingSchema.safeParse(driftedPayload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.id, '9988');
      assert.equal(parsed.data.title, 'Staff DevOps Architect');
      assert.equal(parsed.data.location, 'Remote');
      assert.equal(parsed.data.url, 'https://remoteok.com');
    }
  });

  it('separates valid items from corrupted items without throwing', () => {
    const rawItems = [
      { id: '1', title: 'Frontend Developer', company: 'Acme' },
      null,
      { invalid_structure: true },
      { id: '2', position: 'Backend Developer', company: 'Beta' },
      'random_string_payload'
    ];

    const { valid, invalidCount } = validateJobListings(rawItems as any);
    assert.equal(valid.length, 2);
    assert.equal(invalidCount, 3);
    assert.equal(valid[0]?.title, 'Frontend Developer');
    assert.equal(valid[1]?.title, 'Backend Developer');
  });
});
