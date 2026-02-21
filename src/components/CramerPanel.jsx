import { useCramer } from '../hooks/useCramer';
import { Card, BlinkingDot } from './ui';

const SIGNAL_CONFIG = {
  strong:   { label: 'STRONG',   bars: 5, color: '#FF453A' },
  moderate: { label: 'MODERATE', bars: 3, color: '#FF9F0A' },
  neutral:  { label: 'NEUTRAL',  bars: 1, color: 'rgba(255,255,255,0.4)' },
};

function Perf({ value, t }) {
  if (value === null) return <span style={{ color: t.textTertiary }}>--</span>;
  const color = value >= 0 ? t.green : t.red;
  const sign = value >= 0 ? '+' : '';
  return <span style={{ color, fontWeight: 600 }}>{sign}{value.toFixed(2)}%</span>;
}

function SignalBars({ level, config, t }) {
  const max = 5;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{
          width: 10, height: 14,
          borderRadius: 2,
          background: i < config.bars ? config.color : t.border,
          transition: 'background 0.3s',
        }} />
      ))}
      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: config.color, letterSpacing: '0.05em' }}>
        {config.label}
      </span>
    </div>
  );
}

export default function CramerPanel({ dark, t, font, stocks = {} }) {
  const {
    sjimPerf, ljimPerf, spyPerf,
    inverseSignal, inverseSignalDelta,
    recentPicks, winRate, totalPicks,
  } = useCramer(stocks);

  const signalCfg = SIGNAL_CONFIG[inverseSignal] ?? SIGNAL_CONFIG.neutral;

  return (
    <Card dark={dark} t={t} style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BlinkingDot color={t.orange} speed={4} />
          <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: t.textSecondary }}>
            CRAMER TRACKER
          </span>
        </div>
        <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>
          INVERSE CRAMER
        </span>
      </div>

      {/* ETF Row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
        {[
          { label: 'SJIM', value: sjimPerf, price: stocks.SJIM?.price },
          { label: 'LJIM', value: ljimPerf, price: stocks.LJIM?.price },
          { label: 'SPY',  value: spyPerf,  price: stocks.SPY?.price },
        ].map(({ label, value, price }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: font, fontSize: 10, color: t.textTertiary, letterSpacing: '0.08em' }}>{label}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              {price && (
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: font }}>
                  ${price.toFixed(2)}
                </span>
              )}
              <Perf value={value} t={t} />
            </div>
          </div>
        ))}
      </div>

      {/* Inverse Signal */}
      <div style={{
        background: `${signalCfg.color}10`,
        border: `1px solid ${signalCfg.color}30`,
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: font, letterSpacing: '0.08em' }}>INVERSE SIGNAL</span>
          <SignalBars level={inverseSignal} config={signalCfg} t={t} />
        </div>
        {inverseSignalDelta !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>SJIM vs SPY</div>
            <Perf value={inverseSignalDelta} t={t} />
          </div>
        )}
      </div>

      {/* Picks Table */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '52px 44px 80px 1fr 60px',
          gap: 4,
          padding: '4px 0',
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 6,
        }}>
          {['TICKER', 'CALL', 'DATE', 'NOTE', 'INVERSE'].map(h => (
            <span key={h} style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, letterSpacing: '0.08em' }}>{h}</span>
          ))}
        </div>
        {recentPicks.map((p, i) => {
          const isWin = p.inverse_outcome === 'WIN';
          const pctColor = p.outcome_pct < 0 ? t.red : t.green;
          return (
            <div key={`${p.ticker}-${p.date}-${i}`} style={{
              display: 'grid',
              gridTemplateColumns: '52px 44px 80px 1fr 60px',
              gap: 4,
              padding: '5px 0',
              borderBottom: `1px solid ${t.border}20`,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: font }}>{p.ticker}</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: p.call === 'BUY' ? t.green : p.call === 'SAFE' ? t.yellow : t.red,
                fontFamily: font,
              }}>{p.call}</span>
              <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>
                {new Date(p.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </span>
              <span style={{ fontSize: 9, color: t.textTertiary, lineHeight: 1.3 }}>
                <span style={{ color: pctColor, fontWeight: 600, marginRight: 4 }}>
                  {p.outcome_pct > 0 ? '+' : ''}{p.outcome_pct.toFixed(0)}%
                </span>
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: isWin ? t.green : t.red,
                fontFamily: font,
              }}>{isWin ? 'WIN' : 'LOSS'}</span>
            </div>
          );
        })}
      </div>

      {/* Win Rate Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>
          Historical inverse win rate ({totalPicks} picks)
        </span>
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: winRate >= 60 ? t.green : winRate >= 45 ? t.yellow : t.red,
          fontFamily: font,
        }}>{winRate}%</span>
      </div>
    </Card>
  );
}
