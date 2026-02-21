// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './flights.js';

const mockOpenSkyResponse = {
  time: 1708000000,
  states: [
    ['abc123', 'AC123   ', 'Canada', 1708000000, 1708000000, -123.1, 49.2, 10668, false, 240, 180, null, null, null, 'none', null, 0],
    ['def456', 'WS456   ', 'Canada', 1708000000, 1708000000, -122.9, 49.0, 11582, false, 220, 90, null, null, null, 'none', null, 0],
    ['xyz789', 'UA789   ', 'USA',    1708000000, 1708000000, -123.2, 49.1, null,  true,  0,   0, null, null, null, 'none', null, 0], // onGround, should be filtered
  ],
};

function makeReqRes(query = {}) {
  const req = { method: 'GET', query };
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  return { req, res };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/flights handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'POST';
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._body.error).toMatch(/method/i);
  });

  it('returns 400 for missing bbox params', async () => {
    const { req, res } = makeReqRes({ lamin: '49' });
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBeTruthy();
  });

  it('returns 400 for invalid bbox (lamin >= lamax)', async () => {
    const { req, res } = makeReqRes({ lamin: '50', lomin: '-124', lamax: '49', lomax: '-121' });
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 for NaN bbox values', async () => {
    const { req, res } = makeReqRes({ lamin: 'abc', lomin: '-124', lamax: '51', lomax: '-121' });
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns flight states from OpenSky', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenSkyResponse),
    });

    const { req, res } = makeReqRes({ lamin: '47', lomin: '-126', lamax: '51', lomax: '-120' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.source).toBe('opensky');
    // onGround flight should be filtered out
    expect(res._body.states.every(s => !s.onGround)).toBe(true);
    expect(res._body.count).toBe(2);
  });

  it('converts altitude from metres to feet', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenSkyResponse),
    });

    const { req, res } = makeReqRes({ lamin: '47', lomin: '-126', lamax: '51', lomax: '-120' });
    await handler(req, res);
    const first = res._body.states[0];
    // 10668m = ~35000ft
    expect(first.altitude).toBeCloseTo(35000, -2);
  });

  it('returns 502 when OpenSky fails', async () => {
    // Reload handler module to get a fresh cache (avoids stale cache from prior tests)
    vi.resetModules();
    const { default: freshHandler } = await import('./flights.js');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { req, res } = makeReqRes({ lamin: '47', lomin: '-126', lamax: '51', lomax: '-120' });
    await freshHandler(req, res);

    expect(res._status).toBe(502);
    expect(res._body.error).toBeTruthy();
    expect(res._body.states).toEqual([]);
    expect(res._body.count).toBe(0);
  });

  it('sets cache headers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenSkyResponse),
    });

    const { req, res } = makeReqRes({ lamin: '47', lomin: '-126', lamax: '51', lomax: '-120' });
    await handler(req, res);
    expect(res._headers['Cache-Control']).toContain('max-age=15');
  });

  it('trims callsign whitespace', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenSkyResponse),
    });
    const { req, res } = makeReqRes({ lamin: '47', lomin: '-126', lamax: '51', lomax: '-120' });
    await handler(req, res);
    res._body.states.forEach(s => {
      expect(s.callsign).toBe(s.callsign.trim());
    });
  });
});
