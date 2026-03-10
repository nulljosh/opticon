// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../server/api/incidents.js';

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

describe('api/incidents handler', () => {
  it('returns 405 for non-GET methods', async () => {
    const { req, res } = makeReqRes();
    req.method = 'PUT';
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when location params are missing', async () => {
    const { req, res } = makeReqRes({});
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/lat\/lon or bbox/i);
  });

  it('returns mapped incidents for lat/lon query', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        elements: [
          { tags: { highway: 'construction', name: 'Road Work' }, center: { lat: 49.2, lon: -123.1 } },
          { tags: { barrier: 'gate' }, lat: 49.1, lon: -123.0 },
          { tags: { highway: 'construction' } }, // no coordinates => filtered
        ],
      }),
    });

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Cache-Control']).toContain('max-age=600');
    expect(res._body.incidents).toHaveLength(2);
    expect(res._body.meta.status).toBe('live');
    expect(res._body.incidents[0].type).toBe('construction');
    expect(res._body.incidents[0].description).toBe('Road Work');
  });

  it('returns mapped incidents for bbox query', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        elements: [{ tags: { highway: 'road_works' }, lat: 49.3, lon: -123.2 }],
      }),
    });

    const { req, res } = makeReqRes({ lamin: '49', lomin: '-124', lamax: '50', lomax: '-123' });
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.incidents).toHaveLength(1);
    expect(res._body.incidents[0].type).toBe('road_works');
    expect(res._body.meta.status).toBe('live');
  });

  it('returns empty incidents when Overpass fails', async () => {
    vi.resetModules();
    const { default: freshHandler } = await import('../server/api/incidents.js');
    global.fetch = vi.fn().mockRejectedValue(new Error('Down'));

    const { req, res } = makeReqRes({ lat: '49.28', lon: '-123.12' });
    await freshHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._body.incidents).toEqual([]);
    expect(res._body.meta.status).toBe('degraded');
  });
});
