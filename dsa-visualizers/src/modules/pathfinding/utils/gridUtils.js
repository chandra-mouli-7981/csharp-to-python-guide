export const ROWS = 21;
export const COLS = 51;

// Start and end sit on odd row/col numbers. The maze generator puts its walls on even
// rows/cols, so an even/even position can be walled in and leave the maze unsolvable.
export const START_ROW = 11;
export const START_COL = 11;
export const END_ROW = 11;
export const END_COL = 41;

export const NODE_TYPES = {
  EMPTY: 'empty',
  WALL: 'wall',
  START: 'start',
  END: 'end',
  VISITED: 'visited',
  PATH: 'path',
  WEIGHT: 'weight',
};

export function createNode(row, col) {
  return {
    row,
    col,
    isStart: row === START_ROW && col === START_COL,
    isEnd: row === END_ROW && col === END_COL,
    isWall: false,
    isVisited: false,
    isPath: false,
    weight: 1,
    distance: Infinity,
    gScore: Infinity,
    fScore: Infinity,
    previousNode: null,
  };
}

export function createInitialGrid() {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => createNode(row, col))
  );
}

export function resetGridForVisualization(grid) {
  return grid.map(row =>
    row.map(node => ({
      ...node,
      isVisited: false,
      isPath: false,
      distance: Infinity,
      gScore: Infinity,
      fScore: Infinity,
      previousNode: null,
    }))
  );
}

export function clearWalls(grid) {
  return grid.map(row =>
    row.map(node => ({
      ...node,
      isWall: false,
      isVisited: false,
      isPath: false,
      distance: Infinity,
      gScore: Infinity,
      fScore: Infinity,
      previousNode: null,
    }))
  );
}

export function toggleWall(grid, row, col) {
  const newGrid = grid.map(r => r.map(n => ({ ...n })));
  const node = newGrid[row][col];
  if (!node.isStart && !node.isEnd) {
    node.isWall = !node.isWall;
  }
  return newGrid;
}

export function moveNode(grid, row, col, type) {
  return grid.map(r =>
    r.map(n => {
      const updated = { ...n };
      if (type === 'start') {
        updated.isStart = n.row === row && n.col === col;
      } else {
        updated.isEnd = n.row === row && n.col === col;
      }
      return updated;
    })
  );
}

/**
 * Recursive Division Maze Generator
 */
export function generateMaze(grid) {
  const newGrid = grid.map(r =>
    r.map(n => ({
      ...n,
      isWall: false,
      isVisited: false,
      isPath: false,
      distance: Infinity,
      gScore: Infinity,
      fScore: Infinity,
      previousNode: null,
    }))
  );

  const walls = [];
  addOuterWalls(walls, newGrid);
  recursiveDivision(
    walls,
    newGrid,
    1,
    ROWS - 2,
    1,
    COLS - 2,
    chooseOrientation(ROWS - 2, COLS - 2)
  );

  walls.forEach(([r, c]) => {
    const node = newGrid[r][c];
    if (!node.isStart && !node.isEnd) {
      node.isWall = true;
    }
  });

  return { grid: newGrid, walls };
}

function addOuterWalls(walls, grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        walls.push([r, c]);
      }
    }
  }
}

function recursiveDivision(walls, grid, rStart, rEnd, cStart, cEnd, orientation) {
  if (rEnd < rStart || cEnd < cStart) return;

  // Chamber bounds are odd, walls go on even rows/cols. A chamber needs at least 3 rows
  // (or cols) to contain a wall line. Without this check, 1-cell-wide chambers draw "walls"
  // on their own row/col, which seals the openings left by the parent walls.
  const canSplitHorizontally = rEnd - rStart >= 2;
  const canSplitVertically = cEnd - cStart >= 2;
  if (!canSplitHorizontally && !canSplitVertically) return;

  let horizontal = orientation === 'H';
  if (horizontal && !canSplitHorizontally) horizontal = false;
  if (!horizontal && !canSplitVertically) horizontal = true;

  const wallRow = horizontal
    ? randomEven(rStart, rEnd)
    : null;
  const wallCol = horizontal
    ? null
    : randomEven(cStart, cEnd);

  const passRow = horizontal ? wallRow : randomOdd(rStart, rEnd);
  const passCol = horizontal ? randomOdd(cStart, cEnd) : wallCol;

  if (horizontal) {
    for (let c = cStart - 1; c <= cEnd + 1; c++) {
      if (c !== passCol && wallRow >= 0 && wallRow < ROWS) {
        walls.push([wallRow, c]);
      }
    }
    recursiveDivision(walls, grid, rStart, wallRow - 1, cStart, cEnd, chooseOrientation(wallRow - 1 - rStart, cEnd - cStart));
    recursiveDivision(walls, grid, wallRow + 1, rEnd, cStart, cEnd, chooseOrientation(rEnd - wallRow - 1, cEnd - cStart));
  } else {
    for (let r = rStart - 1; r <= rEnd + 1; r++) {
      if (r !== passRow && wallCol >= 0 && wallCol < COLS) {
        walls.push([r, wallCol]);
      }
    }
    recursiveDivision(walls, grid, rStart, rEnd, cStart, wallCol - 1, chooseOrientation(rEnd - rStart, wallCol - 1 - cStart));
    recursiveDivision(walls, grid, rStart, rEnd, wallCol + 1, cEnd, chooseOrientation(rEnd - rStart, cEnd - wallCol - 1));
  }
}

function chooseOrientation(height, width) {
  if (width < height) return 'H';
  if (height < width) return 'V';
  return Math.random() < 0.5 ? 'H' : 'V';
}

function randomEven(min, max) {
  const nums = [];
  for (let i = min; i <= max; i++) if (i % 2 === 0) nums.push(i);
  return nums.length ? nums[Math.floor(Math.random() * nums.length)] : min;
}

function randomOdd(min, max) {
  const nums = [];
  for (let i = min; i <= max; i++) if (i % 2 !== 0) nums.push(i);
  return nums.length ? nums[Math.floor(Math.random() * nums.length)] : min;
}
