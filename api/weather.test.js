// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';

function makeReqRes(query = {}) {
  const req = { method: 'GET', query };
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(k, v) { this._headers[k] = v; },
    end() { return this; },
  };
  return { req, res };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/weather handler', () => {
  it('returns live weather data with freshness metadata', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/weather.js');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        current_weather: { temperature: 12.4, windspeed: 14.2, winddirection: 90, weathercode: 2 },
        hourly: { relative_humidity_2m: [71] },
      }),
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.temp).toBe(12);
    expect(res._body.meta.status).toBe('live');
  });

  it('returns degraded fallback when Open-Meteo fails', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/weather.js');

    global.fetch = vi.fn().mockRejectedValue(new Error('Open-Meteo down'));

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.fallback).toBe(true);
    expect(res._body.meta.status).toBe('degraded');
  });
});
