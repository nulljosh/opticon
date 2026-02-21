// Inject keyframes for animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes scroll {
    0% { transform: translate3d(0, 0, 0); }
    100% { transform: translate3d(-50%, 0, 0); }
  }
  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .rise-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 768px) {
    .rise-grid {
      grid-template-columns: 1fr;
    }
  }
`;
if (!document.head.querySelector('#bloomberg-animations')) {
  styleSheet.id = 'bloomberg-animations';
  document.head.appendChild(styleSheet);
}

// Bloomberg-style blinking indicators
export const BlinkingDot = ({ color, delay = 0, speed = 2 }) => (
  <span style={{
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: color,
    animation: `blink ${speed}s ease-in-out ${delay}s infinite`,
    boxShadow: `0 0 2px ${color}`,
  }} />
);

export const StatusBar = ({ t, reliability }) => {
  const status = reliability?.status || 'live';
  const cfg = status === 'stale'
    ? { label: 'STALE', color: '#ff6b6b' }
    : status === 'fallback'
      ? { label: 'FALLBACK', color: '#f5a623' }
      : { label: 'LIVE', color: t.green };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
      <BlinkingDot color={cfg.color} delay={0} speed={3} />
      <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
    </div>
  );
};

export const Card = ({ children, style, onClick, dark, t }) => (
  <div onClick={onClick} style={{
    background: t.glass,
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    borderRadius: 20,
    border: `0.5px solid ${t.border}`,
    boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 0px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.07)',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    ...style
  }}>{children}</div>
);
