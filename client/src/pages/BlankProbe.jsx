import { useEffect, useState } from 'react';

function BlankProbe() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        color: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
        zIndex: 999999,
      }}
    >
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
          BLANK-PROBE RENDERED
        </div>
        <div style={{ fontSize: 16, marginBottom: 4 }}>tick: {tick}</div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>
          If you see this, React is mounting correctly.
        </div>
      </div>
    </div>
  );
}

export default BlankProbe;

