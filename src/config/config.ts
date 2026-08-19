import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  PRIMARY_SOURCE_URL: process.env.PRIMARY_SOURCE_URL || 'https://remoteok.com/api',
  FETCHER: {
    BASE_DELAY_MS: Number(process.env.FETCHER_BASE_DELAY_MS) || 1500,
    MAX_RETRIES: Number(process.env.FETCHER_MAX_RETRIES) || 3,
    TIMEOUT_MS: 8000,
    USER_AGENTS: [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0'
    ]
  },
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: Number(process.env.CB_FAILURE_THRESHOLD) || 3,
    COOLDOWN_MS: Number(process.env.CB_COOLDOWN_MS) || 30000,
  },
};
