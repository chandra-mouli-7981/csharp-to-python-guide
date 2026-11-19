import React from 'react';
import './SearchInput.css';

const EXAMPLES = [
  { text: 'the quick brown fox jumps over the lazy dog. the fox ran fast.', pattern: 'fox' },
  { text: 'AABAACAADAABAABA', pattern: 'AABA' },
  { text: 'abcabcabcabc', pattern: 'abcabc' },
  { text: 'mississippi', pattern: 'issi' },
];

export default function SearchInput({ text, pattern, onTextChange, onPatternChange, onRun }) {
  return (
    <div className="search-input-section">
      <div className="si-row">
        <div className="si-field si-text">
          <label>Text <span className="si-len">{text.length} chars</span></label>
          <textarea
            value={text}
            onChange={e => onTextChange(e.target.value)}
            rows={2}
            placeholder="Enter the text to search in…"
            spellCheck={false}
          />
        </div>
        <div className="si-field si-pattern">
          <label>Pattern <span className="si-len">{pattern.length} chars</span></label>
          <input
            value={pattern}
            onChange={e => onPatternChange(e.target.value)}
            placeholder="Pattern…"
            spellCheck={false}
          />
        </div>
        <button className="btn-run" onClick={() => onRun(text, pattern)}>
          ▶ Search
        </button>
      </div>

      <div className="si-examples">
        <span className="si-ex-label">Examples:</span>
        {EXAMPLES.map((ex, i) => (
          <button key={i} className="si-ex-chip"
            onClick={() => { onTextChange(ex.text); onPatternChange(ex.pattern); onRun(ex.text, ex.pattern); }}>
            "{ex.pattern}"
          </button>
        ))}
      </div>
    </div>
  );
}
