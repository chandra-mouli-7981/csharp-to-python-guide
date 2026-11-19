import React from 'react';
import './AlgoInfo.css';
import { ALGORITHM_INFO } from '../../utils/constants';

export default function AlgoInfo({ algorithm }) {
  const info = ALGORITHM_INFO[algorithm];
  return (
    <div className="algo-info">
      <p className="algo-description">{info.description}</p>
      <div className="algo-complexity">
        <span className="complexity-item">
          <span className="complexity-label">Time</span>
          <code>{info.complexity.time}</code>
        </span>
        <span className="complexity-sep">·</span>
        <span className="complexity-item">
          <span className="complexity-label">Space</span>
          <code>{info.complexity.space}</code>
        </span>
      </div>
    </div>
  );
}
