import { useState } from 'react';
import { GAME_PHASE, LIGHT_LEVEL_START } from '@the-last-diya/shared';

export default function App() {
  const [launched, setLaunched] = useState(false);

  return (
    <main className="shell">
      <nav className="nav"><strong>The Last Diya</strong><span>Phase 1 · Technical Prototype</span></nav>
      {!launched ? (
        <section className="hero">
          <div className="eyebrow">A cooperative web adventure</div>
          <h1>Carry the light.<br />Bring the neighbourhood back.</h1>
          <p>Explore a quiet Indian neighbourhood, help its people, and light the forgotten diyas. Every flame moves the shared world closer to Diwali night.</p>
          <div className="actions"><button onClick={() => setLaunched(true)}>Enter the prototype</button><a href="https://github.com/Brajesh31/the-last-diya" target="_blank" rel="noreferrer">View source</a></div>
          <div className="stats"><div><b>{LIGHT_LEVEL_START}%</b><span>Light Level</span></div><div><b>1</b><span>Neighbourhood</span></div><div><b>10</b><span>Target players</span></div></div>
        </section>
      ) : (
        <section className="launcher">
          <div className="lamp">🪔</div>
          <div><div className="eyebrow">{GAME_PHASE}</div><h2>The game client is ready to launch.</h2><p>Run <code>npm install</code>, then start <code>apps/game</code> on port 5174. The next milestone is movement, interaction, and the first diya.</p></div>
          <button onClick={() => setLaunched(false)}>Back</button>
        </section>
      )}
    </main>
  );
}
