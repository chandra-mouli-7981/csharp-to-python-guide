# Level 5 · Reference

## 5.1 Dialect cheat sheet

Function-level differences (dates, strings, casting) are in 2.6. This table covers the rest.

| Feature | SQL Server (T-SQL) | PostgreSQL | MySQL | Oracle |
|---|---|---|---|---|
| Limit rows | `TOP n`, or `OFFSET m ROWS FETCH NEXT n ROWS ONLY` | `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | `FETCH FIRST n ROWS ONLY` (12c+), older: `ROWNUM` |
| Auto-generated key | `IDENTITY(1,1)` | `GENERATED ALWAYS AS IDENTITY`, `SERIAL` | `AUTO_INCREMENT` | `GENERATED AS IDENTITY` (12c+), or a sequence |
| Get the new key | `OUTPUT inserted.id`, `SCOPE_IDENTITY()` | `RETURNING id` | `LAST_INSERT_ID()` | `RETURNING id INTO :v` |
| String concat | `+`, `CONCAT()` | `\|\|`, `CONCAT()` | `CONCAT()` | `\|\|` |
| Quote an identifier | `[name]` or `"name"` | `"name"` | `` `name` `` | `"name"` |
| Boolean type | `BIT` | `BOOLEAN` | `BOOLEAN` (alias of `TINYINT(1)`) | `NUMBER(1)` (`BOOLEAN` from 23ai) |
| Upsert | `MERGE` | `ON CONFLICT ... DO UPDATE` (15+: `MERGE`) | `ON DUPLICATE KEY UPDATE` | `MERGE` |
| Recursive CTE | `WITH` (no keyword) | `WITH RECURSIVE` | `WITH RECURSIVE` | `WITH` (no keyword) |
| `FULL OUTER JOIN` | Yes | Yes | **No** (emulate with `UNION`) | Yes |
| `INTERSECT` / `EXCEPT` | Both | Both | Both from 8.0.31 | `INTERSECT`, and **`MINUS`** instead of `EXCEPT` |
| `SELECT` with no `FROM` | Yes | Yes | Yes | `FROM DUAL` (until 23ai) |
| Temp table | `#temp` (session), `##temp` (global) | `CREATE TEMP TABLE` | `CREATE TEMPORARY TABLE` | `GLOBAL TEMPORARY TABLE` |
| Procedural language | T-SQL | PL/pgSQL (and others) | SQL/PSM-style stored programs | PL/SQL |
| Case-insensitive search | Default collation is usually case-insensitive | `ILIKE`, or `LOWER(col)` | Default collation is usually case-insensitive | `UPPER(col)`, or NLS settings |
| `''` equals `NULL`? | No | No | No | **Yes** |
| Partial / filtered index | Yes (filtered index) | Yes | No | Via function-based tricks |
| Transactional DDL | Yes | Yes | **No** (implicit commit) | **No** (implicit commit) |
| Default isolation | Read Committed | Read Committed | **Repeatable Read** | Read Committed |
| Show a plan | Actual execution plan, `SET SHOWPLAN_XML ON` | `EXPLAIN (ANALYZE)` | `EXPLAIN [ANALYZE]` | `EXPLAIN PLAN FOR` + `DBMS_XPLAN` |
| List tables | `INFORMATION_SCHEMA.TABLES`, `sys.tables` | `INFORMATION_SCHEMA.TABLES`, `\dt` | `INFORMATION_SCHEMA.TABLES`, `SHOW TABLES` | `ALL_TABLES`, `USER_TABLES` |
| Variables | `DECLARE @x INT = 5;` | PL/pgSQL `DECLARE x INT := 5;` | `SET @x = 5;` | PL/SQL `x NUMBER := 5;` |
| NULLs in `ORDER BY ASC` | First | **Last** | First | **Last** |

Handy habit: when asked a syntax question in an interview, say "In standard SQL it is X; in SQL Server it is Y." Showing that you know the standard *and* the dialect is a plus.

## 5.2 Common mistakes and traps

**NULL**

- `= NULL` / `<> NULL` instead of `IS [NOT] NULL`.
- `NOT IN` with a subquery that can return NULL, which returns nothing. Use `NOT EXISTS`.
- `COUNT(col)` skips NULLs, `COUNT(*)` does not. `AVG` ignores NULLs.
- `col <> 'x'` silently drops rows where `col` is NULL.
- Arithmetic or `+` concatenation with NULL gives NULL.

**Filtering and grouping**

- `AND`/`OR` without parentheses (`AND` binds first).
- Aggregate in `WHERE` (use `HAVING`), alias in `WHERE` (not visible yet).
- Selecting a non-grouped column (invalid in standard SQL, and silently arbitrary in lenient engines).
- `BETWEEN` on date-times, which drops the end day's afternoon. Use `>= start AND < next_day`.
- `SELECT DISTINCT` used to hide a join bug.
- `ORDER BY` assumed to be stable without being written, or `LIMIT`/`TOP` without `ORDER BY`.

**Joins**

- Missing or wrong `ON`, giving a Cartesian product.
- Right-table filter in `WHERE` of a `LEFT JOIN` (becomes an inner join). Put it in `ON`.
- Aggregating after a one-to-many join (fan-out and double counting).
- `COUNT(*)` over a `LEFT JOIN` (counts the unmatched row). Count a right-table column.
- Joining on a column that is NULL for some rows (never matches).
- Joining or comparing mismatched types (implicit conversion kills index use).

**Windows**

- Window function in `WHERE` (filter in an outer query or CTE).
- Default frame with ties (running totals not changing per row), and `LAST_VALUE` returning the current row.
- `ROW_NUMBER` without a tie-breaker (non-deterministic) or `RANK` where `DENSE_RANK` was wanted.

**Data modification**

- `UPDATE`/`DELETE` without `WHERE`.
- `INSERT` without a column list.
- Check-then-insert race (use a unique constraint and `ON CONFLICT`/`MERGE`).
- `TRUNCATE` assumed to be as rollback-safe as `DELETE` (not in MySQL/Oracle).
- Deleting a huge table in one transaction (log growth and lock escalation). Delete in batches.

**Performance**

- Function on an indexed column in `WHERE` (not sargable).
- `SELECT *`, deep `OFFSET` paging, `NOT IN`, row-by-row cursors, `OR` across columns.
- No index on foreign key or join columns.
- Over-indexing: every index slows writes.
- Stale statistics, parameter sniffing, implicit conversions.
- N+1 queries from the application layer.

**Types and arithmetic**

- Integer division (`7 / 2 = 3`). Cast first.
- `FLOAT` for money. Use `DECIMAL`.
- Time zones, and `DATETIME` vs `DATETIMEOFFSET`/`TIMESTAMPTZ`.
- `CHAR` padding in comparisons, and case-sensitive collations.

**Security**

- Concatenating user input into SQL. Always use parameters, and whitelist dynamic identifiers.
- Application accounts with `db_owner`/superuser rights.

## 5.3 How to answer in the interview

### For "write a query" questions

1. **Repeat the problem** in your own words and confirm the output columns.
2. **Ask about edge cases**: ties? NULLs? duplicates? What counts (completed orders only)? Which engine?
3. **Sketch the tables** and state the **grain** of the result.
4. **Say your plan** before typing: "join A to B, filter, group by X, then rank within Y."
5. **Build it up in steps** (CTEs), running each mentally on a small example.
6. **Check the edge cases** you raised, then **state the complexity and indexes** you would want.
7. **Offer an alternative** briefly ("this also works with a correlated subquery, but I prefer the window version because...").

If you freeze: write the `FROM`/`JOIN` skeleton first, then add `WHERE`, then think about aggregates. Partial, correct, well-explained SQL beats a silent attempt at a perfect one.

**Style that reads well on a whiteboard:** uppercase keywords, one clause per line, short meaningful table aliases (`o` for orders), qualify every column (`o.order_id`), and CTE names that describe the step (`monthly_revenue`, `ranked_orders`).

### For concept questions

Use **definition → example → trade-off or gotcha**. For example, for "What is an index?": "A sorted structure, usually a B-tree, that lets the DB seek instead of scan. For example an index on `orders(customer_id)` makes 'orders for customer 5' fast. The trade-off is slower writes and extra storage, so I index columns used in frequent filters and joins, and I verify with the execution plan."

### For "this is slow" questions

Use the 8-step checklist in 3.4: measure → read the actual plan → check statistics → check indexes → rewrite → check blocking → look at design → verify.

### For "design a schema" questions

Use the checklist in 3.6: entities and relationships, keys and types, normalize to 3NF, constraints, indexes for the main queries, then trade-offs.

### Questions you can ask at the end

- "Which database engines do you use, and how do you handle migrations?"
- "How do you monitor slow queries and review schema changes?"
- "Is the workload mostly OLTP, reporting, or both?"

## 5.4 Pattern → technique cram sheet

| When the question says... | Reach for |
|---|---|
| Nth highest / top N overall | `DENSE_RANK()` or `ORDER BY ... LIMIT/OFFSET` |
| Top N **per group** | `ROW_NUMBER`/`RANK`/`DENSE_RANK` `OVER (PARTITION BY ...)` in a CTE, filter outside |
| Latest / first row per group | `ROW_NUMBER() ... = 1` (with tie-breaker) |
| Find duplicates | `GROUP BY cols HAVING COUNT(*) > 1` |
| Delete duplicates | `ROW_NUMBER() > 1`, or `id NOT IN (SELECT MIN(id) ... GROUP BY ...)` |
| Rows with **no** match | `NOT EXISTS` / `LEFT JOIN ... IS NULL` |
| Has **all** of a set (A and B) | `WHERE x IN (...) GROUP BY ... HAVING COUNT(DISTINCT x) = N` |
| Running total / cumulative | `SUM() OVER (ORDER BY ... ROWS UNBOUNDED PRECEDING)` |
| Percentage of total | `x / SUM(x) OVER ()` (or `OVER (PARTITION BY ...)` for per-group share) |
| Compare with previous / next row | `LAG` / `LEAD` |
| Month-over-month / period change | Aggregate to the period in a CTE, then `LAG` |
| Consecutive days / streaks | `date - ROW_NUMBER()` constant, or `LAG` flag + running `SUM` |
| Sessions, merged intervals | `LAG`/`MAX() OVER` flag + running `SUM` |
| Rows to columns | `SUM(CASE WHEN ... THEN ... END)` (conditional aggregation) |
| Hierarchy / org chart / path | Recursive CTE |
| Missing numbers or dates | Generate a series (recursive CTE or calendar table) and anti-join, or `LEAD` gaps |
| Median / percentile | `ROW_NUMBER` + `COUNT`, or `PERCENTILE_CONT` |
| Pairs of rows in a table | Self join with `a.id < b.id` |
| Above/below average of own group | Correlated subquery, or `AVG() OVER (PARTITION BY ...)` |
| Compare to the overall average | Scalar subquery or `AVG() OVER ()` |
| Rolling N-day window | `ROWS` (row count) vs `RANGE` (value distance). Mind missing days |
| Top X% contributors | Running share of total, keep rows where the total **before** the row is under X% |
| Count with conditions | `SUM(CASE ...)` or `COUNT(CASE ...)` or `FILTER` |
| Safe division | `a / NULLIF(b, 0)` |
| Default for NULL | `COALESCE(x, default)` |

## 5.5 Self-test: answer these out loud

If you can answer all of these in about a minute each, you are ready. Section numbers show where to look when you cannot.

**Basics (Level 1)**

1. Order of execution of a `SELECT`, and what it implies for aliases and aggregates (1.6).
2. Why `WHERE col = NULL` fails, and the `NOT IN` + NULL trap (1.4).
3. `WHERE` vs `HAVING`. `COUNT(*)` vs `COUNT(col)` vs `COUNT(DISTINCT col)` (1.4, 1.5).
4. `DELETE` vs `TRUNCATE` vs `DROP` (1.7).
5. Primary key vs unique key vs foreign key, and candidate/composite/surrogate keys (1.8).

**Intermediate (Level 2)**

6. Draw the join types and say what each returns. Why a `LEFT JOIN` with a right-table `WHERE` condition becomes an inner join (2.1).
7. `UNION` vs `UNION ALL`. `INTERSECT`/`EXCEPT` (2.2).
8. Correlated subquery, `EXISTS` vs `IN`, and when you would use each (2.3).
9. What a CTE is, how a recursive CTE works, and its stop condition (2.4).
10. Conditional aggregation with `CASE` (2.5).

**Advanced (Level 3)**

11. `ROW_NUMBER` vs `RANK` vs `DENSE_RANK`, and top-N per group (3.1).
12. The default window frame and the `LAST_VALUE` trap (3.2).
13. Clustered vs non-clustered index, covering index, leftmost prefix, sargability (3.3).
14. A slow query: what do you do, step by step? (3.4)
15. ACID, isolation levels with anomalies, MVCC, deadlocks and how to avoid them (3.5).
16. Normal forms up to 3NF/BCNF and when to denormalize (3.6).
17. Procedure vs function vs trigger. Why avoid cursors (3.7).
18. Safe upsert, preventing a lost update, optimistic vs pessimistic locking (3.5, 3.8).
19. Partitioning vs sharding vs replication (3.9).
20. Parameterized queries, SQL injection, N+1 (3.10).

**Practice (Level 4):** re-solve E2/E3 (Nth highest), M1/M3 (per-group top), M5 (pivot), H1 (streaks) and H2 (median) from a blank page.

Good luck. Speak your reasoning, ask clarifying questions, and test your query against the edge cases you named.
