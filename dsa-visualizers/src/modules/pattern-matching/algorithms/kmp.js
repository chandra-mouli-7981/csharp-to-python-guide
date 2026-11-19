/**
 * Knuth-Morris-Pratt (KMP) Algorithm
 * Time: O(n + m) — builds a failure function to skip redundant comparisons.
 */

export function buildFailureFunction(pattern) {
  const m    = pattern.length;
  const fail = new Array(m).fill(0);
  let   k    = 0;

  for (let i = 1; i < m; i++) {
    while (k > 0 && pattern[k] !== pattern[i]) k = fail[k - 1];
    if (pattern[k] === pattern[i]) k++;
    fail[i] = k;
  }
  return fail;
}

export function kmpSearch(text, pattern) {
  const n = text.length, m = pattern.length;
  if (!m || !n) return { matches: [], steps: [], comparisons: 0, failureFunction: [] };

  const fail    = buildFailureFunction(pattern);
  const matches = [];
  const steps   = [];
  let   q       = 0;          // matched chars so far
  let   comparisons = 0;

  for (let i = 0; i < n; i++) {
    while (q > 0 && pattern[q] !== text[i]) {
      steps.push({ textIdx: i, patIdx: q, match: false, action: `Mismatch — jump to fail[${q - 1}]=${fail[q - 1]}`, q });
      q = fail[q - 1];
    }

    comparisons++;
    if (pattern[q] === text[i]) {
      steps.push({ textIdx: i, patIdx: q, match: true, action: `Match: text[${i}]='${text[i]}' == pattern[${q}]='${pattern[q]}'`, q });
      q++;
    } else {
      steps.push({ textIdx: i, patIdx: q, match: false, action: `Mismatch: text[${i}]='${text[i]}' != pattern[${q}]='${pattern[q]}'`, q });
    }

    if (q === m) {
      const start = i - m + 1;
      matches.push(start);
      steps.push({ textIdx: i, patIdx: q - 1, match: true, action: `✓ Full match found at index ${start}`, found: true, matchStart: start });
      q = fail[q - 1];
    }
  }

  return { matches, steps, comparisons, failureFunction: fail };
}
