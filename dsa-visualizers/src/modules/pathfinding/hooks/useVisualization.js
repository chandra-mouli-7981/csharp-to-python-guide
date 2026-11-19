import { useState, useRef, useCallback } from 'react';
import { dijkstra } from '../algorithms/dijkstra';
import { bfs } from '../algorithms/bfs';
import { dfs } from '../algorithms/dfs';
import { astar } from '../algorithms/astar';
import { resetGridForVisualization } from '../utils/gridUtils';
import { ALGORITHMS, SPEEDS } from '../utils/constants';

const ALGORITHM_MAP = {
  [ALGORITHMS.DIJKSTRA]: dijkstra,
  [ALGORITHMS.BFS]: bfs,
  [ALGORITHMS.DFS]: dfs,
  [ALGORITHMS.ASTAR]: astar,
};

export function useVisualization(grid, setGrid, startPos, endPos) {
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [speed, setSpeed] = useState('MEDIUM');
  const [stats, setStats] = useState(null);
  const timeoutsRef = useRef([]);

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  const visualize = useCallback(
    (algorithm) => {
      clearTimeouts();

      const freshGrid = resetGridForVisualization(grid);
      setGrid(freshGrid);
      setIsFinished(false);
      setStats(null);

      const startNode = freshGrid[startPos.row][startPos.col];
      const endNode = freshGrid[endPos.row][endPos.col];

      const algoFn = ALGORITHM_MAP[algorithm];
      const { visited, path } = algoFn(freshGrid, startNode, endNode);

      const { visitDelay, pathDelay } = SPEEDS[speed];
      const startTime = performance.now();

      if (visitDelay === 0 && pathDelay === 0) {
        // Instant mode: batch update
        setGrid(prev => {
          const newGrid = prev.map(r => r.map(n => ({ ...n })));
          visited.forEach(node => {
            if (!newGrid[node.row][node.col].isStart && !newGrid[node.row][node.col].isEnd) {
              newGrid[node.row][node.col].isVisited = true;
            }
          });
          path.forEach(node => {
            if (!newGrid[node.row][node.col].isStart && !newGrid[node.row][node.col].isEnd) {
              newGrid[node.row][node.col].isPath = true;
            }
          });
          return newGrid;
        });
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
        setStats({ visited: visited.length, pathLength: path.length, time: elapsed, found: path.length > 0 });
        setIsFinished(true);
        return;
      }

      setIsRunning(true);

      visited.forEach((node, i) => {
        const tid = setTimeout(() => {
          if (!node.isStart && !node.isEnd) {
            setGrid(prev => {
              const newGrid = prev.map(r => r.map(n => ({ ...n })));
              newGrid[node.row][node.col].isVisited = true;
              return newGrid;
            });
          }
        }, i * visitDelay);
        timeoutsRef.current.push(tid);
      });

      const pathStart = visited.length * visitDelay;

      path.forEach((node, i) => {
        const tid = setTimeout(() => {
          if (!node.isStart && !node.isEnd) {
            setGrid(prev => {
              const newGrid = prev.map(r => r.map(n => ({ ...n })));
              newGrid[node.row][node.col].isPath = true;
              return newGrid;
            });
          }
          if (i === path.length - 1) {
            const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
            setStats({ visited: visited.length, pathLength: path.length, time: elapsed, found: path.length > 0 });
            setIsRunning(false);
            setIsFinished(true);
          }
        }, pathStart + i * pathDelay);
        timeoutsRef.current.push(tid);
      });

      if (path.length === 0) {
        const tid = setTimeout(() => {
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);
          setStats({ visited: visited.length, pathLength: 0, time: elapsed, found: false });
          setIsRunning(false);
          setIsFinished(true);
        }, pathStart + 50);
        timeoutsRef.current.push(tid);
      }
    },
    [grid, setGrid, startPos, endPos, speed, clearTimeouts]
  );

  const stop = useCallback(() => {
    clearTimeouts();
    setIsRunning(false);
  }, [clearTimeouts]);

  const reset = useCallback(() => {
    clearTimeouts();
    setIsRunning(false);
    setIsFinished(false);
    setStats(null);
    setGrid(prev => resetGridForVisualization(prev));
  }, [clearTimeouts, setGrid]);

  return { isRunning, isFinished, speed, setSpeed, stats, visualize, stop, reset };
}
