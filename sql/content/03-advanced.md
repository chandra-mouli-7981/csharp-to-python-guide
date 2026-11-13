# Level 3 · Advanced

## 3.1 Window functions

A **window function** computes a value across a set of rows related to the current row **without collapsing them**. `GROUP BY` gives one row per group. A window function keeps every row and adds a computed column.

```text
function(...) OVER ( [PARTITION BY cols]  [ORDER BY cols]  [frame clause] )
                      │                     │                │
                      split into groups     order inside     which rows around the current one
                      (like GROUP BY,       each partition   are included (3.2)
                       but rows survive)
```

```sql run
-- Every employee row, plus the department average beside it
SELECT name, dept_id, salary,
       ROUND(AVG(salary) OVER (PARTITION BY dept_id))                AS dept_avg,
       salary - ROUND(AVG(salary) OVER (PARTITION BY dept_id))       AS vs_avg
FROM employees
WHERE dept_id IS NOT NULL
ORDER BY dept_id, salary DESC, name;
```

```text out
name  | dept_id | salary | dept_avg | vs_avg
------+---------+--------+----------+-------
Alice | 1       | 150000 | 123000   | 27000
Liam  | 1       | 130000 | 123000   | 7000
Bob   | 1       | 120000 | 123000   | -3000
Carol | 1       | 120000 | 123000   | -3000
Dave  | 1       | 95000  | 123000   | -28000
Eve   | 2       | 110000 | 77500    | 32500
Frank | 2       | 70000  | 77500    | -7500
Grace | 2       | 70000  | 77500    | -7500
Heidi | 2       | 60000  | 77500    | -17500
Ivan  | 3       | 80000  | 72500    | 7500
Judy  | 3       | 65000  | 72500    | -7500
```

### Ranking: ROW_NUMBER vs RANK vs DENSE_RANK

| Function | Ties | Sequence for salaries 150, 130, 120, 120, 95 |
|---|---|---|
| `ROW_NUMBER()` | Always unique, ties broken arbitrarily (add a tie-breaker!) | 1, 2, 3, 4, 5 |
| `RANK()` | Ties share a rank, then **gaps** | 1, 2, 3, 3, **5** |
| `DENSE_RANK()` | Ties share a rank, **no gaps** | 1, 2, 3, 3, **4** |
| `NTILE(n)` | Splits the ordered rows into `n` near-equal buckets | e.g. quartiles |

```sql run
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC, name) AS row_num,
       RANK()       OVER (ORDER BY salary DESC)       AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC)       AS dense_rnk
FROM employees
WHERE dept_id = 1
ORDER BY salary DESC, name;
```

```text out
name  | salary | row_num | rnk | dense_rnk
------+--------+---------+-----+----------
Alice | 150000 | 1       | 1   | 1
Liam  | 130000 | 2       | 2   | 2
Bob   | 120000 | 3       | 3   | 3
Carol | 120000 | 4       | 3   | 3
Dave  | 95000  | 5       | 5   | 4
```

**Which one to use?** "Nth highest salary" → `DENSE_RANK` (a tie counts once). "Top N rows, no more" or "de-duplicate, keep one" → `ROW_NUMBER`. "Olympic-style ranking" → `RANK`.

### Top-N per group (the most common window question)

Window functions cannot appear in `WHERE`, so compute the rank in a CTE or subquery and filter outside:

```sql run
-- Top 2 distinct salary levels in each department (ties included)
WITH ranked AS (
  SELECT name, dept_id, salary,
         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, salary, rnk
FROM ranked
WHERE rnk <= 2
ORDER BY dept_id, rnk, name;
```

```text out
dept_id | name  | salary | rnk
--------+-------+--------+----
1       | Alice | 150000 | 1
1       | Liam  | 130000 | 2
2       | Eve   | 110000 | 1
2       | Frank | 70000  | 2
2       | Grace | 70000  | 2
3       | Ivan  | 80000  | 1
3       | Judy  | 65000  | 2
```

### LAG / LEAD: look at the previous or next row

`LAG(col, offset, default)` reads `offset` rows **back** (default offset 1, default value NULL). `LEAD` reads forward.

```sql run
WITH monthly AS (
  SELECT strftime('%Y-%m', o.order_date) AS month, SUM(i.qty * i.unit_price) AS revenue
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY strftime('%Y-%m', o.order_date)
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev_month,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
                   / LAG(revenue) OVER (ORDER BY month), 1) AS pct_change
FROM monthly
ORDER BY month;
```

```text out
month   | revenue | prev_month | pct_change
--------+---------+------------+-----------
2024-01 | 1920    | NULL       | NULL
2024-02 | 1650    | 1920       | -14.1
2024-03 | 910     | 1650       | -44.8
2024-04 | 560     | 910        | -38.5
```

Use `LAG` for month-over-month change, time between events, "same as previous row" detection, and gaps-and-islands (Level 4).

### Running totals and share of total

Window functions are evaluated **after** `GROUP BY`, so they can wrap aggregates directly:

```sql run
-- Running total of completed-order revenue
SELECT o.order_id, o.order_date,
       SUM(i.qty * i.unit_price) AS order_total,
       SUM(SUM(i.qty * i.unit_price)) OVER (
           ORDER BY o.order_date, o.order_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total
FROM orders o JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'completed'
GROUP BY o.order_id, o.order_date
ORDER BY o.order_date, o.order_id;
```

```text out
order_id | order_date | order_total | running_total
---------+------------+-------------+--------------
1        | 2024-01-05 | 1020        | 1020
2        | 2024-01-20 | 900         | 1920
3        | 2024-02-03 | 450         | 2370
5        | 2024-02-28 | 1200        | 3570
6        | 2024-03-09 | 310         | 3880
7        | 2024-03-15 | 600         | 4480
8        | 2024-04-02 | 560         | 5040
```

```sql run
-- Revenue, share of total and rank per customer
SELECT c.name,
       SUM(i.qty * i.unit_price)                                                   AS revenue,
       ROUND(100.0 * SUM(i.qty * i.unit_price) / SUM(SUM(i.qty * i.unit_price)) OVER (), 1) AS pct_of_total,
       RANK() OVER (ORDER BY SUM(i.qty * i.unit_price) DESC)                       AS rnk
FROM customers c
JOIN orders o      ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'completed'
GROUP BY c.customer_id, c.name
ORDER BY rnk;
```

```text out
name | revenue | pct_of_total | rnk
-----+---------+--------------+----
Asha | 2070    | 41.1         | 1
Ben  | 1210    | 24           | 2
Chen | 1200    | 23.8         | 3
Dina | 560     | 11.1         | 4
```

`OVER ()` with empty parentheses means "the whole result set is one window".

### NTILE, FIRST_VALUE, and friends

```sql run
SELECT name, salary,
       NTILE(3) OVER (ORDER BY salary DESC, name) AS tier,      -- 12 rows -> 3 tiers of 4
       FIRST_VALUE(name) OVER (PARTITION BY dept_id ORDER BY salary DESC, name) AS dept_top_earner
FROM employees
ORDER BY salary DESC, name
LIMIT 5;
```

```text out
name  | salary | tier | dept_top_earner
------+--------+------+----------------
Alice | 150000 | 1    | Alice
Liam  | 130000 | 1    | Alice
Bob   | 120000 | 1    | Alice
Carol | 120000 | 1    | Alice
Eve   | 110000 | 2    | Eve
```

Others worth naming: `PERCENT_RANK()`, `CUME_DIST()`, `NTH_VALUE()`, `LAST_VALUE()`, and every aggregate (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`) used with `OVER`. SQL Server also has `PERCENTILE_CONT ... OVER`; PostgreSQL has ordered-set aggregates (`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)`).

### Rules to remember

- Allowed only in the **`SELECT` list and `ORDER BY`** (not `WHERE`, `GROUP BY`, `HAVING`).
- `PARTITION BY` is optional (omitted = one partition). `ORDER BY` is what makes `ROW_NUMBER`, `RANK`, `LAG` and `LEAD` meaningful, and SQL Server **requires** it for them.
- Window functions do **not** reduce the number of rows. If you need one row per group, filter `ROW_NUMBER() = 1` or use `GROUP BY`.
- Several window functions can share a definition with a named window: `... OVER w ... WINDOW w AS (PARTITION BY dept_id ORDER BY salary)` (PostgreSQL, MySQL 8, SQLite; SQL Server 2022).

## 3.2 Window frames: ROWS vs RANGE

The **frame** says which rows around the current row feed an aggregate window function (`SUM`, `AVG`, `FIRST_VALUE`, `LAST_VALUE`...). Syntax: `ROWS | RANGE | GROUPS BETWEEN <start> AND <end>`, where bounds are `UNBOUNDED PRECEDING`, `n PRECEDING`, `CURRENT ROW`, `n FOLLOWING`, `UNBOUNDED FOLLOWING`.

**Defaults, which is where bugs hide:**

| You wrote | Frame used |
|---|---|
| `... OVER (PARTITION BY x)` (no `ORDER BY`) | The **whole partition** |
| `... OVER (PARTITION BY x ORDER BY y)` | `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |

`ROWS` counts **physical rows**. `RANGE` works on **values**: all rows with the same `ORDER BY` value (**peers**) are included together. That changes running totals when there are ties:

```sql run
SELECT name, salary,
       SUM(salary) OVER (ORDER BY salary)                                                   AS default_range,
       SUM(salary) OVER (ORDER BY salary, name ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_frame
FROM employees
WHERE dept_id = 1
ORDER BY salary, name;
```

```text out
name  | salary | default_range | rows_frame
------+--------+---------------+-----------
Dave  | 95000  | 95000         | 95000
Bob   | 120000 | 335000        | 215000
Carol | 120000 | 335000        | 335000
Liam  | 130000 | 465000        | 465000
Alice | 150000 | 615000        | 615000
```

Bob and Carol both earn 120000. With the default `RANGE` frame they are peers, so both show the same running total (they are added together). With `ROWS` and a unique ordering, each row adds only itself. **Use an explicit `ROWS` frame (with a unique `ORDER BY`) for running totals.**

### The `LAST_VALUE` trap and moving averages

```sql run
WITH monthly AS (
  SELECT strftime('%Y-%m', o.order_date) AS month, SUM(i.qty * i.unit_price) AS revenue
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY strftime('%Y-%m', o.order_date)
)
SELECT month, revenue,
       ROUND(AVG(revenue) OVER (ORDER BY month ROWS BETWEEN 1 PRECEDING AND CURRENT ROW), 1) AS avg_2_months,
       LAST_VALUE(revenue) OVER (ORDER BY month)                                              AS last_default,  -- surprise!
       LAST_VALUE(revenue) OVER (ORDER BY month
           ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)                         AS last_full
FROM monthly
ORDER BY month;
```

```text out
month   | revenue | avg_2_months | last_default | last_full
--------+---------+--------------+--------------+----------
2024-01 | 1920    | 1920         | 1920         | 560
2024-02 | 1650    | 1785         | 1650         | 560
2024-03 | 910     | 1280         | 910          | 560
2024-04 | 560     | 735          | 560          | 560
```

`LAST_VALUE` with the default frame returns the **current row's** own value (the frame ends at the current row), not the last row of the partition. Extend the frame to `UNBOUNDED FOLLOWING`, or flip the order and use `FIRST_VALUE`.

**Engine notes:** `RANGE` with numeric or interval offsets (`RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW`) works in PostgreSQL, MySQL 8, SQLite. SQL Server supports `RANGE` only with `UNBOUNDED`/`CURRENT ROW`, so use `ROWS` or a self-join for time windows. `GROUPS` frames exist in PostgreSQL 11+ and SQLite.

## 3.3 Indexes

An **index** is a separate sorted structure (usually a **B-tree**, strictly B+tree) that maps column values to rows, like the index at the back of a book. It turns a full table **scan** (read everything, O(n)) into a **seek** (walk the tree, O(log n)). The cost: extra storage and slower writes, because every `INSERT`/`UPDATE`/`DELETE` must update every index.

### Clustered vs non-clustered

| | Clustered index | Non-clustered (secondary) index |
|---|---|---|
| What it is | The table's rows **are stored in key order** (the leaf level is the data) | A separate structure: key values plus a **pointer** to the row |
| How many | **One** per table | Many |
| Lookup of other columns | Direct | Extra step: **key lookup** (bookmark lookup) into the clustered index or heap, unless the index *covers* the query |
| Default | SQL Server: the primary key. MySQL InnoDB: **always** the primary key | Everything else |

- **InnoDB** (MySQL) secondary indexes store the *primary key value* as the row pointer, so a wide primary key bloats every index.
- **PostgreSQL** has no maintained clustered index: tables are heaps, and all indexes are secondary. `CLUSTER` reorders the table once, and it does not stay ordered.
- A table without a clustered index is a **heap**.

### Composite indexes and the leftmost-prefix rule

An index on `(a, b, c)` is sorted by `a`, then `b` within `a`, then `c`. It can serve queries that filter on `a`, on `a, b`, or on `a, b, c`, but **not** efficiently on `b` or `c` alone.

**Column order guideline:** equality columns first, then the range column, then columns needed for sorting. Among equality columns, put the more selective one first.

```sql
CREATE INDEX ix_orders_cust_date ON orders (customer_id, order_date);
-- Helps:  WHERE customer_id = 5
--         WHERE customer_id = 5 AND order_date >= '2024-02-01'
--         WHERE customer_id = 5 ORDER BY order_date
-- Does NOT help (alone): WHERE order_date >= '2024-02-01'
```

### Covering indexes

If an index contains **every column** the query needs, the engine answers from the index alone and never touches the table. SQL Server and PostgreSQL 11+ let you add non-key columns with `INCLUDE`, so they are stored in the leaf only and not used for sorting:

```sql
CREATE INDEX ix_orders_cust ON orders (customer_id) INCLUDE (order_date, status);   -- SQL Server / PostgreSQL 11+
```

### Seeing it in a plan (SQLite's `EXPLAIN QUERY PLAN`)

```sql run
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3;     -- no index on customer_id yet
```

```text out
plan
-----------
SCAN orders
```

```sql run
CREATE INDEX ix_orders_cust_date ON orders (customer_id, order_date);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 3;
```

```text out
plan
-------------------------------------------------------------
SEARCH orders USING INDEX ix_orders_cust_date (customer_id=?)
```

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE customer_id = 1 AND order_date >= '2024-02-01';   -- uses both index columns
```

```text out
plan
------------------------------------------------------------------------------
SEARCH orders USING INDEX ix_orders_cust_date (customer_id=? AND order_date>?)
```

```sql run
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE order_date >= '2024-02-01';                        -- skips the leading column: no seek
```

```text out
plan
-----------
SCAN orders
```

```sql run
EXPLAIN QUERY PLAN
SELECT customer_id, order_date FROM orders WHERE customer_id = 1;             -- everything is in the index
```

```text out
plan
----------------------------------------------------------------------
SEARCH orders USING COVERING INDEX ix_orders_cust_date (customer_id=?)
```

### Sargable predicates ("Search ARGument ABLE")

A condition is sargable when the engine can use an index seek for it. **Wrapping the indexed column in a function or expression usually breaks that.**

| Not sargable (scan) | Sargable rewrite |
|---|---|
| `WHERE YEAR(order_date) = 2024` | `WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'` |
| `WHERE UPPER(name) = 'ALICE'` | Case-insensitive collation, or a computed/expression index |
| `WHERE salary * 12 > 100000` | `WHERE salary > 100000 / 12` |
| `WHERE name LIKE '%ice'` (leading wildcard) | `LIKE 'Ali%'` can seek (in PostgreSQL with a non-C collation, the index needs `text_pattern_ops`). For contains-search use full-text / trigram indexes |
| `WHERE ISNULL(col, 0) = 0` | `WHERE col = 0 OR col IS NULL` |
| `WHERE varchar_col = 123` (implicit conversion) | Compare like with like: `= '123'` (in SQL Server a mismatched type can convert the *column* and kill the seek) |
| `WHERE a = 1 OR b = 2` | Often `UNION ALL` of two seeks, or one composite/index-merge plan |

```sql run
CREATE INDEX ix_orders_date ON orders (order_date);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE strftime('%Y', order_date) = '2024';   -- function on the column
```

```text out
plan
-----------
SCAN orders
```

```sql run
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01';   -- range
```

```text out
plan
------------------------------------------------------------------------
SEARCH orders USING INDEX ix_orders_date (order_date>? AND order_date<?)
```

### When indexes do not help (or hurt)

- **Low selectivity.** A `status` column with 3 values: if a query returns a large share of the table (very roughly more than 10-20%), scanning is cheaper than thousands of random lookups, so the optimizer ignores the index. Combine it with other columns, or use a **partial/filtered index** (`CREATE INDEX ... WHERE status = 'pending'`; PostgreSQL, SQLite, SQL Server. Not MySQL).
- **Tiny tables.** Scanning one page beats walking a tree.
- **Write-heavy tables.** Each extra index slows every write and uses space. Index for real queries, and drop unused ones.
- **Stale statistics** make the optimizer misjudge selectivity (see 3.4).
- **Fragmentation / page splits** from random keys (GUIDs) slow inserts and bloat the index. Rebuild or reorganize periodically, or use sequential keys.

### Other index types worth naming

| Type | Use |
|---|---|
| Unique index | Enforces uniqueness (this is how `UNIQUE` and `PRIMARY KEY` are implemented) |
| Hash index | Equality lookups only (memory-optimized tables, PostgreSQL `USING hash`) |
| Bitmap index | Low-cardinality columns in warehouses (Oracle) |
| Full-text index | Word search (`CONTAINS`, `tsvector`, `MATCH ... AGAINST`) |
| GIN / GiST (PostgreSQL) | JSONB, arrays, full-text, geometric and range data |
| Columnstore | Analytics: column-oriented compression and scans (SQL Server, Postgres extensions) |
| Spatial | Geometry and geography queries |

**Rules of thumb for choosing indexes:** index columns used in `WHERE`, `JOIN ... ON`, `ORDER BY` and `GROUP BY` of **frequent or slow** queries. **Index foreign key columns** (SQL Server and PostgreSQL do not do it for you, MySQL InnoDB does). Check the plan before and after. Remove indexes that usage statistics show are never read.

## 3.4 Execution plans and query tuning

The optimizer turns your declarative SQL into a **plan**: which indexes, which join order, which join algorithm. You see it with:

| Engine | How |
|---|---|
| PostgreSQL | `EXPLAIN` (estimated) / `EXPLAIN (ANALYZE, BUFFERS)` (runs it, shows actual rows and time) |
| SQL Server | SSMS "Include Actual Execution Plan", or `SET STATISTICS IO, TIME ON` and `SET SHOWPLAN_XML ON` |
| MySQL | `EXPLAIN` / `EXPLAIN ANALYZE` (8.0.18+) |
| SQLite | `EXPLAIN QUERY PLAN` |

### What to look for in a plan

- **Scan vs seek**: a table or index *scan* on a big table with a selective filter means a missing or unusable index.
- **Key lookups** repeated for thousands of rows: make the index covering.
- **Estimated vs actual rows** wildly different: stale statistics, or a predicate the optimizer cannot estimate (functions, table variables, skewed data).
- **Sorts and hash spills to disk**: not enough memory grant, or a missing index that could return rows pre-sorted.
- **Nested loops over large inputs**, or a join with no usable index on the join column.
- **Implicit conversions** (a warning in SQL Server plans).

### Join algorithms

| Algorithm | How it works | Best when |
|---|---|---|
| **Nested loop** | For each outer row, probe the inner side (ideally an index seek) | One side is small and the other has an index. Good for OLTP lookups |
| **Hash join** | Build an in-memory hash table on the smaller input, probe with the other | Large, unsorted inputs, equality joins only. Needs memory |
| **Merge join** | Walk two inputs **already sorted** on the join key in parallel | Both sides sorted (e.g. by indexes), equality or range joins |

### Statistics and parameter sniffing

- **Statistics** (histograms of value distribution) let the optimizer estimate how many rows each step returns. They go stale as data changes, so keep auto-update on, or run `UPDATE STATISTICS` / `ANALYZE`.
- **Parameter sniffing** (SQL Server): the plan for a parameterized query or stored procedure is compiled for the **first** parameter values, then cached and reused. If data is skewed (customer 1 has 5 orders, customer 2 has 5 million), that plan can be terrible for other values. Mitigations: `OPTION (RECOMPILE)`, `OPTIMIZE FOR`, splitting the procedure, better statistics or indexes, or forcing a plan in Query Store. PostgreSQL has the same idea with generic vs custom plans for prepared statements.

### Tuning anti-patterns and fixes

| Anti-pattern | Why it hurts | Fix |
|---|---|---|
| `SELECT *` | Extra IO and network, breaks covering indexes | List needed columns |
| Function on an indexed column in `WHERE` | No seek | Rewrite as a range (3.3) |
| Leading wildcard `LIKE '%x'` | No seek | Full-text or trigram index, or rethink |
| `NOT IN (subquery)` | NULL trap and poor plans | `NOT EXISTS` |
| Correlated subquery per row | Possible row-by-row work | Join, derived table, or window function |
| Row-by-row cursor or loop | Thousands of round trips | One set-based statement |
| `DISTINCT` / `UNION` used to hide duplicates | Hides a bad join, adds a sort | Fix the join, use `UNION ALL` |
| `COUNT(*) > 0` to test existence | Counts everything | `EXISTS` (stops at the first row) |
| Deep `OFFSET` paging | Reads and discards all skipped rows | Keyset pagination |
| `OR` across different columns | May force a scan | `UNION ALL`, or an index that serves both |
| Huge `IN (...)` lists | Parse and plan overhead | Temp table or table-valued parameter and a join |
| Missing index on FK/join columns | Scans on every join or cascade | Index them |
| Scalar user-defined function in `WHERE` (SQL Server) | Called once per row, blocks parallelism | Inline table-valued function or rewrite |
| N+1 queries from the app | One query per row | Join/eager load or a single batched `IN` query (3.10) |
| Long transactions | Locks held, blocking | Keep them short, batch work |

### Interview answer: "This query is slow. What do you do?"

1. **Reproduce and measure**: capture the actual query, parameters and timing. Is it slow always or only sometimes (parameter sniffing, blocking, load)?
2. **Look at the actual execution plan** (not just estimated). Find the most expensive operator.
3. **Check estimates vs actuals** and **statistics**. Update them if stale.
4. **Check indexes** against the filter, join, sort and group columns: missing, wrong column order, not covering, or unusable because of a function or implicit conversion.
5. **Rewrite the query**: select fewer columns and rows early, remove unnecessary `DISTINCT`, replace row-by-row logic, break a monster into steps (temp table), fix joins.
6. **Check for blocking and waits** (long transactions, lock waits, deadlocks) and for resource pressure (memory grants, tempdb spills, IO).
7. **Look at the data volume and design**: archiving, partitioning, denormalization or caching, if the query is inherently heavy.
8. **Verify** with the new plan and timings, and watch for regressions on other queries when you add an index.

## 3.5 Transactions, ACID, isolation and locking

A **transaction** is a group of statements that succeed or fail as one unit.

| Letter | Property | Meaning | Mechanism |
|---|---|---|---|
| **A** | Atomicity | All or nothing | Undo/rollback log |
| **C** | Consistency | Moves the database from one valid state to another (constraints hold) | Constraints, triggers, application rules |
| **I** | Isolation | Concurrent transactions do not see each other's partial work | Locks or MVCC |
| **D** | Durability | Once committed, it survives a crash | Write-ahead log (WAL) flushed to disk |

```sql run
CREATE TABLE accounts (id INT PRIMARY KEY, owner TEXT, balance INT NOT NULL CHECK (balance >= 0));
INSERT INTO accounts VALUES (1, 'Asha', 500), (2, 'Ben', 100);

BEGIN;                                                        -- START TRANSACTION / BEGIN TRAN
UPDATE accounts SET balance = balance - 200 WHERE id = 1;
UPDATE accounts SET balance = balance + 200 WHERE id = 2;
ROLLBACK;                                                     -- or COMMIT to make it permanent

SELECT * FROM accounts ORDER BY id;                           -- unchanged: the transfer was undone
```

```text out
id | owner | balance
---+-------+--------
1  | Asha  | 500
2  | Ben   | 100
```

- **Autocommit:** by default each statement is its own transaction. Grouping needs an explicit `BEGIN`.
- **Savepoints** allow a partial rollback: `SAVEPOINT s1; ... ROLLBACK TO s1;`.
- In SQL Server, wrap work in `BEGIN TRY ... END TRY BEGIN CATCH ROLLBACK; THROW; END CATCH`, or set `XACT_ABORT ON` so a runtime error aborts the whole transaction.
- DDL: transactional in SQL Server and PostgreSQL, but **auto-commits** in MySQL and Oracle.

### Concurrency problems (anomalies)

| Anomaly | What happens |
|---|---|
| **Dirty read** | You read another transaction's **uncommitted** change, which may be rolled back |
| **Non-repeatable read** | You read a row twice and it changed in between (another transaction committed an update) |
| **Phantom read** | You run the same range query twice and **new rows** appear (or vanish) |
| **Lost update** | Two transactions read, then both write, so the second overwrites the first |
| **Write skew** | Two transactions read overlapping data, then update **different** rows in a way that breaks a rule (two doctors both go off call, leaving none) |

### Isolation levels (SQL standard)

| Level | Dirty read | Non-repeatable read | Phantom |
|---|---|---|---|
| `READ UNCOMMITTED` | Possible | Possible | Possible |
| `READ COMMITTED` | **No** | Possible | Possible |
| `REPEATABLE READ` | No | **No** | Possible (by the standard) |
| `SERIALIZABLE` | No | No | **No** |

Higher isolation means fewer anomalies but more blocking or more retries. Real engines differ from the table:

| Engine | Default | Notes |
|---|---|---|
| SQL Server | `READ COMMITTED` (lock-based) | Optional `READ_COMMITTED_SNAPSHOT` (row versioning, on by default in Azure SQL) and `SNAPSHOT` isolation. `NOLOCK` = `READ UNCOMMITTED` and can return duplicate or missing rows |
| PostgreSQL | `READ COMMITTED` | MVCC. `REPEATABLE READ` is snapshot isolation (no phantoms, but write skew is possible). `SERIALIZABLE` uses SSI and may abort with a serialization failure to retry. `READ UNCOMMITTED` behaves as `READ COMMITTED` |
| MySQL (InnoDB) | `REPEATABLE READ` | MVCC plus gap/next-key locks to limit phantoms |
| Oracle | `READ COMMITTED` | MVCC via undo. Offers `SERIALIZABLE`, but no `REPEATABLE READ` |

**MVCC (multi-version concurrency control):** writers create a new row version instead of overwriting, so **readers do not block writers and writers do not block readers**. Old versions are cleaned up later (PostgreSQL `VACUUM`, InnoDB purge, SQL Server version store in tempdb).

### Preventing lost updates

The anti-pattern is read-modify-write in the application:

```text
T1: SELECT balance → 500        T2: SELECT balance → 500
T1: UPDATE balance = 500 - 100  T2: UPDATE balance = 500 - 50     ← overwrites T1; the -100 is lost
```

| Fix | How |
|---|---|
| **Atomic update** (best when possible) | `UPDATE accounts SET balance = balance - 100 WHERE id = 1 AND balance >= 100`, then check rows affected |
| **Pessimistic lock** | `SELECT ... FOR UPDATE` (PostgreSQL, MySQL, Oracle) or `WITH (UPDLOCK, ROWLOCK)` (SQL Server), then update |
| **Optimistic concurrency** | A `version` (or `rowversion`) column. Update only if it is unchanged, and treat 0 rows affected as a conflict |
| **Serializable isolation** | Let the DB detect it, and retry on failure |

```sql run
CREATE TABLE prices (id INT PRIMARY KEY, price INT NOT NULL, version INT NOT NULL DEFAULT 1);
INSERT INTO prices VALUES (1, 100, 1);
-- Both users loaded version 1. User A saves first:
UPDATE prices SET price = 120, version = version + 1 WHERE id = 1 AND version = 1;
SELECT changes() AS rows_updated_by_A;    -- 1 = success
```

```text out
rows_updated_by_A
-----------------
1
```

```sql run
-- User B saves with the stale version 1:
UPDATE prices SET price = 90, version = version + 1 WHERE id = 1 AND version = 1;
SELECT changes() AS rows_updated_by_B;    -- 0 = conflict, B must reload and retry
```

```text out
rows_updated_by_B
-----------------
0
```

### Locks and deadlocks

- **Lock types:** shared (S, for reads), exclusive (X, for writes), update (U, SQL Server's "I will probably write" lock), and intent locks that advertise row locks at table level. Granularity: row, page, table. **Lock escalation** (SQL Server, roughly at 5,000 locks on one object) promotes many row locks to a table lock and can block everyone.
- **Blocking** is normal: one session waits for another's lock. A **deadlock** is a cycle:

```text
T1 holds lock on A, wants B      T2 holds lock on B, wants A      → neither can proceed
```

The engine detects it and kills a **victim** (SQL Server error 1205, PostgreSQL SQLSTATE `40P01`, MySQL error 1213). Your code must catch that and **retry**.

**Reduce deadlocks:** access tables and rows in a **consistent order**, keep transactions **short**, never wait for user input inside a transaction, use proper **indexes** (fewer rows locked), use lower isolation or row versioning for readers, and add retry logic.

**Distributed transactions:** across databases or services, two-phase commit (2PC) gives atomicity but is slow and fragile. Microservices usually use **sagas** (a sequence of local transactions with compensating actions) plus idempotency.

## 3.6 Normalization and schema design

**Normalization** organizes tables to remove redundancy and prevent anomalies.

| Anomaly | Example in a wide "orders" table that repeats the customer's address on every row |
|---|---|
| **Update** | Change the address and miss some rows, so there are conflicting copies |
| **Insert** | Cannot store a new customer until they place an order |
| **Delete** | Deleting the last order loses the customer entirely |

| Normal form | Rule | Typical violation |
|---|---|---|
| **1NF** | Atomic values, no repeating groups, each row identifiable | `phones = '555-1, 555-2'`, or `phone1, phone2, phone3` columns |
| **2NF** | 1NF + no **partial dependency**: every non-key column depends on the **whole** composite key | `order_items(order_id, product_id, product_name)`: `product_name` depends on `product_id` only |
| **3NF** | 2NF + no **transitive dependency**: non-key columns depend on the key, not on other non-key columns | `employees(emp_id, dept_id, dept_name)`: `dept_name` depends on `dept_id` |
| **BCNF** | Every determinant is a candidate key (a stricter 3NF) | A non-key column that determines part of the key |

Mnemonic: *every non-key attribute must depend on **the key**, **the whole key**, and **nothing but the key**.*

```sql
-- Before: everything in one table (violates 2NF and 3NF)
-- orders_flat(order_id, product_id, customer_id, customer_name, customer_city, product_name, qty)

-- After: normalized
CREATE TABLE customers   (customer_id INT PRIMARY KEY, name VARCHAR(50), city VARCHAR(50));
CREATE TABLE products    (product_id  INT PRIMARY KEY, name VARCHAR(50), price DECIMAL(10,2));
CREATE TABLE orders      (order_id    INT PRIMARY KEY, customer_id INT REFERENCES customers, order_date DATE);
CREATE TABLE order_items (order_id INT REFERENCES orders, product_id INT REFERENCES products, qty INT,
                          PRIMARY KEY (order_id, product_id));
```

(That is exactly the sample database used throughout this guide.)

### Denormalization: when and why

Deliberately duplicating data to avoid joins: pre-computed totals, a copied `customer_name` on an invoice (which should *freeze* the value at sale time, so it is not redundancy), reporting tables, and read-heavy dashboards. The price is extra write work and the risk of inconsistency, so use triggers, application logic or batch jobs to keep it in sync. **Normalize first, denormalize with evidence.**

### Relationships and common design patterns

| Relationship | How to model |
|---|---|
| One-to-many | FK on the "many" side (`orders.customer_id`) |
| Many-to-many | **Junction table** with two FKs and a composite PK (`order_items`, `student_courses`) |
| One-to-one | FK with `UNIQUE` (or a shared primary key) |
| Hierarchy | Self-referencing FK (`manager_id`), or closure/nested-set tables for heavy tree queries |

- **Soft delete** (`is_deleted`/`deleted_at`): keeps history, but every query must filter it and unique constraints get complicated (use partial indexes).
- **Audit columns:** `created_at`, `updated_at`, `created_by`. History tables or temporal tables for full change tracking.
- **Lookup tables vs enums:** a small table plus FK is easier to extend than `CHECK (status IN (...))`.
- **Avoid EAV** (entity-attribute-value: `entity_id, key, value`) for core data: no types, no constraints, painful queries. Use JSON columns for genuinely sparse attributes.
- **Money:** `DECIMAL`, plus a currency code. **Time:** UTC. **Names and addresses:** do not assume one string fits.

**OLTP vs OLAP**

| | OLTP | OLAP |
|---|---|---|
| Goal | Many small transactions (orders, payments) | Large analytical scans and aggregates |
| Schema | Normalized (3NF) | Denormalized **star/snowflake schema**: a central **fact** table (events, measures) joined to **dimension** tables (who, what, when) |
| Storage | Row store | Often column store |
| Typical engines | SQL Server, PostgreSQL, MySQL | Snowflake, BigQuery, Redshift, Synapse |

Dimension history is handled with **slowly changing dimensions**: Type 1 overwrites, Type 2 adds a new row with validity dates (the common choice), Type 3 keeps a "previous value" column.

### How to answer "design the schema for X"

1. Clarify the entities, the core queries and the scale.
2. Identify entities and relationships (1:1, 1:N, M:N).
3. Choose keys (surrogate vs natural) and data types.
4. Normalize to 3NF, and add constraints (PK, FK, UNIQUE, CHECK, NOT NULL).
5. Add indexes for the main access paths.
6. Mention the trade-offs: denormalization, partitioning, soft deletes, auditing.

## 3.7 Stored procedures, functions, triggers and other objects

| Object | Purpose | Key facts |
|---|---|---|
| **Stored procedure** | Named, precompiled-style batch of SQL with parameters | Can modify data, return result sets, output parameters, manage transactions, use `TRY...CATCH`. Called with `EXEC`/`CALL`. Not usable inside a `SELECT` |
| **Function (UDF)** | Returns a value or table, usable inside queries | **Scalar** (one value) or **table-valued**. In SQL Server functions cannot modify data. Scalar UDFs can be very slow (per row, no parallelism) until inlining arrived in SQL Server 2019. **Inline table-valued** functions are fast |
| **Trigger** | Runs automatically on `INSERT`/`UPDATE`/`DELETE` (or DDL) | Good for auditing, enforcing cross-row rules. Hidden logic, hard to debug, can cascade |
| **View** | Saved query | See 2.7 |
| **Sequence** | Number generator independent of any table | PostgreSQL, Oracle, SQL Server 2012+. MySQL uses `AUTO_INCREMENT` |

**Stored procedure pros and cons**

- Pros: fewer network round trips, plan reuse, central logic, permission control (grant `EXEC` only), parameterized by design (safe from injection).
- Cons: logic split between app and DB, harder to version and test, vendor lock-in, can become a scaling bottleneck because DB CPU is expensive.

**Procedure vs function (SQL Server flavoured):** a function must return a value and can be used in `SELECT`/`WHERE`/`FROM`, but cannot change data. A procedure can change data, return multiple result sets, and handle transactions, but it cannot be used in a query.

**Triggers: what to know**

- Timing: `AFTER`, `BEFORE` (PostgreSQL, MySQL, Oracle), `INSTEAD OF` (SQL Server, and views elsewhere).
- Row context: `inserted` / `deleted` pseudo-tables (SQL Server) or `NEW` / `OLD` (PostgreSQL, MySQL, Oracle, SQLite).
- **SQL Server triggers fire once per statement, not per row**, so they must handle multi-row `inserted`/`deleted` sets. PostgreSQL, MySQL and Oracle commonly use `FOR EACH ROW`.

```sql run
-- An audit trigger (SQLite syntax; T-SQL and PostgreSQL syntax differ but the idea is identical)
CREATE TABLE salary_audit (emp_id INT, old_salary INT, new_salary INT);

CREATE TRIGGER trg_salary_audit AFTER UPDATE OF salary ON employees
WHEN OLD.salary <> NEW.salary
BEGIN
  INSERT INTO salary_audit (emp_id, old_salary, new_salary) VALUES (OLD.emp_id, OLD.salary, NEW.salary);
END;

UPDATE employees SET salary = salary + 1000 WHERE emp_id IN (6, 7);
SELECT * FROM salary_audit ORDER BY emp_id;
```

```text out
emp_id | old_salary | new_salary
-------+------------+-----------
6      | 70000      | 71000
7      | 70000      | 71000
```

```sql
-- T-SQL stored procedure: transaction, error handling, parameters
CREATE OR ALTER PROCEDURE dbo.TransferMoney @From INT, @To INT, @Amount DECIMAL(19,4)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;                       -- any runtime error aborts and rolls back the transaction
  BEGIN TRY
    BEGIN TRAN;
      UPDATE dbo.accounts SET balance = balance - @Amount WHERE id = @From AND balance >= @Amount;
      IF @@ROWCOUNT = 0 THROW 50001, 'Insufficient funds', 1;
      UPDATE dbo.accounts SET balance = balance + @Amount WHERE id = @To;
    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;                                 -- rethrow to the caller
  END CATCH
END
```

### Temp tables, table variables, CTEs

| | `#temp` table | `@table` variable (SQL Server) | CTE |
|---|---|---|---|
| Statistics and indexes | Yes (can add indexes) | Limited statistics (better since SQL Server 2019 deferred compilation) | None (it is just a query) |
| Scope | Session (`##global` visible to all) | Batch | One statement |
| Rolled back with the transaction | Yes | **No** | n/a |
| Use for | Large intermediate results, reuse | Tiny row counts | Readability, recursion |

### Cursors: usually avoid

A cursor processes one row at a time, which is slow and lock-heavy. Think **set-based**: express the transformation as one `UPDATE ... FROM`, `INSERT ... SELECT`, or window function. Legitimate cases: administrative loops over objects, or complex per-row logic with side effects (such as calling a procedure for each row).

### Dynamic SQL

Building SQL as text at runtime. Use parameterized execution (`sp_executesql` with parameters, `EXECUTE ... USING` in PostgreSQL), and **whitelist or quote identifiers** (`QUOTENAME()`, `format('%I')`), or you have an injection hole.

### Materialized and indexed views

A **materialized view** stores the query result physically: very fast reads for expensive aggregates, but it is stale until refreshed. PostgreSQL: `CREATE MATERIALIZED VIEW ...; REFRESH MATERIALIZED VIEW [CONCURRENTLY] ...`. Oracle supports fast refresh and query rewrite. SQL Server **indexed views** are kept up to date automatically on every write, at a cost to writes and with many restrictions (`SCHEMABINDING`, limited aggregates). MySQL has no native materialized views, so use a summary table plus a scheduled job.

## 3.8 UPSERT, MERGE and concurrency patterns

### UPSERT: insert, or update if it exists

| Engine | Syntax |
|---|---|
| PostgreSQL, SQLite | `INSERT ... ON CONFLICT (key) DO UPDATE SET col = EXCLUDED.col` (or `DO NOTHING`) |
| MySQL | `INSERT ... ON DUPLICATE KEY UPDATE col = VALUES(col)` (or alias syntax in 8.0.19+) |
| SQL Server, Oracle, PostgreSQL 15+ | `MERGE target USING source ON ... WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...` |

```sql run
CREATE TABLE page_views (page TEXT PRIMARY KEY, views INT NOT NULL);
INSERT INTO page_views VALUES ('home', 1);

INSERT INTO page_views (page, views) VALUES ('home', 1), ('docs', 1)
ON CONFLICT (page) DO UPDATE SET views = views + excluded.views;     -- atomic: no read-then-write race

SELECT * FROM page_views ORDER BY page;
```

```text out
page | views
-----+------
docs | 1
home | 2
```

**Why not `IF EXISTS (SELECT ...) UPDATE ELSE INSERT`?** There is a **race**: two sessions both see "not there" and both insert (a duplicate key error, or worse, duplicates if no unique constraint exists). Always back an upsert with a **unique constraint** and let the database arbitrate. In SQL Server, `MERGE` has a history of bugs and race conditions (if you use it, add `WITH (HOLDLOCK)`), and many teams prefer an explicit `UPDATE`, then `INSERT` if `@@ROWCOUNT = 0`, inside a transaction.

### Prevent overselling: atomic conditional update

```sql run
CREATE TABLE stock (product_id INT PRIMARY KEY, qty INT NOT NULL CHECK (qty >= 0));
INSERT INTO stock VALUES (1, 1);                                          -- one unit left
UPDATE stock SET qty = qty - 1 WHERE product_id = 1 AND qty > 0;          -- first buyer succeeds
```

```sql run
UPDATE stock SET qty = qty - 1 WHERE product_id = 1 AND qty > 0;          -- second buyer: condition fails
SELECT changes() AS rows_updated;                                         -- 0 => sold out; tell the user
```

```text out
rows_updated
------------
0
```

The check and the change happen in **one statement**, so no lock juggling is needed. Always inspect "rows affected".

### Work queues: `SKIP LOCKED`

Many workers need to claim distinct jobs without blocking each other:

```sql
-- PostgreSQL / MySQL 8 / Oracle
BEGIN;
SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED;
UPDATE jobs SET status = 'running' WHERE id = :id;
COMMIT;

-- SQL Server equivalent
SELECT TOP (1) id FROM jobs WITH (UPDLOCK, READPAST, ROWLOCK) WHERE status = 'pending' ORDER BY id;
```

### More patterns interviewers ask about

- **Idempotent writes:** a unique key such as `(request_id)` plus `INSERT ... ON CONFLICT DO NOTHING`, so retries do not double-apply.
- **Batch deletes/updates:** delete in chunks (`DELETE TOP (5000) ...` in a loop, or `WHERE id IN (SELECT id ... LIMIT 5000)`) to avoid huge transactions, lock escalation and log growth.
- **Gapless sequences:** identity/sequence values can have **gaps** (rollbacks, crashes). If you need gapless numbering (invoice numbers), use a counter table updated under a lock, and accept the contention.
- **Bulk loading:** use `COPY` (PostgreSQL), `BULK INSERT`/`bcp`/`SqlBulkCopy` (SQL Server), `LOAD DATA` (MySQL). Batch inserts instead of one row per round trip.
- **Counting rows:** `COUNT(*)` is O(n) on big tables. Keep a counter table, use approximate stats (`pg_class.reltuples`), or cache.

## 3.9 Scaling: partitioning, replication, sharding

| Technique | What | Trade-offs |
|---|---|---|
| **Indexing and query tuning** | First step, always | Cheapest and most effective |
| **Vertical scaling** | Bigger server | Simple, but has a ceiling and a cost curve |
| **Caching** | Redis or an app cache in front of the DB | Invalidation complexity, staleness |
| **Read replicas** | Copies that serve reads. A primary takes writes | **Replication lag**: a read right after a write may be stale (read-your-writes problem) |
| **Partitioning** | Split one big table into pieces *inside one database* by range (date), list or hash | Faster pruning, easier archive/drop of old data. Choose the key to match query filters |
| **Sharding** | Split data across **multiple databases/servers** by a shard key (e.g. `customer_id % N`) | Cross-shard joins and transactions are hard, resharding is painful, hot shards |
| **Archiving** | Move cold rows to cheap storage | Needs a retrieval path |
| **CQRS / read models** | Separate write model and denormalized read model | More moving parts, eventual consistency |

- **Synchronous vs asynchronous replication:** sync waits for the replica before commit (no data loss on failover, but higher latency). Async is faster but can lose recent commits on failover.
- **Connection pooling** matters: opening connections is expensive and databases cap them. Use the driver pool, or PgBouncer/ProxySQL.
- **CAP theorem:** under a network partition, a distributed system must choose consistency or availability. Traditional single-node RDBMS side-step this. Distributed SQL and NoSQL systems make explicit choices.
- **SQL vs NoSQL (a balanced answer):** pick relational when you need joins, transactions and a stable schema. Pick document/key-value/wide-column stores for flexible schema, massive horizontal scale, or simple access patterns. Many systems use both (polyglot persistence).

## 3.10 SQL from C# and Python

### SQL injection and parameterized queries

**Never build SQL by concatenating or formatting user input.** Send the SQL text and the values **separately**, so the database never parses user data as code.

```python
# BAD: attacker enters  x' OR '1'='1
cursor.execute(f"SELECT * FROM customers WHERE name = '{user_input}'")

# GOOD: placeholder + parameters (the driver sends them separately)
cursor.execute("SELECT * FROM customers WHERE name = ?", (user_input,))
```

```csharp
// BAD
var cmd = new SqlCommand($"SELECT * FROM Customers WHERE Name = '{name}'", conn);

// GOOD (ADO.NET)
var cmd = new SqlCommand("SELECT * FROM Customers WHERE Name = @name", conn);
cmd.Parameters.Add("@name", SqlDbType.NVarChar, 50).Value = name;

// GOOD (Dapper)
var rows = conn.Query<Customer>("SELECT * FROM Customers WHERE Name = @name", new { name });

// GOOD (EF Core): LINQ is parameterized; for raw SQL use the interpolated overload
var list = db.Customers.FromSqlInterpolated($"SELECT * FROM Customers WHERE Name = {name}").ToList();
```

| Library | Placeholder style |
|---|---|
| ADO.NET, Dapper (SQL Server) | `@name` |
| Python `sqlite3` | `?` or `:name` |
| `pyodbc` | `?` |
| `pymssql` | `%s` |
| `psycopg` (PostgreSQL), `mysql-connector`, PyMySQL | `%s` (always `%s`, even for numbers) |
| SQLAlchemy `text()` | `:name` |

**What you cannot parameterize:** table names, column names, `ORDER BY` direction, and SQL keywords. For dynamic identifiers, **whitelist against a fixed set** (`if sort_col not in {"name", "salary"}: raise`), never pass them through.

Other defences: least-privilege DB accounts, stored procedures with parameters, input validation, and never showing raw DB errors to users.

### Transactions in code

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER NOT NULL CHECK (balance >= 0))")
db.executemany("INSERT INTO accounts VALUES (?, ?)", [(1, 500), (2, 100)])
db.commit()

try:
    with db:                                    # commits if the block succeeds, rolls back on any exception
        db.execute("UPDATE accounts SET balance = balance + 50 WHERE id = 2")
        db.execute("UPDATE accounts SET balance = balance - 600 WHERE id = 1")   # violates CHECK -> exception
except sqlite3.IntegrityError as e:
    print("rolled back:", e)

print(db.execute("SELECT id, balance FROM accounts ORDER BY id").fetchall())   # [(1, 500), (2, 100)]
```

Note that `with db:` manages the **transaction**, not the connection. It does not close it, so call `db.close()` yourself (or wrap it in `contextlib.closing`). In C#, the equivalent is `using var tx = conn.BeginTransaction(); ...; tx.Commit();` (an uncommitted transaction is rolled back on dispose), or `TransactionScope`.

### The N+1 query problem

```python
# N+1: 1 query for customers + 1 query PER customer = N+1 round trips
for c in db.execute("SELECT customer_id, name FROM customers"):
    orders = db.execute("SELECT * FROM orders WHERE customer_id = ?", (c[0],)).fetchall()

# Fix: one joined (or batched IN) query
rows = db.execute("""SELECT c.name, o.order_id FROM customers c
                     LEFT JOIN orders o ON o.customer_id = c.customer_id""").fetchall()
```

ORMs hide this behind lazy loading (`customer.Orders` in EF, `customer.orders` in SQLAlchemy). Fix with eager loading (`Include()` / `selectinload`/`joinedload`), projection to DTOs, or a single batched query. Also: `AsNoTracking()` for read-only EF queries, and always page large result sets.

### LINQ ↔ SQL ↔ pandas cheat sheet

| SQL | C# LINQ | pandas |
|---|---|---|
| `WHERE salary > 100000` | `.Where(e => e.Salary > 100000)` | `df[df.salary > 100000]` |
| `SELECT name, salary` | `.Select(e => new { e.Name, e.Salary })` | `df[["name", "salary"]]` |
| `ORDER BY salary DESC` | `.OrderByDescending(e => e.Salary)` | `df.sort_values("salary", ascending=False)` |
| `GROUP BY dept_id` + `COUNT(*)` | `.GroupBy(e => e.DeptId).Select(g => new { g.Key, N = g.Count() })` | `df.groupby("dept_id").size()` |
| `AVG(salary)` | `.Average(e => e.Salary)` | `df.salary.mean()` |
| `INNER JOIN` | `.Join(...)` | `df.merge(other, on="dept_id")` |
| `LEFT JOIN` | `GroupJoin` + `SelectMany` + `DefaultIfEmpty` | `df.merge(other, on="dept_id", how="left")` |
| `EXISTS (...)` | `.Any(pred)` | `(df.col == v).any()` |
| `NOT EXISTS (... NOT pred)` / all match | `.All(pred)` | `(df.col == v).all()` |
| `IN (1, 2, 3)` | `ids.Contains(e.Id)` | `df[df.id.isin(ids)]` |
| `DISTINCT` | `.Distinct()` | `df.drop_duplicates()` |
| `LIMIT 10` / `TOP 10` | `.Take(10)` | `df.head(10)` |
| `OFFSET 20 ... FETCH 10` | `.Skip(20).Take(10)` | `df.iloc[20:30]` |
| `UNION ALL` / `UNION` | `.Concat(b)` / `.Union(b)` | `pd.concat([a, b])` (+ `.drop_duplicates()`) |
| `EXCEPT` / `INTERSECT` | `.Except(b)` / `.Intersect(b)` | `a[~a.id.isin(b.id)]` / `a[a.id.isin(b.id)]` |
| Window `ROW_NUMBER()` | (usually raw SQL) | `df.groupby("dept_id").cumcount() + 1` |

## 3.11 Quick-fire Q&A (Advanced)

**What is a window function and how is it different from `GROUP BY`?** It computes across related rows without collapsing them, so detail rows stay while aggregates, ranks and running totals are added.

**`ROW_NUMBER` vs `RANK` vs `DENSE_RANK`?** Unique sequence. Ties share a rank and leave gaps. Ties share a rank with no gaps.

**How do you get the Nth highest salary?** `DENSE_RANK() OVER (ORDER BY salary DESC)` in a CTE, then filter `= N`. Or `ORDER BY ... LIMIT 1 OFFSET N-1` on distinct salaries.

**Why can't you use a window function in `WHERE`?** `WHERE` runs before `SELECT`, where windows are computed. Use a CTE or subquery and filter outside.

**What is the default window frame and why does it matter?** With `ORDER BY`: `RANGE UNBOUNDED PRECEDING TO CURRENT ROW`. Ties are peers, and `LAST_VALUE` returns the current row. Specify the frame explicitly.

**Clustered vs non-clustered index?** Clustered: the table data in key order, one per table. Non-clustered: a separate structure pointing to rows, many per table.

**What is a covering index?** One that holds every column the query needs, so the table is never touched.

**What is the leftmost-prefix rule?** A composite index `(a, b, c)` serves filters on `a`, `a+b`, `a+b+c`, but not `b` or `c` alone.

**What is "sargable"?** A predicate the engine can seek with an index. Functions or expressions on the indexed column usually make it non-sargable.

**Do indexes always help?** No. They cost writes and space, and the optimizer ignores them for low-selectivity filters and tiny tables.

**Index scan vs index seek?** A scan reads the whole index (or a large range). A seek navigates the tree to the exact rows.

**What are statistics?** Value-distribution metadata the optimizer uses to estimate row counts and choose plans. Stale statistics produce bad plans.

**Name the join algorithms.** Nested loop (small outer, indexed inner), hash (large unsorted equi-joins), merge (both inputs sorted).

**What is parameter sniffing?** The plan is built from the first parameter values and reused, which is bad if data is skewed. Fix with `RECOMPILE`, `OPTIMIZE FOR`, or better stats and indexes.

**What is ACID?** Atomicity, Consistency, Isolation, Durability.

**Name the isolation levels and anomalies.** Read uncommitted, read committed, repeatable read, serializable, which progressively prevent dirty reads, non-repeatable reads and phantoms.

**What is MVCC?** Writers create new row versions, so readers see a consistent snapshot without blocking writers.

**What is a deadlock and how do you handle it?** A circular lock wait. The DB kills a victim. Prevent with consistent lock order and short transactions, and handle with retry.

**Optimistic vs pessimistic concurrency?** Optimistic: no lock, a version check at write time, retry on conflict. Pessimistic: lock the row up front (`SELECT ... FOR UPDATE`).

**How do you prevent a lost update?** Atomic `UPDATE ... SET x = x - 1 WHERE ...`, row locks, version columns, or serializable isolation with retries.

**What does `NOLOCK` do?** (SQL Server) Reads uncommitted data (`READ UNCOMMITTED`): dirty reads, and possibly missing or duplicate rows. Avoid it for correctness-sensitive reads. Use row versioning instead.

**Normal forms in one line each?** 1NF atomic values. 2NF no partial key dependency. 3NF no transitive dependency. BCNF every determinant is a candidate key.

**When do you denormalize?** For proven read-performance needs (reports, aggregates), accepting write complexity and risk of inconsistency.

**Stored procedure vs function?** Procedures can modify data, return multiple result sets and manage transactions. Functions return a value and can be used in queries.

**Why avoid triggers? When use them?** They hide logic and cascade. Use them for auditing and integrity rules that cannot be expressed otherwise.

**View vs materialized view?** A view is a stored query (always fresh, no storage). A materialized view stores results (fast, needs refresh).

**Temp table vs table variable vs CTE?** Temp tables: stats and indexes, session scope. Table variables: lightweight, minimal stats. CTE: named query for one statement.

**Partitioning vs sharding?** Partitioning splits a table within one database server. Sharding distributes data across multiple servers.

**How do you scale a read-heavy database?** Indexes and tuning, caching, read replicas (mind the replication lag), then partitioning.

**How do you prevent SQL injection?** Parameterized queries or stored procedures, never string concatenation, whitelist dynamic identifiers, least privilege.

**What is the N+1 problem?** One query for the parent list plus one per child, instead of one joined or batched query.

**How would you make `COUNT(*)` on a billion-row table fast?** Maintain a counter or summary table, use approximate statistics, or cache. A true count requires scanning an index.

**How do you do pagination on a big table?** Keyset pagination (`WHERE (sort_col, id) > (:last_sort, :last_id) ORDER BY sort_col, id LIMIT n`) instead of deep `OFFSET`.
