# Anti-Bot Resilient Data Ingestion Pipeline

An end-to-end resilient job data ingestion engine engineered to extract job listings reliably while implementing anti-bot detection mitigation, circuit breaker fault tolerance, Zod schema validation & data drift handling, cross-run deduplication, and real-time observability telemetry.

---

## 🏗️ Architecture & Features

* **Anti-Bot Evasion Engine**:
  * Rotational desktop User-Agent pool (macOS / Windows across Chrome, Safari, Firefox, Edge).
  * Modern browser client hints and security headers (`Sec-Ch-Ua`, `Sec-Fetch-*`, `Accept-Language`, `DNT`).
  * Randomized human jitter delays (`1500ms + random(0-1000ms)`).
* **Circuit Breaker Resilience (Plan B)**:
  * Automated state machine transitions (`CLOSED` → `OPEN` → `HALF_OPEN`).
  * In-memory snapshot cache fallback — serves cached real data when primary target fails or trips.
  * Synthetic sandbox fallback for cold-start failure protection.
* **Data Drift & Corruption Shield**:
  * Zod `.safeParse()` schema validation with key alias remapping (`position` → `title`) and default fallbacks.
  * Filters malformed entries without throwing unhandled exceptions.
* **Cross-Run Deduplication**:
  * Bounded MD5 content hash cache (`company:title`) to prevent duplicate ingestion across multiple runs.
* **Real-Time Observability**:
  * Dedicated `/api/metrics` endpoint exposing telemetry (circuit breaker status, failure counters, trip history, cache health).
* **Automated Test Suite**:
  * 10 automated unit and resilience tests covering all core components (`npm test`).

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start the Server
```bash
npx tsx src/index.ts
```

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/jobs` | `GET` | Triggers ingestion pipeline, validates, deduplicates, and returns standardized job listings. |
| `/api/metrics` | `GET` | Returns real-time telemetry, circuit breaker metrics, deduplication cache size, and cache status. |
| `/api/health` | `GET` | Health check endpoint returning uptime and server status. |

---

## 🧪 Testing with cURL

```bash
# Test Ingestion Endpoint
curl -s http://localhost:3000/api/jobs | python3 -m json.tool

# Test Metrics & Observability
curl -s http://localhost:3000/api/metrics | python3 -m json.tool

# Test Health
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

---

## 📂 Project Structure

```text
ingestion-pipeline/
├── DESIGN_DOCUMENT.md      # Comprehensive technical design doc & strategy
├── Dockerfile              # Container deployment configuration
├── render.yaml             # Render cloud deployment specification
├── src/
│   ├── config/             # Environment & anti-bot configuration
│   ├── fetcher/            # Anti-bot pacing, UA rotation & header injection
│   ├── pipeline/           # Ingestion orchestrator & deduplication
│   ├── resilience/         # Circuit breaker state machine & telemetry
│   ├── schema/             # Zod schema validation & data drift handling
│   └── index.ts            # Express API server & routes
└── tests/
    └── pipeline.test.ts    # Automated resilience & unit test suite
```
