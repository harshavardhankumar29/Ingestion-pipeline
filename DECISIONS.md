# Engineering Decisions (`DECISIONS.md`)

---

## 1. Why this ingestion strategy over the obvious alternative?

### The Alternative We Rejected: Heavy Headless Browsers (Puppeteer / Playwright)
* **Why it's tempting**: It's easy to just open a real automated Chrome browser tab.
* **Why we rejected it**:
  1. **Easy to Detect**: Anti-bot tools detect automated browsers immediately (via hidden flags like `navigator.webdriver = true`).
  2. **Heavy & Slow**: Each browser tab eats 200MB+ of RAM. It is slow and expensive to scale.
  3. **Fragile**: Scraping breaks the moment a website changes its HTML button/layout.

### Our Strategy: Lightweight Paced HTTP Requests + Circuit Breaker
* **How it works**: We send lightweight HTTP requests that mimic real browsers by rotating **User-Agents**, adding **browser headers** (`Sec-Fetch-*`), and adding **human-like randomized delays** (`1.5s - 2.5s`).
* **Why it's better**: It uses under 50MB of RAM, runs 50x faster, and uses a **Circuit Breaker** so if a site blocks us, our server automatically serves cached real data instead of crashing.

---

## 2. One trade-off made under the time limit, and what we'd do with a real week

### The Trade-off: In-Memory Storage vs. A Real Database
* **What we did**: Kept the duplicate checker (MD5 hashes) and cached job snapshot in the server's **RAM (memory)**.
* **The drawback**: If the server restarts, that in-memory cache resets.

### What we would build with a full week:
1. **A Real Database (Redis / PostgreSQL)**: Store historical job hashes and listings permanently so memory persists across restarts.
2. **Rotating Proxies (IP Pool)**: Route requests through a pool of rotating IP addresses so no single IP ever makes too many requests.
3. **Scheduled Background Cron Jobs**: Automatically ingest listings every few hours and alert us if a website changes its format.

---

## 3. Where AI tools were used, and what was personally verified & fixed

### Where AI was used:
* Setting up initial TypeScript interfaces and Zod schema templates.
* Drafting Markdown documentation outlines.

### What was personally verified, debugged, and fixed:
1. **Fixed Scope & Config Bugs**: Diagnosed and fixed TypeScript compiler settings (`tsconfig.json`) and variable declarations to ensure clean builds.
2. **Verified the Circuit Breaker**: Tested the state machine logic manually to make sure it trips to `OPEN` after 3 failures and safely waits 30 seconds before probing again.
3. **Live API Testing**: Tested the live server with `curl` commands to confirm 100 real listings from RemoteOK are fetched, validated, deduplicated, and served.
4. **Refactored Architecture**: Cleaned up the project structure into dedicated route modules (`/api/health`, `/api/jobs`, `/api/metrics`).
