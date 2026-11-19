/**
 * Z-Algorithm
 * Time: O(n + m) — builds a Z-array where Z[i] = length of the longest
 * substring starting at i that is also a prefix of the full string.
 * Pattern matching: search in concatenated string "pattern$text".
 */

export function buildZArray(s) {
  const n = s.length;
  const Z = new Array(n).fill(0);
  let l = 0, r = 0;
  Z[0] = n;

  for (let i = 1; i < n; i++) {
    if (i < r) Z[i] = Math.min(r - i, Z[i - l]);
    while (i + Z[i] < n && s[Z[i]] === s[i + Z[i]]) Z[i]++;
    if (i + Z[i] > r) { l = i; r = i + Z[i]; }
  }
  return Z;
}

export function zSearch(text, pattern) {
  const n = text.length, m = pattern.length;
  if (!m || !n) return { matches: [], steps: [], comparisons: 0, zArray: [] };

  const concat = pattern + '$' + text;
  const Z      = buildZArray(concat);

  const matches     = [];
  const steps       = [];
  let   comparisons = 0;

  for (let i = m + 1; i < concat.length; i++) {
    const textIdx = i - m - 1;
    comparisons++;

    if (Z[i] >= m) {
      matches.push(textIdx);
      steps.push({
        concatIdx: i, textIdx, zVal: Z[i],
        match: true,
        action: `✓ Match at text[${textIdx}] — Z[${i}]=${Z[i]} ≥ m=${m}`,
      });
    } else {
      steps.push({
        concatIdx: i, textIdx, zVal: Z[i],
        match: false,
        action: `Skip text[${textIdx}] — Z[${i}]=${Z[i]} < m=${m}`,
      });
    }
  }

  return { matches, steps, comparisons, zArray: Z.slice(m + 1) };
}
