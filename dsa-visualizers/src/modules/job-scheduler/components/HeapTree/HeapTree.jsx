import React from 'react';
import './HeapTree.css';

export default function HeapTree({ snapshot, jobs }) {
  if (!snapshot?.length) return null;

  const jobMap = Object.fromEntries((jobs || []).map(j => [j.id, j]));

  // Lay out nodes level by level
  function getPos(index, totalLevels) {
    const level = Math.floor(Math.log2(index + 1));
    const posInLevel = index - (Math.pow(2, level) - 1);
    const nodesInLevel = Math.pow(2, level);
    const totalWidth = 320;
    const x = (totalWidth / (nodesInLevel + 1)) * (posInLevel + 1);
    const y = 40 + level * 64;
    return { x, y };
  }

  const maxLevel = Math.floor(Math.log2(snapshot.length));
  const svgH = 60 + maxLevel * 64;

  return (
    <div className="heap-tree">
      <div className="ht-title">
        Priority Heap <span className="ht-sub">Min-Heap (lower priority # = higher priority)</span>
      </div>
      <svg viewBox={`0 0 320 ${svgH}`} className="ht-svg">
        {/* Edges */}
        {snapshot.map(({ index, leftChild, rightChild }) => {
          const from = getPos(index, maxLevel);
          const children = [leftChild, rightChild].filter(c => c !== null);
          return children.map(ci => {
            const to = getPos(ci, maxLevel);
            return (
              <line key={`${index}-${ci}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#2a2a4a" strokeWidth="1.5" />
            );
          });
        })}
        {/* Nodes */}
        {snapshot.map(({ item, index }) => {
          const { x, y } = getPos(index, maxLevel);
          const job = jobMap[item.id] || item;
          return (
            <g key={index}>
              <circle cx={x} cy={y} r={22} fill={job.color} fillOpacity=".2"
                stroke={job.color} strokeWidth={index === 0 ? 2.5 : 1.5} />
              <text x={x} y={y - 4} textAnchor="middle" fill={job.color}
                fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">
                {item.name}
              </text>
              <text x={x} y={y + 10} textAnchor="middle" fill="#9090b0"
                fontSize="9" fontFamily="JetBrains Mono, monospace">
                p={item.priority}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
