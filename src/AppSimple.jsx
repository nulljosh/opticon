export default function AppSimple() {
  return (
    <div style={{ padding: 40, background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1>Opticon is working!</h1>
      <p>If you see this, React is rendering correctly.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
