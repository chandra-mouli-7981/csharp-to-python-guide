# SQL Interview Guide

One place to revise SQL before an interview: concepts, the traps interviewers like, and solved problems. It runs from the basics to advanced topics (window functions, indexing, transactions, tuning, design).

## Start here

**How the guide is organised**

| Level | Covers | Why it matters |
|---|---|---|
| **1. Basics** | SELECT, filtering, NULL, aggregates, execution order, DML, constraints and keys | Every interview opens here. Mistakes on NULL and `GROUP BY` are an instant red flag |
| **2. Intermediate** | Joins, set operators, subqueries, CTEs, CASE, functions, views | The bulk of most "write a query" rounds |
| **3. Advanced** | Window functions, indexes, execution plans, transactions and isolation, normalisation, procedures and triggers, concurrency, scaling, SQL from C# and Python | Senior roles and "how would you debug this slow query?" questions |
| **4. Practice** | 30+ classic problems with solutions, easy → hard | This is where you build speed |
| **5. Reference** | Dialect cheat sheet, common traps, answering strategy, last-day checklist | Read the night before |

**Suggested use**

1. Read Levels 1–3 once, trying each query yourself before looking at the output.
2. Do Level 4 **without looking at the solution** for at least 20 minutes per problem. Say your approach out loud.
3. Re-read Level 5 and the "Quick-fire Q&A" at the end of each level the day before.

**Dialects.** The examples use standard SQL that runs on PostgreSQL and SQLite. Where **SQL Server (T-SQL)** or **MySQL** differ, the difference is called out, because interviewers often name a specific database. Every query marked with a result was executed against the sample database below, and the output shown is the real output (produced on SQLite 3.50).

> **Tip:** if the interviewer does not name a database, ask. "Which database engine?" is a good clarifying question, because `LIMIT`, `TOP`, date functions and string concatenation all differ.

**Try the examples yourself** (no install, since Python includes SQLite):

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript(open("schema.sql").read())   # paste the sample database below into schema.sql
for row in db.execute("SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3"):
    print(row)
```

Online playgrounds work too (sqliteonline.com, db-fiddle.com, sqlfiddle.com).

## Sample database

Every example uses the same small company and shop data, so you can concentrate on the query instead of the data. The data has deliberate quirks that reveal bugs: salary ties, an employee with no department, a department with no employees, a customer who never ordered, a product never sold, and cancelled and pending orders.

```text
departments 1──* employees        employees.manager_id ──> employees.emp_id  (self reference)
customers   1──* orders 1──* order_items *──1 products
```

```sql run core
CREATE TABLE departments (
  dept_id    INT PRIMARY KEY,
  dept_name  VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
  emp_id     INT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  dept_id    INT REFERENCES departments(dept_id),   -- NULL = not assigned yet
  manager_id INT REFERENCES employees(emp_id),      -- NULL = top of the org chart
  salary     INT NOT NULL,
  hire_date  DATE NOT NULL
);

CREATE TABLE customers (
  customer_id INT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  city        VARCHAR(50),
  signup_date DATE NOT NULL
);

CREATE TABLE products (
  product_id INT PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  category   VARCHAR(50) NOT NULL,
  price      DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  order_id    INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(customer_id),
  order_date  DATE NOT NULL,
  status      VARCHAR(20) NOT NULL        -- completed | pending | cancelled
);

CREATE TABLE order_items (
  order_id   INT NOT NULL REFERENCES orders(order_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  qty        INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,       -- price at the time of sale (can differ from products.price)
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO departments VALUES (1,'Engineering'),(2,'Sales'),(3,'HR'),(4,'Marketing');

INSERT INTO employees VALUES
 (1,'Alice',1,NULL,150000,'2018-01-15'),
 (2,'Bob',  1,1,   120000,'2019-03-01'),
 (3,'Carol',1,1,   120000,'2020-06-15'),
 (4,'Dave', 1,2,    95000,'2021-09-01'),
 (5,'Eve',  2,1,   110000,'2017-11-20'),
 (6,'Frank',2,5,    70000,'2020-01-10'),
 (7,'Grace',2,5,    70000,'2022-02-01'),
 (8,'Heidi',2,5,    60000,'2023-05-05'),
 (9,'Ivan', 3,1,    80000,'2019-08-19'),
 (10,'Judy',3,9,    65000,'2022-10-10'),
 (11,'Karl',NULL,1, 50000,'2023-01-01'),
 (12,'Liam',1,3,   130000,'2021-01-01');

INSERT INTO customers VALUES
 (1,'Asha','Pune','2023-11-02'),
 (2,'Ben','Delhi','2023-12-10'),
 (3,'Chen','Pune','2024-01-15'),
 (4,'Dina','Mumbai','2024-02-20'),
 (5,'Eli','Delhi','2024-03-01');

INSERT INTO products VALUES
 (1,'Laptop','Electronics',1000),
 (2,'Phone','Electronics',600),
 (3,'Desk','Furniture',300),
 (4,'Chair','Furniture',150),
 (5,'Pen','Stationery',2),
 (6,'Notebook','Stationery',5);

INSERT INTO orders VALUES
 (1,1,'2024-01-05','completed'),
 (2,2,'2024-01-20','completed'),
 (3,1,'2024-02-03','completed'),
 (4,3,'2024-02-14','cancelled'),
 (5,3,'2024-02-28','completed'),
 (6,2,'2024-03-09','completed'),
 (7,1,'2024-03-15','completed'),
 (8,4,'2024-04-02','completed'),
 (9,4,'2024-04-02','pending');

INSERT INTO order_items VALUES
 (1,1,1,1000),(1,5,10,2),
 (2,2,1,600),(2,4,2,150),
 (3,3,1,300),(3,4,1,150),
 (4,1,1,1000),
 (5,2,2,600),
 (6,3,1,300),(6,5,5,2),
 (7,2,1,600),
 (8,4,4,140),
 (9,5,20,2);
```

The data itself:

```sql run
SELECT * FROM employees ORDER BY emp_id;
```

```text out
emp_id | name  | dept_id | manager_id | salary | hire_date
-------+-------+---------+------------+--------+-----------
1      | Alice | 1       | NULL       | 150000 | 2018-01-15
2      | Bob   | 1       | 1          | 120000 | 2019-03-01
3      | Carol | 1       | 1          | 120000 | 2020-06-15
4      | Dave  | 1       | 2          | 95000  | 2021-09-01
5      | Eve   | 2       | 1          | 110000 | 2017-11-20
6      | Frank | 2       | 5          | 70000  | 2020-01-10
7      | Grace | 2       | 5          | 70000  | 2022-02-01
8      | Heidi | 2       | 5          | 60000  | 2023-05-05
9      | Ivan  | 3       | 1          | 80000  | 2019-08-19
10     | Judy  | 3       | 9          | 65000  | 2022-10-10
11     | Karl  | NULL    | 1          | 50000  | 2023-01-01
12     | Liam  | 1       | 3          | 130000 | 2021-01-01
```

```sql run
SELECT * FROM departments;
```

```text out
dept_id | dept_name
--------+------------
1       | Engineering
2       | Sales
3       | HR
4       | Marketing
```

```sql run
SELECT o.order_id, c.name AS customer, o.order_date, o.status,
       SUM(i.qty * i.unit_price) AS total
FROM orders o
JOIN customers c   ON c.customer_id = o.customer_id
JOIN order_items i ON i.order_id = o.order_id
GROUP BY o.order_id, c.name, o.order_date, o.status
ORDER BY o.order_id;
```

```text out
order_id | customer | order_date | status    | total
---------+----------+------------+-----------+------
1        | Asha     | 2024-01-05 | completed | 1020
2        | Ben      | 2024-01-20 | completed | 900
3        | Asha     | 2024-02-03 | completed | 450
4        | Chen     | 2024-02-14 | cancelled | 1000
5        | Chen     | 2024-02-28 | completed | 1200
6        | Ben      | 2024-03-09 | completed | 310
7        | Asha     | 2024-03-15 | completed | 600
8        | Dina     | 2024-04-02 | completed | 560
9        | Dina     | 2024-04-02 | pending   | 40
```

Remaining tables: `customers` has 5 rows (Eli never orders), `products` has 6 (Notebook is never sold), and `order_items` has 13 lines.
