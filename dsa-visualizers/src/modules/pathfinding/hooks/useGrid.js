import { useState, useCallback, useRef } from 'react';
import {
  createInitialGrid,
  resetGridForVisualization,
  clearWalls,
  toggleWall,
  moveNode,
  generateMaze,
  START_ROW,
  START_COL,
  END_ROW,
  END_COL,
} from '../utils/gridUtils';

export function useGrid() {
  const [grid, setGrid] = useState(() => createInitialGrid());
  const [startPos, setStartPos] = useState({ row: START_ROW, col: START_COL });
  const [endPos, setEndPos] = useState({ row: END_ROW, col: END_COL });
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null); // 'wall' | 'start' | 'end'
  const mouseIsPressed = useRef(false);

  const handleMouseDown = useCallback(
    (row, col) => {
      const node = grid[row][col];
      mouseIsPressed.current = true;

      if (node.isStart) {
        setIsDragging(true);
        setDragType('start');
      } else if (node.isEnd) {
        setIsDragging(true);
        setDragType('end');
      } else {
        setDragType('wall');
        setGrid(prev => toggleWall(prev, row, col));
      }
    },
    [grid]
  );

  const handleMouseEnter = useCallback(
    (row, col) => {
      if (!mouseIsPressed.current) return;

      if (dragType === 'start') {
        setGrid(prev => {
          const node = prev[row][col];
          if (node.isEnd || node.isWall) return prev;
          return moveNode(prev, row, col, 'start');
        });
        setStartPos({ row, col });
      } else if (dragType === 'end') {
        setGrid(prev => {
          const node = prev[row][col];
          if (node.isStart || node.isWall) return prev;
          return moveNode(prev, row, col, 'end');
        });
        setEndPos({ row, col });
      } else if (dragType === 'wall') {
        setGrid(prev => {
          const node = prev[row][col];
          if (node.isStart || node.isEnd) return prev;
          return toggleWall(prev, row, col);
        });
      }
    },
    [dragType]
  );

  const handleMouseUp = useCallback(() => {
    mouseIsPressed.current = false;
    setIsDragging(false);
    setDragType(null);
  }, []);

  const resetForVisualization = useCallback(() => {
    setGrid(prev => resetGridForVisualization(prev));
  }, []);

  const clearBoard = useCallback(() => {
    setGrid(createInitialGrid());
    setStartPos({ row: START_ROW, col: START_COL });
    setEndPos({ row: END_ROW, col: END_COL });
  }, []);

  const clearWallsOnly = useCallback(() => {
    setGrid(prev => clearWalls(prev));
  }, []);

  const applyMaze = useCallback(() => {
    const { grid: mazeGrid } = generateMaze(grid);
    setGrid(mazeGrid);
    return mazeGrid;
  }, [grid]);

  const applyVisited = useCallback((row, col) => {
    setGrid(prev => {
      const newGrid = prev.map(r => r.map(n => ({ ...n })));
      newGrid[row][col].isVisited = true;
      return newGrid;
    });
  }, []);

  const applyPath = useCallback((row, col) => {
    setGrid(prev => {
      const newGrid = prev.map(r => r.map(n => ({ ...n })));
      newGrid[row][col].isPath = true;
      return newGrid;
    });
  }, []);

  return {
    grid,
    setGrid,
    startPos,
    endPos,
    isDragging,
    dragType,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    resetForVisualization,
    clearBoard,
    clearWallsOnly,
    applyMaze,
    applyVisited,
    applyPath,
  };
}
