export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerMetrics {
    state: CircuitState;
    failureCount: number;
    failureThreshold: number;
    cooldownMs: number;
    totalExecutions: number;
    successfulPrimaryCalls: number;
    failedPrimaryCalls: number;
    fallbackExecutions: number;
    tripCount: number;
    lastSuccessTime: string | null;
    lastFailureTime: string | null;
    lastTripTime: string | null;
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private lastStateChange: number = Date.now();

    // Telemetry counters
    private totalExecutions = 0;
    private successfulPrimaryCalls = 0;
    private failedPrimaryCalls = 0;
    private fallbackExecutions = 0;
    private tripCount = 0;
    private lastSuccessTime: string | null = null;
    private lastFailureTime: string | null = null;
    private lastTripTime: string | null = null;

    constructor(
        private readonly failureThreshold: number = 3,
        private readonly cooldownMs: number = 30000 // 30 seconds
    ) { }

    public async execute<T>(primaryTask: () => Promise<T>, fallbackTask: () => Promise<T>): Promise<T> {
        this.totalExecutions++;
        this.updateState();

        if (this.state === CircuitState.OPEN) {
            console.warn(`[CircuitBreaker] Circuit is OPEN. Skipping primary source & executing fallback...`);
            this.fallbackExecutions++;
            return fallbackTask();
        }

        try {
            const result = await primaryTask();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            console.error(`[CircuitBreaker] Primary source failed (${this.failureCount}/${this.failureThreshold}). Delegating to fallback.`);
            this.fallbackExecutions++;
            return fallbackTask();
        }
    }

    private updateState(): void {
        if (this.state === CircuitState.OPEN && Date.now() - this.lastStateChange > this.cooldownMs) {
            this.state = CircuitState.HALF_OPEN;
            this.lastStateChange = Date.now();
            console.info(`[CircuitBreaker] Cooldown expired (${this.cooldownMs}ms). Circuit transitioning to HALF-OPEN...`);
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
        this.successfulPrimaryCalls++;
        this.lastSuccessTime = new Date().toISOString();
    }

    private onFailure(): void {
        this.failureCount++;
        this.failedPrimaryCalls++;
        this.lastFailureTime = new Date().toISOString();

        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.lastStateChange = Date.now();
            this.tripCount++;
            this.lastTripTime = new Date().toISOString();
            console.error(`[CircuitBreaker] Failure threshold reached (${this.failureThreshold})! Tripping circuit to OPEN for ${this.cooldownMs / 1000}s.`);
        }
    }

    public getState(): CircuitState {
        this.updateState();
        return this.state;
    }

    public getMetrics(): CircuitBreakerMetrics {
        this.updateState();
        return {
            state: this.state,
            failureCount: this.failureCount,
            failureThreshold: this.failureThreshold,
            cooldownMs: this.cooldownMs,
            totalExecutions: this.totalExecutions,
            successfulPrimaryCalls: this.successfulPrimaryCalls,
            failedPrimaryCalls: this.failedPrimaryCalls,
            fallbackExecutions: this.fallbackExecutions,
            tripCount: this.tripCount,
            lastSuccessTime: this.lastSuccessTime,
            lastFailureTime: this.lastFailureTime,
            lastTripTime: this.lastTripTime,
        };
    }

    // Helper for testing
    public reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.lastStateChange = Date.now();
    }
}