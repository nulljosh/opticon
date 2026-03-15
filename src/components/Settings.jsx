import { Card } from './ui';

export default function Settings({ dark, setDark, t, mapLayers, setMapLayers }) {
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };

  const toggleStyle = (enabled) => ({
    borderRadius: 999,
    border: `1px solid ${enabled ? 'transparent' : t.border}`,
    background: enabled ? t.text : t.glass,
    color: enabled ? t.bg : t.textSecondary,
    padding: '6px 14px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font,
    boxShadow: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  });

  return (
    <div style={{ padding: '16px' }}>
      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>Map Layers</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(mapLayers).map(([key, enabled]) => (
            <button
              key={key}
              onClick={() => setMapLayers(prev => ({ ...prev, [key]: !prev[key] }))}
              style={toggleStyle(enabled)}
            >
              {key}
            </button>
          ))}
        </div>
      </Card>

      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>Appearance</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setDark(false)}
            style={toggleStyle(!dark)}
          >
            Light
          </button>
          <button
            onClick={() => setDark(true)}
            style={toggleStyle(dark)}
          >
            Dark
          </button>
        </div>
      </Card>

      <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={labelStyle}>About</div>
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          Opticon v2.3.1
        </div>
      </Card>
    </div>
  );
}
