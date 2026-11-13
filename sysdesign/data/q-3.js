/* ===================== API DESIGN & IDEMPOTENCY ===================== */
Q("api", 1,
  "A mobile client times out on `POST /payments` and automatically retries. What can happen and how do you protect the customer?",
  "The first request may have succeeded.",
  [
    "The customer may be charged twice if the first request actually succeeded.",
    "Idempotency-Key header: the server stores the key with the request fingerprint and result; a repeat returns the stored response without re-executing.",
    "Enforce with a unique constraint on the key; the same key with a different payload returns an error (422).",
    "Keys need a TTL (e.g. 24h) and should be scoped to the client/account.",
  ],
  "What if the second request arrives while the first is still processing?");

Q("api", 2,
  "Two requests with the same idempotency key arrive 5 ms apart (the first is still in progress). What should the server do?",
  "A completed result doesn't exist yet.",
  [
    "Insert the key atomically (unique constraint) with status `processing`; the second request finds it and either waits/polls or returns 409 Conflict (with Retry-After).",
    "When the first finishes, store the response and status `completed`; later duplicates replay the same response (including errors).",
    "Handle crashes: a `processing` record with a timeout/lease so abandoned keys can be taken over safely.",
    "Do the key insert and the business effect in the same transaction where possible.",
  ],
  "How does this change if the side effect is an external API call?");

Q("api", 2,
  "Offset-based pagination (`?page=3&size=20`) is used on a feed while new items are being inserted. What does the user see?",
  "Offsets shift when the data changes.",
  [
    "Items are duplicated or skipped across pages because the underlying list shifts. Deep offsets are also slow (the DB scans and discards rows).",
    "Use cursor/keyset pagination (`WHERE (created_at, id) < (?, ?) ORDER BY ... LIMIT n`) with a stable unique sort key.",
    "Return an opaque cursor token; for consistency across pages you can include a snapshot/time bound.",
    "Tradeoff: no random page jumps and total counts are expensive.",
  ],
  "How do you paginate over a result set sorted by a non-unique column?");

Q("api", 2,
  "You need to remove a field from the API response, but older mobile app versions in the wild still read it. What do you do?",
  "You don't control when users update.",
  [
    "Removing it crashes or breaks old clients. Prefer additive, backward-compatible changes (new fields, tolerant readers).",
    "Version the API (URL/header) or negotiate capabilities; deprecate with telemetry on usage and a sunset date.",
    "Use contract tests/consumer-driven contracts; feature flags and force-upgrade for security cases.",
    "Servers must tolerate older requests and unknown fields in both directions during rolling deploys.",
  ],
  "How do you roll out a breaking change for a public API?");

Q("api", 2,
  "You send webhooks to customers and one customer's endpoint is down for 3 days. What should your system do?",
  "Think retries, ordering, and protecting yourself.",
  [
    "Retry with exponential backoff and jitter over a bounded window, then mark the endpoint failing/disabled and notify the customer, with a manual replay feature.",
    "Events can arrive duplicated and out of order: include event id, timestamp/sequence, and let receivers dedupe.",
    "Sign payloads (HMAC) with a timestamp to prevent spoofing/replay; set short timeouts so slow customers don't tie up workers.",
    "Isolate per-customer queues so one bad endpoint doesn't delay others.",
  ],
  "How do you design the receiving side to process webhooks reliably?");

Q("api", 2,
  "A user uploads a 2 GB file and the connection drops at 95%. What happens, and how should uploads work?",
  "Don't make the user start over.",
  [
    "A naive single request loses everything and the user restarts; partial data may linger as orphaned storage.",
    "Resumable/multipart uploads (S3 multipart, tus protocol) with chunk checksums; direct-to-object-store uploads via pre-signed URLs to avoid proxying bytes.",
    "Track upload state; lifecycle rules to clean up incomplete uploads; validate and virus-scan asynchronously.",
    "Only mark the file 'available' after completion is confirmed.",
  ],
  "How do you keep the DB metadata and the object store consistent?");

Q("api", 2,
  "A report-generation endpoint takes 90 seconds, but your API gateway times out at 30 seconds. What happens, and what is the better design?",
  "Does the work stop when the client disconnects?",
  [
    "The client gets a 504 while the server may keep working (wasted effort) or retry and duplicate the work.",
    "Make it asynchronous: return `202 Accepted` with a job id; the client polls a status endpoint or gets a webhook/push.",
    "Jobs run on workers via a queue, are idempotent and resumable, and results are stored with expiry.",
    "Support cancellation and show progress.",
  ],
  "How do you prevent the same user from creating 100 duplicate report jobs?");

Q("api", 2,
  "A bulk API accepts 100 items and 3 of them fail validation or processing. What should it return, and what should the semantics be?",
  "All-or-nothing vs partial success.",
  [
    "Decide and document semantics: atomic (all or nothing, 4xx on any failure) vs partial success (207 Multi-Status or 200 with per-item results).",
    "Per-item results with ids and error codes so clients can retry only failures.",
    "Make items idempotent so a retry of the whole batch is safe; limit batch size.",
    "Validate everything up front when possible; for atomic batches use a single transaction (not possible across systems).",
  ],
  "How do you handle partial failure when the batch spans multiple services?");

/* ===================== RESILIENCE ===================== */
Q("resil", 2,
  "Service A calls B which calls C. C slows down. What happens to A and B and where does it stop?",
  "Latency is infectious.",
  [
    "B's threads/connections wait on C, B saturates, then A's calls to B pile up and A saturates (cascading failure), and even unrelated endpoints can fail because they share resources.",
    "Timeouts shorter than the caller's timeout (deadline propagation), circuit breakers, bulkheads (isolated pools per dependency), and fallbacks.",
    "Load shedding at the edge; async decoupling via queues for non-critical paths.",
    "Observe dependency latency percentiles and set alerts before saturation.",
  ],
  "How should the timeouts at A, B and C relate to each other?");

Q("resil", 3,
  "Three layers (client, gateway, service) each retry a failed call 3 times. The database blips for 10 seconds. What load reaches the DB?",
  "Multiply the attempts.",
  [
    "Retry amplification: up to 3x3x3 = 27x the original traffic on the struggling dependency, turning a blip into an outage (retry storm).",
    "Retry at one layer only, use retry budgets (e.g. max 10% extra), exponential backoff with jitter, and respect Retry-After.",
    "Only retry idempotent operations and retriable errors (not 4xx); fail fast when a circuit breaker is open.",
    "Add load shedding on the server.",
  ],
  "How does a retry budget work?");

Q("resil", 2,
  "Describe what a circuit breaker does, what happens in the half-open state, and how a bad configuration can hurt you.",
  "Closed, open, half-open.",
  [
    "Closed: calls flow, failures are counted. Open: calls fail immediately for a cool-down, protecting the dependency and the caller's resources. Half-open: a few trial calls decide whether to close.",
    "Bad configs: threshold too sensitive (flapping), cool-down too short (hammering), too long (slow recovery), shared breaker across unrelated operations, no fallback.",
    "Use a minimum request volume and failure-rate/slow-call rate thresholds.",
    "Pair with timeouts, bulkheads and a meaningful degraded response.",
  ],
  "What should the user experience while the breaker is open?");

Q("resil", 2,
  "Your readiness/liveness probe checks the database. The DB has a 30-second blip. What happens to the fleet?",
  "What does Kubernetes do with a failing liveness probe?",
  [
    "If liveness fails, Kubernetes restarts every pod simultaneously, so you get cold starts, connection storms and a prolonged outage even after the DB recovers.",
    "Liveness should only check that the process is alive (not deadlocked), not dependencies. Readiness may check critical dependencies, but beware all pods going unready at once.",
    "Use startup probes, sensible thresholds, and degrade gracefully instead of failing health.",
    "Include deep health checks in monitoring, not in orchestration decisions.",
  ],
  "What should happen to traffic if every pod is unready?");

Q("resil", 3,
  "A flash sale starts and traffic jumps 20x in 30 seconds. Autoscaling takes 3-4 minutes to add capacity. What happens, and how do you prepare?",
  "Autoscaling is reactive, so what covers the gap?",
  [
    "Existing instances saturate, latency rises, errors and retries amplify it, and new instances come up into an already-overloaded system (cold caches and connections).",
    "Pre-scale for known events, keep headroom, scale on leading indicators (queue depth, RPS) rather than CPU.",
    "Absorb with CDN/caching, queues, a virtual waiting room, and load shedding with priority classes; degrade non-essential features.",
    "Load test, and protect the DB first (connection limits, rate limits).",
  ],
  "What would you shed first and what must stay up?");

Q("resil", 2,
  "During a rolling deploy, in-flight requests are dropped and users see errors. What do you change?",
  "What does the instance do on SIGTERM?",
  [
    "Instances are killed while serving requests or while still receiving traffic from the load balancer.",
    "Graceful shutdown: on SIGTERM mark not-ready, stop accepting new connections, drain in-flight requests (with a deadline), then exit; add a preStop delay so the LB deregisters first.",
    "Clients retry idempotent calls; long-lived connections (WebSockets/streams) need reconnection with jitter.",
    "Rolling update surge/unavailable settings and PodDisruptionBudgets.",
  ],
  "How do you handle long-running background jobs during deploys?");

Q("resil", 3,
  "A whole availability zone goes down. Your fleet had 3 AZs at 70% CPU each. What happens?",
  "Do the survivors have enough capacity?",
  [
    "Traffic redistributes to the 2 surviving AZs which would need ~105% capacity: overload and cascading failure (N+1 sizing failed).",
    "Design capacity so surviving zones can absorb the loss (e.g. N+1 with utilisation < ~60%), or autoscale quickly with headroom.",
    "Stateful tiers (DB, cache, queues) must also be multi-AZ with automatic failover; avoid cross-AZ chattiness and single-AZ dependencies.",
    "Test AZ failure (chaos/game days) and watch DNS/LB health check timings.",
  ],
  "What changes if the failure is an entire region?");

Q("resil", 3,
  "After a short outage ends, the system stays degraded even though the original trigger is gone: retries and cold caches keep it overloaded. What is this and how do you break out?",
  "A sustaining feedback loop.",
  [
    "Metastable failure: a trigger (spike, restart) pushes the system into a state where a self-sustaining loop (retries, cache misses, queue backlog, GC) keeps load above capacity.",
    "Break the loop: shed load/reject traffic, disable retries or lower the retry budget, scale up, warm caches, drain queues, circuit-break dependencies.",
    "Prevent: exponential backoff with jitter, bounded queues, admission control, load tests including recovery, and avoiding dependency on warm caches for survival.",
    "Operationally: have a 'big red button' to shed load.",
  ],
  "How would you test for metastable behaviour?");

Q("resil", 2,
  "Your payment provider is down for an hour. Orders can still be browsed and carts filled. What do you do with checkout?",
  "Graceful degradation, not total failure.",
  [
    "Degrade, don't die: queue payment attempts (pending-payment state), failover to a secondary provider, or show a clear message while keeping the rest of the site up.",
    "Use a circuit breaker so you stop hammering the provider; keep an idempotent retry mechanism for pending payments.",
    "Don't confirm orders as paid until the provider confirms; reconcile afterwards.",
    "Communicate through status pages and alerts.",
  ],
  "How do you avoid double charges if you fail over to another provider?");

/* ===================== SCALING & LOAD BALANCING ===================== */
Q("scale", 1,
  "Your single load balancer is the entry point for all traffic. What if it fails?",
  "Is there a single point of failure?",
  [
    "Total outage if there's only one LB (SPOF).",
    "Redundant LBs (active-active or active-passive with a floating/virtual IP and health checks), managed multi-AZ cloud LBs, or DNS/anycast across multiple LBs.",
    "Health checks and fast failover; consider DNS TTLs that cause clients to keep using dead IPs.",
    "Also consider the LB's own capacity limits (connections, throughput) and TLS termination cost.",
  ],
  "How does anycast/global load balancing route users to the nearest healthy region?");

Q("scale", 2,
  "Your app uses sticky sessions with in-memory session storage. What happens when a server is replaced during a deploy or crashes?",
  "Where does the session live?",
  [
    "Users bound to that server lose their session (logged out, carts lost) and load becomes uneven.",
    "Externalise state: a shared store (Redis/DB) or signed stateless tokens; make servers stateless so any instance can serve any request.",
    "Stickiness may still be used as an optimisation (cache locality) but never for correctness.",
    "Tradeoff of stateless tokens: revocation and size.",
  ],
  "What are the tradeoffs between server-side sessions and JWTs?");

Q("scale", 2,
  "You balance WebSocket connections with round robin. After a deploy, one server holds 80% of the connections. Why, and what do you do?",
  "Long-lived connections don't rebalance themselves.",
  [
    "Connections are long-lived, so new connections go to whichever servers are up while old ones stay put; after rolling restarts, early-restarted servers accumulate the reconnections.",
    "Use least-connections balancing, cap connections per node, and have servers shed/rebalance gracefully (gradually closing connections with jittered reconnect).",
    "Plan connection capacity and avoid reconnection storms (backoff + jitter).",
    "A pub/sub backplane (Redis/Kafka) is needed so messages reach users on any node.",
  ],
  "How do you route a message to the user's specific connection among 500 servers?");

Q("scale", 2,
  "You scale the app tier from 10 to 100 instances and the site gets SLOWER. What are likely causes?",
  "Where is the real bottleneck?",
  [
    "A shared bottleneck: DB connections/locks, a single cache node, a rate-limited dependency or a contended resource. More clients means more contention.",
    "Each instance adds connection-pool and keep-alive overhead; the DB max_connections is exceeded.",
    "Fix by scaling the bottleneck: read replicas, caching, sharding, connection pooling, async/queues.",
    "Find the bottleneck with metrics (USE method) and Amdahl/Universal Scalability Law thinking.",
  ],
  "How would you find the true bottleneck under load?");

Q("scale", 3,
  "A celebrity with 50M followers posts. Your news feed uses fan-out-on-write. What happens?",
  "Do the math on writes per post.",
  [
    "50M feed writes for a single post: huge delay, write amplification, and queues flooded. It delays the feeds of other users too.",
    "Hybrid: fan-out on write for normal users, fan-out on read (pull and merge at read time) for celebrities.",
    "Process fan-out asynchronously in batches with priority and rate limits; skip inactive users.",
    "Cache hot celebrity timelines; accept eventual consistency in feed delivery.",
  ],
  "How do you merge pushed and pulled feeds and keep ordering?");

Q("scale", 2,
  "You fail over to another region by changing DNS, but many users keep hitting the dead region for 10+ minutes. Why?",
  "Who caches DNS?",
  [
    "DNS caching by resolvers, OS and clients ignores or overshoots your TTL (some resolvers enforce minimums); long-lived connections don't re-resolve.",
    "Use low TTLs ahead of time, health-checked global load balancing/anycast, or an LB in front that fails over without DNS changes.",
    "Clients with retry logic and multiple endpoints improve resilience.",
    "Practice failovers to know the real recovery time.",
  ],
  "What does the failover story look like for mobile apps?");

/* ===================== DISTRIBUTED TRANSACTIONS ===================== */
Q("dtx", 2,
  "An order flow: reserve inventory, charge payment, create shipment (three services). Payment succeeds but the shipment service is down. What state are you in?",
  "No distributed ACID transaction here.",
  [
    "Partial completion: money taken, no shipment. Without a coordination mechanism you get inconsistent state.",
    "Saga: sequence of local transactions with compensating actions (refund/release stock), orchestrated by a coordinator or choreographed via events.",
    "Retry the shipment step (it must be idempotent) before compensating; compensate only on permanent failure.",
    "Compensations can fail too, so they need retries, idempotency, alerts and manual intervention paths. Persist saga state.",
  ],
  "Orchestration vs choreography: what are the tradeoffs?");

Q("dtx", 3,
  "Using two-phase commit, the coordinator crashes after all participants voted 'yes' (prepared) but before sending commit. What happens to the participants?",
  "Participants can't unilaterally decide.",
  [
    "Participants are blocked in the prepared state holding locks until the coordinator recovers (2PC is a blocking protocol).",
    "Recovery needs the coordinator's durable log; participants can't safely commit or abort alone since others might have decided differently.",
    "Mitigate with a replicated coordinator (Paxos/Raft), timeouts and heuristic decisions (risky). 3PC reduces blocking but not partitions.",
    "This is why microservices usually prefer sagas/outbox over 2PC.",
  ],
  "Why can't a participant just time out and abort?");

Q("dtx", 3,
  "In a saga, the 'cancel order' compensation message arrives BEFORE the 'create order' message has been processed (out-of-order). What happens?",
  "The compensation looks for something that doesn't exist yet.",
  [
    "The cancel finds nothing to cancel and is dropped, then the create runs and an order exists that should have been cancelled: inconsistent state.",
    "Make handlers commutative/state-based: record a 'cancelled' tombstone so a late create sees it and is ignored; use version/sequence checks.",
    "Per-aggregate ordering (partition by order id) and explicit state machines with valid transitions.",
    "Compensations and actions must both be idempotent.",
  ],
  "How do you test saga failure paths?");

Q("dtx", 3,
  "You transfer money between accounts held in two different databases. How do you design it to never lose or create money?",
  "Think ledger, idempotency and reconciliation.",
  [
    "Use a double-entry ledger: every transfer is immutable debit + credit entries; balances derive from entries.",
    "Saga with explicit states (initiated -> debited -> credited -> completed/reversed); idempotent transfer ids so retries are safe; a pending/holding account for in-flight money.",
    "Reconciliation jobs to detect and repair drift; alerting on invariants (sum of ledger must be zero).",
    "Avoid distributed locking of balances; serialise per-account operations.",
  ],
  "How do you prevent negative balances under concurrency?");

Q("dtx", 2,
  "Your service uses the transactional outbox. The relay publishes an event, then crashes before marking the row as published. What happens on restart?",
  "Publish and mark are two steps.",
  [
    "The event is published again: duplicates (at-least-once).",
    "Consumers must be idempotent (event id dedupe, upserts, natural idempotency).",
    "Ordering per aggregate must be preserved by the relay (e.g. sequence ids, partition key).",
    "CDC-based relays (Debezium reading the WAL) avoid polling gaps but still give at-least-once.",
  ],
  "How do you keep the outbox table from growing forever?");

Q("dtx", 2,
  "Two services drift out of sync because of bugs and lost messages. How do you detect and repair this in production?",
  "You can't prevent all inconsistencies.",
  [
    "Run reconciliation jobs that compare authoritative records (counts, checksums, per-entity state) and generate repair events.",
    "Choose a source of truth per entity; repairs flow from it. Make repairs idempotent.",
    "Event sourcing/audit logs make it possible to replay and rebuild state; monitor business invariants and alert.",
    "Time-bound the acceptable inconsistency window (SLO).",
  ],
  "How do you reconcile with an external provider that only gives you daily reports?");
