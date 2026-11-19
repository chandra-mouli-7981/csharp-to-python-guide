/**
 * Dijkstra's Algorithm
 * Guarantees shortest path on weighted/unweighted graphs.
 * Returns: { visited: Node[], path: Node[] }
 */
export function dijkstra(grid, startNode, endNode) {
  const visited = [];
  startNode.distance = 0;

  const unvisited = getAllNodes(grid);

  while (unvisited.length) {
    sortByDistance(unvisited);
    const closest = unvisited.shift();

    if (closest.isWall) continue;
    if (closest.distance === Infinity) break;

    closest.isVisited = true;
    visited.push(closest);

    if (closest === endNode) return { visited, path: getPath(endNode) };

    updateNeighbors(closest, grid);
  }

  return { visited, path: [] };
}

function sortByDistance(nodes) {
  nodes.sort((a, b) => a.distance - b.distance);
}

function updateNeighbors(node, grid) {
  const neighbors = getNeighbors(node, grid);
  for (const neighbor of neighbors) {
    const newDist = node.distance + neighbor.weight;
    if (newDist < neighbor.distance) {
      neighbor.distance = newDist;
      neighbor.previousNode = node;
    }
  }
}

function getAllNodes(grid) {
  return grid.flat();
}

function getNeighbors(node, grid) {
  const { row, col } = node;
  const neighbors = [];
  if (row > 0) neighbors.push(grid[row - 1][col]);
  if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
  if (col > 0) neighbors.push(grid[row][col - 1]);
  if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);
  return neighbors.filter(n => !n.isVisited);
}

export function getPath(endNode) {
  const path = [];
  let current = endNode;
  while (current !== null) {
    path.unshift(current);
    current = current.previousNode;
  }
  return path;
}
