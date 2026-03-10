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

describe('api/crime handler', () => {
  it('returns degraded metadata when no regional or news results exist', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/crime.js');

    global.fetch = vi.fn((url) => {
      if (url.includes('nominatim.openstreetmap.org/reverse')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: { village: 'Hope' } }),
        });
      }
      if (url.includes('news.google.com')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('<rss></rss>') });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { req, res } = makeReqRes({ lat: '49.38', lon: '-121.44' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.incidents).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
    expect(res._body.attemptedSources).toContain('canadian_news_fallback');
  });

  it('returns live metadata when nearby city or news coverage yields incidents', async () => {
    vi.resetModules();
    const { default: handler } = await import('../server/api/crime.js');

    global.fetch = vi.fn((url) => {
      if (url.includes('nominatim.openstreetmap.org/reverse')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ address: { city: 'Vancouver' } }),
        });
      }
      if (url.includes('news.google.com')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`
            <rss>
              <item>
                <title><![CDATA[Vancouver police investigate robbery downtown]]></title>
                <pubDate>Tue, 10 Mar 2026 01:00:00 GMT</pubDate>
              </item>
            </rss>
          `),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.incidents.length).toBeGreaterThan(0);
    expect(res._body.sources).toContain('news_rss');
    expect(res._body.meta.status).toBe('live');
  });
});
