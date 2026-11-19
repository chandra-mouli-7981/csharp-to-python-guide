import React from 'react';
import Node from '../Node/Node';
import './Grid.css';

export default function Grid({
  grid,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  isRunning,
}) {
  return (
    <div
      className="grid-wrapper"
      onMouseLeave={onMouseUp}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 0}, var(--node-size))` }}
      >
        {grid.map(row =>
          row.map(node => (
            <Node
              key={`${node.row}-${node.col}`}
              {...node}
              onMouseDown={isRunning ? () => {} : onMouseDown}
              onMouseEnter={isRunning ? () => {} : onMouseEnter}
              onMouseUp={isRunning ? () => {} : onMouseUp}
            />
          ))
        )}
      </div>
    </div>
  );
}
