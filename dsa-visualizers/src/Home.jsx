import React from 'react';
import { MODULES } from './modules/registry';

export default function Home() {
  return (
    <div className="dsa-home">
      <div className="dsa-home-inner">
        <h1>DSA Visualizers</h1>
        <p className="dsa-lead">
          Four interactive projects that animate classic data-structure and algorithm topics. Pick one to start.
        </p>

        <div className="dsa-cards">
          {MODULES.map(m => (
            <a key={m.id} className="dsa-card" href={`#/${m.id}`}>
              <div className="dsa-card-icon" aria-hidden="true">{m.icon}</div>
              <h2>{m.title}</h2>
              <p>{m.blurb}</p>
              <div className="dsa-tags">
                {m.tags.map(t => <span key={t}>{t}</span>)}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
