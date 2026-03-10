// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../server/api/earthquakes.js';

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/earthquakes handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'POST';
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns mapped earthquakes from USGS', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            properties: { mag: 3.2, place: '10km NW of Test', time: 1708000000 },
            geometry: { coordinates: [-123.1, 49.2, 12.3] },
          },
        ],
      }),
    });

    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Cache-Control']).toContain('max-age=300');
    expect(res._body.earthquakes).toHaveLength(1);
    expect(res._body.meta.status).toBe('live');
    expect(res._body.earthquakes[0]).toEqual({
      mag: 3.2,
      place: '10km NW of Test',
      time: 1708000000,
      lat: 49.2,
      lon: -123.1,
      depth: 12.3,
    });
  });

  it('returns 502 when USGS fetch fails', async () => {
    vi.resetModules();
    const { default: freshHandler } = await import('../server/api/earthquakes.js');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { req, res } = makeReqRes();
    await freshHandler(req, res);

    expect(res._status).toBe(502);
    expect(res._body.error).toBeTruthy();
    expect(res._body.earthquakes).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
  });
});
