# C# → Python Migration Guide

A practical cheat sheet for C# developers moving to Python: syntax, collections, LINQ equivalents, the DSA toolkit, and OOP differences.

## 1. Mindset shifts

| C# | Python |
|---|---|
| Statically typed, compiled | Dynamically typed, interpreted (type hints are optional) |
| Braces `{}` and `;` | **Indentation** defines blocks, with no semicolons |
| `Main()` entry point | Top-level script, with `if __name__ == "__main__":` as the idiom |
| `null` | `None` |
| `true/false` | `True/False` (capitalized) |
| `&&`, `\|\|`, `!` | `and`, `or`, `not` |
| `x++` | **Not available**, use `x += 1` |
| `condition ? a : b` | `a if condition else b` |
| `// comment` | `# comment` |
| `/// summary` | Docstrings: `"""..."""` |
| `==` value vs `ReferenceEquals` | `==` value, `is` identity (use `is None`) |
| `camelCase`/`PascalCase` methods | `snake_case` functions, `PascalCase` classes, `UPPER_CASE` constants |

```python
# Variables: no declaration keyword, no type needed
x = 10
name = "Ravi"
x = "now a string"   # legal, but avoid it

# Optional type hints (not enforced at runtime)
def add(a: int, b: int) -> int:
    return a + b
```

## 2. Basic types and conversions

| C# | Python |
|---|---|
| `int`, `long` | `int` (**arbitrary precision**, no overflow) |
| `float`, `double` | `float` (64-bit double) |
| `decimal` | `decimal.Decimal` |
| `bool` | `bool` |
| `char` | `str` of length 1 (no char type) |
| `string` | `str` (immutable, as in C#) |
| `object` | `object` |
| `var` | Not needed |
| `dynamic` | Default behavior |

```python
int("42")        # int.Parse / Convert.ToInt32
float("3.14")    # double.Parse
str(42)          # ToString()
ord('a')         # (int)'a'  -> 97
chr(97)          # (char)97  -> 'a'
bool([])         # False, because empty collections are falsy
```

**Python-specific notes:**

- `/` is always float division. `//` is floor division. `%` is modulo.
- `7 // 2 = 3`, but `-7 // 2 = -4` (floor, **not** truncation like C#). This matters in DSA.
- `-7 % 3 = 2` in Python, but `-1` in C#. Python's result takes the sign of the divisor.
- `**` is the power operator. `divmod(a, b)` returns `(quotient, remainder)`.
- No integer overflow, so there is no `checked`/`unchecked`. For 32-bit simulation, mask with `& 0xFFFFFFFF`.
- Falsy values: `None, 0, 0.0, "", [], {}, set(), ()`.

## 3. Strings

| C# | Python |
|---|---|
| `s.Length` | `len(s)` |
| `s[i]` | `s[i]`, and negative indexes work: `s[-1]` is the last char |
| `s.Substring(a, len)` | `s[a:a+len]` (slicing) |
| `s.Substring(a)` | `s[a:]` |
| `s.ToUpper()/ToLower()` | `s.upper()` / `s.lower()` |
| `s.Trim()` | `s.strip()` (also `lstrip`, `rstrip`) |
| `s.Split(',')` | `s.split(',')` (`s.split()` splits on any whitespace) |
| `string.Join(",", list)` | `",".join(list)` (items must be `str`) |
| `s.Contains("x")` | `"x" in s` |
| `s.IndexOf("x")` | `s.find("x")` (returns -1) or `s.index("x")` (raises an error) |
| `s.StartsWith/EndsWith` | `s.startswith()` / `s.endswith()` |
| `s.Replace(a, b)` | `s.replace(a, b)` |
| `s.ToCharArray()` | `list(s)` |
| `new string(chars)` | `"".join(chars)` |
| `string.IsNullOrEmpty(s)` | `not s` |
| `char.IsDigit(c)` | `c.isdigit()` |
| `char.IsLetter(c)` | `c.isalpha()` |
| `char.IsLetterOrDigit(c)` | `c.isalnum()` |
| `char.IsUpper(c)` | `c.isupper()` |
| `new string('a', 5)` | `"a" * 5` |
| `$"Hi {name}"` | `f"Hi {name}"` |
| `s.Reverse()` | `s[::-1]` |
| `s.CompareTo(t)` | Use `<`, `>`, `==` directly |
| `StringBuilder` | Collect in a `list`, then `"".join(parts)` |
| `s.PadLeft(5,'0')` | `s.zfill(5)` or `s.rjust(5,'0')` |

```python
s = "hello"
s[1:4]      # "ell"
s[::-1]     # "olleh"
s[::2]      # "hlo"
f"{3.14159:.2f}"   # "3.14"
f"{x:>5}"          # right-align width 5
f"{x=}"            # debug print -> "x=10"
```

> **Strings are immutable.** `s[0] = 'a'` fails. Don't build strings with `+=` in a big loop. Use a list and `join`.

## 4. Collections mapping

| C# | Python | Notes |
|---|---|---|
| `T[]` / `List<T>` | `list` | One type covers both |
| `Dictionary<K,V>` | `dict` | Insertion-ordered since 3.7 |
| `HashSet<T>` | `set` | |
| `Tuple` / `ValueTuple` | `tuple` | Immutable, hashable |
| `Stack<T>` | `list` (`append`/`pop`) | |
| `Queue<T>` | `collections.deque` | `list.pop(0)` is O(n), so don't use it |
| `LinkedList<T>` | `deque` (usually) | |
| `PriorityQueue` | `heapq` (min-heap on a list) | |
| `SortedDictionary/SortedSet` | No built-in, use `sortedcontainers` or `bisect` | |
| `Array.Sort` / `List.Sort` | `list.sort()` / `sorted()` | |
| `LINQ` | Comprehensions, `map/filter`, `itertools` | |

### List

```python
a = [1, 2, 3]
a.append(4)              # Add
a.extend([5, 6])         # AddRange
a.insert(0, 9)           # Insert(0, 9)
a.pop()                  # remove last and return it
a.pop(0)                 # RemoveAt(0), O(n)
a.remove(3)              # Remove(value), first occurrence
del a[1]                 # RemoveAt(1)
a.index(5)               # IndexOf (raises if missing)
a.count(2)               # Count of value
len(a)                   # Count
a.reverse()              # in-place reverse
a.sort(); a.sort(reverse=True)
a.clear()
b = a[:]  # or a.copy()  -> shallow copy
```

```python
[0] * n                          # new int[n]
[[0] * m for _ in range(n)]      # 2D array. RIGHT
[[0] * m] * n                    # WRONG, all rows are the same object
```

### Dictionary

```python
d = {"a": 1}
d["b"] = 2
d.get("z", 0)             # TryGetValue / GetValueOrDefault
"a" in d                  # ContainsKey
d.pop("a", None)          # Remove
d.setdefault("k", [])     # get or create
for k, v in d.items(): ...
d.keys(); d.values()
```

**Replacement for `Dictionary<K, List<V>>` and counting patterns:**

```python
from collections import defaultdict, Counter

graph = defaultdict(list)
graph[1].append(2)            # no need to check the key exists

freq = Counter("aabbbc")      # Counter({'b':3,'a':2,'c':1})
freq.most_common(2)
freq[x] += 1                  # missing keys default to 0
```

A missing `d[key]` raises `KeyError`, not `default(T)`.

### Set

```python
s = {1, 2, 3}        # empty set is set(), NOT {}
s.add(4); s.discard(9); s.remove(1)   # remove raises if missing
a | b   # UnionWith
a & b   # IntersectWith
a - b   # ExceptWith
a ^ b   # SymmetricExceptWith
a <= b  # IsSubsetOf
```

### Tuple

```python
t = (1, 2)
x, y = t                  # unpacking (deconstruction)
a, b = b, a               # swap, no temp variable
first, *rest = [1, 2, 3]  # star unpacking
```

Only hashable (immutable) objects can be dict keys or set items. Use tuples, not lists, as keys.

## 5. Control flow

```python
# if
if x > 0: ...
elif x == 0: ...
else: ...

# for loops: there is no C-style for
for i in range(n): ...            # for (i=0;i<n;i++)
for i in range(a, b): ...         # a..b-1
for i in range(n-1, -1, -1): ...  # reverse loop
for i in range(0, n, 2): ...      # step 2
for x in arr: ...                 # foreach
for i, x in enumerate(arr): ...   # index + value
for a, b in zip(l1, l2): ...      # parallel iteration

# while
while cond: ...

# loop-else (unique to Python): runs if the loop did NOT break
for x in arr:
    if x == target: break
else:
    print("not found")

# switch -> match (3.10+)
match cmd:
    case "go": ...
    case 1 | 2: ...
    case _: ...                   # default

# ternary, walrus
label = "pos" if x > 0 else "neg"
if (n := len(a)) > 10: ...

# chained comparisons
if 0 <= i < n: ...                # instead of i >= 0 && i < n

pass          # empty statement/body
```

There is no `do-while`. Use `while True:` with `break`.

## 6. Functions

```python
def greet(name, greeting="Hello", *args, **kwargs):
    return f"{greeting}, {name}"

greet("A", greeting="Hi")           # named args
nums = [1, 2]; f(*nums)             # spread list
f(**{"name": "A"})                  # spread dict

# multiple return values (tuple)
def min_max(a): return min(a), max(a)
lo, hi = min_max([1, 2, 3])

# lambda (single expression only)
sq = lambda x: x * x
```

**Gotchas:**

- **Mutable default arguments are shared between calls.** `def f(a=[])` is a bug. Use `def f(a=None): a = a if a is not None else []`.
- Inner functions modifying outer variables need `nonlocal x`. Module-level variables need `global x`.
- Recursion limit is about 1000 by default. For deep DFS, use `sys.setrecursionlimit(10**6)` or iterate.
- Functions are first-class. You can pass them around, and no `Func<>`/`Action<>` types are needed.

## 7. LINQ → Python

| LINQ | Python |
|---|---|
| `Select(x => x*2)` | `[x*2 for x in a]` or `map` |
| `Where(x => x>0)` | `[x for x in a if x>0]` |
| `Select().Where()` | `[f(x) for x in a if cond(x)]` |
| `Any(pred)` | `any(pred(x) for x in a)` |
| `All(pred)` | `all(pred(x) for x in a)` |
| `Sum()/Min()/Max()` | `sum(a)`, `min(a)`, `max(a)` |
| `Count(pred)` | `sum(1 for x in a if pred(x))` |
| `First()` | `a[0]` or `next(iter(a))` |
| `FirstOrDefault(pred)` | `next((x for x in a if pred(x)), None)` |
| `OrderBy(x => x.Age)` | `sorted(a, key=lambda x: x.age)` |
| `OrderByDescending` | `sorted(a, key=..., reverse=True)` |
| `Distinct()` | `set(a)` or `list(dict.fromkeys(a))` (keeps order) |
| `GroupBy` | `defaultdict(list)` or `itertools.groupby` (needs sorted input) |
| `Zip` | `zip(a, b)` |
| `Take(n)` / `Skip(n)` | `a[:n]` / `a[n:]` |
| `Concat` | `a + b` or `itertools.chain(a, b)` |
| `ToDictionary` | `{k(x): v(x) for x in a}` |
| `Aggregate` | `functools.reduce(f, a, init)` |
| `SelectMany` | `[y for x in a for y in x]` or `itertools.chain.from_iterable` |

```python
squares = [x*x for x in range(10) if x % 2 == 0]   # list comp
uniq = {x % 3 for x in a}                          # set comp
m = {x: i for i, x in enumerate(a)}                # dict comp
gen = (x*x for x in range(10**9))                  # generator, lazy
```

## 8. DSA toolkit

### Built-ins

```python
len, sum, min, max, abs, pow(a, b, mod), divmod, sorted, reversed,
enumerate, zip, range, any, all, map, filter, round, bin, hex, int(s, base)
```

```python
float('inf'), float('-inf')     # int.MaxValue, int.MinValue substitutes
import math
math.inf, math.sqrt, math.gcd, math.lcm, math.ceil, math.floor,
math.log2, math.factorial, math.comb, math.isqrt
```

`int.MaxValue` is not needed. Use `float('inf')` or `10**18` as a sentinel.

### Sorting

```python
a.sort()                                  # in place, stable
sorted(a, key=lambda x: (x[0], -x[1]))    # multi-key (tuple compare)
sorted(words, key=len)
sorted(d.items(), key=lambda kv: kv[1], reverse=True)

from functools import cmp_to_key
sorted(a, key=cmp_to_key(lambda x, y: x - y))   # custom Comparer
```

### Stack, Queue and Deque

```python
stack = []; stack.append(x); stack.pop(); stack[-1]   # push/pop/peek

from collections import deque
q = deque([start])
q.append(x)        # Enqueue
q.popleft()        # Dequeue
q[0]               # Peek
q.appendleft(x); q.pop()   # deque ops (sliding window max)
```

### Heap (PriorityQueue)

`heapq` is a **min-heap** only.

```python
import heapq
h = []
heapq.heappush(h, (priority, item))
heapq.heappop(h)
heapq.heapify(arr)
h[0]                              # peek
heapq.heappush(h, -x)             # max-heap trick: negate values
heapq.nlargest(k, arr); heapq.nsmallest(k, arr)
```

Tuples compare element by element. If priorities tie, the second elements get compared and must be comparable.

### Binary search

```python
import bisect
bisect.bisect_left(a, x)    # lower bound
bisect.bisect_right(a, x)   # upper bound
bisect.insort(a, x)         # insert maintaining order
```

### Itertools and functools

```python
from itertools import permutations, combinations, product, accumulate, chain, groupby
permutations(a); combinations(a, 2); product(a, repeat=2)
list(accumulate(a))             # prefix sums

from functools import lru_cache, cache, reduce
@cache                          # memoization (DP)
def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)
```

`@lru_cache(None)` / `@cache` replaces a hand-written memo dictionary. Function arguments must be hashable.

### Graph: BFS and DFS template

```python
from collections import deque, defaultdict

g = defaultdict(list)
for u, v in edges:
    g[u].append(v); g[v].append(u)

def bfs(start):
    seen = {start}; q = deque([start])
    while q:
        u = q.popleft()
        for v in g[u]:
            if v not in seen:
                seen.add(v); q.append(v)

# grid directions
for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
    nx, ny = x + dx, y + dy
    if 0 <= nx < R and 0 <= ny < C: ...
```

### Linked list and tree nodes

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right
```

### Input and output (competitive coding)

```python
import sys
input = sys.stdin.readline            # fast input
n = int(input())
arr = list(map(int, input().split()))
print(*arr)                           # space separated
print(a, b, sep=",", end="")          # Console.Write
```

### Copying (a common bug source)

```python
import copy
b = a[:]              # shallow
b = copy.deepcopy(a)  # deep (needed for 2D lists)
```

Assignment (`b = a`) copies the **reference**, for lists, dicts and sets.

### Time-complexity gotchas

- `x in list` is O(n). `x in set/dict` is O(1).
- `list.pop(0)` and `list.insert(0, x)` are O(n). Use `deque`.
- `s += c` in a loop is O(n²). Use a list and `join`.
- Slicing `a[i:j]` copies, which is O(k).
- Python is about 50x slower than C#, so prefer built-ins and comprehensions over manual loops.

## 9. OOP: C# vs Python

### Class basics

```csharp
// C#
public class Person {
    private string _name;
    public int Age { get; set; }
    public Person(string name, int age) { _name = name; Age = age; }
    public string Name => _name;
    public override string ToString() => $"{_name} ({Age})";
}
```

```python
class Person:
    species = "human"                     # class attribute (like static field)

    def __init__(self, name: str, age: int):   # constructor
        self._name = name                 # "private" by convention
        self.age = age                    # public attribute, no property needed

    @property                             # read-only property
    def name(self):
        return self._name

    def __str__(self):                    # ToString()
        return f"{self._name} ({self.age})"

    def __repr__(self):                   # debug representation
        return f"Person({self._name!r}, {self.age})"
```

### Key differences

| Topic | C# | Python |
|---|---|---|
| `this` | Implicit | Explicit `self` as the **first param** of every instance method |
| Constructor | Same name as class, overloads allowed | `__init__` only. No overloading, use defaults, `*args`, or `@classmethod` factories |
| Access modifiers | `public/private/protected/internal` | **None enforced**. `_x` means protected by convention, `__x` triggers name-mangling (not true private) |
| Properties | `get; set;` | `@property`, `@x.setter`, or plain attributes |
| Fields declaration | Declared in class body | Created dynamically in `__init__` (or any time) |
| Static member | `static` | Class attributes, `@staticmethod`, `@classmethod` |
| Destructor | `~Class` / `IDisposable` | `__del__` (rarely used), context managers (`with`) |
| Method overloading | Supported | **Not supported**. The last definition wins |
| Interfaces | `interface` | `abc.ABC` or `typing.Protocol` (duck typing) |
| Abstract class | `abstract` | `ABC` with `@abstractmethod` |
| Virtual methods | `virtual/override` | All methods are virtual. No `override` keyword |
| `sealed` | Yes | No (convention only, or `typing.final`) |
| `base.Method()` | `base` | `super().method()` |
| Multiple inheritance | Not for classes | **Supported** (uses MRO, C3 linearization) |
| Generics | `List<T>` | Dynamic typing, or `typing.Generic[T]` for hints only |
| Operator overloading | `operator +` | `__add__`, `__eq__`, `__lt__`, etc. |
| Indexer | `this[int i]` | `__getitem__` / `__setitem__` |
| `IEnumerable` | `GetEnumerator` | `__iter__` / `__next__`, or a generator with `yield` |
| `IDisposable` / `using` | `using (...)` | `with ...:` using `__enter__/__exit__` |
| Equality / hash | `Equals`, `GetHashCode` | `__eq__`, `__hash__` (defining `__eq__` alone makes the class unhashable) |
| `IComparable` | `CompareTo` | `__lt__` (add `@functools.total_ordering` for the rest) |
| Records | `record` | `@dataclass` |
| `enum` | `enum` | `enum.Enum` |
| Exceptions | `try/catch/finally` | `try/except/else/finally` |
| `nameof`, reflection | Yes | `getattr`, `hasattr`, `type()`, `dir()` |

### Static, class and instance methods

```python
class Counter:
    count = 0                       # shared across instances

    def __init__(self):
        Counter.count += 1

    @staticmethod
    def helper(x): return x * 2     # no self/cls

    @classmethod
    def from_str(cls, s):           # alternative constructor
        return cls(int(s))
```

### Inheritance and abstraction

```python
from abc import ABC, abstractmethod

class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Circle(Shape):
    def __init__(self, r):
        super().__init__()
        self.r = r
    def area(self):                 # override, no keyword needed
        return 3.14159 * self.r ** 2
```

- A subclass `__init__` does **not** automatically call the parent's. You must call `super().__init__(...)`.
- **Duck typing:** if an object has the needed methods, it works. Interfaces are often unnecessary.

### Properties with validation

```python
class Account:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self): return self._balance

    @balance.setter
    def balance(self, v):
        if v < 0: raise ValueError("negative")
        self._balance = v
```

### Dataclass (replacement for DTOs and records)

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, order=True)     # frozen is similar to a readonly record
class Point:
    x: int
    y: int
    tags: list = field(default_factory=list)
# auto-generates __init__, __repr__, __eq__ (and ordering if order=True)
```

### Magic (dunder) methods cheat sheet

| C# | Python |
|---|---|
| `ToString()` | `__str__`, `__repr__` |
| `Equals` | `__eq__` |
| `GetHashCode` | `__hash__` |
| `CompareTo` | `__lt__`, `__le__`, `__gt__`, `__ge__` |
| `operator +` | `__add__` |
| `this[i]` | `__getitem__`, `__setitem__` |
| `Count` / `Length` | `__len__` |
| `IEnumerable` | `__iter__` |
| `Contains` | `__contains__` |
| `IDisposable` | `__enter__`, `__exit__` |
| Delegate invocation | `__call__` |
| Constructor | `__init__` (and `__new__` for low-level creation) |

### Exceptions

```python
try:
    risky()
except (ValueError, KeyError) as e:
    print(e)
except Exception:
    raise                    # rethrow (C# `throw;`)
else:
    ...                      # runs if no exception
finally:
    ...

raise ValueError("bad")      # throw new ...

class MyError(Exception):    # custom exception
    pass
```

### Delegates, events, async and more

- Delegates, `Func`, `Action`: just pass functions or lambdas.
- Events: keep a list of callbacks.
- `async/await`: Python has `async def` / `await` with `asyncio`. It is single-threaded cooperative concurrency. The **GIL** prevents true CPU-parallel threads, so use `multiprocessing` for CPU-bound work.
- Generics: no compile-time enforcement. Use `from typing import List, Dict, Optional, TypeVar, Generic`.
- `Nullable<T>` / `int?`: use `Optional[int]` (hint only) and check `is None`.
- Null-conditional `?.` and `??`: Python has no `?.`. Use `x.y if x else None`, and `a or b` / `a if a is not None else b` for `??`.

## 10. Project and tooling equivalents

| C# | Python |
|---|---|
| .NET SDK / `dotnet` CLI | `python`, `pip` |
| NuGet | PyPI (`pip install pkg`) |
| `.csproj` | `pyproject.toml` / `requirements.txt` |
| Solution / project | Package (folder with `__init__.py`) / module (`.py` file) |
| `using System.Linq;` | `import itertools` / `from x import y` |
| `namespace` | Module and package path |
| Visual Studio | VS Code or PyCharm |
| Project-level isolation | `python -m venv .venv` |
| xUnit / NUnit | `pytest` (or `unittest`) |
| Roslyn analyzers | `ruff`, `flake8`, `mypy`, `black` |
| `Debug.WriteLine` | `print()`, `logging` |
| `Console.ReadLine()` | `input()` |

## 11. Quick "Pythonic" checklist

1. Prefer `for x in items` over indexing. Use `enumerate` when you need the index.
2. Use comprehensions instead of building lists in loops.
3. Use `with` for files and resources: `with open(p) as f:`.
4. Use `is None`, not `== None`.
5. Don't use mutable default arguments.
6. Use `snake_case`, and follow PEP 8 (`black` formats your code).
7. Use f-strings for formatting.
8. Remember that integer division, modulo with negatives, and `//` behave differently from C#.
9. Python has no block scope. Variables defined in `if`/`for` leak into the enclosing function.
10. Use `if __name__ == "__main__":` to guard entry-point code.

## 12. Suggested learning path

1. **Week 1:** Syntax, strings, lists, dicts, sets, functions, comprehensions.
2. **Week 2:** OOP (dunder methods, dataclasses, properties, ABC), exceptions, file I/O, modules.
3. **Week 3:** `collections`, `heapq`, `bisect`, `itertools`, `functools`. Redo 30–40 easy/medium LeetCode problems you've already solved in C#, writing them in Python.
4. **Week 4:** Typing, `pytest`, `asyncio`, virtual environments. Optionally add a framework (FastAPI or Django).
