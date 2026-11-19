/**
 * Depth-First Search (DFS)
 * Does NOT guarantee shortest path.
 * Returns: { visited: Node[], path: Node[] }
 */
export function dfs(grid, startNode, endNode) {
  const visited = [];
  const stack = [startNode];

  while (stack.length) {
    const current = stack.pop();

    if (current.isWall || current.isVisited) continue;

    current.isVisited = true;
    visited.push(current);

    if (current === endNode) return { visited, path: getPath(endNode) };

    const neighbors = getNeighbors(current, grid);
    for (const neighbor of neighbors) {
      if (!neighbor.isVisited) {
        neighbor.previousNode = current;
        stack.push(neighbor);
      }
    }
  }

  return { visited, path: [] };
}

function getNeighbors(node, grid) {
  const { row, col } = node;
  const neighbors = [];
  if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);
  if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
  if (col > 0) neighbors.push(grid[row][col - 1]);
  if (row > 0) neighbors.push(grid[row - 1][col]);
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
