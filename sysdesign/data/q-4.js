/* ===================== RATE LIMITING & ABUSE ===================== */
Q("rate", 2,
  "You limit 100 req/min per user with an in-memory counter on each of 10 app servers (round-robin). What is the real limit?",
  "Each server only sees part of the traffic.",
  [
    "Up to 1,000 req/min: each node enforces 100 independently, so the effective limit is multiplied by the node count.",
    "Use a shared store (Redis) with atomic ops/Lua scripts, or enforce at a gateway; or divide the quota across nodes and sync periodically for approximation.",
    "Sticky routing by user id is fragile (failures, rebalances).",
    "Know the algorithms: fixed window, sliding window log/counter, token bucket, leaky bucket.",
  ],
  "What does the Redis implementation of a token bucket look like and where are its race conditions?");

Q("rate", 2,
  "Your rate limiter depends on Redis, and Redis goes down. Should requests be allowed or blocked?",
  "Fail-open vs fail-closed.",
  [
    "Fail-open protects availability but exposes you to abuse; fail-closed protects the backend but causes a self-inflicted outage.",
    "Usually fail-open with a local in-memory fallback limiter (coarser limits), and alerts; fail-closed for security-critical limits (login attempts, OTP).",
    "Keep the limiter's latency low with strict timeouts so it can't slow requests.",
    "Decide per endpoint based on risk.",
  ],
  "How do you avoid the limiter itself becoming a SPOF or a hot key?");

Q("rate", 2,
  "A fixed-window limiter allows 100 requests per minute. A client sends 100 at 12:00:59 and 100 at 12:01:00. What happens?",
  "Look at the window boundary.",
  [
    "200 requests within 2 seconds pass: boundary burst up to 2x the intended rate.",
    "Sliding window (log or weighted counter) smooths this; token bucket permits controlled bursts while enforcing an average rate.",
    "Choose by the need: strict smoothing vs allowing bursts; memory cost (log) vs approximation (counter).",
    "Return 429 with Retry-After and rate-limit headers.",
  ],
  "How would you rate limit by cost (e.g. expensive queries) instead of by request count?");

Q("rate", 2,
  "You rate limit by IP. A university campus of 20,000 students is behind a single NAT IP. What happens, and what else could you key on?",
  "Identity vs network address.",
  [
    "Legitimate users get throttled together (false positives), while attackers rotate IPs (botnets/proxies) and evade limits.",
    "Limit by authenticated identity (user/API key/tenant), device fingerprint, or combine signals; apply IP limits only for unauthenticated, coarse protection.",
    "Layered defence: WAF, bot detection, CAPTCHAs, progressive penalties and different limits per tier/endpoint.",
    "Expensive endpoints (login, search, export) deserve stricter limits.",
  ],
  "How do you defend login against credential stuffing without locking out real users?");

Q("rate", 2,
  "One tenant on a shared multi-tenant platform runs a huge batch job, and everyone else's latency spikes. How do you prevent this?",
  "Noisy neighbour.",
  [
    "Shared resources (threads, DB, queue) are monopolised by one tenant.",
    "Per-tenant quotas and rate limits, fair queuing/weighted scheduling, bulkheads, and separate pools or queues for heavy tenants.",
    "Isolate with dedicated shards/cells for large tenants; cell-based architecture limits blast radius.",
    "Metrics per tenant to detect and bill/throttle the offenders.",
  ],
  "How do you give a VIP customer guaranteed capacity?");

/* ===================== SECURITY & AUTH ===================== */
Q("sec", 2,
  "A user's JWT access token (valid 24 hours) is stolen. The user changes their password. Is the attacker still in?",
  "Stateless tokens are valid until they expire, by design.",
  [
    "Yes, until expiry, since signature validation doesn't check server state.",
    "Use short-lived access tokens (5-15 min) with rotating refresh tokens; add a token version/`jti` denylist or per-user `not before` timestamp for immediate revocation.",
    "Opaque tokens with introspection allow instant revocation at the cost of a lookup.",
    "Protect tokens: HttpOnly secure cookies, TLS, binding to device where possible.",
  ],
  "What are the tradeoffs of a denylist for a stateless token system?");

Q("sec", 3,
  "You use rotating refresh tokens. An old refresh token that was already used is presented again. What does this mean and what do you do?",
  "Who could be holding an already-used token?",
  [
    "Either a legitimate client with a race (two tabs) or an attacker replaying a stolen token; you can't tell which one is real.",
    "Reuse detection: revoke the whole token family and force re-authentication, plus alert.",
    "Allow a small grace window for benign concurrent refreshes (multi-tab).",
    "Store hashed tokens server-side and bind them to client/session metadata.",
  ],
  "How do you handle two browser tabs refreshing simultaneously?");

Q("sec", 2,
  "Your endpoint is `GET /api/invoices/12345` and checks that the user is logged in. A user changes the ID to 12346. What happens?",
  "Authentication is not authorisation.",
  [
    "IDOR/BOLA: they read someone else's invoice, since the server verified identity but not ownership.",
    "Authorise on every object access (owner/tenant/role check) server-side; scope queries by tenant (`WHERE id=? AND tenant_id=?`).",
    "Unguessable IDs help but are not a control; centralise policy (RBAC/ABAC/ReBAC), test with negative authorisation tests.",
    "Multi-tenant: enforce with row-level security in the DB for defence in depth.",
  ],
  "Where would you enforce this in a microservice architecture: gateway or each service?");

Q("sec", 2,
  "An engineer accidentally commits a cloud access key to a public repo. What do you do in the first 30 minutes?",
  "Assume it has already been scraped.",
  [
    "Revoke/rotate the credential IMMEDIATELY (deleting the commit is not enough - assume compromise), then audit access logs for misuse and review the blast radius.",
    "Remove it from history, add secret scanning/pre-commit hooks and push protection.",
    "Use a secrets manager and short-lived credentials (IAM roles/OIDC) with least privilege.",
    "Post-incident review without blame; improve guardrails.",
  ],
  "How do you design so that a leaked key has limited impact?");

Q("sec", 2,
  "A cache key for `GET /dashboard` does not include the tenant or user. What can happen?",
  "Whose data gets cached?",
  [
    "User A's response is cached and served to user B: cross-tenant data leakage (a severe incident).",
    "Include every dimension that affects the response in the cache key (tenant, user, locale, permissions) or mark responses `Cache-Control: private/no-store` at CDNs and proxies.",
    "Use the `Vary` header correctly; test caching with multiple identities.",
    "Treat shared caches as part of the security boundary.",
  ],
  "What other kinds of bugs lead to cross-tenant leakage?");

Q("sec", 2,
  "An attacker captures a valid signed webhook/API request and replays it 100 times. What happens?",
  "A valid signature does not mean a fresh request.",
  [
    "The signature verifies each time, so the action is executed repeatedly (replay attack).",
    "Include a timestamp and nonce/event id in the signed payload; reject old timestamps and store seen ids for the validity window.",
    "Make the handlers idempotent; use TLS and short validity windows.",
    "Constant-time signature comparison and key rotation.",
  ],
  "How do you rotate a signing secret without breaking clients?");

/* ===================== DEPLOYMENT & OPERATIONS ===================== */
Q("ops", 2,
  "You deploy a new version and error rate climbs to 5% for a subset of users. What is your response and how should the process have prevented it?",
  "Limit blast radius, then rollback fast.",
  [
    "Roll back or disable via feature flag first; investigate after mitigation. Time-to-mitigate matters more than the root cause.",
    "Progressive delivery: canary (1% -> 10% -> 100%) with automated metric gates and auto-rollback; blue/green for quick switching.",
    "Backward-compatible DB migrations so rollback is possible; feature flags separate deploy from release.",
    "Postmortem: add tests/alerts for the escaped bug.",
  ],
  "What if the new version already ran an irreversible data migration?");

Q("ops", 3,
  "During a rolling deploy, v1 and v2 of your service run side by side. v2 expects a new DB column; v1 doesn't know about it. What problems can occur?",
  "Mixed versions interacting with one schema and one message format.",
  [
    "v1 breaks (if schema changed incompatibly) or v2 breaks (if the migration hasn't run). Messages written by v2 may be unreadable by v1 and vice versa.",
    "Expand/contract: (1) add the new column, compatible with v1; (2) deploy v2 writing both/reading new; (3) backfill; (4) later remove the old one.",
    "Forward and backward compatible serialisation (additive fields, tolerant readers).",
    "Never couple a destructive migration and the app deploy in one step.",
  ],
  "How do you handle queued messages created by an older version?");

Q("ops", 3,
  "A bad configuration change is pushed to all servers globally at once and takes everything down. How should config changes be managed?",
  "Treat config as code with the same rollout safety.",
  [
    "Config changes cause many large outages. Use staged rollouts (canary regions/cells), validation and linting, automated rollback and a kill switch.",
    "Version, review and audit all config; keep the last known good config locally and fall back to it.",
    "Decouple the control plane from the data plane so config service failure doesn't stop serving traffic.",
    "Avoid dependencies that are needed to fix the outage itself (circular dependencies in tooling/auth).",
  ],
  "What happens to your service at startup if the config service is down?");

Q("ops", 2,
  "A cron job is deployed on 3 instances for HA. At midnight, the 'send invoices' job runs three times. What do you do?",
  "How do N instances agree on who runs it?",
  [
    "Duplicate execution (customers get 3 invoices).",
    "Run the scheduler as a single leader (leader election via lease), use a distributed lock, or a DB-claimed job row (`SELECT ... FOR UPDATE SKIP LOCKED`) or a dedicated scheduler service.",
    "Jobs must be idempotent anyway (the leader can fail mid-run and retries happen); record a run id per schedule slot with a unique constraint.",
    "Handle missed runs (catch-up policy) and overlap (long runs).",
  ],
  "What if the leader crashes halfway through sending invoices?");

Q("ops", 2,
  "It's 3 AM. Your alert says p99 latency doubled; no deployments happened. Walk me through your investigation.",
  "Structure your debugging.",
  [
    "Triage: scope and impact (which endpoints/regions/customers?), mitigate if possible (scale, shed load, failover, rollback recent changes).",
    "Check recent changes (deploys, config, flags, traffic mix, dependency incidents), then golden signals/RED metrics (rate, errors, duration) and USE (utilisation, saturation, errors) for resources.",
    "Follow traces to the slow dependency; check DB slow queries, GC, thread pools, connection pools, queues, noisy neighbours, cache hit rate drops.",
    "Communicate status, keep a timeline, and write a blameless postmortem with action items.",
  ],
  "How would you distinguish 'slow dependency' from 'we are saturated'?");

Q("ops", 1,
  "The database server's disk reaches 100%. What happens and how do you prevent it?",
  "What does a database do when it cannot write?",
  [
    "The DB can't write WAL or temp files and may crash or become read-only, causing a full outage and possibly corruption risk.",
    "Immediate: free space (old logs/WAL, add volume, drop unneeded data), never delete DB files by hand.",
    "Prevent: alert at 70/80/90% and on growth rate, retention policies and log rotation, partitioning/archival, auto-expandable volumes, capacity planning.",
    "Check replication slots, long transactions and temp file growth.",
  ],
  "What else fills disks unexpectedly?");

Q("ops", 1,
  "A TLS certificate expires at midnight on a Sunday. What happens and how do you make sure it never happens again?",
  "A very common cause of outages.",
  [
    "Clients refuse to connect (browser errors, API failures, service-to-service mTLS failures).",
    "Automate issuance/renewal (ACME/Let's Encrypt, cert-manager, cloud-managed certs) and monitor expiry with alerts well in advance (30/14/7 days).",
    "Inventory every cert (including internal CAs, mTLS, client certs); test renewal and reload without restart.",
    "Runbooks for emergency replacement.",
  ],
  "How do you rotate certificates for mTLS between thousands of services?");

Q("ops", 2,
  "You have nightly backups. A developer drops the production table. How do you recover, and how do you know your backups work?",
  "A backup you haven't restored is a hope, not a backup.",
  [
    "Restore from backup plus point-in-time recovery (WAL/binlog replay) to just before the incident; RPO/RTO define acceptable loss and downtime.",
    "Practice restores regularly and automatically verify them (restore tests, checksums); keep backups off-account/immutable to survive ransomware or credential compromise.",
    "Replicas do not protect from logical errors (the DROP replicates).",
    "Reduce risk: least privilege, delayed replicas, deletion protection, change reviews.",
  ],
  "How would you recover just that one table without taking the whole DB offline?");

Q("ops", 2,
  "A feature-flag service goes down. What should your application do?",
  "What is the default behaviour when the dependency fails?",
  [
    "Hard dependency means an outage or inconsistent behaviour for all requests.",
    "Use local cached flag values (last known good) with periodic refresh, sane defaults per flag (fail to the safe state), and timeouts.",
    "Evaluate flags in-process using an SDK with streaming updates so the flag service is not on the request path.",
    "Keep flags short-lived and clean up old ones to avoid combinatorial states.",
  ],
  "Which default is 'safe' for a flag that gates a risky new feature vs a kill switch?");

/* ===================== STORAGE, SEARCH & CDN ===================== */
Q("storage", 2,
  "You upload an image to object storage, then write its metadata row to the DB. The DB write fails (or the process dies in between). What state are you in?",
  "Two stores, no shared transaction.",
  [
    "An orphaned object in storage with no metadata (a leak), or if reversed, metadata pointing to a missing object (broken links).",
    "Order matters: write the object first (to a temporary/unique key), then metadata; a periodic sweeper deletes unreferenced objects older than N hours.",
    "Or record 'pending' metadata first, then upload, then mark 'ready' (state machine) and reconcile stuck pending items.",
    "Use idempotent keys (content hash) so retries don't duplicate.",
  ],
  "How do you handle deletes so you never lose a referenced object?");

Q("storage", 2,
  "You replaced `logo.png` but users still see the old version for hours. Why, and how do you fix it?",
  "Caches exist at the CDN, the browser and intermediate proxies.",
  [
    "CDN edge and browser caches keep the old object until the TTL expires; purges propagate slowly and don't reach browsers.",
    "Use immutable, versioned/fingerprinted URLs (`logo.8f3a2c.png`) with long cache lifetimes, and short TTL/revalidation (ETag) for HTML/entry points.",
    "Use CDN purge APIs for emergencies; `stale-while-revalidate` for smoother updates.",
    "Watch out for cache key variations (query string, headers) and origin shield/thundering herd.",
  ],
  "How do you cache personalised content at a CDN safely?");

Q("storage", 2,
  "Your Elasticsearch index is fed by the app writing to both the DB and search. Search results are sometimes missing or stale. Why, and how do you fix it?",
  "Dual-write again.",
  [
    "Dual writes can fail partially (DB succeeds, search fails) or reorder; search indexing is also asynchronous (refresh interval), so it's eventually consistent.",
    "Drive the index from the source of truth via CDC/outbox events; make indexing idempotent using document version (external versioning) so late events don't overwrite newer ones.",
    "Periodic reindex/reconciliation; support rebuilds using aliases (zero-downtime reindex).",
    "Read-your-writes for the user: show the DB record directly after creation.",
  ],
  "How do you reindex a billion documents without downtime?");

Q("storage", 2,
  "A user requests account deletion (GDPR). Their data is in the DB, caches, search index, analytics warehouse, logs and backups. What does 'deleted' mean?",
  "Deletion is a distributed workflow.",
  [
    "Data fans out to many systems; deletion needs a tracked, idempotent workflow (events to each system with confirmation and retries) and an audit trail.",
    "Backups: either expire within the retention window or use crypto-shredding (delete the per-user encryption key). Re-apply deletions when restoring.",
    "Logs and analytics: avoid storing PII, pseudonymise, set short retention.",
    "Soft delete then hard delete after a grace period; handle legal holds and dependencies.",
  ],
  "How do you find all places where a user's data lives?");

Q("storage", 3,
  "You must ingest 1M events per second of time-series data and query recent windows quickly. What storage choices matter and what breaks first?",
  "Write path and partitioning.",
  [
    "Single-node relational DB with indexes will bottleneck on write amplification and index maintenance.",
    "Use append-optimised storage (LSM-based: Cassandra, ClickHouse, TimescaleDB, Kafka plus warehouse), partition by time (+ key), batch writes, and avoid hot partitions on the current time bucket.",
    "Downsample/rollup old data, apply TTL/retention and tier to cheap storage.",
    "Handle late and out-of-order events and backpressure on ingest.",
  ],
  "How do you avoid a hot partition when all writes target 'now'?");

Q("storage", 3,
  "In a Cassandra-style LSM store you delete lots of rows and then reads become very slow. Why?",
  "Deletes are writes.",
  [
    "Deletes create tombstones that must be scanned and kept until compaction/gc_grace; queries over tombstone-heavy partitions are slow and may fail.",
    "Avoid delete-heavy queue-like patterns; use TTLs with time-window compaction and time-bucketed partitions, so whole partitions drop.",
    "Tune compaction and gc_grace carefully (shorter gc_grace risks resurrected data if repairs lag).",
    "Know that LSM read amplification can also come from many SSTables.",
  ],
  "Why can a tombstone 'resurrect' deleted data?");

/* ===================== REAL-WORLD SCENARIOS ===================== */
Q("real", 3,
  "A concert goes on sale: 1M users compete for 50k seats at 10:00:00. What breaks and how do you design the booking flow?",
  "Combine contention, burst traffic and temporary holds.",
  [
    "Thundering herd on one inventory dataset, DB hot rows, double-booking, and a payment step that takes minutes.",
    "Virtual waiting room/queue to admit users at a controlled rate; static content via CDN.",
    "Seat hold with TTL: atomic reservation (conditional update/unique constraint per seat) -> payment window -> confirm or release on timeout/failure.",
    "Idempotent payment and booking, per-user limits and bot protection, graceful 'sold out' paths.",
  ],
  "A user pays but their hold expired a second earlier. What do you do?");

Q("real", 2,
  "A customer was charged, but no order exists in your system. What could have happened and how do you design to avoid it?",
  "Think about the payment redirect/callback.",
  [
    "The payment callback/webhook was lost or failed, the user closed the browser before returning, or the order write failed after charging.",
    "Create the order first in `pending` state with an id used as the idempotency key for the payment; confirm via signed provider webhook (source of truth), not only the browser redirect.",
    "Reconciliation job comparing provider transactions with orders; auto-refund or auto-complete.",
    "Webhooks must be idempotent, retried and ordered/versioned.",
  ],
  "Webhook arrives twice and out of order. What do you do?");

Q("real", 3,
  "In a chat app, user B is offline when A sends a message, and B has 3 devices. Walk through delivery, ordering and what can fail.",
  "At-least-once, ordering per conversation, per-device state.",
  [
    "Persist the message first (durable), assign a per-conversation sequence number, then attempt delivery to online devices (WebSocket) and push notifications for offline ones.",
    "Client acks; server retries until ack (at-least-once) and clients dedupe by message id. Each device tracks its own last-seen sequence to sync on reconnect.",
    "Failure cases: connection dropped after server send but before ack (duplicate on retry), gateway node crash (routing table stale), out-of-order arrivals (sort by seq).",
    "Group chats need fan-out and read receipts at scale; consider message TTL/retention.",
  ],
  "How do you route a message to whichever gateway node holds the recipient's connection?");

Q("real", 2,
  "A URL shortener generates codes by hashing the URL and taking 7 characters. What breaks at scale, and how do you fix it?",
  "Collisions and coordination.",
  [
    "Hash collisions: two URLs map to the same code. Check-then-insert races produce duplicates unless there's a unique constraint.",
    "Use a unique index on the code and retry with a new code/salt on conflict, or generate codes from a unique ID (counter/Snowflake) encoded in base62.",
    "Distributed counters: allocate ID ranges per app server (so no coordination per request); handle range-server failure by wasting ranges (fine).",
    "Cache hot redirects; custom aliases must be reserved atomically.",
  ],
  "How do you keep codes unpredictable if they come from a counter?");

Q("real", 2,
  "Your notification service sends SMS through provider X. X starts failing at 30% of requests. What should happen?",
  "Retries, fallback, duplicates, and user experience.",
  [
    "Queue notifications; retry with backoff for transient failures; circuit breaker on provider X and failover to provider Y.",
    "Duplicates: providers may accept and send but time out the response; use provider idempotency keys and dedupe on your side; for OTPs, a duplicate is usually harmless.",
    "Prioritise (OTP vs marketing), TTL (an OTP older than 5 minutes is useless), per-user rate limits and preferences.",
    "DLQ and observability (delivery receipts, success rate by provider/country).",
  ],
  "How do you avoid sending the same push twice when workers crash?");

Q("real", 3,
  "A ride-hailing system sends one driver two ride requests, and both riders accept at the same time. What goes wrong and how do you prevent it?",
  "A driver is a contended resource.",
  [
    "Double assignment: a driver gets two rides because matching and acceptance race.",
    "Make assignment an atomic state transition on the driver (`available -> assigned` conditional update/CAS, or a per-driver lock/actor), with the ride holding a reservation and a timeout.",
    "Offer rides one at a time with a timeout (or to a small set with first-accept-wins and atomic claim).",
    "Location updates are high-volume ephemeral data (geohash/S2 in an in-memory store), and stale locations must be handled gracefully.",
  ],
  "How do you handle driver location updates at 1M/sec?");

Q("real", 2,
  "A video transcoding worker crashes at 90% of a 2-hour video. What happens to the job?",
  "Who notices, and how is work resumed or restarted safely?",
  [
    "Without safeguards the job is lost or stuck forever.",
    "Use a queue with visibility timeout/lease + heartbeats: if the worker dies the job becomes visible again and another worker picks it up (at-least-once).",
    "Split work into idempotent chunks with checkpointing so retries resume instead of restarting; write outputs to temp locations and commit atomically (rename/manifest).",
    "Max-retry and DLQ for jobs that keep failing, and a job status API.",
  ],
  "What if the original worker was only slow (not dead) and finishes after the retry started?");

Q("real", 3,
  "Two users type in the same document at the same time, one of them offline for 10 minutes. How do you merge the edits?",
  "Concurrent edits without locking.",
  [
    "Naive last-write-wins loses edits. Locking makes collaboration painful and fails offline.",
    "Operational Transformation (central server transforms concurrent ops, e.g. Google Docs) or CRDTs (commutative ops that converge without a central authority; e.g. Yjs, Automerge).",
    "Operations are logged with client ids and versions; the server orders or merges them; clients apply optimistically and reconcile.",
    "Tradeoffs: complexity, tombstone growth/GC, intent preservation.",
  ],
  "How do you store history and let users undo?");

Q("real", 2,
  "A wallet balance is checked in the app (`if balance >= amount`) and then debited. Under concurrent purchases, the balance goes negative. What are all the ways to fix this?",
  "Make the check and the update indivisible.",
  [
    "Atomic conditional update `UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ?` and check affected rows; plus a DB CHECK constraint.",
    "Row lock (`FOR UPDATE`) or serialisable isolation; or optimistic version with retry.",
    "Ledger design: append-only entries with balance derived and per-account serialised processing (a queue or actor per account).",
    "Idempotent transaction ids so retries don't double-debit.",
  ],
  "How does this change when the wallet is sharded across regions?");

Q("real", 2,
  "A global leaderboard stores scores in a Redis sorted set. The game becomes huge. What can go wrong and how do you scale it?",
  "Single key, single node.",
  [
    "A single sorted-set key lives on one node: a hot key and a memory limit; Redis restarts can lose recent data without persistence.",
    "Shard by score range or by bucket/region and merge top-K at read time; keep per-shard top-K plus periodic global aggregation.",
    "Approximate ranks for most players (exact only for top N); batch writes and use write-behind to the DB for durability.",
    "Ties need a deterministic tie-breaker (timestamp/user id).",
  ],
  "How do you show a user's exact rank among 100M players?");
