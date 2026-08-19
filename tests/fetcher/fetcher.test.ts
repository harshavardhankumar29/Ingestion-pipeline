import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRandomUserAgent, getBrowserHeaders } from '../../src/fetcher/fetcher.js';

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

  it('detects Windows platform from User-Agent', () => {
    const winUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0';
    const headers = getBrowserHeaders(winUa);
    assert.equal(headers['Sec-Ch-Ua-Platform'], '"Windows"');
  });
});
