import React, { Suspense, useEffect } from 'react';
import { MODULES } from './modules/registry';
import useHashRoute from './useHashRoute';
import Home from './Home';

export default function App() {
  const route = useHashRoute();
  const active = MODULES.find(m => m.id === route);

  useEffect(() => {
    document.title = active ? `${active.title} · DSA Visualizers` : 'DSA Visualizers';
  }, [active]);

  return (
    <div className="dsa-shell">
      <header className="dsa-bar">
        <a className={`dsa-brand${active ? '' : ' is-active'}`} href="#/">
          <span aria-hidden="true">◂</span> DSA Visualizers
        </a>
        <nav className="dsa-tabs" aria-label="Visualizers">
          {MODULES.map(m => (
            <a key={m.id} href={`#/${m.id}`} className={m.id === route ? 'is-active' : ''} title={m.title}>
              <span aria-hidden="true">{m.icon}</span> {m.short}
            </a>
          ))}
        </nav>
        <a className="dsa-back" href="../">Guide home</a>
      </header>

      <main className="dsa-stage">
        {active ? (
          <Suspense fallback={<div className="dsa-loading">Loading {active.title}…</div>}>
            <active.Component key={active.id} />
          </Suspense>
        ) : (
          <Home />
        )}
      </main>
    </div>
  );
}
