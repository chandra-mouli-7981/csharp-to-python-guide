# Level 1 · Basics

## 1.1 What SQL is and its statement families

**SQL (Structured Query Language)** is the standard *declarative* language for relational databases. You describe **what** result you want, and the **query optimizer** decides **how** to get it (which indexes, which join order). That is the biggest mindset shift from C# or Python, where you write the loop yourself.

| Family | Stands for | Statements | Purpose |
|---|---|---|---|
| **DQL** | Data Query | `SELECT` | Read data |
| **DML** | Data Manipulation | `INSERT`, `UPDATE`, `DELETE`, `MERGE` | Change rows |
| **DDL** | Data Definition | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` | Change structure |
| **DCL** | Data Control | `GRANT`, `REVOKE` (`DENY` in SQL Server) | Permissions |
| **TCL** | Transaction Control | `BEGIN`/`START TRANSACTION`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` | Group statements atomically |

Some sources put `SELECT` under DML. Say "DQL, or DML in some classifications" and move on.

**Relational vocabulary**: table = *relation*, row = *tuple/record*, column = *attribute/field*. An **RDBMS** (SQL Server, PostgreSQL, MySQL, Oracle, SQLite) stores data in related tables and enforces integrity with keys and constraints.

**Things that vary by engine and trip people up**

- Keywords are case-insensitive (`select` = `SELECT`). Whether **string comparison** is case-sensitive depends on the **collation**: SQL Server and MySQL default to case-insensitive, PostgreSQL is case-sensitive.
- Statement terminator `;` is required by most engines for multi-statement scripts. SQL Server tolerates a missing one, except before `WITH` (CTE).
- Identifier quoting: `"name"` (standard, PostgreSQL), `[name]` (SQL Server), `` `name` `` (MySQL). Avoid reserved words as column names.

## 1.2 Data types you must know

| Category | Typical types | Interview notes |
|---|---|---|
| Whole numbers | `TINYINT`, `SMALLINT`, `INT`, `BIGINT` | `INT` is 4 bytes (about ±2.1 billion). Use `BIGINT` for ids that can outgrow it |
| Exact decimals | `DECIMAL(p,s)` / `NUMERIC(p,s)` | `p` = total digits, `s` = digits after the point. **Use for money** |
| Approximate | `FLOAT`, `REAL`, `DOUBLE PRECISION` | Binary floating point, so `0.1 + 0.2 != 0.3` exactly as in C# `double` or Python `float`. **Never for money** |
| Text | `CHAR(n)`, `VARCHAR(n)`, `TEXT`, `NVARCHAR(n)` | `CHAR` is fixed length (padded). `VARCHAR` is variable length. `NVARCHAR` (SQL Server) stores Unicode |
| Date/time | `DATE`, `TIME`, `DATETIME2` / `TIMESTAMP`, `DATETIMEOFFSET` / `TIMESTAMPTZ` | Store timestamps in **UTC**, convert at the edges. Prefer `DATETIME2` over legacy `DATETIME` in SQL Server |
| Boolean | `BOOLEAN` (PG, MySQL), `BIT` (SQL Server) | |
| Binary | `VARBINARY`, `BYTEA`, `BLOB` | Prefer file storage with a path in the DB for large files |
| Identifier | `UNIQUEIDENTIFIER` (SQL Server), `UUID` (PG) | Random GUID primary keys cause **index fragmentation** and page splits. Use sequential ids where you can |
| Semi-structured | `JSON`, `JSONB` (PG), `XML` | Handy, but you lose constraints and cheap filtering |

**Q: `CHAR` vs `VARCHAR`?** `CHAR(n)` always uses `n` characters (right-padded), so it is good only for truly fixed-length codes (country code `'IN'`). `VARCHAR(n)` stores the actual length plus a small overhead.

**Q: Why not `FLOAT` for money?** Binary floating point cannot represent most decimal fractions exactly, so errors accumulate and totals will not match to the cent. Use `DECIMAL(19,4)` or store integer minor units (paise or cents).

**Q: `DATETIME` vs `TIMESTAMP`?** The names mean different things per engine. In MySQL, `TIMESTAMP` is stored as UTC and converted to the session time zone, with a limited range (1970 to **2038**), while `DATETIME` is stored as written with a much wider range. In SQL Server, `TIMESTAMP` is *not* a date at all, it is a row-version counter (`ROWVERSION`). Always say which engine you mean.

## 1.3 SELECT, WHERE, ORDER BY, DISTINCT, row limiting

```sql run
SELECT name, salary, salary * 12 AS annual_salary
FROM employees
WHERE salary >= 100000
ORDER BY salary DESC, name;
```

```text out
name  | salary | annual_salary
------+--------+--------------
Alice | 150000 | 1800000
Liam  | 130000 | 1560000
Bob   | 120000 | 1440000
Carol | 120000 | 1440000
Eve   | 110000 | 1320000
```

- `AS alias` renames a column or table. The `AS` is optional, but explicit is clearer.
- Avoid `SELECT *` in application code. It reads unneeded columns, defeats covering indexes, and breaks when the schema changes.

### Filtering operators

| Operator | Meaning | Gotcha |
|---|---|---|
| `=`, `<>` (or `!=`), `<`, `>`, `<=`, `>=` | Comparison | Any comparison with `NULL` is *unknown* (see 1.4) |
| `AND`, `OR`, `NOT` | Logic | **`AND` binds tighter than `OR`** |
| `IN (a, b, c)` | Matches any listed value | `NOT IN` + `NULL` is a trap (see 1.4) |
| `BETWEEN a AND b` | `>= a AND <= b` | **Inclusive on both ends** |
| `LIKE 'pat'` | `%` = any run of characters, `_` = exactly one | Leading `%` cannot use an index |
| `IS NULL` / `IS NOT NULL` | NULL test | `= NULL` never works |

**`AND`/`OR` precedence.** The first query below does not do what people expect:

```sql run
-- Reads as: dept 1  OR  (dept 2 AND salary > 100000)
SELECT name, dept_id, salary FROM employees
WHERE dept_id = 1 OR dept_id = 2 AND salary > 100000
ORDER BY emp_id;
```

```text out
name  | dept_id | salary
------+---------+-------
Alice | 1       | 150000
Bob   | 1       | 120000
Carol | 1       | 120000
Dave  | 1       | 95000
Eve   | 2       | 110000
Liam  | 1       | 130000
```

```sql run
-- Probably intended: (dept 1 OR dept 2) AND salary > 100000
SELECT name, dept_id, salary FROM employees
WHERE (dept_id = 1 OR dept_id = 2) AND salary > 100000
ORDER BY emp_id;
```

```text out
name  | dept_id | salary
------+---------+-------
Alice | 1       | 150000
Bob   | 1       | 120000
Carol | 1       | 120000
Eve   | 2       | 110000
Liam  | 1       | 130000
```

**`LIKE`**

```sql run
SELECT name FROM employees WHERE name LIKE '_a%' ORDER BY name;   -- 2nd letter is 'a'
```

```text out
name
-----
Carol
Dave
Karl
```

To match a literal `%` or `_`, escape it: `LIKE '50\%%' ESCAPE '\'`.

**`BETWEEN` and dates.** If the column holds a time portion, `BETWEEN '2024-01-01' AND '2024-01-31'` silently drops everything after midnight on the 31st. Prefer a half-open range, which is also index-friendly:

```sql run
SELECT order_id, order_date FROM orders
WHERE order_date >= '2024-02-01' AND order_date < '2024-03-01'
ORDER BY order_id;
```

```text out
order_id | order_date
---------+-----------
3        | 2024-02-03
4        | 2024-02-14
5        | 2024-02-28
```

### ORDER BY

- Without `ORDER BY` the row order is **not guaranteed**, even if it looks stable today.
- You can sort by several columns, by an alias, by an expression, or by position (`ORDER BY 2`; avoid it because it is fragile).
- **NULL ordering differs.** SQL Server, MySQL and SQLite put NULLs *first* in ascending order. PostgreSQL and Oracle put them *last*. PostgreSQL, Oracle and SQLite (3.30+) accept `NULLS FIRST` / `NULLS LAST`.

### Limiting rows (a very common dialect question)

| Engine | Top 3 salaries |
|---|---|
| PostgreSQL, MySQL, SQLite | `... ORDER BY salary DESC LIMIT 3` (skip rows: `LIMIT 3 OFFSET 6`) |
| SQL Server | `SELECT TOP 3 ... ORDER BY salary DESC`, or `ORDER BY salary DESC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY` |
| Oracle 12c+, standard SQL | `... ORDER BY salary DESC FETCH FIRST 3 ROWS ONLY` |

```sql run
SELECT name, salary FROM employees
ORDER BY salary DESC, name      -- add a tie-breaker so paging is deterministic
LIMIT 3;
```

```text out
name  | salary
------+-------
Alice | 150000
Liam  | 130000
Bob   | 120000
```

> Paging with `OFFSET` gets slower the deeper you go (the engine still reads and discards all skipped rows). For large tables use **keyset pagination**: `WHERE (salary, emp_id) < (:last_salary, :last_id) ORDER BY salary DESC, emp_id DESC LIMIT 20`. Row-value comparison is not available in SQL Server, so you expand it with `OR`.

### DISTINCT

`DISTINCT` de-duplicates **whole result rows**, not just the first column. NULLs are treated as equal to each other here.

```sql run
SELECT DISTINCT dept_id FROM employees ORDER BY dept_id;
```

```text out
dept_id
-------
NULL
1
2
3
```

If you reach for `DISTINCT` to remove duplicates created by a join, stop and check the join. Usually you have a many-to-many fan-out that you should fix instead of hiding.

## 1.4 NULL and three-valued logic

`NULL` means **unknown or missing**, not zero and not an empty string. Any comparison with it yields **UNKNOWN** (not true, not false), and `WHERE` keeps only rows where the condition is **TRUE**.

| Expression | Result |
|---|---|
| `NULL = NULL` | UNKNOWN (use `IS NULL`) |
| `NULL <> 5` | UNKNOWN |
| `NULL + 10` | `NULL` |
| `TRUE AND UNKNOWN` | UNKNOWN |
| `FALSE AND UNKNOWN` | FALSE |
| `TRUE OR UNKNOWN` | TRUE |
| `FALSE OR UNKNOWN` | UNKNOWN |
| `NOT UNKNOWN` | UNKNOWN |

```sql run
SELECT name FROM employees WHERE dept_id = NULL;   -- always empty
```

```text out
name
----
(no rows)
```

```sql run
SELECT name FROM employees WHERE dept_id IS NULL;
```

```text out
name
----
Karl
```

**Silent row loss.** `dept_id <> 1` does not return Karl (dept is NULL). To include him you must say so:

```sql run
SELECT name, dept_id FROM employees
WHERE dept_id <> 1 OR dept_id IS NULL
ORDER BY emp_id;
```

```text out
name  | dept_id
------+--------
Eve   | 2
Frank | 2
Grace | 2
Heidi | 2
Ivan  | 3
Judy  | 3
Karl  | NULL
```

### The classic `NOT IN` trap

If the list or subquery contains even one `NULL`, `x NOT IN (...)` can never be TRUE. Here `employees.dept_id` contains NULL (Karl), so asking for departments with no employees returns **nothing**, though Marketing has none:

```sql run
SELECT dept_name FROM departments
WHERE dept_id NOT IN (SELECT dept_id FROM employees);
```

```text out
dept_name
---------
(no rows)
```

Safe versions:

```sql run
SELECT d.dept_name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id);
```

```text out
dept_name
---------
Marketing
```

```sql run
SELECT d.dept_name FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
WHERE e.emp_id IS NULL;
```

```text out
dept_name
---------
Marketing
```

### NULL and aggregates

| Function | NULL behaviour |
|---|---|
| `COUNT(*)` | Counts rows, NULLs included |
| `COUNT(col)` | Counts **non-NULL** values only |
| `COUNT(DISTINCT col)` | Distinct non-NULL values |
| `SUM`, `AVG`, `MIN`, `MAX` | Ignore NULLs. Over zero rows or all NULLs they return `NULL`, not 0 |

```sql run
SELECT COUNT(*) AS all_rows,
       COUNT(dept_id) AS with_dept,
       COUNT(DISTINCT dept_id) AS distinct_depts,
       AVG(dept_id) AS avg_dept_id
FROM employees;
```

```text out
all_rows | with_dept | distinct_depts | avg_dept_id
---------+-----------+----------------+------------
12       | 11        | 3              | 1.7273
```

`AVG` divides by the number of **non-NULL** values, not by all rows. Use `AVG(COALESCE(x, 0))` if NULL really means zero.

### Handling NULL

```sql run
SELECT name,
       COALESCE(dept_id, 0)       AS dept_or_zero,   -- first non-NULL argument (standard SQL)
       NULLIF(salary, 70000)      AS null_if_70k      -- NULL when both are equal, else the first value
FROM employees
WHERE emp_id IN (6, 11)
ORDER BY emp_id;
```

```text out
name  | dept_or_zero | null_if_70k
------+--------------+------------
Frank | 2            | NULL
Karl  | 0            | 50000
```

- `COALESCE(a, b, c, ...)` is standard SQL. Engine-specific forms are `ISNULL(a, b)` (SQL Server), `IFNULL(a, b)` (MySQL, SQLite), `NVL(a, b)` (Oracle).
- `NULLIF` is the idiom to avoid divide-by-zero: `total / NULLIF(count, 0)` gives NULL instead of an error.

### More NULL facts interviewers like

- `GROUP BY`, `DISTINCT`, `UNION` treat NULLs as **equal** (one group, one row), even though `NULL = NULL` is unknown.
- **UNIQUE constraints and NULL**: SQL Server allows only **one** NULL in a unique column or index. PostgreSQL, MySQL and SQLite allow many (use `NULLS NOT DISTINCT` in PostgreSQL 15+ to change that).
- **Empty string vs NULL**: they are different values, except in **Oracle**, which treats `''` as NULL.
- **Null-safe equality**: `IS NOT DISTINCT FROM` (PostgreSQL, SQL Server 2022+), `<=>` (MySQL), `IS` (SQLite).
- **String concatenation** with NULL: the operators `||` (standard, PostgreSQL, SQLite) and `+` (SQL Server, by default) return NULL if any side is NULL. The `CONCAT()` function differs: PostgreSQL and SQL Server treat NULL as an empty string, but **MySQL's `CONCAT` returns NULL** if any argument is NULL (use `CONCAT_WS` to skip NULLs there).

## 1.5 Aggregates, GROUP BY and HAVING

Aggregate functions collapse many rows into one value: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.

```sql run
SELECT dept_id,
       COUNT(*)           AS headcount,
       ROUND(AVG(salary)) AS avg_salary,
       MAX(salary)        AS top_salary
FROM employees
GROUP BY dept_id
ORDER BY dept_id;
```

```text out
dept_id | headcount | avg_salary | top_salary
--------+-----------+------------+-----------
NULL    | 1         | 50000      | 50000
1       | 5         | 123000     | 150000
2       | 4         | 77500      | 110000
3       | 2         | 72500      | 80000
```

**The GROUP BY rule:** every column in `SELECT` must either be in `GROUP BY` or be inside an aggregate function. Otherwise the engine has no single value to show. (MySQL with `ONLY_FULL_GROUP_BY` disabled and SQLite will quietly pick an arbitrary row's value. Do not rely on that.)

NULLs form their own group (see the `dept_id` NULL row above).

### WHERE vs HAVING

| | `WHERE` | `HAVING` |
|---|---|---|
| Filters | Individual **rows** | Whole **groups** |
| Runs | **Before** grouping | **After** grouping |
| Can use aggregates | No | Yes |
| Can use an index to find rows | Yes | No (it operates on already-aggregated groups) |

Filter as much as possible in `WHERE` (cheaper), and use `HAVING` only for conditions on aggregates.

```sql run
-- Departments with more than 3 people AND average salary above 75k
SELECT dept_id, COUNT(*) AS headcount, ROUND(AVG(salary)) AS avg_salary
FROM employees
WHERE dept_id IS NOT NULL            -- row filter
GROUP BY dept_id
HAVING COUNT(*) > 3 AND AVG(salary) > 75000   -- group filter
ORDER BY dept_id;
```

```text out
dept_id | headcount | avg_salary
--------+-----------+-----------
1       | 5         | 123000
2       | 4         | 77500
```

### Group by several columns

```sql run
SELECT c.city, o.status, COUNT(*) AS orders
FROM orders o JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.city, o.status
ORDER BY c.city, o.status;
```

```text out
city   | status    | orders
-------+-----------+-------
Delhi  | completed | 2
Mumbai | completed | 1
Mumbai | pending   | 1
Pune   | cancelled | 1
Pune   | completed | 4
```

### Subtotals and grand totals (not in SQLite)

```sql
-- PostgreSQL, SQL Server, Oracle:
SELECT dept_id, COUNT(*) FROM employees GROUP BY ROLLUP (dept_id);                   -- per dept + a grand-total row
SELECT customer_id, status, COUNT(*) FROM orders GROUP BY CUBE (customer_id, status); -- every combination of subtotals
SELECT customer_id, status, COUNT(*) FROM orders
GROUP BY GROUPING SETS ((customer_id), (status), ());                                -- exactly the sets you list

-- MySQL has only the older form (no CUBE / GROUPING SETS):
SELECT dept_id, COUNT(*) FROM employees GROUP BY dept_id WITH ROLLUP;
```

In the result, subtotal rows show `NULL` in the rolled-up column. Use `GROUPING(col)` to tell a subtotal NULL from a real NULL.

## 1.6 Logical order of execution

You *write* `SELECT` first, but the engine *logically evaluates* it in a different order. This single idea explains most "why can't I do that?" errors.

| Step | Clause | What happens |
|---|---|---|
| 1 | `FROM` / `JOIN` / `ON` | Build the working row set |
| 2 | `WHERE` | Filter rows |
| 3 | `GROUP BY` | Form groups |
| 4 | `HAVING` | Filter groups |
| 5 | `SELECT` | Compute expressions and aliases. **Window functions run here** |
| 6 | `DISTINCT` | Remove duplicate rows |
| 7 | `ORDER BY` | Sort |
| 8 | `LIMIT` / `OFFSET` / `TOP` / `FETCH` | Trim |

Consequences:

- A **column alias** defined in `SELECT` is not visible in `WHERE`, `GROUP BY` or `HAVING` in standard SQL, SQL Server and Oracle. It **is** visible in `ORDER BY`. (MySQL and PostgreSQL are lenient in places, and SQLite is lenient almost everywhere. Do not depend on it.)
- **Aggregates cannot appear in `WHERE`**, because grouping has not happened yet. Use `HAVING`.
- **Window functions cannot appear in `WHERE`**, since they are computed in step 5. Wrap the query in a CTE or subquery and filter outside. (Snowflake, BigQuery and DuckDB offer `QUALIFY`.)
- The optimizer may *physically* reorder work (push filters down, pick join order), but the **result** must match this logical order.

```sql
-- Fails in standard SQL / SQL Server / PostgreSQL: alias does not exist yet at WHERE time
SELECT salary * 12 AS annual FROM employees WHERE annual > 1000000;

-- Works: repeat the expression, or push it into a subquery / CTE
SELECT salary * 12 AS annual FROM employees WHERE salary * 12 > 1000000;
```

## 1.7 INSERT, UPDATE, DELETE, TRUNCATE, DROP

### INSERT

```sql run
INSERT INTO departments (dept_id, dept_name) VALUES (5, 'Legal');                 -- always list columns
INSERT INTO departments (dept_id, dept_name) VALUES (6, 'Ops'), (7, 'Support');   -- multi-row
INSERT INTO departments (dept_id, dept_name)                                      -- INSERT ... SELECT
SELECT dept_id + 100, dept_name || ' (archive)' FROM departments WHERE dept_id <= 2;
SELECT * FROM departments ORDER BY dept_id;
```

```text out
dept_id | dept_name
--------+----------------------
1       | Engineering
2       | Sales
3       | HR
4       | Marketing
5       | Legal
6       | Ops
7       | Support
101     | Engineering (archive)
102     | Sales (archive)
```

- Always name the target columns. `INSERT INTO t VALUES (...)` breaks when someone adds a column.
- Auto-generated keys: `IDENTITY(1,1)` (SQL Server), `GENERATED ALWAYS AS IDENTITY` (PostgreSQL, Oracle), `AUTO_INCREMENT` (MySQL), `AUTOINCREMENT` (SQLite).
- Getting the new id: `OUTPUT inserted.id` / `SCOPE_IDENTITY()` (SQL Server), `RETURNING id` (PostgreSQL, SQLite), `LAST_INSERT_ID()` (MySQL). **Avoid `@@IDENTITY`**, because triggers can change what it returns.

### UPDATE

```sql run
UPDATE employees
SET salary = salary + 5000
WHERE dept_id = 3;                      -- forget this WHERE and EVERY row is updated
SELECT name, salary FROM employees WHERE dept_id = 3 ORDER BY emp_id;
```

```text out
name | salary
-----+-------
Ivan | 85000
Judy | 70000
```

```sql run
-- Update from a subquery (portable). UPDATE ... JOIN / UPDATE ... FROM syntax differs per engine.
UPDATE employees
SET salary = (SELECT AVG(salary) FROM employees WHERE dept_id = 2)
WHERE emp_id = 8;
SELECT name, salary FROM employees WHERE emp_id = 8;
```

```text out
name  | salary
------+-------
Heidi | 77500
```

### DELETE, TRUNCATE, DROP (a favourite question)

| | `DELETE` | `TRUNCATE TABLE` | `DROP TABLE` |
|---|---|---|---|
| Family | DML | DDL | DDL |
| Removes | Selected rows (`WHERE`) or all | **All** rows, no `WHERE` | Rows **and** the table definition, indexes, permissions |
| Speed | Slower. Logged **row by row** | Fast. Deallocates pages, minimal logging | Fast |
| Triggers | `DELETE` triggers fire | Do not fire | n/a |
| Identity counter | Keeps counting | Reset (PostgreSQL: only with `RESTART IDENTITY`) | n/a |
| Rollback | Yes, inside a transaction | SQL Server and PostgreSQL: yes inside a transaction. **MySQL and Oracle: no** (implicit commit) | Same as left |
| FK-referenced table | Allowed (FK checks rows) | **Not allowed** in SQL Server and MySQL, unless the FK is dropped. PostgreSQL needs `CASCADE` | Needs FKs removed first |

**Safe-practice checklist for destructive statements**: run the same `WHERE` as a `SELECT` first, wrap in `BEGIN ... ROLLBACK`, check the "rows affected" count, and only then `COMMIT`.

### Getting results into a new table

```sql
SELECT * INTO emp_backup FROM employees;               -- SQL Server (also PostgreSQL)
CREATE TABLE emp_backup AS SELECT * FROM employees;    -- PostgreSQL, MySQL, Oracle, SQLite
```

Neither copies indexes, constraints or triggers, only column names and types.

## 1.8 Constraints and keys

Constraints make the database itself reject bad data, which is the last line of defence when applications have bugs.

| Constraint | Rule | Notes |
|---|---|---|
| `PRIMARY KEY` | Unique and NOT NULL, one per table | Gets a unique index automatically. In SQL Server it is clustered by default |
| `FOREIGN KEY` | Value must exist in the parent table (or be NULL) | Keeps **referential integrity**. Index FK columns yourself, as most engines do not |
| `UNIQUE` | No duplicates | Many per table. NULL handling differs by engine (see 1.4) |
| `NOT NULL` | Value required | |
| `CHECK` | Boolean rule, e.g. `CHECK (salary > 0)` | |
| `DEFAULT` | Value used when none is supplied | |

```sql
CREATE TABLE employee_demo (
  emp_id     INT          PRIMARY KEY,
  email      VARCHAR(200) NOT NULL UNIQUE,
  salary     INT          NOT NULL CHECK (salary > 0),
  status     VARCHAR(10)  NOT NULL DEFAULT 'active',
  dept_id    INT          NULL,
  manager_id INT          NULL,
  CONSTRAINT fk_demo_dept    FOREIGN KEY (dept_id)    REFERENCES departments(dept_id)
                             ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_demo_manager FOREIGN KEY (manager_id) REFERENCES employee_demo(emp_id)
);
```

**Foreign key actions** when a parent row is deleted or updated:

| Action | Effect |
|---|---|
| `NO ACTION` (default) / `RESTRICT` | Reject the change if children exist. (In PostgreSQL a deferrable constraint with `NO ACTION` can be checked at commit time, `RESTRICT` never) |
| `CASCADE` | Delete or update the children too. Powerful, so be careful about accidental mass deletes |
| `SET NULL` / `SET DEFAULT` | Detach the children |

### Keys vocabulary

| Term | Meaning |
|---|---|
| **Super key** | Any set of columns that uniquely identifies a row |
| **Candidate key** | A *minimal* super key (no column can be removed). A table may have several |
| **Primary key** | The candidate key you chose as the main identifier |
| **Alternate key** | A candidate key you did not choose (often a `UNIQUE` column, such as email) |
| **Composite key** | A key made of 2+ columns (`order_items (order_id, product_id)`) |
| **Foreign key** | Column(s) referencing another table's key |
| **Natural key** | Meaningful real-world value (email, SSN). Can change, so risky |
| **Surrogate key** | Meaningless generated value (identity, UUID). Stable, and the usual choice |

**Q: Primary key vs unique key?**
PK: one per table, never NULL, and is the row's identity. Unique: many per table, NULL allowed (engine-dependent rules), and is an alternate way to identify a row. Both create an index.

**Q: Can a foreign key be NULL?** Yes. NULL means "no parent". Add `NOT NULL` if a parent is mandatory. It may also reference a `UNIQUE` column, not just a primary key.

**Q: Can a table have no primary key?** Technically yes (a heap), but it is almost always a mistake. You cannot reliably identify, update or replicate rows.

## 1.9 Quick-fire Q&A (Basics)

**What is the difference between `WHERE` and `HAVING`?** `WHERE` filters rows before grouping and cannot use aggregates. `HAVING` filters groups after aggregation.

**`COUNT(*)` vs `COUNT(col)` vs `COUNT(DISTINCT col)`?** All rows. Non-NULL values in `col`. Distinct non-NULL values in `col`.

**Why does `WHERE col = NULL` return nothing?** The comparison is UNKNOWN, and `WHERE` keeps only TRUE. Use `IS NULL`.

**Order of execution?** FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT (window functions) → DISTINCT → ORDER BY → LIMIT/TOP.

**`DELETE` vs `TRUNCATE` vs `DROP`?** Remove chosen rows (logged, triggers, can filter), remove all rows quickly (no WHERE, resets identity, minimal logging), remove the whole table including its definition.

**What is a primary key? A foreign key?** A unique non-NULL row identifier. A column referencing another table's key to enforce referential integrity.

**`CHAR` vs `VARCHAR`?** Fixed vs variable length storage.

**Is `NULL = 0`? Is `NULL = ''`?** No. Both comparisons are UNKNOWN. NULL is "unknown", not a value.

**`UNION` vs `UNION ALL`?** (Covered in 2.2.) `UNION` removes duplicates, so it needs extra work. `UNION ALL` keeps everything and is faster.

**Can you use a column alias in `WHERE`?** Not in standard SQL, SQL Server or Oracle, because `SELECT` is evaluated after `WHERE`. You can in `ORDER BY`.

**How do you get the top N rows?** `LIMIT N` / `TOP N` / `FETCH FIRST N ROWS ONLY`, always with `ORDER BY`, and ideally a tie-breaker column.

**What does `SELECT DISTINCT a, b` do?** Removes duplicate **(a, b) pairs**, not duplicates of `a` alone.

**Is `ORDER BY` guaranteed without being written?** No. Row order is undefined unless you specify it.

**What is the difference between `DECIMAL` and `FLOAT`?** Exact vs approximate numbers. Use `DECIMAL` for money.

**What happens if you `UPDATE` without `WHERE`?** Every row is updated. Run the `WHERE` as a `SELECT` first, and use a transaction.

**What is a constraint? Name them.** A rule the DB enforces: `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, `CHECK`, `DEFAULT`.

**What is referential integrity?** A foreign key value must match an existing parent key (or be NULL), so there are no orphaned child rows.

**Does an alias or a `SELECT` expression run before `WHERE`?** No. `WHERE` is evaluated first, and `SELECT` (aliases, expressions, window functions) afterwards.
