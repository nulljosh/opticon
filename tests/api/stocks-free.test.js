import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler from '../../api/stocks-free.js';

global.fetch = vi.fn();

const makeChartResponse = (symbol, price = 150, prevClose = 148, opts = {}) => ({
  chart: {
    result: [{
      meta: {
        regularMarketPrice: price,
        chartPreviousClose: prevClose,
        regularMarketVolume: opts.volume ?? 50_000_000,
        regularMarketDayHigh: opts.high ?? price + 2,
        regularMarketDayLow: opts.low ?? price - 2,
        regularMarketOpen: opts.open ?? prevClose + 0.5,
        fiftyTwoWeekHigh: opts.high52 ?? price + 50,
        fiftyTwoWeekLow: opts.low52 ?? price - 50,
      },
    }],
  },
});

const mockOk = (body) => ({ ok: true, json: async () => body });
const mockFail = (status = 404) => ({ ok: false, status });

function makeReqRes(querySymbols) {
  let statusCode = 200;
  let jsonData = null;
  const mockRes = {
    status: vi.fn((code) => { statusCode = code; return mockRes; }),
    json: vi.fn((data) => { jsonData = data; return mockRes; }),
    setHeader: vi.fn(),
    getStatus: () => statusCode,
    getData: () => jsonData,
  };
  return {
    req: { query: querySymbols !== undefined ? { symbols: querySymbols } : {} },
    res: mockRes,
    status: () => statusCode,
    data: () => jsonData,
  };
}

describe('stocks-free API handler', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  // --- Happy path ---

  it('returns stock data for a valid symbol', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toBeInstanceOf(Array);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('AAPL');
    expect(data()[0].price).toBe(245);
    expect(data()[0].change).toBeCloseTo(-3, 1);
    expect(data()[0].changePercent).toBeCloseTo(-1.21, 1);
  });

  it('returns data for multiple symbols', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,MSFT');
    global.fetch
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248)))
      .mockResolvedValueOnce(mockOk(makeChartResponse('MSFT', 416, 414)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(2);
    expect(data().map(s => s.symbol)).toEqual(expect.arrayContaining(['AAPL', 'MSFT']));
  });

  it('uses default symbols when query param is absent', async () => {
    const { req, res, status, data } = makeReqRes(undefined);
    global.fetch.mockResolvedValue(mockOk(makeChartResponse('AAPL')));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data().length).toBeGreaterThan(0);
  });

  it('includes all required fields in response', async () => {
    const { req, res, data } = makeReqRes('NVDA');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('NVDA', 136, 138, {
      volume: 30_000_000, high: 140, low: 133, open: 138.5, high52: 175, low52: 80,
    })));

    await handler(req, res);

    const stock = data()[0];
    expect(stock).toMatchObject({
      symbol: 'NVDA',
      price: 136,
      change: expect.any(Number),
      changePercent: expect.any(Number),
      volume: 30_000_000,
      high: 140,
      low: 133,
      open: 138.5,
      prevClose: 138,
      fiftyTwoWeekHigh: 175,
      fiftyTwoWeekLow: 80,
    });
  });

  it('sets CORS and cache headers', async () => {
    const { req, res } = makeReqRes('AAPL');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('AAPL')));

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  });

  // --- Symbol limit ---

  it('rejects more than 100 symbols with 400', async () => {
    const { req, res, status, data } = makeReqRes(Array(101).fill('AAPL').join(','));

    await handler(req, res);

    expect(status()).toBe(400);
    expect(data().error).toMatch(/100/);
  });

  it('accepts exactly 100 symbols', async () => {
    const syms = Array.from({ length: 100 }, (_, i) => `T${String(i).padStart(3, '0')}`);
    const { req, res, status } = makeReqRes(syms.join(','));
    global.fetch.mockResolvedValue(mockOk(makeChartResponse('T000')));

    await handler(req, res);

    // Should not return 400
    expect(status()).not.toBe(400);
  });

  // --- Partial failures ---

  it('filters out symbols that fail on both query1 and query2', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,BADTICKER');
    global.fetch
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248))) // AAPL query1 ok
      .mockResolvedValueOnce(mockFail(404))  // BADTICKER query1 fails
      .mockResolvedValueOnce(mockFail(404)); // BADTICKER query2 fails

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('AAPL');
  });

  it('falls back to query2 when query1 returns non-ok', async () => {
    const { req, res, status, data } = makeReqRes('AAPL');
    global.fetch
      .mockResolvedValueOnce(mockFail(429))  // query1 rate limited
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248))); // query2 ok

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].price).toBe(245);
  });

  it('falls back to query2 on query1 network error', async () => {
    const { req, res, status, data } = makeReqRes('MSFT');
    global.fetch
      .mockRejectedValueOnce(new Error('ECONNRESET'))  // query1 throws
      .mockResolvedValueOnce(mockOk(makeChartResponse('MSFT', 416, 414))); // query2 ok

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('MSFT');
  });

  it('returns 500 when ALL symbols fail on both endpoints', async () => {
    const { req, res, status, data } = makeReqRes('FAKE1,FAKE2');
    global.fetch.mockResolvedValue(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500);
    expect(data().error).toBeDefined();
  });

  it('succeeds partially when only some symbols fail both endpoints', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,FAKE');
    global.fetch
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248))) // AAPL ok
      .mockResolvedValue(mockFail(404)); // FAKE always fails

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
  });

  // --- Per-symbol timeout ---

  it('handles per-symbol timeout by skipping to query2', async () => {
    vi.useFakeTimers();
    const { req, res, status, data } = makeReqRes('AAPL');

    global.fetch
      .mockImplementationOnce(() => {
        // query1: never resolves (will be aborted by 8s timeout)
        return new Promise(() => {});
      })
      .mockResolvedValueOnce(mockOk(makeChartResponse('AAPL', 245, 248)));

    const handlerPromise = handler(req, res);
    vi.advanceTimersByTime(8001); // trigger abort
    await handlerPromise;
    vi.useRealTimers();

    expect(status()).toBe(200);
    expect(data()[0].price).toBe(245);
  });

  // --- Malformed responses ---

  it('skips symbol with null chart result array', async () => {
    const { req, res, status, data } = makeReqRes('AAPL,MSFT');
    global.fetch
      .mockResolvedValueOnce(mockOk({ chart: { result: null } })) // AAPL bad
      .mockResolvedValueOnce(mockFail(404))                        // AAPL query2 bad
      .mockResolvedValueOnce(mockOk(makeChartResponse('MSFT', 416, 414))); // MSFT ok

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()).toHaveLength(1);
    expect(data()[0].symbol).toBe('MSFT');
  });

  it('skips symbol when price is missing', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch
      .mockResolvedValueOnce(mockOk({
        chart: { result: [{ meta: { chartPreviousClose: 248 } }] }, // no regularMarketPrice
      }))
      .mockResolvedValueOnce(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500); // no valid data
  });

  it('skips symbol when prevClose is zero (division guard)', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch
      .mockResolvedValueOnce(mockOk({
        chart: { result: [{ meta: { regularMarketPrice: 245, chartPreviousClose: 0 } }] },
      }))
      .mockResolvedValueOnce(mockFail(404));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  it('handles completely invalid JSON response without crashing', async () => {
    const { req, res, status } = makeReqRes('AAPL');
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('bad json'); } })
      .mockResolvedValueOnce(mockFail(500));

    await handler(req, res);

    expect(status()).toBe(500);
  });

  // --- Futures symbols ---

  it('handles futures symbols like GC=F correctly', async () => {
    const { req, res, status, data } = makeReqRes('GC=F');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('GC=F', 2943, 2932)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('GC=F');
    expect(data()[0].price).toBe(2943);
  });

  it('handles BRK-B hyphenated symbol correctly', async () => {
    const { req, res, status, data } = makeReqRes('BRK-B');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('BRK-B', 499, 497)));

    await handler(req, res);

    expect(status()).toBe(200);
    expect(data()[0].symbol).toBe('BRK-B');
  });

  // --- Change percent calculation ---

  it('computes changePercent correctly', async () => {
    const { req, res, data } = makeReqRes('TEST');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('TEST', 110, 100)));

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(10, 5);
    expect(data()[0].changePercent).toBeCloseTo(10, 5);
  });

  it('computes negative changePercent correctly', async () => {
    const { req, res, data } = makeReqRes('TEST');
    global.fetch.mockResolvedValueOnce(mockOk(makeChartResponse('TEST', 90, 100)));

    await handler(req, res);

    expect(data()[0].change).toBeCloseTo(-10, 5);
    expect(data()[0].changePercent).toBeCloseTo(-10, 5);
  });
});
