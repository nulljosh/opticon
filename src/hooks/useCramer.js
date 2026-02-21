import { useMemo } from 'react';
import picks from '../data/cramer-picks.json';

// Derive Cramer inverse signal from SJIM/LJIM/SPY price data
// Input: stockData map from useStocks
// Output: signal object with strength, ETF perf, win rate, recent picks

const SIGNAL_THRESHOLDS = {
  STRONG: 2.0,    // SJIM outperforms SPY by 2%+ over 30d → Cramer very wrong
  MODERATE: 0.5,  // SJIM outperforms SPY by 0.5-2% → moderate inverse signal
};

function calcPerf30d(stock) {
  if (!stock || typeof stock.changePercent !== 'number') return null;
  // Yahoo Finance returns daily changePercent.
  // We don't have 30-day history in useStocks, so we use current day change
  // as a directional proxy. For true 30d we'd need useStockHistory per symbol.
  return stock.changePercent;
}

function calcInverseSignal(sjimPerf, spyPerf) {
  if (sjimPerf === null || spyPerf === null) return 'neutral';
  const delta = sjimPerf - spyPerf;
  if (delta >= SIGNAL_THRESHOLDS.STRONG) return 'strong';
  if (delta >= SIGNAL_THRESHOLDS.MODERATE) return 'moderate';
  return 'neutral';
}

function calcWinRate(pickList) {
  if (!Array.isArray(pickList) || pickList.length === 0) return 0;
  const wins = pickList.filter(p => p.inverse_outcome === 'WIN').length;
  return Math.round((wins / pickList.length) * 100);
}

export function useCramer(stocks = {}) {
  return useMemo(() => {
    const sjim = stocks.SJIM ?? null;
    const ljim = stocks.LJIM ?? null;
    const spy = stocks.SPY ?? null;

    const sjimPerf = calcPerf30d(sjim);
    const ljimPerf = calcPerf30d(ljim);
    const spyPerf = calcPerf30d(spy);

    const inverseSignal = calcInverseSignal(sjimPerf, spyPerf);
    const inverseSignalDelta = (sjimPerf !== null && spyPerf !== null)
      ? +(sjimPerf - spyPerf).toFixed(2)
      : null;

    const sortedPicks = [...picks].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentPicks = sortedPicks.slice(0, 10);
    const winRate = calcWinRate(picks);

    return {
      sjimPerf,
      ljimPerf,
      spyPerf,
      inverseSignal,
      inverseSignalDelta,
      recentPicks,
      winRate,
      totalPicks: picks.length,
      sjim,
      ljim,
      spy,
    };
  }, [
    stocks.SJIM?.price,
    stocks.LJIM?.price,
    stocks.SPY?.price,
    stocks.SJIM?.changePercent,
    stocks.LJIM?.changePercent,
    stocks.SPY?.changePercent,
  ]);
}
