// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from './traffic.js';

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

const mockTomTomFlow = {
  flowSegmentData: {
    currentSpeed: 60,
    freeFlowSpeed: 100,
    confidence: 0.9,
  },
};

const mockHereIncidents = {
  results: [
    {
      incidentDetails: { type: 'ACCIDENT', description: { value: 'Minor collision' }, criticality: 'MINOR', startTime: '2026-02-20T10:00:00Z' },
      location: { shape: { links: [{ points: [{ lat: 49.2, lng: -123.1 }] }] } },
    },
  ],
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TOMTOM_API_KEY;
  delete process.env.HERE_API_KEY;
});

describe('api/traffic handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'DELETE';
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when no location params provided', async () => {
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toBeTruthy();
  });

  it('returns 400 for invalid lat/lon', async () => {
    const { req, res } = makeReqRes({ lat: 'abc', lon: 'xyz' });
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns flow and incidents when both APIs succeed', async () => {
    process.env.TOMTOM_API_KEY = 'test-tomtom-key';
    process.env.HERE_API_KEY = 'test-here-key';

    global.fetch = vi.fn(url => {
      if (url.includes('tomtom.com')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTomTomFlow) });
      if (url.includes('hereapi.com')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHereIncidents) });
      return Promise.reject(new Error('Unknown'));
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.flow.currentSpeed).toBe(60);
    expect(res._body.flow.freeFlowSpeed).toBe(100);
    expect(res._body.incidents).toHaveLength(1);
    expect(res._body.center.lat).toBeCloseTo(49.28, 2);
  });

  it('classifies heavy congestion when speed ratio < 0.4', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';

    global.fetch = vi.fn(url => {
      if (url.includes('tomtom.com')) return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          flowSegmentData: { currentSpeed: 30, freeFlowSpeed: 100, confidence: 0.8 },
        }),
      });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);
    expect(res._body.flow.congestion).toBe('heavy');
  });

  it('classifies moderate congestion when speed ratio 0.4-0.7', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';

    global.fetch = vi.fn(url => {
      if (url.includes('tomtom.com')) return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          flowSegmentData: { currentSpeed: 55, freeFlowSpeed: 100, confidence: 0.9 },
        }),
      });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);
    expect(res._body.flow.congestion).toBe('moderate');
  });

  it('returns source none when TomTom key missing', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }));
    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.flow.source).toBe('none');
    expect(res._body.flow.congestion).toBe('unknown');
  });

  it('accepts bbox params instead of lat/lon', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockTomTomFlow),
    }));

    const { req, res } = makeReqRes({ lamin: '48', lomin: '-124', lamax: '50', lomax: '-122' });
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.center.lat).toBeCloseTo(49, 0);
    expect(res._body.center.lon).toBeCloseTo(-123, 0);
  });

  it('sets cache headers', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) }));
    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);
    expect(res._headers['Cache-Control']).toContain('max-age=60');
  });

  it('handles TomTom API failure gracefully without crashing', async () => {
    process.env.TOMTOM_API_KEY = 'test-key';
    global.fetch = vi.fn(url => {
      if (url.includes('tomtom.com')) return Promise.reject(new Error('TomTom down'));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.flow.source).toBe('none');
  });
});
