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
  };
  return { req, res };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api/local-events handler', () => {
  it('returns degraded metadata when small-town sources produce no events', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/local-events.js');

    global.fetch = vi.fn((url) => {
      if (url.includes('nominatim.openstreetmap.org/reverse')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: { village: 'Hope' } }),
        });
      }
      if (url.includes('eventbriteapi.com')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [] }) });
      }
      if (url.includes('overpass-api.de')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ elements: [] }) });
      }
      if (url.includes('news.google.com')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<rss></rss>') });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { req, res } = makeReqRes({ lat: '49.38', lon: '-121.44' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.events).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
    expect(res._body.attemptedSources).toContain('news_rss');
  });

  it('returns live metadata and event sources when a provider succeeds', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/local-events.js');

    global.fetch = vi.fn((url) => {
      if (url.includes('nominatim.openstreetmap.org/reverse')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: { city: 'Vancouver' } }),
        });
      }
      if (url.includes('eventbriteapi.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            events: [{
              name: { text: 'Waterfront Night Market' },
              start: { utc: '2026-03-10T02:00:00Z' },
              venue: { latitude: '49.2827', longitude: '-123.1207' },
            }],
          }),
        });
      }
      if (url.includes('overpass-api.de')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ elements: [] }) });
      }
      if (url.includes('news.google.com')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<rss></rss>') });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.events).toHaveLength(1);
    expect(res._body.sources).toContain('eventbrite');
    expect(res._body.meta.status).toBe('live');
  });
});
