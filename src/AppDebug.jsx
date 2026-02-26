import { useState } from 'react';
import { usePolymarket, MARKET_CATEGORIES } from './hooks/usePolymarket';
import { useLivePrices } from './hooks/useLivePrices';
import { useStocks } from './hooks/useStocks';
import { getTheme } from './utils/theme';
import { defaultAssets } from './utils/assets';

export default function AppDebug() {
  console.log('AppDebug rendering');

  const [dark, setDark] = useState(true);
  const t = getTheme(dark);

  // Test hooks one by one
  let marketsStatus = 'not loaded';
  let pricesStatus = 'not loaded';
  let stocksStatus = 'not loaded';

  try {
    const { markets, loading: pmLoading, error: pmError } = usePolymarket();
    marketsStatus = `loaded: ${markets.length} markets, loading: ${pmLoading}, error: ${pmError}`;
  } catch (err) {
    marketsStatus = `ERROR: ${err.message}`;
    console.error('usePolymarket error:', err);
  }

  try {
    const { prices, loading: pricesLoading } = useLivePrices(defaultAssets);
    pricesStatus = `loaded: ${Object.keys(prices).length} assets, loading: ${pricesLoading}`;
  } catch (err) {
    pricesStatus = `ERROR: ${err.message}`;
    console.error('useLivePrices error:', err);
  }

  try {
    const { stocks, loading: stocksLoading, error: stocksError } = useStocks();
    stocksStatus = `loaded: ${Object.keys(stocks).length} stocks, loading: ${stocksLoading}, error: ${stocksError}`;
  } catch (err) {
    stocksStatus = `ERROR: ${err.message}`;
    console.error('useStocks error:', err);
  }

  return (
    <div style={{ padding: 40, background: t.bg, color: t.text, minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1>Opticon Debug</h1>
      <div style={{ marginTop: 20, lineHeight: 1.8 }}>
        <p><strong>Polymarket:</strong> {marketsStatus}</p>
        <p><strong>Live Prices:</strong> {pricesStatus}</p>
        <p><strong>Stocks:</strong> {stocksStatus}</p>
      </div>
      <button
        onClick={() => setDark(!dark)}
        style={{ marginTop: 20, padding: '10px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Toggle Theme
      </button>
    </div>
  );
}
