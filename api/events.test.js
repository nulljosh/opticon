// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../server/api/events.js';

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

describe('api/events handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'PATCH';
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns mapped events from GDELT', async () => {
    const articles = Array.from({ length: 12 }, (_, i) => ({
      title: `Event ${i + 1}`,
      url: `https://example.com/${i + 1}`,
      domain: 'example.com',
      seendate: '2026-02-20T12:00:00Z',
      sourcecountry: 'US',
    }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles }),
    });

    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Cache-Control']).toContain('max-age=300');
    expect(res._body.events).toHaveLength(10);
    expect(res._body.meta.status).toBe('live');
    expect(res._body.events[0]).toEqual({
      title: 'Event 1',
      url: 'https://example.com/1',
      domain: 'example.com',
      date: '2026-02-20T12:00:00Z',
      country: 'US',
    });
  });

  it('returns 502 when GDELT fails', async () => {
    vi.resetModules();
    const { default: freshHandler } = await import('../server/api/events.js');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { req, res } = makeReqRes();
    await freshHandler(req, res);

    expect(res._status).toBe(502);
    expect(res._body.error).toBeTruthy();
    expect(res._body.events).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
  });
});
