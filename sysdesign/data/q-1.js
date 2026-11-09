/* ===================== CONCURRENCY ===================== */
Q("conc", 2,
  "Two users click 'Buy' on the last item at the same instant. Your code does `SELECT stock` -> `if stock > 0` -> `UPDATE stock = stock - 1`. What happens?",
  "Look at the gap between the read and the write.",
  [
    "Both read stock=1, both pass the check, both decrement: stock goes to -1 or two orders exist for one item (oversell). Classic check-then-act race.",
    "Fix 1: atomic conditional update `UPDATE items SET stock = stock - 1 WHERE id=? AND stock > 0`, then check affected rows == 1.",
    "Fix 2: pessimistic lock (`SELECT ... FOR UPDATE` inside a transaction). Fix 3: optimistic lock with a version column and retry.",
    "Add a `CHECK (stock >= 0)` constraint as the last line of defence.",
  ],
  "The stock counter lives in Redis for speed while orders are in SQL. How do you stay correct now?");

Q("conc", 1,
  "Two admins open the same user profile, edit different fields, and both hit Save. What is the final state?",
  "Each client sends back the whole object it originally loaded.",
  [
    "Lost update: the second save overwrites the first, silently dropping the first admin's change (last write wins).",
    "Optimistic concurrency: send a version/ETag with the update, server rejects stale writes (HTTP 409/412) and the client reloads/merges.",
    "Or use PATCH with only the changed fields so non-conflicting edits both survive.",
    "For true collaborative edits, use field-level merge, OT or CRDTs.",
  ],
  "When would you prefer pessimistic locking over optimistic here?");

Q("conc", 3,
  "You guard a critical section with a Redis lock (`SET key val NX PX 10000`). The lock holder hits a 15s GC/stop-the-world pause. What happens?",
  "Who thinks they still hold the lock?",
  [
    "The lock expires at 10s, another client acquires it, then the paused client wakes up and still believes it holds the lock. Two writers in the critical section.",
    "Fix: fencing tokens. The lock service issues a monotonically increasing token and the resource (DB/storage) rejects writes with an older token.",
    "Use lock only as an efficiency optimisation, and enforce correctness at the data layer (unique constraints, conditional writes, versioning).",
    "Lock renewal (watchdog) helps but cannot fully fix pauses or clock issues. Know the Redlock debate (Kleppmann vs antirez).",
  ],
  "Would you use ZooKeeper/etcd instead? What guarantees do they add?");

Q("conc", 2,
  "Two concurrent transfers: A->B (100) and B->A (50), each locking source row first then destination row. What can go wrong?",
  "Think about the order in which each transaction takes its locks.",
  [
    "Deadlock: T1 holds A waiting for B, T2 holds B waiting for A. The DB detects it and aborts one transaction (or both time out).",
    "Prevent with a consistent global lock order (e.g. always lock the lower account id first).",
    "Keep transactions short, set lock timeouts, and retry on deadlock errors with backoff.",
    "Alternative: single atomic statements or a per-account serialized queue/actor.",
  ],
  "How do you avoid this across two different databases?");

Q("conc", 2,
  "A downstream service becomes slow (30s responses instead of 50ms). Your service uses a fixed thread pool and blocking calls. What happens?",
  "Where do the threads go while they wait?",
  [
    "Threads pile up waiting on the slow call, the pool is exhausted, new requests queue, latency spikes, health checks fail, and the whole service looks dead (cascading failure).",
    "Set aggressive timeouts, use bulkheads (separate pools per dependency), and circuit breakers to fail fast.",
    "Use async/non-blocking I/O, bounded queues and load shedding (reject early with 503) instead of unbounded queueing.",
    "Provide fallbacks (cached/default responses) for non-critical dependencies.",
  ],
  "How would you size the thread pool and the queue?");

Q("conc", 2,
  "A 'likes' counter is incremented from 50 app servers using `read count -> count+1 -> write`. What goes wrong, and what if one post goes viral?",
  "Consider both correctness and the hot-row problem.",
  [
    "Read-modify-write loses increments under concurrency. Use atomic increments (`UPDATE ... SET likes = likes + 1`, Redis `INCR`).",
    "Viral post creates a hot row/key: lock contention and a single shard bottleneck.",
    "Sharded/striped counters (N sub-counters, sum on read), or buffer increments in memory/Kafka and batch-apply.",
    "If exactness isn't required, use approximate counts; use a set/unique constraint to dedupe 'one like per user'.",
  ],
  "How do you guarantee one like per user per post at that scale?");

Q("conc", 1,
  "Your signup code checks `if (!usernameExists) insert user`. Two people register `alice` simultaneously. What happens?",
  "Where should uniqueness really be enforced?",
  [
    "Both checks pass, both inserts succeed: duplicate usernames (check-then-act race).",
    "Enforce uniqueness with a UNIQUE index in the database and handle the constraint violation (return 409).",
    "App-level checks are only a UX optimisation. The DB constraint is the source of truth.",
    "Normalise before comparing (case, unicode) so `Alice` and `alice` don't slip through.",
  ],
  "How would you enforce uniqueness across shards?");

Q("conc", 3,
  "You use optimistic locking (version column) on a hot row that 500 clients update concurrently. What do you observe?",
  "What does a version conflict cost the loser?",
  [
    "Most updates fail the version check and retry: wasted work, retry storms, high latency and possible starvation. Throughput collapses under contention.",
    "Optimistic locking suits low-contention data. For hot rows use atomic operations, pessimistic locks, or serialise writes via a queue per key.",
    "Reduce contention by redesign: split the row (sharded counters), append-only events with aggregation, or batch writes.",
    "Add jittered backoff and a retry cap to avoid synchronized retries.",
  ],
  "How would you detect hot rows in production?");

/* ===================== DATABASES ===================== */
Q("db", 2,
  "A nightly report runs several queries in one transaction at READ COMMITTED while writes continue. Totals don't add up. Why?",
  "What can change between two statements in the same transaction?",
  [
    "Non-repeatable reads/phantoms: each statement sees data committed up to that statement's start, so queries see different snapshots.",
    "Use REPEATABLE READ / snapshot isolation (consistent snapshot for the whole transaction), or run on a replica/snapshot export.",
    "Know isolation levels and anomalies: dirty read, non-repeatable read, phantom, lost update, write skew.",
    "Long snapshots have costs: MVCC bloat and replication conflicts.",
  ],
  "Does REPEATABLE READ in PostgreSQL prevent phantoms? What about MySQL InnoDB?");

Q("db", 3,
  "Hospital rule: at least one doctor must be on call. Two doctors on call both request to go off call at the same time, each in a snapshot-isolation transaction that first checks 'is someone else on call?'. What happens?",
  "Each transaction writes a different row.",
  [
    "Write skew: both see the other on call, each updates their own row, no row conflict is detected, and now nobody is on call.",
    "Snapshot isolation does not prevent this. SERIALIZABLE (SSI) will abort one transaction.",
    "Alternatives: `SELECT ... FOR UPDATE` on the whole set of rows being checked, or materialise the conflict (a single 'shift' row to lock), or a constraint/trigger.",
    "Same pattern: meeting-room double booking, username claiming, balance across accounts.",
  ],
  "Why is double-booking a room the same problem, and how do range/exclusion constraints help?");

Q("db", 2,
  "Someone leaves a transaction open for 6 hours (an idle-in-transaction connection, or a giant batch update). What problems can it cause?",
  "Think about locks and MVCC cleanup.",
  [
    "Holds row/table locks, so other writers and DDL queue up behind it, causing a pile-up and possible outage.",
    "Prevents vacuum/garbage collection of old row versions: table bloat, slower queries, risk of transaction ID wraparound (Postgres).",
    "Can increase replication lag/conflicts and exhaust connection slots.",
    "Mitigate: statement/idle-in-transaction timeouts, chunk batch jobs into small transactions, monitor long-running transactions.",
  ],
  "How do you safely delete 200M rows from a live table?");

Q("db", 3,
  "You run `ALTER TABLE orders ADD COLUMN status VARCHAR NOT NULL DEFAULT 'new'` on a 500M-row production table at peak. What can happen?",
  "Think table locks, rewrite time, replicas and rollbacks.",
  [
    "Depending on the engine/version it may rewrite the table or hold an exclusive lock, blocking all reads/writes, spiking connections and causing an outage. Replicas lag heavily.",
    "Use online schema change tools (gh-ost, pt-osc, `pg_repack`) or engine features for instant add-column.",
    "Expand/contract pattern: add nullable column, deploy code writing both, backfill in small batches, then add the constraint (validated separately), then clean up.",
    "Always keep migrations backward compatible so rolling deploys and rollbacks work.",
  ],
  "How do you roll back if the backfill corrupts data?");

Q("db", 2,
  "Traffic doubles and your app starts throwing 'too many connections' / 'timeout acquiring connection from pool'. Walk me through what is happening.",
  "Each request holds a connection for how long?",
  [
    "Pool exhausted: requests hold connections too long (slow queries, holding a connection during external calls, leaks) or pool x instance count exceeds DB max_connections.",
    "Scaling app servers horizontally multiplies connections; use a pooler (PgBouncer/ProxySQL) with transaction pooling.",
    "Never hold a DB connection/transaction across network calls; set acquire/statement timeouts; fix leaks.",
    "Size the pool using Little's Law; more connections than cores/IOPS makes things slower, not faster.",
  ],
  "Why can a bigger pool make the problem worse?");

Q("db", 2,
  "Your service commits a transaction, but the connection drops before the client receives the ack. The client sees a timeout. What does it do?",
  "Is the write applied or not? Can the client tell?",
  [
    "Outcome is unknown: the commit may have succeeded. Blind retry may duplicate the write.",
    "Make operations idempotent: client-generated idempotency key / natural unique key, so a retry is safe.",
    "Or query the state first (read-your-write check) before retrying.",
    "This is the core reason exactly-once is built from at-least-once + idempotency.",
  ],
  "Where would you store idempotency keys and how long do you keep them?");

Q("db", 2,
  "A query that ran in 5ms for a year suddenly takes 5 seconds in production with no code change. What are your suspects and steps?",
  "What changes without a deploy?",
  [
    "Data growth or skew, stale statistics, plan regression, missing/dropped index, lock contention, bloat, cache eviction, noisy neighbour, or a parameter-sniffing plan.",
    "Diagnose: `EXPLAIN (ANALYZE)`, compare plans, check lock waits, slow query log, recent changes (stats, index, config).",
    "Mitigate: ANALYZE/update stats, add/fix index, rewrite the query, kill runaway queries, statement timeout, index hints as last resort.",
    "Prevent: query performance monitoring and load tests with production-like data.",
  ],
  "How would you stop one bad query from taking down the whole database?");

Q("db", 3,
  "A replica goes down for hours and the primary's disk fills up with write-ahead logs. How did that happen and what do you do?",
  "Who is the primary waiting for?",
  [
    "The primary retains WAL/binlog for the missing replica (replication slot or retention), so logs accumulate until disk is full and the primary crashes or goes read-only.",
    "Monitor disk and slot lag with alerts, cap retained WAL (max_slot_wal_keep_size), and drop dead slots.",
    "Rebuild the replica from a base backup if lag is too large rather than catching up.",
    "A broader lesson: a non-critical component must not be able to take down the critical one.",
  ],
  "How would you design the system to survive a full-disk primary?");

/* ===================== CACHING ===================== */
Q("cache", 2,
  "A very popular cache key (homepage data) expires. 10,000 requests per second now miss at once. What happens?",
  "Everyone sees the miss in the same instant.",
  [
    "Cache stampede / thundering herd: all requests hit the DB to recompute the same value, which can overload and take the DB down.",
    "Request coalescing (single-flight): one request recomputes, others wait or serve stale.",
    "Soft TTL + stale-while-revalidate, background refresh before expiry, probabilistic early expiration.",
    "Jitter TTLs so keys do not expire together; pre-warm critical keys.",
  ],
  "How do you implement single-flight across many app servers?");

Q("cache", 2,
  "Attackers request random non-existent IDs. Every request misses the cache and hits the DB. What do you do?",
  "A cache can't store what doesn't exist... or can it?",
  [
    "Cache penetration: misses always reach the DB, which overloads.",
    "Negative caching: cache 'not found' for a short TTL.",
    "Bloom filter in front of the cache/DB to cheaply reject IDs that cannot exist.",
    "Input validation, authentication, and rate limiting on suspicious clients.",
  ],
  "What are the downsides of a Bloom filter when data is deleted or added frequently?");

Q("cache", 3,
  "You use cache-aside: on update you write the DB then delete the cache key. A reader and a writer interleave. Can the cache end up with stale data forever?",
  "Trace a reader that misses, reads the DB, and writes to the cache slowly.",
  [
    "Yes: Reader misses and reads old value from DB; Writer updates DB and deletes the key; Reader then writes the OLD value to the cache. Cache is stale until TTL.",
    "Mitigate: always set a TTL as a safety net, delayed double-delete, versioned values (reject older versions), or leases (Memcached/Facebook).",
    "Better: invalidation driven by DB change log (CDC) so ordering follows commit order.",
    "Accept bounded staleness when business allows it, and be explicit about it.",
  ],
  "Why delete the key instead of updating it on write?");

Q("cache", 2,
  "One of five cache nodes dies. With `hash(key) % N` sharding, what happens to the hit ratio and the database?",
  "What happens to the mapping when N changes?",
  [
    "Modulo hashing remaps most keys when N changes, so the hit rate collapses and the DB takes a surge of misses.",
    "Use consistent hashing (with virtual nodes) so only ~1/N of keys move.",
    "Add replicas/failover for cache nodes, and protect the DB with request coalescing, rate limiting and circuit breakers.",
    "Warm up new nodes gradually.",
  ],
  "What problems do virtual nodes solve?");

Q("cache", 2,
  "A celebrity's profile key receives 500k requests/sec, all hitting one cache shard. What happens?",
  "Sharding spreads keys, not requests to one key.",
  [
    "Hot key: one shard's CPU/network saturates, causing latency and possible node failure and rebalancing cascades.",
    "Local in-process cache (short TTL) in front of the distributed cache.",
    "Replicate the hot key under multiple suffixed keys (`key#1..k`) and pick one randomly on read.",
    "Detect hot keys (sampling) and apply special handling; use CDN/edge caching for public data.",
  ],
  "How do you keep multiple copies consistent when the value changes?");

Q("cache", 3,
  "Your entire Redis cluster goes down during peak traffic. Everything now reads from the DB. What happens, and how should it have been designed?",
  "Can the DB handle 100% of reads?",
  [
    "DB overload, then timeouts, retries amplifying load, and possibly a full outage; recovery is hard because the cache comes back cold (another stampede).",
    "Protect the DB: circuit breaker, rate limiting/load shedding, request coalescing, degrade features (serve stale/limited data).",
    "Run the cache in HA mode (replicas/sentinel/cluster, multi-AZ), and keep a small local fallback cache.",
    "Capacity plan: know what happens at 0% hit rate, and test it (game day).",
  ],
  "What is a metastable failure and how does this scenario become one?");

Q("cache", 2,
  "You use a write-back (write-behind) cache to absorb write spikes, flushing to DB asynchronously. The cache node crashes. What is lost?",
  "Acknowledged is not the same as durable.",
  [
    "Acknowledged writes not yet flushed are lost (data loss) and the DB is now inconsistent with what clients saw.",
    "Mitigate with replication of the buffer, append-only persistence (AOF/WAL), or a durable queue/log as the write buffer.",
    "Only use write-back where the loss window is acceptable (metrics, counters, non-critical data).",
    "Compare: write-through (safer, slower) vs write-around vs write-back.",
  ],
  "How would you make the flush idempotent and ordered?");
