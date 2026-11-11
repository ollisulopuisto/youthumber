# Sentinel's Journal - Critical Learnings Only

## 2026-11-03 - Concurrency Limits on Background Worker Jobs
**Vulnerability:** Asynchronous background job endpoints spawning unbounded worker threads without concurrency caps allow thread pool explosion, high memory allocation, and CPU/GPU starvation (denial-of-service).
**Learning:** Local-first desktop backends that dispatch heavy asynchronous tasks (such as computer vision video scanning) in independent threads can quickly overwhelm machine resources if requests are repeated or queued rapidly.
**Prevention:** Track active job statuses in memory and enforce a strict upper bound on concurrently running background jobs (e.g., `MAX_ACTIVE_SCAN_JOBS = 3`), returning HTTP 429 Too Many Requests when the limit is exceeded.

## 2026-11-02 - Restricting CORS on Local Desktop Embedded Server
**Vulnerability:** The embedded FastAPI server used wildcard CORS (`allow_origins=["*"]`) with credentials enabled (`allow_credentials=True`), allowing arbitrary web pages visited by a user to issue cross-origin requests to the local background-removal and preset endpoints.
**Learning:** Local desktop apps with embedded HTTP servers often set wildcard CORS during development to ease web-to-backend communication across varying ports (e.g., Vite on 5173 to backend on 5055/8731), but this inadvertently exposes local API endpoints to third-party web origins.
**Prevention:** Restrict CORS origins using an anchored regular expression matching strictly localhost and 127.0.0.1 origins (`r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"`) so local development works seamlessly without allowing external origins.
