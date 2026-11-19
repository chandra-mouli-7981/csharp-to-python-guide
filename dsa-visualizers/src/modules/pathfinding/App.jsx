import React, { useState, useCallback } from 'react';
import './App.css';
import Navbar from './components/Navbar/Navbar';
import Grid from './components/Grid/Grid';
import Legend from './components/Legend/Legend';
import StatsPanel from './components/StatsPanel/StatsPanel';
import AlgoInfo from './components/AlgoInfo/AlgoInfo';
import { useGrid } from './hooks/useGrid';
import { useVisualization } from './hooks/useVisualization';
import { ALGORITHMS } from './utils/constants';

export default function App() {
  const [algorithm, setAlgorithm] = useState(ALGORITHMS.DIJKSTRA);

  const {
    grid,
    setGrid,
    startPos,
    endPos,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    clearBoard,
    clearWallsOnly,
    applyMaze,
  } = useGrid();

  const {
    isRunning,
    isFinished,
    speed,
    setSpeed,
    stats,
    visualize,
    stop,
    reset,
  } = useVisualization(grid, setGrid, startPos, endPos);

  const handleVisualize = useCallback(() => {
    visualize(algorithm);
  }, [visualize, algorithm]);

  const handleClearBoard = useCallback(() => {
    reset();
    clearBoard();
  }, [reset, clearBoard]);

  const handleClearWalls = useCallback(() => {
    reset();
    clearWallsOnly();
  }, [reset, clearWallsOnly]);

  const handleGenerateMaze = useCallback(() => {
    reset();
    applyMaze();
  }, [reset, applyMaze]);

  const handleAlgorithmChange = useCallback((algo) => {
    setAlgorithm(algo);
    reset();
  }, [reset]);

  return (
    <div className="app">
      <Navbar
        algorithm={algorithm}
        onAlgorithmChange={handleAlgorithmChange}
        speed={speed}
        onSpeedChange={setSpeed}
        onVisualize={handleVisualize}
        onReset={isRunning ? stop : reset}
        onClearBoard={handleClearBoard}
        onClearWalls={handleClearWalls}
        onGenerateMaze={handleGenerateMaze}
        isRunning={isRunning}
        isFinished={isFinished}
      />

      <AlgoInfo algorithm={algorithm} />

      <Grid
        grid={grid}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseUp={handleMouseUp}
        isRunning={isRunning}
      />

      <Legend />

      <StatsPanel
        stats={stats}
        algorithm={algorithm}
        isRunning={isRunning}
      />
    </div>
  );
}
