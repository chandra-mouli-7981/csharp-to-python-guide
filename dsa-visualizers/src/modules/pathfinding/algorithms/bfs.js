/**
 * Breadth-First Search (BFS)
 * Guarantees shortest path on unweighted graphs.
 * Returns: { visited: Node[], path: Node[] }
 */
export function bfs(grid, startNode, endNode) {
  const visited = [];
  const queue = [startNode];
  startNode.isVisited = true;

  while (queue.length) {
    const current = queue.shift();

    if (current.isWall) continue;

    visited.push(current);
    if (current === endNode) return { visited, path: getPath(endNode) };

    const neighbors = getNeighbors(current, grid);
    for (const neighbor of neighbors) {
      neighbor.isVisited = true;
      neighbor.previousNode = current;
      queue.push(neighbor);
    }
  }

  return { visited, path: [] };
}

function getNeighbors(node, grid) {
  const { row, col } = node;
  const neighbors = [];
  if (row > 0) neighbors.push(grid[row - 1][col]);
  if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
  if (col > 0) neighbors.push(grid[row][col - 1]);
  if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);
  return neighbors.filter(n => !n.isVisited && !n.isWall);
}

function getPath(endNode) {
  const path = [];
  let current = endNode;
  while (current !== null) {
    path.unshift(current);
    current = current.previousNode;
  }
  return path;
}
