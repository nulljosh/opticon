import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCramer } from './useCramer';

const makeStock = (symbol, price, changePercent) => ({
  symbol, price, change: 0, changePercent, volume: 1000000,
  high52: price * 1.3, low52: price * 0.7,
});

describe('useCramer', () => {
  const baseStocks = {
    SJIM: makeStock('SJIM', 21.40, 0.31),
    LJIM: makeStock('LJIM', 20.10, -0.44),
    SPY: makeStock('SPY', 596.80, 0.14),
  };

  it('returns neutral signal when SJIM barely outperforms SPY', () => {
    const stocks = {
      ...baseStocks,
      SJIM: makeStock('SJIM', 21.40, 0.20),
      SPY: makeStock('SPY', 596.80, 0.14),
    };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignal).toBe('neutral');
  });

  it('returns moderate signal when SJIM outperforms SPY by 0.5-2%', () => {
    const stocks = {
      ...baseStocks,
      SJIM: makeStock('SJIM', 21.40, 1.50),
      SPY: makeStock('SPY', 596.80, 0.30),
    };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignal).toBe('moderate');
    expect(result.current.inverseSignalDelta).toBeCloseTo(1.2, 1);
  });

  it('returns strong signal when SJIM outperforms SPY by 2%+', () => {
    const stocks = {
      ...baseStocks,
      SJIM: makeStock('SJIM', 21.40, 2.80),
      SPY: makeStock('SPY', 596.80, 0.50),
    };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignal).toBe('strong');
  });

  it('returns neutral when stock data is missing', () => {
    const { result } = renderHook(() => useCramer({}));
    expect(result.current.inverseSignal).toBe('neutral');
    expect(result.current.sjimPerf).toBeNull();
    expect(result.current.spyPerf).toBeNull();
    expect(result.current.inverseSignalDelta).toBeNull();
  });

  it('returns neutral when only SPY is missing', () => {
    const stocks = { SJIM: makeStock('SJIM', 21.40, 2.50), LJIM: makeStock('LJIM', 20.10, -0.50) };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignal).toBe('neutral');
  });

  it('calculates win rate correctly from picks', () => {
    const { result } = renderHook(() => useCramer(baseStocks));
    const { winRate, totalPicks } = result.current;
    expect(totalPicks).toBeGreaterThan(0);
    expect(winRate).toBeGreaterThanOrEqual(0);
    expect(winRate).toBeLessThanOrEqual(100);
  });

  it('returns last 10 picks sorted newest first', () => {
    const { result } = renderHook(() => useCramer(baseStocks));
    const { recentPicks } = result.current;
    expect(recentPicks.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < recentPicks.length; i++) {
      expect(new Date(recentPicks[i - 1].date) >= new Date(recentPicks[i].date)).toBe(true);
    }
  });

  it('exposes raw ETF stock objects', () => {
    const { result } = renderHook(() => useCramer(baseStocks));
    expect(result.current.sjim).toEqual(baseStocks.SJIM);
    expect(result.current.ljim).toEqual(baseStocks.LJIM);
    expect(result.current.spy).toEqual(baseStocks.SPY);
  });

  it('handles stocks with undefined changePercent gracefully', () => {
    const stocks = {
      SJIM: { symbol: 'SJIM', price: 21.40 },
      SPY: { symbol: 'SPY', price: 596.80 },
    };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignal).toBe('neutral');
  });

  it('is negative delta when SJIM underperforms SPY', () => {
    const stocks = {
      ...baseStocks,
      SJIM: makeStock('SJIM', 21.40, -0.50),
      SPY: makeStock('SPY', 596.80, 1.00),
    };
    const { result } = renderHook(() => useCramer(stocks));
    expect(result.current.inverseSignalDelta).toBeLessThan(0);
    expect(result.current.inverseSignal).toBe('neutral');
  });
});
