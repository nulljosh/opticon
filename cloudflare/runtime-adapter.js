function toQueryObject(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    if (key in query) {
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
    } else {
      query[key] = value;
    }
  }
  return query;
}

function toHeaderObject(headers) {
  return Object.fromEntries(headers.entries());
}

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return undefined;
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  if (contentType.includes('multipart/form-data')) {
    return await request.formData();
  }

  try {
    return await request.text();
  } catch {
    return undefined;
  }
}

export async function toNodeRequest(request) {
  const url = new URL(request.url);
  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    query: toQueryObject(url.searchParams),
    headers: toHeaderObject(request.headers),
    body: await readBody(request),
  };
}

export function createNodeResponse() {
  const headers = new Headers();
  let statusCode = 200;
  let body = '';

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    setHeader(name, value) {
      if (Array.isArray(value)) {
        headers.delete(name);
        value.forEach((item) => headers.append(name, item));
        return;
      }
      headers.set(name, value);
    },
    json(payload) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      body = JSON.stringify(payload);
      return res;
    },
    send(payload) {
      body = typeof payload === 'string' ? payload : String(payload ?? '');
      return res;
    },
    end(payload = '') {
      body = payload;
      return res;
    },
    toResponse() {
      return new Response(body, { status: statusCode, headers });
    },
  };

  return res;
}

export function installProcessEnv(env = {}) {
  const stringEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      stringEnv[key] = value;
    }
  }

  if (!globalThis.process) {
    globalThis.process = { env: {} };
  } else if (!globalThis.process.env) {
    globalThis.process.env = {};
  }

  globalThis.process.env = {
    ...globalThis.process.env,
    ...stringEnv,
    NODE_ENV: globalThis.process.env.NODE_ENV || 'production',
  };
}
