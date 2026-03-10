// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../server/api/weather-alerts.js';

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

describe('api/weather-alerts handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'POST';
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 400 for invalid lat/lon params', async () => {
    const { req, res } = makeReqRes({ lat: 'abc', lon: 'xyz' });
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns merged NOAA and Open-Meteo alerts', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('weather.gov')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            features: [
              {
                properties: {
                  event: 'Flood Warning',
                  severity: 'Severe',
                  headline: 'Flood warning in area',
                  expires: '2026-02-22T01:00:00Z',
                },
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          current_weather: { weathercode: 95 },
        }),
      });
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Cache-Control']).toContain('max-age=600');
    expect(res._body.alerts).toHaveLength(2);
    expect(res._body.alerts[0].source).toBe('noaa');
    expect(res._body.alerts[1].source).toBe('open-meteo');
    expect(res._body.meta.status).toBe('live');
  });

  it('handles NOAA failure and returns Open-Meteo severe alert', async () => {
    vi.resetModules();
    const { default: freshHandler } = await import('../server/api/weather-alerts.js');

    global.fetch = vi.fn(url => {
      if (url.includes('weather.gov')) return Promise.reject(new Error('NOAA down'));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ current_weather: { weathercode: 96 } }),
      });
    });

    const { req, res } = makeReqRes({ lat: '40.71', lon: '-74.00' });
    await freshHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.alerts).toHaveLength(1);
    expect(res._body.alerts[0].source).toBe('open-meteo');
    expect(res._body.meta.status).toBe('live');
  });

  it('returns degraded metadata when no provider returns alerts', async () => {
    vi.resetModules();
    const { default: freshHandler } = await import('../server/api/weather-alerts.js');

    global.fetch = vi.fn(() => Promise.reject(new Error('all down')));

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await freshHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.alerts).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
  });
});
