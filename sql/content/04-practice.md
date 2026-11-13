# Level 4 · Practice

## How to attack any SQL problem

Spend 20 minutes on each problem **before** reading the solution. Say your reasoning out loud, because that is what the interviewer is grading.

1. **Clarify the output**: which columns, what order, how to handle ties, NULLs and "no result" cases.
2. **Find the grain**: what does one row of the *result* represent (one customer? one customer per month?).
3. **Pick the tables and joins** needed to get there, and check for fan-out (one-to-many) before aggregating.
4. **Filter** early (`WHERE`), **group** if you need one row per something, and **filter groups** with `HAVING`.
5. **Need "per group" detail next to the detail rows, ranks, previous row, running totals?** That means a window function.
6. **Break it into CTEs**: one named step per idea. It is easier to debug and to explain.
7. **Test with edge cases**: empty groups, ties, NULLs, duplicates.
8. **Say the complexity and the index** you would want, if the interviewer asks about performance.

Solutions use the sample database from the start of the guide (outputs are real). Dates are SQLite functions (`strftime`, `date`, `julianday`). The equivalent for other engines is in the dialect table in 2.6 and Level 5.

## Practice data

A few extra tables for the problems below. Load them once, together with the sample database.

```sql run core
-- E4, M2: duplicate emails
CREATE TABLE contacts (id INT PRIMARY KEY, email VARCHAR(100));
INSERT INTO contacts VALUES (1,'a@x.com'),(2,'b@x.com'),(3,'a@x.com'),(4,'c@x.com'),(5,'b@x.com'),(6,'a@x.com');

-- E8: swapping values
CREATE TABLE staff (id INT PRIMARY KEY, name VARCHAR(20), sex CHAR(1));
INSERT INTO staff VALUES (1,'Anu','m'),(2,'Bela','f'),(3,'Chet','m'),(4,'Dia','f');

-- M6: gaps in a sequence
CREATE TABLE tickets (id INT PRIMARY KEY);
INSERT INTO tickets VALUES (1),(2),(4),(5),(8);

-- H1, H5: login history (user 1 has a duplicate row on 03-02, on purpose)
CREATE TABLE logins (user_id INT, login_date DATE);
INSERT INTO logins VALUES
 (1,'2024-03-01'),(1,'2024-03-02'),(1,'2024-03-02'),(1,'2024-03-03'),
 (1,'2024-03-05'),(1,'2024-03-06'),(1,'2024-03-07'),(1,'2024-03-08'),(1,'2024-03-10'),
 (2,'2024-03-01'),(2,'2024-03-03'),(2,'2024-03-04'),
 (3,'2024-03-05'),(3,'2024-03-06');

-- H4: click stream
CREATE TABLE events (user_id INT, event_time TIMESTAMP);
INSERT INTO events VALUES
 (1,'2024-03-01 10:00:00'),(1,'2024-03-01 10:10:00'),(1,'2024-03-01 10:25:00'),
 (1,'2024-03-01 11:30:00'),(1,'2024-03-01 11:40:00'),
 (2,'2024-03-01 09:00:00'),(2,'2024-03-01 09:45:00');

-- H6: room bookings (inclusive dates)
CREATE TABLE bookings (booking_id INT PRIMARY KEY, room CHAR(1), start_date DATE, end_date DATE);
INSERT INTO bookings VALUES
 (1,'A','2024-01-01','2024-01-05'),(2,'A','2024-01-04','2024-01-08'),
 (3,'A','2024-01-10','2024-01-12'),(4,'A','2024-01-12','2024-01-15'),
 (5,'B','2024-02-01','2024-02-03');

-- H7: wallet transactions
CREATE TABLE wallet (txn_id INT PRIMARY KEY, txn_date DATE, amount INT);
INSERT INTO wallet VALUES (1,'2024-03-01',100),(2,'2024-03-02',-30),(3,'2024-03-03',-50),(4,'2024-03-04',-40),(5,'2024-03-05',10);

-- H8: daily sales with a missing day (03-03)
CREATE TABLE daily_sales (sale_date DATE PRIMARY KEY, amount INT);
INSERT INTO daily_sales VALUES ('2024-03-01',10),('2024-03-02',20),('2024-03-04',30),('2024-03-05',40);
```

## 4.1 Easy problems

### E1. Customers who never placed an order

**Approach:** an anti-join. Use `NOT EXISTS` (NULL-safe). `LEFT JOIN ... IS NULL` is equivalent.

```sql run
SELECT c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

```text out
name
----
Eli
```

```sql run
-- Same result with an anti-join
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;
```

```text out
name
----
Eli
```

### E2. Second highest salary (return NULL if there is none)

**Approach:** "second highest *distinct* value". Three common answers (know all three):

```sql run
-- 1) OFFSET on distinct values, wrapped in a scalar subquery so "no row" becomes NULL
SELECT (SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1) AS second_highest;
```

```text out
second_highest
--------------
130000
```

```sql run
-- 2) Max of everything below the max (no window functions, works everywhere)
SELECT MAX(salary) AS second_highest
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
```

```text out
second_highest
--------------
130000
```

```sql run
-- 3) DENSE_RANK (generalizes to Nth, see E3)
WITH r AS (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees)
SELECT MAX(salary) AS second_highest FROM r WHERE rnk = 2;
```

```text out
second_highest
--------------
130000
```

Why `MAX(...)` at the end of the third? An aggregate over zero rows returns `NULL`, which satisfies "return NULL if none". Why not `RANK`? With ties at the top, `RANK` skips rank 2.

### E3. Nth highest salary

```sql run
-- N = 3
WITH r AS (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employees)
SELECT MAX(salary) AS third_highest FROM r WHERE rnk = 3;
```

```text out
third_highest
-------------
120000
```

For a parameter `:n`, use `WHERE rnk = :n`. Without windows: `SELECT DISTINCT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET :n - 1`. In SQL Server: `ORDER BY salary DESC OFFSET @n - 1 ROWS FETCH NEXT 1 ROWS ONLY`.

### E4. Find duplicate emails

```sql run
SELECT email, COUNT(*) AS occurrences
FROM contacts
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY email;
```

```text out
email   | occurrences
--------+------------
a@x.com | 3
b@x.com | 2
```

This is the standard "find duplicates" pattern: group by the columns that should be unique, then `HAVING COUNT(*) > 1`.

### E5. Employees who earn more than their manager

**Approach:** self join, matching each employee to their manager's row.

```sql run
SELECT e.name AS employee, e.salary, m.name AS manager, m.salary AS manager_salary
FROM employees e
JOIN employees m ON m.emp_id = e.manager_id
WHERE e.salary > m.salary;
```

```text out
employee | salary | manager | manager_salary
---------+--------+---------+---------------
Liam     | 130000 | Carol   | 120000
```

An inner join is right here: Alice has no manager, so she cannot "earn more than her manager".

### E6. Revenue and order count per month (completed orders only)

```sql run
SELECT strftime('%Y-%m', o.order_date)  AS month,
       SUM(i.qty * i.unit_price)        AS revenue,
       COUNT(DISTINCT o.order_id)       AS orders
FROM orders o
JOIN order_items i ON i.order_id = o.order_id
WHERE o.status = 'completed'
GROUP BY strftime('%Y-%m', o.order_date)
ORDER BY month;
```

```text out
month   | revenue | orders
--------+---------+-------
2024-01 | 1920    | 2
2024-02 | 1650    | 2
2024-03 | 910     | 2
2024-04 | 560     | 1
```

`COUNT(DISTINCT o.order_id)` is needed because the join to `order_items` repeats each order once per line (fan-out). Month expression: PostgreSQL `DATE_TRUNC('month', order_date)`, SQL Server `FORMAT(order_date, 'yyyy-MM')` or `EOMONTH(order_date)`, MySQL `DATE_FORMAT(order_date, '%Y-%m')`.

### E7. Customers who bought both a Laptop and a Phone (completed orders)

**Approach:** this is "relational division": filter to the two products, group by customer, require both to be present.

```sql run
SELECT c.name
FROM customers c
JOIN orders o      ON o.customer_id = c.customer_id AND o.status = 'completed'
JOIN order_items i ON i.order_id = o.order_id
JOIN products p    ON p.product_id = i.product_id
WHERE p.name IN ('Laptop', 'Phone')
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT p.name) = 2;
```

```text out
name
----
Asha
```

Chen is excluded because his Laptop order was cancelled. Generalizes to "bought all of N things": `HAVING COUNT(DISTINCT p.name) = N`.

### E8. Swap `m` and `f` values with one UPDATE

```sql run
UPDATE staff
SET sex = CASE WHEN sex = 'm' THEN 'f'
               WHEN sex = 'f' THEN 'm'
               ELSE sex END;
SELECT * FROM staff ORDER BY id;
```

```text out
id | name | sex
---+------+----
1  | Anu  | f
2  | Bela | m
3  | Chet | f
4  | Dia  | m
```

In a single `UPDATE`, every right-hand side sees the **old** row values, so no temporary column is needed. The `ELSE sex` keeps any unexpected values unchanged.

### E9. Managers with at least 3 direct reports

```sql run
SELECT m.name, COUNT(*) AS direct_reports
FROM employees e
JOIN employees m ON m.emp_id = e.manager_id
GROUP BY m.emp_id, m.name
HAVING COUNT(*) >= 3
ORDER BY direct_reports DESC;
```

```text out
name  | direct_reports
------+---------------
Alice | 5
Eve   | 3
```

### E10. Department(s) with the highest average salary

```sql run
WITH dept_avg AS (
  SELECT dept_id, AVG(salary) AS avg_salary
  FROM employees
  WHERE dept_id IS NOT NULL
  GROUP BY dept_id
)
SELECT d.dept_name, ROUND(a.avg_salary) AS avg_salary
FROM dept_avg a
JOIN departments d ON d.dept_id = a.dept_id
WHERE a.avg_salary = (SELECT MAX(avg_salary) FROM dept_avg);
```

```text out
dept_name   | avg_salary
------------+-----------
Engineering | 123000
```

Comparing to `MAX(avg_salary)` (instead of `ORDER BY ... LIMIT 1`) returns **all** departments that tie for first.

## 4.2 Medium problems

### M1. Highest-paid employee(s) in each department (ties included)

```sql run
-- Window version
WITH r AS (
  SELECT name, dept_id, salary,
         RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk
  FROM employees
  WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, salary FROM r WHERE rnk = 1 ORDER BY dept_id;
```

```text out
dept_id | name  | salary
--------+-------+-------
1       | Alice | 150000
2       | Eve   | 110000
3       | Ivan  | 80000
```

```sql run
-- Correlated subquery version (works without window functions)
SELECT e.dept_id, e.name, e.salary
FROM employees e
WHERE e.salary = (SELECT MAX(x.salary) FROM employees x WHERE x.dept_id = e.dept_id)
ORDER BY e.dept_id;
```

```text out
dept_id | name  | salary
--------+-------+-------
1       | Alice | 150000
2       | Eve   | 110000
3       | Ivan  | 80000
```

Use `RANK` (or `DENSE_RANK`) to keep ties and `ROW_NUMBER` to force exactly one row per department. Karl (no department) never matches in the correlated version because `NULL = NULL` is unknown.

### M2. Delete duplicate rows, keeping the lowest `id`

```sql run
DELETE FROM contacts
WHERE id NOT IN (SELECT MIN(id) FROM contacts GROUP BY email);   -- safe: MIN(id) is never NULL
SELECT * FROM contacts ORDER BY id;
```

```text out
id | email
---+--------
1  | a@x.com
2  | b@x.com
4  | c@x.com
```

Engine-specific alternatives (same idea, "number the duplicates and delete those after the first"):

```sql
-- SQL Server: delete straight through a CTE
WITH d AS (SELECT ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn FROM contacts)
DELETE FROM d WHERE rn > 1;

-- PostgreSQL: self-join delete
DELETE FROM contacts a USING contacts b WHERE a.email = b.email AND a.id > b.id;

-- MySQL (cannot select from the table being deleted in a subquery, so join instead)
DELETE a FROM contacts a JOIN contacts b ON a.email = b.email AND a.id > b.id;
```

Always run the matching `SELECT` first and use a transaction. Then add a `UNIQUE` constraint on `email` so it cannot happen again.

### M3. Latest order for each customer

```sql run
WITH r AS (
  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id
                                 ORDER BY order_date DESC, order_id DESC) AS rn   -- tie-breaker!
  FROM orders o
)
SELECT customer_id, order_id, order_date, status
FROM r
WHERE rn = 1
ORDER BY customer_id;
```

```text out
customer_id | order_id | order_date | status
------------+----------+------------+----------
1           | 7        | 2024-03-15 | completed
2           | 6        | 2024-03-09 | completed
3           | 5        | 2024-02-28 | completed
4           | 9        | 2024-04-02 | pending
```

Dina has two orders on the same date, so the `order_id DESC` tie-breaker decides which is "latest". Alternatives: a correlated `MAX(order_date)` subquery (returns ties twice), SQL Server `CROSS APPLY (SELECT TOP 1 ...)`, PostgreSQL `LATERAL` or `DISTINCT ON (customer_id)`.

### M4. Running total of completed spend per customer

```sql run
WITH t AS (
  SELECT o.customer_id, o.order_id, o.order_date, SUM(i.qty * i.unit_price) AS total
  FROM orders o JOIN order_items i ON i.order_id = o.order_id
  WHERE o.status = 'completed'
  GROUP BY o.customer_id, o.order_id, o.order_date
)
SELECT customer_id, order_id, order_date, total,
       SUM(total) OVER (PARTITION BY customer_id ORDER BY order_date, order_id) AS running_total
FROM t
ORDER BY customer_id, order_date, order_id;
```

```text out
customer_id | order_id | order_date | total | running_total
------------+----------+------------+-------+--------------
1           | 1        | 2024-01-05 | 1020  | 1020
1           | 3        | 2024-02-03 | 450   | 1470
1           | 7        | 2024-03-15 | 600   | 2070
2           | 2        | 2024-01-20 | 900   | 900
2           | 6        | 2024-03-09 | 310   | 1210
3           | 5        | 2024-02-28 | 1200  | 1200
4           | 8        | 2024-04-02 | 560   | 560
```

### M5. Pivot: revenue per category by month

**Approach:** conditional aggregation, the portable way to turn rows into columns. (SQL Server has `PIVOT`, PostgreSQL has `crosstab()` in the `tablefunc` extension.)

```sql run
SELECT p.category,
       SUM(CASE WHEN strftime('%m', o.order_date) = '01' THEN i.qty * i.unit_price ELSE 0 END) AS jan,
       SUM(CASE WHEN strftime('%m', o.order_date) = '02' THEN i.qty * i.unit_price ELSE 0 END) AS feb,
       SUM(CASE WHEN strftime('%m', o.order_date) = '03' THEN i.qty * i.unit_price ELSE 0 END) AS mar,
       SUM(CASE WHEN strftime('%m', o.order_date) = '04' THEN i.qty * i.unit_price ELSE 0 END) AS apr,
       SUM(i.qty * i.unit_price) AS total
FROM orders o
JOIN order_items i ON i.order_id = o.order_id
JOIN products p    ON p.product_id = i.product_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY p.category;
```

```text out
category    | jan  | feb  | mar | apr | total
------------+------+------+-----+-----+------
Electronics | 1600 | 1200 | 600 | 0   | 3400
Furniture   | 300  | 450  | 300 | 560 | 1610
Stationery  | 20   | 0    | 10  | 0   | 30
```

The column list is fixed in the query. Truly dynamic pivots need dynamic SQL, or are better done in the application or BI layer.

### M6. Find the missing IDs in a sequence

```sql run
-- Gaps as ranges, using LEAD
SELECT id + 1 AS gap_start, next_id - 1 AS gap_end
FROM (SELECT id, LEAD(id) OVER (ORDER BY id) AS next_id FROM tickets) AS t
WHERE next_id - id > 1;
```

```text out
gap_start | gap_end
----------+--------
3         | 3
6         | 7
```

```sql run
-- Every missing value individually: generate the full series, then anti-join
WITH RECURSIVE seq(n) AS (
  SELECT MIN(id) FROM tickets
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < (SELECT MAX(id) FROM tickets)
)
SELECT n AS missing_id
FROM seq
WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = seq.n);
```

```text out
missing_id
----------
3
6
7
```

### M7. Pairs of employees in the same department with the same salary

```sql run
SELECT a.name AS employee_1, b.name AS employee_2, a.dept_id, a.salary
FROM employees a
JOIN employees b
  ON a.dept_id = b.dept_id
 AND a.salary  = b.salary
 AND a.emp_id  < b.emp_id          -- each pair once, never an employee with themself
ORDER BY a.dept_id, a.name;
```

```text out
employee_1 | employee_2 | dept_id | salary
-----------+------------+---------+-------
Bob        | Carol      | 1       | 120000
Frank      | Grace      | 2       | 70000
```

The `<` condition is the standard way to avoid both `(A,B)`/`(B,A)` duplicates and `(A,A)` self pairs.

### M8. Customers whose spend is above the average customer's spend

```sql run
WITH spend AS (
  SELECT c.customer_id, c.name, SUM(i.qty * i.unit_price) AS total
  FROM customers c
  JOIN orders o      ON o.customer_id = c.customer_id AND o.status = 'completed'
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY c.customer_id, c.name
)
SELECT name, total
FROM spend
WHERE total > (SELECT AVG(total) FROM spend)
ORDER BY total DESC;
```

```text out
name | total
-----+------
Asha | 2070
```

**Clarify out loud:** this averages over customers *who have spent something* (4 customers, average 1260). If "average customer" should include Eli with 0, the average is 1008 and Ben and Chen also qualify. The interviewer wants to hear you notice that.

### M9. Best-selling product (by revenue) in each category

```sql run
WITH rev AS (
  SELECT p.category, p.name, SUM(i.qty * i.unit_price) AS revenue
  FROM order_items i
  JOIN orders o   ON o.order_id = i.order_id AND o.status = 'completed'
  JOIN products p ON p.product_id = i.product_id
  GROUP BY p.product_id, p.category, p.name
),
ranked AS (
  SELECT category, name, revenue,
         RANK() OVER (PARTITION BY category ORDER BY revenue DESC) AS rnk
  FROM rev
)
SELECT category, name, revenue FROM ranked WHERE rnk = 1 ORDER BY category;
```

```text out
category    | name  | revenue
------------+-------+--------
Electronics | Phone | 2400
Furniture   | Chair | 1010
Stationery  | Pen   | 30
```

### M10. Days since each customer's previous order

```sql run
SELECT customer_id, order_id, order_date,
       CAST(julianday(order_date)
            - julianday(LAG(order_date) OVER (PARTITION BY customer_id ORDER BY order_date, order_id))
            AS INTEGER) AS days_since_previous
FROM orders
ORDER BY customer_id, order_date, order_id;
```

```text out
customer_id | order_id | order_date | days_since_previous
------------+----------+------------+--------------------
1           | 1        | 2024-01-05 | NULL
1           | 3        | 2024-02-03 | 29
1           | 7        | 2024-03-15 | 41
2           | 2        | 2024-01-20 | NULL
2           | 6        | 2024-03-09 | 49
3           | 4        | 2024-02-14 | NULL
3           | 5        | 2024-02-28 | 14
4           | 8        | 2024-04-02 | NULL
4           | 9        | 2024-04-02 | 0
```

`LAG` returns NULL for each customer's first order. Date difference elsewhere: PostgreSQL `order_date - LAG(order_date) OVER (...)`, SQL Server `DATEDIFF(day, LAG(order_date) OVER (...), order_date)`, MySQL `DATEDIFF(order_date, LAG(order_date) OVER (...))`. Average gap per customer: wrap this in a CTE and `AVG(days_since_previous)`.

### M11. Customers who ordered in every month of Q1 (relational division)

```sql run
SELECT c.name
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_date >= '2024-01-01' AND o.order_date < '2024-04-01'
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT strftime('%m', o.order_date)) = 3;
```

```text out
name
----
Asha
```

Same shape as E7: filter to the candidate set, then require that the number of distinct values equals the size of the set.

## 4.3 Hard problems

### H1. Longest login streak per user (gaps and islands)

**Idea:** within a user, consecutive dates minus consecutive row numbers give a **constant**. Every unbroken streak ("island") shares one constant, and a gap changes it. Group by that constant.

```sql run
WITH d AS (                                   -- 1) remove duplicate days
  SELECT DISTINCT user_id, login_date FROM logins
),
g AS (                                        -- 2) date - row_number = island id
  SELECT user_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
  FROM d
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM g
GROUP BY user_id, grp
ORDER BY user_id, streak_start;
```

```text out
user_id | streak_start | streak_end | days
--------+--------------+------------+-----
1       | 2024-03-01   | 2024-03-03 | 3
1       | 2024-03-05   | 2024-03-08 | 4
1       | 2024-03-10   | 2024-03-10 | 1
2       | 2024-03-01   | 2024-03-01 | 1
2       | 2024-03-03   | 2024-03-04 | 2
3       | 2024-03-05   | 2024-03-06 | 2
```

Now take the longest per user (ties broken by earliest):

```sql run
WITH d AS (SELECT DISTINCT user_id, login_date FROM logins),
g AS (
  SELECT user_id, login_date,
         date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
  FROM d
),
streaks AS (
  SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
  FROM g GROUP BY user_id, grp
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY days DESC, streak_start) AS rn FROM streaks
)
SELECT user_id, streak_start, streak_end, days FROM ranked WHERE rn = 1 ORDER BY user_id;
```

```text out
user_id | streak_start | streak_end | days
--------+--------------+------------+-----
1       | 2024-03-05   | 2024-03-08 | 4
2       | 2024-03-03   | 2024-03-04 | 2
3       | 2024-03-05   | 2024-03-06 | 2
```

The date arithmetic differs per engine: SQL Server `DATEADD(day, -ROW_NUMBER() OVER (...), login_date)`, PostgreSQL `login_date - (ROW_NUMBER() OVER (...))::int`, MySQL `DATE_SUB(login_date, INTERVAL ROW_NUMBER() OVER (...) DAY)`.

**Second technique (no date arithmetic):** flag the start of each streak with `LAG`, then take a running sum of the flags:

```sql run
WITH d AS (SELECT DISTINCT user_id, login_date FROM logins),
f AS (
  SELECT user_id, login_date,
         CASE WHEN julianday(login_date)
                 - julianday(LAG(login_date) OVER (PARTITION BY user_id ORDER BY login_date)) = 1
              THEN 0 ELSE 1 END AS starts_new_streak          -- first row (NULL gap) also starts one
  FROM d
),
s AS (
  SELECT *, SUM(starts_new_streak) OVER (PARTITION BY user_id ORDER BY login_date) AS streak_id FROM f
)
SELECT user_id, streak_id, MIN(login_date) AS streak_start, COUNT(*) AS days
FROM s GROUP BY user_id, streak_id ORDER BY user_id, streak_id;
```

```text out
user_id | streak_id | streak_start | days
--------+-----------+--------------+-----
1       | 1         | 2024-03-01   | 3
1       | 2         | 2024-03-05   | 4
1       | 3         | 2024-03-10   | 1
2       | 1         | 2024-03-01   | 1
2       | 2         | 2024-03-03   | 2
3       | 1         | 2024-03-05   | 2
```

"Flag a change with `LAG`, then running `SUM`" is the most reusable pattern in hard SQL interviews. It also solves sessionization (H4) and interval merging (H6).

### H2. Median salary per department

**Approach (portable):** number the rows, count the rows, and keep the middle one (odd count) or middle two (even count) and average them.

```sql run
WITH r AS (
  SELECT dept_id, salary,
         ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS rn,
         COUNT(*)     OVER (PARTITION BY dept_id)                  AS cnt
  FROM employees
  WHERE dept_id IS NOT NULL
)
SELECT dept_id, AVG(salary) AS median_salary
FROM r
WHERE rn IN ((cnt + 1) / 2, (cnt + 2) / 2)      -- integer division: odd cnt -> same row twice, even cnt -> two middle rows
GROUP BY dept_id
ORDER BY dept_id;
```

```text out
dept_id | median_salary
--------+--------------
1       | 120000
2       | 70000
3       | 72500
```

Built-ins: PostgreSQL `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary)`, SQL Server `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY dept_id)`, Oracle `MEDIAN(salary)`. MySQL has no built-in, so use the approach above.

### H3. Total (direct and indirect) reports per manager

**Approach:** a recursive CTE that expands each employee into all people beneath them.

```sql run
WITH RECURSIVE tree AS (
  SELECT emp_id AS root, emp_id AS member FROM employees        -- everyone starts as their own subtree
  UNION ALL
  SELECT t.root, e.emp_id
  FROM tree t
  JOIN employees e ON e.manager_id = t.member                   -- add the next level down
)
SELECT m.name AS manager, COUNT(*) - 1 AS total_reports         -- minus themself
FROM tree t
JOIN employees m ON m.emp_id = t.root
GROUP BY m.emp_id, m.name
HAVING COUNT(*) - 1 > 0
ORDER BY total_reports DESC, m.name;
```

```text out
manager | total_reports
--------+--------------
Alice   | 11
Eve     | 3
Bob     | 1
Carol   | 1
Ivan    | 1
```

### H4. Sessionization: a new session after 30 minutes of inactivity

```sql run
WITH f AS (
  SELECT user_id, event_time,
         CASE WHEN LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) IS NULL
                OR CAST(strftime('%s', event_time) AS INTEGER)
                 - CAST(strftime('%s', LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time)) AS INTEGER) > 1800
              THEN 1 ELSE 0 END AS new_session
  FROM events
),
s AS (
  SELECT *, SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_time) AS session_no FROM f
)
SELECT user_id, session_no,
       MIN(event_time) AS session_start, MAX(event_time) AS session_end, COUNT(*) AS events
FROM s
GROUP BY user_id, session_no
ORDER BY user_id, session_no;
```

```text out
user_id | session_no | session_start       | session_end         | events
--------+------------+---------------------+---------------------+-------
1       | 1          | 2024-03-01 10:00:00 | 2024-03-01 10:25:00 | 3
1       | 2          | 2024-03-01 11:30:00 | 2024-03-01 11:40:00 | 2
2       | 1          | 2024-03-01 09:00:00 | 2024-03-01 09:00:00 | 1
2       | 2          | 2024-03-01 09:45:00 | 2024-03-01 09:45:00 | 1
```

Same pattern as H1: compare with the previous row (`LAG`), flag a break, and running-`SUM` the flags to number the groups.

### H5. Day-1 retention: share of users who came back the day after their first login

```sql run
WITH first_login AS (
  SELECT user_id, MIN(login_date) AS d0 FROM logins GROUP BY user_id
)
SELECT COUNT(DISTINCT f.user_id)                                AS users,
       COUNT(DISTINCT l.user_id)                                AS returned_next_day,
       ROUND(100.0 * COUNT(DISTINCT l.user_id) / COUNT(DISTINCT f.user_id), 1) AS day1_retention_pct
FROM first_login f
LEFT JOIN logins l
       ON l.user_id = f.user_id
      AND l.login_date = date(f.d0, '+1 day');
```

```text out
users | returned_next_day | day1_retention_pct
------+-------------------+-------------------
3     | 2                 | 66.7
```

`LEFT JOIN` keeps users who never returned (their `l.user_id` is NULL, which `COUNT(DISTINCT ...)` ignores), and the date condition belongs in `ON`, not `WHERE`.

### H6. Merge overlapping or touching bookings per room

**Approach:** sort by start date, compute the **latest end so far** among earlier bookings, flag a new group when the next booking starts after it, then running-`SUM` the flags.

```sql run
WITH x AS (
  SELECT room, start_date, end_date,
         MAX(end_date) OVER (PARTITION BY room ORDER BY start_date, booking_id
                             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_end
  FROM bookings
),
f AS (
  SELECT *, CASE WHEN prev_max_end IS NULL OR start_date > prev_max_end THEN 1 ELSE 0 END AS new_block FROM x
),
g AS (
  SELECT *, SUM(new_block) OVER (PARTITION BY room ORDER BY start_date, end_date) AS block_id FROM f
)
SELECT room, MIN(start_date) AS from_date, MAX(end_date) AS to_date
FROM g
GROUP BY room, block_id
ORDER BY room, from_date;
```

```text out
room | from_date  | to_date
-----+------------+-----------
A    | 2024-01-01 | 2024-01-08
A    | 2024-01-10 | 2024-01-15
B    | 2024-02-01 | 2024-02-03
```

Bookings 3 and 4 touch on 01-12 and are merged. Use `>=` instead of `>` in the flag if "ends 12th, starts 13th" should also merge.

### H7. When did the running balance first go negative?

```sql run
WITH b AS (
  SELECT txn_id, txn_date, amount,
         SUM(amount) OVER (ORDER BY txn_date, txn_id) AS balance
  FROM wallet
)
SELECT txn_id, txn_date, balance
FROM b
WHERE balance < 0
ORDER BY txn_date, txn_id
LIMIT 1;
```

```text out
txn_id | txn_date   | balance
-------+------------+--------
4      | 2024-03-04 | -20
```

SQL Server: `SELECT TOP (1) ...`. If you need *every* time it dips below zero, drop the `LIMIT` and compare with `LAG(balance)` to find the crossing points.

### H8. Rolling 3-calendar-day sales when some days are missing

`ROWS BETWEEN 2 PRECEDING` counts **rows**, so with a missing day it silently covers more than 3 calendar days. Use a **value-based `RANGE`** frame.

```sql run
SELECT sale_date, amount,
       SUM(amount) OVER (ORDER BY julianday(sale_date)
                         RANGE BETWEEN 2 PRECEDING AND CURRENT ROW)  AS last_3_days_correct,
       SUM(amount) OVER (ORDER BY sale_date
                         ROWS  BETWEEN 2 PRECEDING AND CURRENT ROW)  AS last_3_rows_wrong
FROM daily_sales
ORDER BY sale_date;
```

```text out
sale_date  | amount | last_3_days_correct | last_3_rows_wrong
-----------+--------+---------------------+------------------
2024-03-01 | 10     | 10                  | 10
2024-03-02 | 20     | 30                  | 30
2024-03-04 | 30     | 50                  | 60
2024-03-05 | 40     | 70                  | 90
```

On 03-04 the correct window is 03-02 to 03-04 (20 + 30 = 50). The `ROWS` version also adds 03-01 (60), since the missing 03-03 makes it look back four days. PostgreSQL: `RANGE BETWEEN INTERVAL '2 days' PRECEDING AND CURRENT ROW`. **SQL Server cannot do value-offset `RANGE`**: join to a calendar table to fill the missing days (value 0), then use `ROWS`, or use a self-join with `BETWEEN`.

### H9. Products frequently bought together

```sql run
SELECT p1.name AS product_a, p2.name AS product_b, COUNT(*) AS orders_together
FROM order_items a
JOIN order_items b ON b.order_id = a.order_id AND a.product_id < b.product_id   -- each pair once
JOIN products p1   ON p1.product_id = a.product_id
JOIN products p2   ON p2.product_id = b.product_id
GROUP BY a.product_id, b.product_id, p1.name, p2.name
ORDER BY orders_together DESC, product_a, product_b;
```

```text out
product_a | product_b | orders_together
----------+-----------+----------------
Desk      | Chair     | 1
Desk      | Pen       | 1
Laptop    | Pen       | 1
Phone     | Chair     | 1
```

This is a self-join on the line items. In real data you would add `HAVING COUNT(*) >= :min_support` and watch for the quadratic blow-up when orders have many lines.

### H10. Smallest set of customers that generate 80% of revenue (Pareto)

```sql run
WITH rev AS (
  SELECT c.name, SUM(i.qty * i.unit_price) AS revenue
  FROM customers c
  JOIN orders o      ON o.customer_id = c.customer_id AND o.status = 'completed'
  JOIN order_items i ON i.order_id = o.order_id
  GROUP BY c.customer_id, c.name
),
cum AS (
  SELECT name, revenue,
         SUM(revenue) OVER (ORDER BY revenue DESC, name ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running,
         SUM(revenue) OVER () AS total
  FROM rev
)
SELECT name, revenue, ROUND(100.0 * running / total, 1) AS cumulative_pct
FROM cum
WHERE running - revenue < 0.8 * total        -- include the customer who crosses the 80% line
ORDER BY revenue DESC;
```

```text out
name | revenue | cumulative_pct
-----+---------+---------------
Asha | 2070    | 41.1
Ben  | 1210    | 65.1
Chen | 1200    | 88.9
```

The subtle part is the filter: keep a row if the total **before** it is still under 80%. Using `running <= 0.8 * total` would stop one customer too early.
