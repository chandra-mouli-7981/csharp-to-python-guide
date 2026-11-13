# Level 2 · Intermediate

## 2.1 Joins

A join combines rows from two tables based on a condition. Think of it as: *take every pairing of rows, keep the pairs where `ON` is true*, then (for outer joins) add back the unmatched rows from the preserved side.

| Join | Returns | Typical use |
|---|---|---|
| `INNER JOIN` | Only pairs that match | Employees **with** a department |
| `LEFT [OUTER] JOIN` | All left rows. Right columns are NULL where there is no match | All employees, even those without a department |
| `RIGHT [OUTER] JOIN` | All right rows. Left columns are NULL where there is no match | Same as LEFT with the tables swapped (most people just use LEFT) |
| `FULL [OUTER] JOIN` | All rows from both sides, matched where possible | Reconciliation: "what is in A but not B, and B but not A" |
| `CROSS JOIN` | Cartesian product (m × n rows), no `ON` | Generating combinations (every product × every month) |
| Self join | A table joined to itself (with aliases) | Employee → manager, hierarchies, comparing rows in one table |

### INNER JOIN

```sql run
SELECT e.name, d.dept_name
FROM employees e
INNER JOIN departments d ON d.dept_id = e.dept_id
ORDER BY e.emp_id;
```

```text out
name  | dept_name
------+------------
Alice | Engineering
Bob   | Engineering
Carol | Engineering
Dave  | Engineering
Eve   | Sales
Frank | Sales
Grace | Sales
Heidi | Sales
Ivan  | HR
Judy  | HR
Liam  | Engineering
```

Karl is missing because his `dept_id` is NULL, and NULL never matches anything. Eleven rows come back, not twelve.

### LEFT JOIN

```sql run
SELECT e.name, d.dept_name
FROM employees e
LEFT JOIN departments d ON d.dept_id = e.dept_id
WHERE e.emp_id IN (10, 11)
ORDER BY e.emp_id;
```

```text out
name | dept_name
-----+----------
Judy | HR
Karl | NULL
```

**Counting with a LEFT JOIN: count a column from the right table**, not `*`, or unmatched rows count as 1:

```sql run
SELECT d.dept_name,
       COUNT(*)        AS wrong_count,     -- counts the NULL-extended row
       COUNT(e.emp_id) AS right_count
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY d.dept_id;
```

```text out
dept_name   | wrong_count | right_count
------------+-------------+------------
Engineering | 5           | 5
Sales       | 4           | 4
HR          | 2           | 2
Marketing   | 1           | 0
```

### FULL OUTER JOIN

```sql run
-- Rows that have no partner on either side
SELECT e.name, d.dept_name
FROM employees e
FULL OUTER JOIN departments d ON d.dept_id = e.dept_id
WHERE e.emp_id IS NULL OR d.dept_id IS NULL;
```

```text out
name | dept_name
-----+----------
Karl | NULL
NULL | Marketing
```

MySQL has no `FULL JOIN`. Emulate it with `LEFT JOIN ... UNION ... RIGHT JOIN ...`.

### CROSS JOIN

```sql run
-- 4 departments x 3 product categories = 12 combinations
SELECT COUNT(*) AS combinations
FROM departments
CROSS JOIN (SELECT DISTINCT category FROM products) AS c;
```

```text out
combinations
------------
12
```

Forgetting the `ON` clause (or writing `FROM a, b` with no `WHERE`) gives an accidental cross join: the classic "my query returns millions of rows" bug.

### Self join: employee and manager

```sql run
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.emp_id = e.manager_id     -- LEFT so the CEO (no manager) still appears
ORDER BY e.emp_id;
```

```text out
employee | manager
---------+--------
Alice    | NULL
Bob      | Alice
Carol    | Alice
Dave     | Bob
Eve      | Alice
Frank    | Eve
Grace    | Eve
Heidi    | Eve
Ivan     | Alice
Judy     | Ivan
Karl     | Alice
Liam     | Carol
```

### Non-equi join (join on a range)

```sql run
SELECT e.name, e.salary, b.band
FROM employees e
JOIN (SELECT 'junior' AS band, 0      AS low, 69999  AS high
      UNION ALL SELECT 'mid',   70000,         119999
      UNION ALL SELECT 'senior',120000,        999999) b
  ON e.salary BETWEEN b.low AND b.high
ORDER BY e.salary DESC, e.name;
```

```text out
name  | salary | band
------+--------+-------
Alice | 150000 | senior
Liam  | 130000 | senior
Bob   | 120000 | senior
Carol | 120000 | senior
Eve   | 110000 | mid
Dave  | 95000  | mid
Ivan  | 80000  | mid
Frank | 70000  | mid
Grace | 70000  | mid
Judy  | 65000  | junior
Heidi | 60000  | junior
Karl  | 50000  | junior
```

### ON vs WHERE in outer joins (a favourite trap)

With an `INNER JOIN` it makes no difference where you put a filter. With a `LEFT JOIN` it matters a lot:

```sql run
-- Filter in ON: customers without completed orders are still listed (count 0)
SELECT c.name, COUNT(o.order_id) AS completed_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'completed'
GROUP BY c.customer_id, c.name
ORDER BY c.customer_id;
```

```text out
name | completed_orders
-----+-----------------
Asha | 3
Ben  | 2
Chen | 1
Dina | 1
Eli  | 0
```

```sql run
-- Filter in WHERE: runs AFTER the join; NULL-extended rows fail it, so Eli disappears.
-- The LEFT JOIN has silently become an INNER JOIN.
SELECT c.name, COUNT(o.order_id) AS completed_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
GROUP BY c.customer_id, c.name
ORDER BY c.customer_id;
```

```text out
name | completed_orders
-----+-----------------
Asha | 3
Ben  | 2
Chen | 1
Dina | 1
```

**Rule of thumb:** conditions on the *preserved* (left) table go in `WHERE`. Conditions on the *optional* (right) table go in `ON`.

### Fan-out: the double-counting bug

Joining a parent to a one-to-many child multiplies the parent's rows. Aggregating parent-level values afterwards over-counts.

```sql run
SELECT c.name,
       COUNT(*)                   AS rows_after_joins,   -- one per order line
       COUNT(DISTINCT o.order_id) AS real_orders
FROM customers c
JOIN orders o      ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
GROUP BY c.customer_id, c.name
ORDER BY c.customer_id;
```

```text out
name | rows_after_joins | real_orders
-----+------------------+------------
Asha | 5                | 3
Ben  | 4                | 2
Chen | 2                | 2
Dina | 2                | 2
```

Fixes: `COUNT(DISTINCT ...)` (only good for counts), **aggregate the child first in a subquery or CTE and then join**, or use a window function.

### A realistic multi-table join

```sql run
-- Revenue by product category, completed orders only
SELECT p.category, SUM(i.qty * i.unit_price) AS revenue
FROM orders o
JOIN order_items i ON i.order_id   = o.order_id
JOIN products    p ON p.product_id = i.product_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY revenue DESC;
```

```text out
category    | revenue
------------+--------
Electronics | 3400
Furniture   | 1610
Stationery  | 30
```

### Anti-join and semi-join (name the pattern in interviews)

| Pattern | Meaning | Best forms |
|---|---|---|
| **Semi-join** | Rows in A that **have** a match in B (no duplication) | `WHERE EXISTS (...)`, `WHERE x IN (SELECT ...)` |
| **Anti-join** | Rows in A that have **no** match in B | `WHERE NOT EXISTS (...)`, or `LEFT JOIN ... WHERE b.key IS NULL`. **Avoid `NOT IN`** when the subquery column can be NULL |

### Other join syntax

- `USING (col)`: `JOIN departments USING (dept_id)` for same-named columns (not in SQL Server).
- `NATURAL JOIN`: joins on *all* same-named columns automatically. **Avoid it**: adding a column to either table silently changes the query.
- Old-style `FROM a, b WHERE a.id = b.id` still works, but explicit `JOIN ... ON` is clearer and prevents accidental cross joins.
- You can join a table to a subquery (a **derived table**), as in the salary-band example above.

## 2.2 Set operators

Set operators stack **rows** from two queries (joins add **columns**).

| Operator | Result | Duplicates |
|---|---|---|
| `UNION` | Rows in either query | Removed (needs a sort or hash step) |
| `UNION ALL` | Rows in either query | **Kept**, so it is faster |
| `INTERSECT` | Rows in both | Removed |
| `EXCEPT` (`MINUS` in Oracle) | Rows in the first but not the second | Removed |

**Rules:** both queries need the same number of columns with compatible types. Column names come from the **first** query. `ORDER BY` goes once, at the very end. `INTERSECT` binds tighter than `UNION`/`EXCEPT` in the standard (use parentheses to be explicit). MySQL supports `INTERSECT`/`EXCEPT` from 8.0.31.

```sql run
-- Products that were never sold
SELECT product_id, name FROM products
EXCEPT
SELECT p.product_id, p.name FROM products p JOIN order_items i ON i.product_id = p.product_id;
```

```text out
product_id | name
-----------+---------
6          | Notebook
```

```sql run
-- Customers who have BOTH a completed and a pending order
SELECT customer_id FROM orders WHERE status = 'completed'
INTERSECT
SELECT customer_id FROM orders WHERE status = 'pending';
```

```text out
customer_id
-----------
4
```

```sql run
-- One list of all people; UNION ALL because the sets cannot overlap and we want speed
SELECT name, 'employee' AS kind FROM employees WHERE emp_id <= 2
UNION ALL
SELECT name, 'customer' AS kind FROM customers WHERE customer_id <= 2
ORDER BY kind, name;
```

```text out
name  | kind
------+---------
Asha  | customer
Ben   | customer
Alice | employee
Bob   | employee
```

**UNION vs UNION ALL**: default to `UNION ALL` unless you truly need de-duplication, because `UNION` pays for a sort or hash of the whole result. NULLs are treated as equal for de-duplication.

## 2.3 Subqueries

A **subquery** is a `SELECT` nested inside another statement.

| Kind | Where it appears | Returns |
|---|---|---|
| Scalar | `SELECT` list, `WHERE`, `SET` | Exactly 1 row × 1 column |
| Row / column | `IN (...)`, `= ANY (...)` | A list of values |
| Table (**derived table**) | `FROM (...) AS alias` | A result set. **Alias is required** |
| Correlated | Any of the above, referencing the outer query | Re-evaluated *logically* per outer row |

```sql run
-- Scalar subquery: above the company average
SELECT name, salary FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC, name;
```

```text out
name  | salary
------+-------
Alice | 150000
Liam  | 130000
Bob   | 120000
Carol | 120000
Eve   | 110000
Dave  | 95000
```

If a scalar subquery returns more than one row, the query errors (or in a few engines silently takes one row). It returns NULL when it finds none.

```sql run
-- Correlated subquery: above the average of THEIR OWN department
SELECT e.name, e.dept_id, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(x.salary) FROM employees x WHERE x.dept_id = e.dept_id)
ORDER BY e.emp_id;
```

```text out
name  | dept_id | salary
------+---------+-------
Alice | 1       | 150000
Eve   | 2       | 110000
Ivan  | 3       | 80000
Liam  | 1       | 130000
```

Karl never matches because `x.dept_id = NULL` finds nothing, so his subquery average is NULL.

```sql run
-- Derived table: aggregate first, then join back to the detail
SELECT e.name, e.salary, s.avg_salary
FROM employees e
JOIN (SELECT dept_id, AVG(salary) AS avg_salary FROM employees GROUP BY dept_id) AS s
  ON s.dept_id = e.dept_id
WHERE e.salary > s.avg_salary
ORDER BY e.emp_id;
```

```text out
name  | salary | avg_salary
------+--------+-----------
Alice | 150000 | 123000
Eve   | 110000 | 77500
Ivan  | 80000  | 72500
Liam  | 130000 | 123000
```

The correlated and derived-table versions give the same answer. The derived table computes each average once, which is often faster on engines that do not decorrelate automatically.

```sql run
-- EXISTS: customers with at least one completed order
SELECT c.name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status = 'completed')
ORDER BY c.customer_id;
```

```text out
name
----
Asha
Ben
Chen
Dina
```

```sql run
-- Scalar subquery in the SELECT list
SELECT c.name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS orders_placed
FROM customers c
ORDER BY c.customer_id;
```

```text out
name | orders_placed
-----+--------------
Asha | 3
Ben  | 2
Chen | 2
Dina | 2
Eli  | 0
```

### `IN` vs `EXISTS`

| | `IN (subquery)` | `EXISTS (subquery)` |
|---|---|---|
| Idea | Is the value in the list? | Does at least one matching row exist? |
| NULLs | `NOT IN` breaks if the list has a NULL | `NOT EXISTS` is NULL-safe |
| Duplicates in subquery | Harmless | Harmless (stops at first match) |
| Performance | Modern optimizers usually produce the **same plan** for both | |

The "EXISTS is always faster" claim is mostly folklore today. **Correctness (NULL handling) is the real reason to prefer `NOT EXISTS`.**

### ANY / ALL (supported by most engines, but not SQLite)

```sql
-- PostgreSQL / MySQL / Oracle / SQL Server (ANY and SOME are synonyms)
SELECT name FROM employees WHERE salary > ALL (SELECT salary FROM employees WHERE dept_id = 2);  -- above EVERY Sales salary
SELECT name FROM employees WHERE salary > ANY (SELECT salary FROM employees WHERE dept_id = 2);  -- above AT LEAST ONE
-- Equivalents: > ALL  ==  > (SELECT MAX(...))      > ANY  ==  > (SELECT MIN(...))
-- `= ANY (...)` is the same as `IN (...)`.  Empty subquery: ALL is TRUE, ANY is FALSE.
```

### Subquery or join?

- Need columns from the other table? Use a **join**.
- Only testing existence? Use **EXISTS**.
- Need an aggregate per group alongside detail? **Derived table / CTE**, or a **window function** (3.1).
- Optimizers can often rewrite one into the other, so write whichever is clearer, then check the plan if it is slow.

## 2.4 Common Table Expressions (CTEs)

A CTE is a named, temporary result set that exists for **one statement**. Its main value is **readability**: break a complex query into named steps.

```sql run
WITH dept_stats AS (
  SELECT dept_id, AVG(salary) AS avg_salary, COUNT(*) AS headcount
  FROM employees
  WHERE dept_id IS NOT NULL
  GROUP BY dept_id
),
big_depts AS (                                 -- a CTE can read earlier CTEs
  SELECT dept_id, avg_salary FROM dept_stats WHERE headcount >= 4
)
SELECT d.dept_name, ROUND(b.avg_salary) AS avg_salary
FROM big_depts b
JOIN departments d ON d.dept_id = b.dept_id
ORDER BY d.dept_name;
```

```text out
dept_name   | avg_salary
------------+-----------
Engineering | 123000
Sales       | 77500
```

| | CTE | Subquery (derived table) | Temp table | View |
|---|---|---|---|---|
| Lifetime | One statement | One statement | Session (or until dropped) | Permanent definition |
| Reusable within the statement | Yes (reference it many times) | No (repeat it) | Yes, and across statements | Yes |
| Stores data | No (usually inlined) | No | **Yes**, can be indexed, has statistics | No (unless materialized) |
| Best for | Readability, recursion | Simple one-off steps | Big intermediate results reused several times | Shared logic and security |

> A CTE is **not** a performance feature. SQL Server never materializes a CTE (a CTE referenced twice may be computed twice). PostgreSQL 12+ inlines a CTE that is referenced once unless you write `MATERIALIZED`. If one intermediate result is expensive and reused, consider a temp table.

### Recursive CTEs (hierarchies and series)

A recursive CTE has an **anchor** member (the start), then `UNION ALL`, then a **recursive** member that references the CTE itself. It repeats until the recursive step returns no rows.

```sql run
-- Generate a number series
WITH RECURSIVE nums(n) AS (
  SELECT 1                                  -- anchor
  UNION ALL
  SELECT n + 1 FROM nums WHERE n < 5        -- recursive step + stop condition
)
SELECT n FROM nums;
```

```text out
n
-
1
2
3
4
5
```

```sql run
-- Walk the org chart: depth and full reporting path
WITH RECURSIVE org AS (
  SELECT emp_id, name, 0 AS depth, name AS path
  FROM employees WHERE manager_id IS NULL                      -- anchor: the root
  UNION ALL
  SELECT e.emp_id, e.name, o.depth + 1, o.path || ' > ' || e.name
  FROM employees e
  JOIN org o ON e.manager_id = o.emp_id                        -- children of rows found so far
)
SELECT depth, path FROM org ORDER BY path;
```

```text out
depth | path
------+---------------------
0     | Alice
1     | Alice > Bob
2     | Alice > Bob > Dave
1     | Alice > Carol
2     | Alice > Carol > Liam
1     | Alice > Eve
2     | Alice > Eve > Frank
2     | Alice > Eve > Grace
2     | Alice > Eve > Heidi
1     | Alice > Ivan
2     | Alice > Ivan > Judy
1     | Alice > Karl
```

**Interview details:**

- Syntax: PostgreSQL, MySQL, SQLite need `WITH RECURSIVE`. **SQL Server and Oracle omit the word `RECURSIVE`** (just `WITH`).
- **Infinite loops**: cyclic data (A manages B manages A) never ends. Add a depth limit (`WHERE depth < 20`), track visited ids in a path, or in PostgreSQL 14+ use the `CYCLE` clause. SQL Server stops at `MAXRECURSION` (default **100**, raise it with `OPTION (MAXRECURSION n)`).
- Use `UNION ALL`. Plain `UNION` de-duplicates each round (more expensive, and not allowed in SQL Server).
- Typical uses: org charts, category trees, bill of materials, graph reachability, date or number generation.

## 2.5 CASE expressions and conditional aggregation

`CASE` is SQL's if/else *expression*. It returns a value, so it works in `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY` and inside aggregates.

```sql run
SELECT name, salary,
       CASE WHEN salary >= 120000 THEN 'senior'     -- searched CASE: evaluated top to bottom,
            WHEN salary >= 70000  THEN 'mid'        -- the FIRST true branch wins
            ELSE 'junior'                           -- without ELSE, no match gives NULL
       END AS band
FROM employees
ORDER BY salary DESC, name
LIMIT 6;
```

```text out
name  | salary | band
------+--------+-------
Alice | 150000 | senior
Liam  | 130000 | senior
Bob   | 120000 | senior
Carol | 120000 | senior
Eve   | 110000 | mid
Dave  | 95000  | mid
```

Simple form: `CASE status WHEN 'completed' THEN 1 WHEN 'pending' THEN 0 END` (equality comparison only). Shorthands: `IIF(cond, a, b)` (SQL Server 2012+, SQLite 3.32+), `IF(cond, a, b)` (MySQL).

### Conditional aggregation (pivot-style counts)

Put a `CASE` *inside* an aggregate to count or sum subsets in a single pass:

```sql run
SELECT dept_id,
       COUNT(*)                                          AS total,
       SUM(CASE WHEN salary >= 100000 THEN 1 ELSE 0 END) AS high_earners,
       COUNT(CASE WHEN salary < 70000 THEN 1 END)        AS low_earners   -- COUNT ignores the NULLs CASE produces
FROM employees
GROUP BY dept_id
ORDER BY dept_id;
```

```text out
dept_id | total | high_earners | low_earners
--------+-------+--------------+------------
NULL    | 1     | 0            | 1
1       | 5     | 4            | 0
2       | 4     | 1            | 1
3       | 2     | 0            | 1
```

This is also how you "pivot" rows to columns portably (see the pivot problem in Level 4).

- All `THEN`/`ELSE` branches must resolve to a compatible type.
- Do not rely on `CASE` evaluation order to prevent errors. For example, SQL Server may evaluate an aggregate inside a `CASE` branch before testing the `WHEN` condition, so a `CASE` cannot always guard a risky aggregate such as `MIN(CAST(x AS INT))`.
- `CASE` in `ORDER BY` gives custom sort orders: `ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, order_date`.

## 2.6 Functions: strings, numbers, dates, casting

Core concepts first, then the dialect table.

```sql run
SELECT UPPER(name)                      AS upper_name,
       LENGTH(name)                     AS len,
       SUBSTR(name, 1, 3)               AS first3,
       REPLACE(name, 'a', '@')          AS replaced,
       name || ' (dept ' || dept_id || ')' AS label
FROM employees
WHERE emp_id IN (1, 4)
ORDER BY emp_id;
```

```text out
upper_name | len | first3 | replaced | label
-----------+-----+--------+----------+---------------
ALICE      | 5   | Ali    | Alice    | Alice (dept 1)
DAVE       | 4   | Dav    | D@ve     | Dave (dept 1)
```

**Integer division is a classic gotcha.** In SQL Server, PostgreSQL and SQLite, `int / int` is an `int`:

```sql run
SELECT 7 / 2          AS int_div,        -- 3 (not 3.5)
       7 / 2.0        AS decimal_div,    -- 3.5
       7 % 2          AS modulo,         -- 1
       CAST(7 AS REAL) / 2 AS cast_div;  -- 3.5
```

```text out
int_div | decimal_div | modulo | cast_div
--------+-------------+--------+---------
3       | 3.5         | 1      | 3.5
```

MySQL and Oracle behave differently: `7 / 2` is `3.5`, and MySQL uses `DIV` for integer division. The safe habit is an explicit cast or a decimal literal (`* 1.0`) whenever you want a ratio or percentage.

**Dates in SQLite** (the engine behind the outputs here; the dialect table below shows the other engines):

```sql run
SELECT order_id, order_date,
       strftime('%Y-%m', order_date)                                    AS year_month,
       date(order_date, '+30 days')                                     AS plus_30_days,
       CAST(julianday('2024-04-30') - julianday(order_date) AS INTEGER) AS days_before_apr30
FROM orders
WHERE order_id IN (1, 9)
ORDER BY order_id;
```

```text out
order_id | order_date | year_month | plus_30_days | days_before_apr30
---------+------------+------------+--------------+------------------
1        | 2024-01-05 | 2024-01    | 2024-02-04   | 116
9        | 2024-04-02 | 2024-04    | 2024-05-02   | 28
```

### Dialect cheat sheet for functions

| Task | PostgreSQL | SQL Server | MySQL |
|---|---|---|---|
| Concatenate | `a \|\| b`, `CONCAT(a,b)` | `a + b`, `CONCAT(a,b)` | `CONCAT(a,b)` |
| Length | `LENGTH(s)`, `CHAR_LENGTH(s)` | `LEN(s)` (ignores trailing spaces), `DATALENGTH` = bytes | `CHAR_LENGTH(s)`. `LENGTH` = bytes |
| Substring | `SUBSTRING(s, start, len)` | `SUBSTRING(s, start, len)` (len required) | `SUBSTRING(s, start, len)` |
| Find position | `POSITION('x' IN s)`, `STRPOS` | `CHARINDEX('x', s)` | `LOCATE('x', s)`, `INSTR(s, 'x')` |
| Trim | `TRIM`, `LTRIM`, `RTRIM` | `TRIM` (2017+), `LTRIM`, `RTRIM` | `TRIM`, `LTRIM`, `RTRIM` |
| Now | `NOW()`, `CURRENT_TIMESTAMP` | `GETDATE()`, `SYSDATETIME()`, `SYSUTCDATETIME()` | `NOW()` |
| Today | `CURRENT_DATE` | `CAST(GETDATE() AS DATE)` | `CURDATE()` |
| Add days | `d + INTERVAL '7 days'` | `DATEADD(day, 7, d)` | `DATE_ADD(d, INTERVAL 7 DAY)` |
| Days between | `d2 - d1` (for `DATE`) | `DATEDIFF(day, d1, d2)` | `DATEDIFF(d2, d1)` |
| Year/month part | `EXTRACT(YEAR FROM d)` | `YEAR(d)`, `DATEPART(month, d)` | `YEAR(d)`, `EXTRACT(...)` |
| First day of month | `DATE_TRUNC('month', d)` | `DATETRUNC(month, d)` (2022+), or `DATEFROMPARTS(YEAR(d), MONTH(d), 1)` | `DATE_FORMAT(d, '%Y-%m-01')` |
| End of month | `DATE_TRUNC('month', d) + INTERVAL '1 month - 1 day'` | `EOMONTH(d)` | `LAST_DAY(d)` |
| Format date | `TO_CHAR(d, 'YYYY-MM')` | `FORMAT(d, 'yyyy-MM')` (slow, CLR based) | `DATE_FORMAT(d, '%Y-%m')` |
| Cast | `CAST(x AS INT)`, `x::int` | `CAST`, `CONVERT(INT, x)`, `TRY_CAST` (NULL on failure) | `CAST`, `CONVERT(x, SIGNED)` |
| NULL default | `COALESCE` | `ISNULL(a,b)`, `COALESCE` | `IFNULL(a,b)`, `COALESCE` |
| Join strings per group | `STRING_AGG(x, ', ' ORDER BY x)` | `STRING_AGG(x, ', ') WITHIN GROUP (ORDER BY x)` (2017+) | `GROUP_CONCAT(x ORDER BY x SEPARATOR ', ')` |
| Random | `RANDOM()` | `NEWID()` for random order, `RAND()` | `RAND()` |

**Date gotchas worth mentioning**

- `DATEDIFF(year, '2023-12-31', '2024-01-01')` in SQL Server is **1**: it counts *boundaries crossed*, not elapsed time.
- Wrapping an indexed column in a function (`WHERE YEAR(order_date) = 2024`) prevents index seeks. Use a range instead: `order_date >= '2024-01-01' AND order_date < '2025-01-01'` (see "sargable" in 3.3).
- Time zones: store UTC, convert for display.

```sql run
-- String aggregation (SQLite spells it group_concat / string_agg)
SELECT d.dept_name, string_agg(e.name, ', ' ORDER BY e.name) AS people
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name
ORDER BY d.dept_id;
```

```text out
dept_name   | people
------------+------------------------------
Engineering | Alice, Bob, Carol, Dave, Liam
Sales       | Eve, Frank, Grace, Heidi
HR          | Ivan, Judy
Marketing   | NULL
```

## 2.7 Views

A **view** is a saved `SELECT` with a name. It stores the *query*, not the data, so it is always current.

```sql run
CREATE VIEW dept_summary AS
SELECT d.dept_id, d.dept_name,
       COUNT(e.emp_id)            AS headcount,
       COALESCE(SUM(e.salary), 0) AS payroll
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
GROUP BY d.dept_id, d.dept_name;

SELECT * FROM dept_summary ORDER BY dept_id;
```

```text out
dept_id | dept_name   | headcount | payroll
--------+-------------+-----------+--------
1       | Engineering | 5         | 615000
2       | Sales       | 4         | 310000
3       | HR          | 2         | 145000
4       | Marketing   | 0         | 0
```

**Why views:** hide complexity, give a stable interface when tables change, restrict access (expose some columns or rows only, `GRANT SELECT` on the view), and reuse logic.

**Things to know**

- A plain view does not speed anything up, because the engine expands it into the outer query.
- `ORDER BY` inside a view is not allowed in SQL Server (without `TOP`), and meaningless elsewhere, so sort in the outer query.
- Simple single-table views are **updatable**. Views with joins, `GROUP BY`, `DISTINCT` or aggregates generally are not. `WITH CHECK OPTION` stops inserts or updates through the view that would make the row disappear from it.
- **Materialized view**: stores the result physically, which is fast to read but must be refreshed (PostgreSQL `REFRESH MATERIALIZED VIEW`, Oracle, and SQL Server's *indexed views*). Covered in 3.7.

## 2.8 Quick-fire Q&A (Intermediate)

**INNER vs LEFT vs FULL join?** Matches only. All left rows plus matches. All rows from both sides plus matches.

**How do you find rows in A with no match in B?** `NOT EXISTS`, or `LEFT JOIN ... WHERE b.key IS NULL`. Avoid `NOT IN` when NULLs are possible.

**What is a self join? Give a use case.** A table joined to itself via aliases. Employee → manager, or "find pairs of rows in the same table that share a value".

**What happens if the join condition is missing?** A Cartesian product (m × n rows).

**Why did my LEFT JOIN behave like an INNER JOIN?** A `WHERE` condition on the right table's column filters out the NULL-extended rows. Move it into `ON`.

**Why are my counts too high after joining?** Fan-out from a one-to-many join. Aggregate the child first, or use `COUNT(DISTINCT ...)`.

**`UNION` vs `UNION ALL`?** `UNION` removes duplicates (extra sort or hash), `UNION ALL` does not and is faster.

**`INTERSECT` vs `INNER JOIN`?** `INTERSECT` compares whole rows, treats NULLs as equal, and removes duplicates. A join compares the keys you name, and NULLs never match.

**What is a correlated subquery?** A subquery that references the outer query, so it is logically re-evaluated for each outer row. It can be slow, and is often rewritable as a join or a window function.

**`IN` vs `EXISTS`?** Same result for positive tests. `NOT EXISTS` is safer than `NOT IN` because of NULLs. Performance is usually equal in modern optimizers.

**What is a CTE and how is it different from a subquery or temp table?** A named query scoped to one statement. It is better readability, it can be recursive, and it is not stored (a temp table is stored and can be indexed).

**How does a recursive CTE work?** Anchor member, then `UNION ALL`, then a recursive member that joins back to the CTE, repeating until no new rows appear. Guard against cycles.

**What is the difference between a view and a table? A view and a CTE?** A view is a stored query with no data of its own, and is permanent. A CTE is a named query that lives for one statement.

**When would you use `COALESCE` vs `ISNULL`?** `COALESCE` is standard, takes many arguments, and is portable. `ISNULL` is SQL Server only, takes two, and the result type follows the first argument.

**How do you conditionally count?** `SUM(CASE WHEN cond THEN 1 ELSE 0 END)` or `COUNT(CASE WHEN cond THEN 1 END)`. Some engines also have `COUNT(*) FILTER (WHERE cond)` (PostgreSQL, SQLite).

**How do you find out how many rows an `INSERT`/`UPDATE`/`DELETE` affected?** `@@ROWCOUNT` (SQL Server), `ROW_COUNT()` (MySQL), `GET DIAGNOSTICS ... = ROW_COUNT` (PostgreSQL PL/pgSQL), or `cursor.rowcount` / `ExecuteNonQuery()`'s return value from Python and C# drivers.

**What is a derived table?** A subquery in the `FROM` clause. It must have an alias.

**What does `SELECT 1 FROM ...` inside `EXISTS` mean?** Nothing special. `EXISTS` only checks whether any row comes back, so the select list is ignored. `SELECT *` works the same.

**Can a subquery return multiple columns?** In `FROM` (derived table) yes. In `IN` it must be one column, unless you use row values: `(a, b) IN (SELECT x, y ...)`. SQL Server does not support row-value `IN`.
