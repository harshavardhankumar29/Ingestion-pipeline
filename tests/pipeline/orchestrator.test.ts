import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateListingHash } from '../../src/pipeline/orchestrator.js';
import type { JobListing } from '../../src/schema/jobSchema.js';

describe('Content Hash & Cross-Run Deduplication', () => {
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

  it('generates different hashes for different job listings', () => {
    const job1: JobListing = {
      id: '1',
      title: 'Frontend Developer',
      company: 'Google',
      location: 'Remote',
      url: 'https://google.com',
      date: undefined,
      tags: []
    };

    const job2: JobListing = {
      id: '2',
      title: 'Backend Developer',
      company: 'Google',
      location: 'Remote',
      url: 'https://google.com',
      date: undefined,
      tags: []
    };

    const hash1 = generateListingHash(job1);
    const hash2 = generateListingHash(job2);

    assert.notEqual(hash1, hash2, 'Different titles should produce different hashes');
  });
});
