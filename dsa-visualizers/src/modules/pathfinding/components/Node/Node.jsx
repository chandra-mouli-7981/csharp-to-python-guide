import React, { memo } from 'react';
import './Node.css';

const Node = memo(function Node({
  row,
  col,
  isStart,
  isEnd,
  isWall,
  isVisited,
  isPath,
  weight,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
}) {
  let extraClass = '';
  if (isStart) extraClass = 'node-start';
  else if (isEnd) extraClass = 'node-end';
  else if (isWall) extraClass = 'node-wall';
  else if (isPath) extraClass = 'node-path';
  else if (isVisited) extraClass = 'node-visited';

  return (
    <div
      className={`node ${extraClass}`}
      onMouseDown={() => onMouseDown(row, col)}
      onMouseEnter={() => onMouseEnter(row, col)}
      onMouseUp={onMouseUp}
    >
      {isStart && <span className="node-icon">▶</span>}
      {isEnd && <span className="node-icon">◆</span>}
    </div>
  );
});

export default Node;
