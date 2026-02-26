import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'opticon_watchlist';

// Default watchlist: MAG7 + major indices + popular stocks
const DEFAULT_WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'JPM', 'V', 'NFLX', 'PLTR', 'COIN',
];

export function useWatchlist(authUser) {
  const [watchlist, setWatchlist] = useState(() => {
    // Try loading from auth user record first, then localStorage
    if (authUser?.watchlist) return authUser.watchlist;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // storage full, ignore
    }
  }, [watchlist]);

  const addSymbol = useCallback((symbol) => {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return;
    setWatchlist(prev => {
      if (prev.includes(sym)) return prev;
      return [...prev, sym];
    });
  }, []);

  const removeSymbol = useCallback((symbol) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  }, []);

  const toggleSymbol = useCallback((symbol) => {
    const sym = symbol.toUpperCase().trim();
    setWatchlist(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  }, []);

  const resetToDefault = useCallback(() => {
    setWatchlist(DEFAULT_WATCHLIST);
  }, []);

  return {
    watchlist,
    addSymbol,
    removeSymbol,
    toggleSymbol,
    resetToDefault,
    isInWatchlist: (sym) => watchlist.includes(sym),
  };
}
