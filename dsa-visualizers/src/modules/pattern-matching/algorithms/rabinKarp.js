/**
 * Rabin-Karp Algorithm
 * Time: O(n + m) average — uses rolling polynomial hash to find matches.
 * Hash collisions trigger character-by-character verification.
 */

const BASE  = 31;
const MOD   = 1_000_000_007n;
const BASEn = BigInt(BASE);

function charCode(c) { return BigInt(c.charCodeAt(0) - 96); }

// BigInt % keeps the sign of the dividend, and charCode() is negative for anything below 'a'
// (uppercase, digits, spaces). Keep every hash in 0..MOD-1 so equal strings always get equal hashes.
function mod(x) { return ((x % MOD) + MOD) % MOD; }

export function rabinKarpSearch(text, pattern) {
  const n = text.length, m = pattern.length;
  if (!m || !n || m > n) return { matches: [], steps: [], comparisons: 0, hashCollisions: 0 };

  const steps         = [];
  const matches       = [];
  let   comparisons   = 0;
  let   hashCollisions = 0;

  // Compute pattern hash and first window hash
  let patHash = 0n, winHash = 0n, highPow = 1n;

  for (let i = 0; i < m; i++) {
    patHash = mod(patHash * BASEn + charCode(pattern[i]));
    winHash = mod(winHash * BASEn + charCode(text[i]));
    if (i < m - 1) highPow = (highPow * BASEn) % MOD;
  }

  for (let i = 0; i <= n - m; i++) {
    comparisons++;

    if (winHash === patHash) {
      // Verify character by character
      const substr = text.slice(i, i + m);
      if (substr === pattern) {
        matches.push(i);
        steps.push({
          windowStart: i, hash: String(winHash), patHash: String(patHash),
          hashMatch: true, verified: true,
          action: `✓ Match at [${i}] — hash=${winHash} verified`,
        });
      } else {
        hashCollisions++;
        steps.push({
          windowStart: i, hash: String(winHash), patHash: String(patHash),
          hashMatch: true, verified: false,
          action: `Hash collision at [${i}] — hash matched but strings differ`,
        });
      }
    } else {
      steps.push({
        windowStart: i, hash: String(winHash), patHash: String(patHash),
        hashMatch: false, verified: false,
        action: `Skip [${i}] — hash ${winHash} ≠ ${patHash}`,
      });
    }

    // Rolling hash: slide window
    if (i < n - m) {
      winHash = mod(winHash - charCode(text[i]) * highPow);
      winHash = mod(winHash * BASEn + charCode(text[i + m]));
    }
  }

  return { matches, steps, comparisons, hashCollisions };
}
