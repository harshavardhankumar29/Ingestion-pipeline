import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker, CircuitState } from '../../src/resilience/circuitBreaker.js';

describe('Circuit Breaker Resilience Engine', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
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

    await cb.execute(failingPrimary, fallback);
    assert.equal(cb.getState(), CircuitState.CLOSED);
    assert.equal(cb.getMetrics().failureCount, 1);

    await cb.execute(failingPrimary, fallback);
    assert.equal(cb.getState(), CircuitState.CLOSED);
    assert.equal(cb.getMetrics().failureCount, 2);

    const result3 = await cb.execute(failingPrimary, fallback);
    assert.equal(result3, 'fallback_data');
    assert.equal(cb.getState(), CircuitState.OPEN);
    assert.equal(cb.getMetrics().tripCount, 1);

    let primaryCalled = false;
    const guardedPrimary = async () => { primaryCalled = true; return 'data'; };
    const result4 = await cb.execute(guardedPrimary, fallback);

    assert.equal(result4, 'fallback_data');
    assert.equal(primaryCalled, false, 'Primary should NOT be invoked while circuit is OPEN');
  });

  it('transitions from OPEN to HALF_OPEN after cooldown expires', async () => {
    const failingPrimary = async () => { throw new Error('Network Error'); };
    const fallback = async () => 'fallback_data';

    for (let i = 0; i < 3; i++) {
      await cb.execute(failingPrimary, fallback);
    }
    assert.equal(cb.getState(), CircuitState.OPEN);

    await new Promise(res => setTimeout(res, 60));

    assert.equal(cb.getState(), CircuitState.HALF_OPEN);

    const successPrimary = async () => 'canary_success';
    const result = await cb.execute(successPrimary, fallback);
    assert.equal(result, 'canary_success');
    assert.equal(cb.getState(), CircuitState.CLOSED);
  });
});
