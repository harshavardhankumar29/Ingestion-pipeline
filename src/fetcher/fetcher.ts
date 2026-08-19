import axios, { type AxiosRequestConfig } from 'axios';
import { CONFIG } from '../config/config.js';

export interface FetchOptions {
    url: string;
    maxRetries?: number;
    baseDelayMs?: number;
    headers?: Record<string, string>;
}

/**
 * Returns a randomly selected modern desktop User-Agent string
 */
export function getRandomUserAgent(): string {
    const agents = CONFIG.FETCHER.USER_AGENTS;
    const index = Math.floor(Math.random() * agents.length);
    return agents[index] ?? agents[0]!;
}

/**
 * Generates realistic browser client hint headers based on User-Agent
 */
export function getBrowserHeaders(userAgent: string): Record<string, string> {
    const isWindows = userAgent.includes('Windows');
    const platform = isWindows ? '"Windows"' : '"macOS"';

    return {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': platform,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'DNT': '1',
    };
}

/**
 * Executes an HTTP GET request with anti-bot pacing, randomized User-Agent rotation, 
 * full browser header emulation, and exponential backoff retry.
 */
export async function fetchWithPacing<T>(options: FetchOptions): Promise<T> {
    const maxRetries = options.maxRetries ?? CONFIG.FETCHER.MAX_RETRIES;
    const baseDelay = options.baseDelayMs ?? CONFIG.FETCHER.BASE_DELAY_MS;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Apply randomized pacing delay before request execution (human jitter)
            const jitterMs = Math.floor(Math.random() * 1000);
            const totalDelay = baseDelay + jitterMs;
            await new Promise(res => setTimeout(res, totalDelay));

            const userAgent = getRandomUserAgent();
            const browserHeaders = getBrowserHeaders(userAgent);

            const requestConfig: AxiosRequestConfig = {
                headers: {
                    ...browserHeaders,
                    ...options.headers,
                },
                timeout: CONFIG.FETCHER.TIMEOUT_MS,
            };

            const response = await axios.get<T>(options.url, requestConfig);
            return response.data;
        } catch (error: any) {
            const isRateLimited = error.response?.status === 429;
            const isServerError = error.response?.status >= 500;
            const isNetworkError = !error.response;

            if ((isRateLimited || isServerError || isNetworkError) && attempt < maxRetries) {
                // Exponential backoff formula: baseDelay * 2^attempt + jitter
                const backoffMs = (baseDelay * (2 ** attempt)) + Math.floor(Math.random() * 1000);
                const statusInfo = error.response ? `HTTP ${error.response.status}` : (error.code || 'Network Error');
                console.warn(`[Fetcher] Request failed (${statusInfo}). Retrying with rotated UA in ${backoffMs}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(res => setTimeout(res, backoffMs));
            } else {
                throw error;
            }
        }
    }
    throw new Error('[Fetcher] Max retries reached');
}
