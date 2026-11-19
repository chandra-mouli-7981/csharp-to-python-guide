/**
 * Generic Min-Heap (configurable comparator)
 * Used as the core data structure for all scheduling algorithms.
 */
export class MinHeap {
  constructor(comparator = (a, b) => a - b) {
    this._heap = [];
    this._cmp  = comparator;
  }

  get size()  { return this._heap.length; }
  get isEmpty() { return this._heap.length === 0; }
  peek()      { return this._heap[0] ?? null; }

  push(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    if (this.isEmpty) return null;
    const top  = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  toArray() { return [...this._heap]; }

  snapshot() {
    // Returns heap array as a sorted tree representation
    return this._heap.map((item, i) => ({
      item,
      index:    i,
      parent:   i > 0 ? Math.floor((i - 1) / 2) : null,
      leftChild:  2 * i + 1 < this._heap.length ? 2 * i + 1 : null,
      rightChild: 2 * i + 2 < this._heap.length ? 2 * i + 2 : null,
    }));
  }

  // ── Private ──
  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._cmp(this._heap[i], this._heap[parent]) < 0) {
        [this._heap[i], this._heap[parent]] = [this._heap[parent], this._heap[i]];
        i = parent;
      } else break;
    }
  }

  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._cmp(this._heap[l], this._heap[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this._heap[r], this._heap[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this._heap[i], this._heap[smallest]] = [this._heap[smallest], this._heap[i]];
      i = smallest;
    }
  }
}
