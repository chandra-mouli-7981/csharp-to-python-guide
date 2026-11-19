/**
 * A* Search Algorithm
 * Guarantees shortest path; uses heuristic to explore smarter than Dijkstra.
 * Heuristic: Manhattan distance (optimal for 4-directional grids).
 * Returns: { visited: Node[], path: Node[] }
 */
export function astar(grid, startNode, endNode) {
  const visited = [];
  const openSet = [startNode];

  startNode.gScore = 0;
  startNode.fScore = heuristic(startNode, endNode);

  while (openSet.length) {
    sortByFScore(openSet);
    const current = openSet.shift();

    if (current.isWall) continue;
    if (current === endNode) {
      current.isVisited = true;
      visited.push(current);
      return { visited, path: getPath(endNode) };
    }

    current.isVisited = true;
    visited.push(current);

    const neighbors = getNeighbors(current, grid);
    for (const neighbor of neighbors) {
      const tentativeG = current.gScore + neighbor.weight;

      if (tentativeG < neighbor.gScore) {
        neighbor.previousNode = current;
        neighbor.gScore = tentativeG;
        neighbor.fScore = tentativeG + heuristic(neighbor, endNode);

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return { visited, path: [] };
}

function heuristic(nodeA, nodeB) {
  return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
}

function sortByFScore(nodes) {
  nodes.sort((a, b) => a.fScore - b.fScore || a.gScore - b.gScore);
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
