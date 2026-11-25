# HookRelay

**A webhook router, transactional delivery queue and live inspector — built on Postgres alone.**

HookRelay sits between a webhook sender (Stripe, GitHub, Telegram, a CRM, a payment gateway) and your backend. It accepts the request in milliseconds, stores it, signs it, delivers it with exponential backoff, keeps every attempt, parks what still fails in a dead-letter queue, and lets you replay it with one click.

- **Live demo:** https://hookrelay-mu.vercel.app — API on Render (`https://hookrelay-api-w3w2.onrender.com/api/health`), database on Neon. The free Render instance sleeps after 15 idle minutes, so the first request can take ~30 s.
- **Public sandbox:** open the console, press `Simulate 500 → DLQ`, watch three attempts fail in real time over SSE, then `Replay all DLQ` and watch them recover.

![HookRelay landing page: a sepia mountain range behind the headline "Deliver every webhook with quiet, unbreakable precision", with a live console window rising from the bottom](docs/hero.webp)

| | |
|---|---|
| ![Sandbox dashboard with delivery rate, throughput dot matrix, p95 latency and the live events table](docs/dashboard.webp) | ![Event inspector showing a 502, a 500 and a 200 OK attempt on one event, with the signed payload](docs/inspector.webp) |
| ![Dead letter queue with failure causes, selectable events and the last response body](docs/dlq.webp) | ![Endpoints screen with the ingestion URL, live SSRF check, retry schedule, signing secret and queue health](docs/endpoints.webp) |

## What it does

| | |
|---|---|
| Ingest | `POST /api/ingest/:ingestKey` → `202 { eventId }`. The raw body is stored byte-for-byte. A repeated `Idempotency-Key` returns `200 { deduplicated: true }`. |
| Queue | Workers claim due events with `FOR UPDATE SKIP LOCKED`; any number of workers can run without double delivery. |
| Signing | Every delivery carries `X-HookRelay-Event-Id`, `X-HookRelay-Timestamp`, `X-HookRelay-Signature: v1=<hmac_sha256(secret, ts + "." + body)>`. |
| Retries | `5s → 25s → 2m → 10m → 30m` with ±10% jitter (`5s · 5^(n-1)`, capped). The public sandbox uses `1s → 2s` so the whole cycle fits in a few seconds. |
| Dead letters | After `maxAttempts` the event moves to `DLQ`, a Telegram alert is sent if configured, and it can be replayed one by one or in bulk. |
| SSRF guard | Only `http(s)`, no URL credentials, every resolved A/AAAA record checked (IPv4-mapped IPv6 included), private and metadata ranges refused, redirects never followed, re-checked at connect time to stop DNS rebinding. |
| Live UI | One SSE stream per workspace keeps the dashboard, inspector and DLQ current. Heartbeat every 25 s. |
| Ops | `GET /api/health` (live DB check, uptime, queue depth), `GET /metrics` in Prometheus format behind a bearer token. |

## Architecture

```mermaid
flowchart LR
  S[Sender<br/>Stripe · GitHub · Telegram] -->|POST /api/ingest/:key| I[Ingest route<br/>Zod · rate limit · idempotency]
  I -->|INSERT, 202| DB[(Neon Postgres<br/>WebhookEvent · DeliveryAttempt)]
  I -. nudge .-> W
  W[Worker<br/>FOR UPDATE SKIP LOCKED] -->|claim batch| DB
  W -->|HMAC-SHA256 sign| G{SSRF guard<br/>DNS + connect-time check}
  G -->|2xx| T[Your endpoint]
  G -->|5xx / timeout| R[RETRYING<br/>backoff + jitter]
  R --> DB
  W -->|attempts exhausted| D[DLQ] --> TG[Telegram alert]
  D -->|replay| DB
  W -->|status change| B[Event bus] -->|SSE| UI[React console]
```

```
apps/api       Fastify 5 · Prisma 7 (pg adapter) · Zod 4 · undici · Pino
apps/web       React 19 · Vite 8 · Tailwind 4 · motion · Lenis · TanStack Query · Zustand
packages/shared  Zod schemas and the API/SSE types both sides compile against
loadtest       k6 scenario (runs in CI)
```

## Decisions (ADRs)

**ADR-1 · `SKIP LOCKED` in Postgres instead of Redis or a broker.**
The event row is already in Postgres; making the same table the queue means acceptance, delivery state and the audit trail commit in one transaction, with no second system to keep consistent and nothing extra to pay for on a free tier. A single `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING id` claims a batch atomically; concurrent workers skip each other's rows instead of blocking. A recovery query returns rows stuck in `PROCESSING` for over 60 s (a crashed worker) to the queue. The trade-off is polling (750 ms plus an in-process nudge on ingest) and write load on the primary — acceptable well into thousands of events per second.

**ADR-2 · Server-Sent Events instead of WebSockets.**
The console only needs server → client updates. SSE is plain HTTP: it passes proxies and CORS like any request, reconnects on its own, and needs no extra protocol or library on either side. A comment heartbeat every 25 s keeps Render's proxy from closing idle streams. Fan-out is an in-process `EventEmitter`; with more than one API instance it becomes Postgres `LISTEN/NOTIFY` (see "At 100×").

**ADR-3 · SSRF: validate, then re-validate at connect time, and never follow redirects.**
A target URL is user input that makes the server open connections. Validation rejects non-HTTP schemes and embedded credentials, resolves the host and refuses the whole answer if *any* address is private, loopback, link-local (cloud metadata at `169.254.169.254`), CGNAT or IPv6 ULA/link-local — including IPv4-mapped forms such as `::ffff:127.0.0.1`. Because DNS can change between the check and the connection, the undici agent's `lookup` repeats the check for every socket. `undici.request` does not follow redirects, so a `302 → http://127.0.0.1` is recorded as a failed attempt rather than chased. The sandbox receiver is answered in-process, so no exception to the guard exists for the network path.

**ADR-4 · Idempotency through a unique index, not application logic.**
`@@unique([sourceId, idempotencyKey])` makes the database the arbiter. Ingest simply inserts; a unique violation (`P2002`) means "already have it", and the existing event id is returned with `200`. There is no read-then-write window for two concurrent retries from the sender to slip through.

## Measured numbers

All numbers below were measured, not estimated. Hardware: Windows 11 laptop, Node 24.18, Postgres 18.7 running locally (embedded), API built with `npm run build`.

**Ingest** — `autocannon -c 50 -d 30`, `POST /api/ingest/src_sbx_public`, worker disabled on that instance, per-key rate limit raised for the test:

| requests | non-2xx | errors | avg req/s | p50 | p90 | p97.5 | p99 |
|---|---|---|---|---|---|---|---|
| 13,436 | 0 | 0 | 447.9 | 92 ms | 111 ms | 143 ms | 393 ms |

**Delivery** — one worker process, batch of 10, sandbox receiver (18–60 ms simulated latency): **114 deliveries/s** sustained over 40 s.

**Concurrency** — two API processes draining the same table at once delivered 15,127 events with **0 duplicate successful deliveries** (checked with `GROUP BY "eventId" HAVING count(*) > 1` on successful attempts). The integration suite asserts the same property on every CI run.

**k6 in CI** — [`loadtest/ingest.js`](loadtest/ingest.js), 50 VUs for 30 s on a GitHub Actions `ubuntu-latest` runner against Postgres 16 (`loadtest` job, summary uploaded as an artifact):

| requests | failed | req/s | p50 | p90 | p95 | max |
|---|---|---|---|---|---|---|
| 26,289 | 0 | 875.4 | 50.6 ms | 70.4 ms | 86.4 ms | 591 ms |

Thresholds `http_req_failed < 1%` and `p(95) < 250 ms` gate the job.

## Tests

```
apps/api  · 53 tests — unit (SSRF guard, HMAC, backoff) + integration on real Postgres
apps/web  ·  4 tests — SSE cache merge (ordering, filters, workspaces)
```

Integration tests cover: two concurrent workers on 10 events → each delivered exactly once; `Idempotency-Key` dedup; `500 → retry → retry → DLQ → replay → 200` with signature verification; stuck-job recovery; `/metrics` 401/200; CORS allow-list; login rate limit (`429` on the 11th attempt); API key shown once and stored hashed; SSRF rejection on source creation; the public sandbox end to end.

## Running locally

```bash
npm install
npm run dev:db          # Postgres on :54329 without Docker (or: docker compose up -d)
cp .env.example .env
npm run migrate:deploy
npm run dev:api         # http://localhost:8080
npm run dev:web         # http://localhost:5173
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/hookrelay_test npm test
```

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | DB liveness, uptime, queue depth |
| GET | `/metrics` | Prometheus, `Authorization: Bearer $METRICS_TOKEN` |
| POST | `/api/auth/register` · `/login` · `/logout`, GET `/api/auth/me` | HttpOnly cookie session |
| GET/POST/PATCH/DELETE | `/api/sources[/:id]` | sources with one endpoint each |
| POST | `/api/sources/:id/rotate-secret` | new HMAC secret |
| POST | `/api/endpoints/check` | run a URL through the SSRF guard |
| POST | `/api/endpoints/:id/test-telegram` | test alert |
| POST | `/api/ingest/:ingestKey` | public ingest, honours `Idempotency-Key` |
| GET | `/api/events`, `/api/events/:id` | filters, cursor pagination, attempts |
| POST | `/api/events/:id/replay`, `/api/dlq/replay-bulk` | single and bulk replay |
| GET | `/api/events/stream` | SSE |
| GET | `/api/metrics/summary` | throughput, p50/p95, success rate, DLQ causes |
| GET/POST/DELETE | `/api/api-keys[/:id]` | `hr_live_…`, shown once, stored as SHA-256 |
| POST | `/api/sandbox/simulate`, `/api/sandbox/replay-all` | public sandbox |

## Known limits of the free deployment

- The API (`onrender.com`) and the console (`vercel.app`) are different sites, so the session cookie is third-party (`SameSite=None; Secure`). Browsers that block third-party cookies (Safari, Chrome incognito) will not keep you signed in; the public sandbox needs no account and is unaffected. A custom domain for both, or a same-origin proxy, removes this.
- One free Render instance runs both the API and the worker and sleeps when idle; queued events resume on wake-up.

## At 100× the load

- **Fan-out across instances:** replace the in-process event bus with Postgres `LISTEN/NOTIFY` (or a small Redis pub/sub) so SSE works behind several API replicas.
- **Split the worker from the API** into its own service and scale it horizontally; `SKIP LOCKED` already makes that safe.
- **Partition `WebhookEvent` and `DeliveryAttempt` by day** and move delivered rows older than the retention window to cold storage; the hot index stays small.
- **Per-endpoint concurrency and circuit breaking**, so one slow receiver cannot consume the whole batch.
- **Use `LISTEN/NOTIFY` as the wake-up signal** instead of polling, keeping polling only as a fallback.
- **Read replicas for the console**; the summary queries would move to a rolled-up table updated per minute.

## Licence

MIT
