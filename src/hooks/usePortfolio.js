import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEMO_HOLDINGS, DEMO_ACCOUNTS, DEMO_BUDGET, DEMO_DEBT,
  DEMO_GOALS, DEMO_SPENDING, DEMO_GIVING, validatePortfolioData,
} from '../utils/financeData';

const STORAGE_KEY = 'rise_portfolio';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const { valid } = validatePortfolioData(data);
    return valid ? data : null;
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save portfolio:', err);
  }
}

export function usePortfolio(stocks) {
  const [customData, setCustomData] = useState(() => loadFromStorage());
  const isDemo = !customData;

  const holdings = customData?.holdings ?? DEMO_HOLDINGS;
  const accounts = customData?.accounts ?? DEMO_ACCOUNTS;
  const budget = customData?.budget ?? DEMO_BUDGET;
  const debt = customData?.debt ?? DEMO_DEBT;
  const goals = customData?.goals ?? DEMO_GOALS;
  const spending = customData?.spending ?? DEMO_SPENDING;
  const giving = customData?.giving ?? DEMO_GIVING;

  // Merge live stock prices with holdings for real-time valuation
  const valuedHoldings = useMemo(() => {
    if (!stocks) return holdings.map(h => ({ ...h, currentPrice: h.costBasis, value: h.shares * h.costBasis, gain: 0, gainPercent: 0 }));

    return holdings.map(h => {
      const live = stocks[h.symbol];
      const currentPrice = live?.price ?? h.costBasis;
      const value = h.shares * currentPrice;
      const cost = h.shares * h.costBasis;
      const gain = value - cost;
      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...h, currentPrice, value, gain, gainPercent, changePercent: live?.changePercent ?? 0 };
    });
  }, [holdings, stocks]);

  const stocksValue = useMemo(() => valuedHoldings.reduce((sum, h) => sum + h.value, 0), [valuedHoldings]);
  const cashValue = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
  const totalDebt = useMemo(() => debt.reduce((sum, d) => sum + d.balance, 0), [debt]);

  const totalIncome = useMemo(() => budget.income.reduce((sum, i) => sum + i.amount, 0), [budget]);
  const totalExpenses = useMemo(() => budget.expenses.reduce((sum, e) => sum + e.amount, 0), [budget]);
  const surplus = totalIncome - totalExpenses;

  const netWorth = stocksValue + cashValue - totalDebt;

  const importData = useCallback((data) => {
    const { valid, error } = validatePortfolioData(data);
    if (!valid) return { success: false, error };
    setCustomData(data);
    saveToStorage(data);
    return { success: true };
  }, []);

  const exportData = useCallback(() => {
    return customData || {
      holdings: DEMO_HOLDINGS,
      accounts: DEMO_ACCOUNTS,
      budget: DEMO_BUDGET,
      debt: DEMO_DEBT,
      goals: DEMO_GOALS,
      spending: DEMO_SPENDING,
      giving: DEMO_GIVING,
    };
  }, [customData]);

  const resetToDemo = useCallback(() => {
    setCustomData(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    holdings: valuedHoldings,
    accounts,
    budget,
    debt,
    goals,
    spending,
    giving,
    stocksValue,
    cashValue,
    totalDebt,
    totalIncome,
    totalExpenses,
    surplus,
    netWorth,
    isDemo,
    importData,
    exportData,
    resetToDemo,
  };
}
