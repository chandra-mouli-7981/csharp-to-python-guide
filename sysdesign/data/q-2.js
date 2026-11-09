/* ===================== QUEUES & STREAMING ===================== */
Q("msg", 1,
  "A consumer processes a message (charges a card) and crashes just BEFORE acknowledging it. What does the broker do, and what's the impact?",
  "Think delivery semantics.",
  [
    "The broker redelivers (visibility timeout/unacked/offset not committed): at-least-once delivery means a duplicate, so the card could be charged twice.",
    "Make consumers idempotent: dedupe by message/business id (processed-ids table with unique constraint), or use idempotency keys with the payment provider.",
    "Store the dedupe record and the side effect in the same transaction where possible.",
    "Acking BEFORE processing flips this to at-most-once: a crash loses the message.",
  ],
  "Is exactly-once delivery possible? What does Kafka's 'exactly-once' actually guarantee?");

Q("msg", 2,
  "One malformed message always throws an exception in the consumer. The consumer retries forever. What happens to the queue?",
  "What does retrying the same message block?",
  [
    "A poison message blocks a partition/queue head (head-of-line blocking), lag grows and everything behind it is stuck.",
    "Bounded retries with exponential backoff, then route to a dead-letter queue (DLQ) with metadata and alert.",
    "Separate transient errors (retry) from permanent errors (DLQ immediately); validate schema on produce.",
    "Provide tooling to inspect and replay DLQ messages after fixes.",
  ],
  "How do you retry without breaking ordering?");

Q("msg", 3,
  "Events for the same order (Created, Paid, Shipped) are processed by multiple consumers in parallel and arrive out of order. What can go wrong and how do you fix it?",
  "What defines the unit of ordering?",
  [
    "A Shipped handler may run before Created, so state transitions are invalid, or older updates overwrite newer ones.",
    "Partition by entity key (order id) so all of its events go to the same partition and a single consumer in order; ordering is only guaranteed within a partition.",
    "Include sequence numbers/versions; handlers ignore stale events or buffer out-of-order ones.",
    "Retries and parallel workers per partition can reorder; use per-key serialization.",
  ],
  "What breaks ordering when you retry a failed message asynchronously?");

Q("msg", 2,
  "Consumer lag on a Kafka topic grows from 10k to 100M messages over an hour. Diagnose and respond.",
  "Compare production rate vs consumption rate; then ask why consumption dropped.",
  [
    "Causes: slow processing/downstream dependency, hot partition (skewed key), too few consumers, rebalance loops, GC, poison messages, or a traffic spike.",
    "Scale consumers up to the partition count (more partitions needs planning), batch processing, increase parallelism within a partition when order isn't needed.",
    "Apply backpressure/shedding for low-value events; prioritise topics.",
    "Beware retention: if lag exceeds retention, messages are deleted before being consumed (data loss).",
  ],
  "How would you catch up without breaking the downstream system?");

Q("msg", 3,
  "A Kafka consumer group rebalances in the middle of processing a batch. What can happen to messages and offsets?",
  "Who owns the partition after a rebalance?",
  [
    "Partitions are reassigned; a consumer that lost its partition may have processed messages without committing offsets, so another consumer reprocesses them (duplicates).",
    "Long processing exceeding `max.poll.interval.ms` makes the broker think the consumer is dead and triggers rebalances.",
    "Use idempotent processing, commit offsets after processing, cooperative sticky rebalancing, static membership, and smaller batches.",
    "Rebalance storms cause pauses and lag. Avoid frequent deploys with all consumers restarting at once.",
  ],
  "How do you do rolling deploys of consumers without lag spikes?");

Q("msg", 3,
  "A Kafka broker holding the partition leader dies right after a producer got an ack. Can an acknowledged message be lost?",
  "What did 'acknowledged' mean in the producer config?",
  [
    "With `acks=1` the leader acked before replicating, so if it fails the new leader may not have the message: acknowledged data lost.",
    "Use `acks=all` with `min.insync.replicas>=2` and replication factor >=3; disable unclean leader election.",
    "Enable the idempotent producer so producer retries don't create duplicates.",
    "Tradeoff: durability vs latency/availability (if ISR < min, writes are rejected).",
  ],
  "What happens to producers when ISR shrinks below min.insync.replicas?");

Q("msg", 3,
  "Your service saves an order to the DB and then publishes an `OrderCreated` event to Kafka. The process crashes between the two. What now?",
  "These are two separate systems with no shared transaction.",
  [
    "The dual-write problem: either the DB has the order but no event was sent (downstream never learns), or the reverse order produces events for orders that don't exist.",
    "Transactional outbox: write the event to an outbox table in the same DB transaction; a relay/CDC (Debezium) publishes it.",
    "The relay gives at-least-once publishing, so consumers must be idempotent.",
    "Avoid 'listen to yourself' or 2PC across DB and broker unless necessary.",
  ],
  "What if the relay publishes an event and crashes before marking it as sent?");

Q("msg", 2,
  "Producers push 10x faster than consumers can process for several minutes. The queue is unbounded. What happens?",
  "Queues absorb bursts, but not forever.",
  [
    "Queue grows, memory/disk fills, latency becomes huge (messages are processed long after they matter), and eventually the broker fails.",
    "Apply backpressure: bounded queues, producer throttling, 429/503 to callers, or drop/sample low-priority events.",
    "Autoscale consumers on queue depth/age, and alert on the age of the oldest message, not just depth.",
    "Use TTL for time-sensitive messages and separate queues by priority.",
  ],
  "When is dropping messages the right call?");

/* ===================== DISTRIBUTED SYSTEMS ===================== */
Q("dist", 2,
  "A network partition splits your 2-datacenter database into two halves. Each half can still serve users. What are your options?",
  "CAP is a choice during partitions, not a menu to pick two from forever.",
  [
    "CP: the side without quorum stops accepting writes (unavailable), keeping consistency. AP: both sides accept writes and diverge, requiring conflict resolution after healing.",
    "Quorum systems need a majority, so two DCs plus a third tie-breaker/witness avoids ties.",
    "AP approaches: last-write-wins (lossy), vector clocks, CRDTs, application-level merge.",
    "Choice depends on the business: payments favour CP; shopping carts, likes and feeds favour AP.",
  ],
  "What happens to clients connected to the minority side?");

Q("dist", 3,
  "The leader of your cluster becomes unreachable (not dead, just slow/partitioned). A new leader is elected. The old leader comes back and still thinks it is leader. What happens?",
  "Two nodes believe they are in charge.",
  [
    "Split brain: both accept writes, causing divergent state and data corruption.",
    "Use consensus with terms/epochs (Raft/Paxos): a node with a stale term steps down on seeing a higher term, and writes need a majority quorum.",
    "Fencing tokens: storage rejects requests from older epochs. Leases with expiry plus fencing on resources.",
    "STONITH (shoot the old node) in HA setups when you can't rely on terms.",
  ],
  "Why aren't leases based purely on wall-clock time safe?");

Q("dist", 3,
  "Your multi-region database uses last-write-wins based on server timestamps. One node's clock is 5 seconds ahead. What goes wrong?",
  "Can you trust wall clocks across machines?",
  [
    "Writes from the skewed node appear newer, so they overwrite genuinely later writes from correct nodes: silent data loss and 'time travel'.",
    "Wall clocks drift, jump (NTP), and aren't comparable across machines.",
    "Use logical clocks (Lamport), vector clocks, hybrid logical clocks (HLC), or consensus-based ordering; Spanner uses TrueTime (bounded uncertainty, commit wait).",
    "Don't rely on timestamps for ordering or locking decisions.",
  ],
  "How do vector clocks detect concurrent writes?");

Q("dist", 2,
  "Service A calls Service B and gets a timeout. Did B perform the action? What should A do?",
  "A timeout carries no information about what happened remotely.",
  [
    "Unknown: the request may have been lost, B may be processing it, or B finished but the response was lost.",
    "Retries must be safe: idempotency keys or naturally idempotent operations (PUT vs POST).",
    "Or provide a status/lookup endpoint to confirm the outcome.",
    "Use timeouts, exponential backoff with jitter, and a retry budget; treat unknown outcome distinctly from failure.",
  ],
  "How do you tell a slow node from a dead one?");

Q("dist", 3,
  "You generate IDs with a Snowflake-style scheme (timestamp + machine id + sequence). What failure modes can cause duplicate or non-monotonic IDs?",
  "What assumptions does the timestamp part make?",
  [
    "Clock moving backwards (NTP adjustment, VM migration) produces smaller or duplicate timestamps; the same machine id assigned to two nodes causes collisions.",
    "Mitigate: refuse to issue IDs (or wait) if the clock moves backwards, persist last timestamp, allocate machine ids via coordination (ZooKeeper/etcd/DB lease).",
    "Sequence overflow within one millisecond requires waiting for the next millisecond.",
    "Alternatives: UUIDv4 (no order, index-unfriendly), UUIDv7/ULID (time-ordered), DB ticket servers, range allocation.",
  ],
  "When are auto-increment IDs a bad idea in a sharded system?");

Q("dist", 3,
  "Your quorum store has N=3, W=2, R=2. One replica is down, then comes back with stale data, and a read hits it plus one up-to-date replica. What does the client get?",
  "W + R > N guarantees overlap, but only with real quorums.",
  [
    "With strict quorums, a read of 2 replicas always overlaps the latest write replica, so the coordinator sees the newer version by version/timestamp and returns it, then triggers read repair.",
    "With sloppy quorums and hinted handoff, writes may land on non-replica nodes, so the overlap guarantee is lost and stale reads are possible.",
    "Background anti-entropy (Merkle trees) repairs long-term divergence.",
    "Tune N/R/W for latency vs consistency (R=1 is fast but may be stale).",
  ],
  "What does the system do on concurrent writes to the same key?");

Q("dist", 2,
  "A server restarts after a deploy and 200k clients reconnect simultaneously. What happens?",
  "They all retry at the same moment, so how do you spread them?",
  [
    "Thundering herd/reconnect storm overloads the server or auth backend, causing failures, more retries and longer recovery.",
    "Clients use exponential backoff with jitter; server controls with connection rate limits, admission control and drain/shed.",
    "Rolling restarts, connection draining, and warming caches before taking traffic.",
    "Use server-directed retry (Retry-After) to spread reconnects.",
  ],
  "How would you design WebSocket reconnection for 5M clients?");

Q("dist", 3,
  "Someone claims 'our system provides exactly-once processing'. How do you respond?",
  "Delivery vs processing vs effects.",
  [
    "Exactly-once delivery is impossible in general (Two Generals); what you can build is effectively-once: at-least-once delivery + idempotent/deduplicated processing.",
    "Kafka's EOS works within Kafka (idempotent producer + transactions + read_committed) but external side effects still need idempotency.",
    "Dedup needs a stable unique id and durable dedupe store with the effect applied atomically (same transaction).",
    "Define the dedupe window and what happens when it expires.",
  ],
  "How do you dedupe if you have 1B messages per day?");

/* ===================== REPLICATION & SHARDING ===================== */
Q("repl", 2,
  "A user updates their profile, the page reloads, and they see the old data. You use async read replicas. Why, and how do you fix it?",
  "Which server served the read?",
  [
    "Replication lag: the write went to the primary but the read hit a replica that hasn't applied it yet (read-your-writes violation).",
    "Read from primary for a short period after a user's write, or for data the user just changed; sticky routing.",
    "Track a log position (LSN/GTID) in the session and read only from replicas that have caught up; or use synchronous replicas for critical reads.",
    "Client-side optimistic UI is a UX workaround, not a consistency fix.",
  ],
  "How would you avoid sending reads to a primary that then becomes the bottleneck?");

Q("repl", 3,
  "The primary dies. You promote an asynchronous replica. What is lost and what else can go wrong?",
  "What was the replica missing at the time of failure?",
  [
    "Writes acknowledged by the old primary but not replicated are lost (RPO > 0); and conflicting IDs/sequences may exist when the old primary returns with extra writes.",
    "Old primary must be fenced and demoted/rewound before rejoining (avoid split brain).",
    "Semi-sync/sync replication reduces loss at the cost of write latency and availability; consensus-based replication (Raft/Paxos) gives no acknowledged-write loss.",
    "Clients need to discover the new primary and handle in-flight transactions (retry with idempotency).",
  ],
  "How do you avoid unnecessary failovers on a transient network blip?");

Q("repl", 2,
  "A user refreshes a feed twice and sees a post appear, then disappear. What's happening?",
  "Different replicas can be at different positions.",
  [
    "Monotonic read violation: consecutive reads hit different replicas with different lag.",
    "Fix: pin a user/session to one replica (consistent hashing by user id), or carry a version/LSN watermark and read from a replica at least that fresh.",
    "Related guarantees: consistent prefix reads, monotonic writes, writes-follow-reads.",
    "Tradeoff: stickiness hurts load balancing and failover.",
  ],
  "What happens to sticky users when that replica dies?");

Q("repl", 2,
  "You shard users by `user_id % 16`. One celebrity generates 80% of traffic. What happens, and what can you do?",
  "Even key distribution doesn't mean even load distribution.",
  [
    "Hot shard: one shard saturates (CPU/IO/connections) while the others idle, and it takes the system's tail latency down.",
    "Cache aggressively and replicate hot entities; split the hot key (salting/sub-keys) and aggregate on read.",
    "Isolate hot tenants onto dedicated shards; use range/directory-based sharding to move specific keys.",
    "Pick shard keys on both cardinality and access pattern; monitor per-shard load.",
  ],
  "Why is range sharding by timestamp usually a bad idea for write-heavy data?");

Q("repl", 3,
  "You need to go from 4 shards to 8 with no downtime. What can go wrong during resharding?",
  "Where does a request go while data is mid-move?",
  [
    "Requests may go to the old or new shard while data is moving: lost writes, stale reads, duplicates.",
    "Consistent hashing or a routing/directory service; pre-split into many logical shards (virtual shards) so resharding means moving whole shards, not rehashing.",
    "Process: dual-write or CDC to copy, verify (checksums), cut over reads, then writes, then cleanup; always with a rollback path.",
    "Throttle copy traffic so it doesn't hurt production.",
  ],
  "How do you verify the data matches before cutover?");

Q("repl", 2,
  "Your reporting query joins `orders` and `users`, which are on different shards. What are your options and costs?",
  "Joins are cheap only when the data is co-located.",
  [
    "Cross-shard joins require scatter-gather (slow, fan-out, tail latency) or application-side joins.",
    "Co-locate related data (shard orders by user_id), denormalise, or maintain read models/materialised views.",
    "Send analytics to a separate warehouse (OLAP) via CDC rather than querying OLTP shards.",
    "Cross-shard transactions need 2PC or sagas, so design to avoid them.",
  ],
  "How do secondary indexes work in a sharded database?");

Q("repl", 3,
  "Two regions both accept writes (multi-leader). The same record is edited in both within a second. What happens when they sync?",
  "Who wins, and does anyone notice?",
  [
    "Write-write conflict: LWW silently drops one change; both versions may conflict-merge incorrectly.",
    "Resolution options: LWW (lossy), vector clocks with app-level merge, CRDTs (counters, sets, maps), or user-visible conflict resolution.",
    "Conflict avoidance: route each entity to a 'home' region so only one region writes it.",
    "Define business rules for resolving: e.g. the max of a counter, union of a cart, never LWW for money.",
  ],
  "Would you allow multi-leader for a bank balance? Why or why not?");

Q("repl", 2,
  "An automated failover triggers because of a brief network glitch and promotes a replica, even though the primary was fine. Now what?",
  "False positives in failure detection are expensive.",
  [
    "Two primaries (split brain) or an unnecessary failover with data loss and connection storms.",
    "Make failure detection conservative: multiple observers/quorum for the decision, appropriate timeouts and flap damping.",
    "Fence the old primary (STONITH, revoke its lease, block it at the proxy) before promoting.",
    "Runbooks and drills; consider manual failover for rare high-risk systems.",
  ],
  "How would you detect that failover is happening repeatedly (flapping)?");
