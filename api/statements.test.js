import { describe, expect, it } from 'vitest';
import { categorizeTransaction, parseStatementText, summarizeTransactions } from '../server/api/statements-shared.js';

const SAMPLE_TEXT = `
2026-02-05
2026-02-05
Apple Store
–$750.23
$1,020.53
2026-02-05
2026-02-05
Claude.ai Subscription
–$136.60
$883.93
2026-02-16
2026-02-16
SP SUPER FANTASTIC BIRMINGHAM AL
$43.06
$300.82
2026-02-26
2026-02-26
Direct deposit from PROVINCE OF B.C
$1,060.00
$1,072.68
`;

describe('statement helpers', () => {
  it('parses wealthsimple rows into signed transactions', () => {
    const transactions = parseStatementText(SAMPLE_TEXT);

    expect(transactions).toHaveLength(4);
    expect(transactions[0]).toMatchObject({
      description: 'Apple Store',
      amount: -750.23,
      category: 'shopping',
    });
    expect(transactions[2]).toMatchObject({
      description: 'SP SUPER FANTASTIC BIRMINGHAM AL',
      amount: 43.06,
      category: 'shopping',
    });
  });

  it('summarizes spending and ignores income', () => {
    const transactions = parseStatementText(SAMPLE_TEXT);
    const summary = summarizeTransactions(transactions, 'February_2026.pdf');

    expect(summary.month).toBe('Feb 2026');
    expect(summary.categories).toEqual({
      shopping: 750.23,
      apps: 136.6,
    });
    expect(summary.total).toBe(886.83);
  });

  it('classifies transfer and food merchants cleanly', () => {
    expect(categorizeTransaction('Interac e-Transfer® Out')).toBe('transfers');
    expect(categorizeTransaction('Starbucks 8007827282')).toBe('food');
    expect(categorizeTransaction('Direct deposit from PROVINCE OF B.C')).toBe(null);
  });
});
