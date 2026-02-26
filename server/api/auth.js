import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days
const VERIFY_TTL = 24 * 60 * 60; // 24 hours

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `opticon_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax${secure ? '; Secure' : ''}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', [
    'opticon_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
  ]);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  });
  return cookies;
}

async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies.opticon_session;
  if (!token) return null;

  const session = await kv.get(`session:${token}`);
  if (!session) return null;
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await kv.del(`session:${token}`);
    return null;
  }
  return session;
}

export default async function handler(req, res) {
  const { action } = req.query;

  // GET: check current session
  if (req.method === 'GET' && action === 'me') {
    const session = await getSessionUser(req);
    if (!session) {
      return res.status(200).json({ authenticated: false });
    }
    const user = await kv.get(`user:${session.email}`);
    return res.status(200).json({
      authenticated: true,
      user: {
        id: user?.id,
        email: session.email,
        verified: user?.verified ?? false,
        tier: user?.tier || 'free',
        stripeCustomerId: user?.stripeCustomerId || null,
        watchlist: user?.watchlist || null,
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST: register
  if (action === 'register') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await kv.get(`user:${email.toLowerCase()}`);
    if (existing) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const verifyToken = generateToken();

    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash,
      verified: false,
      tier: 'free',
      stripeCustomerId: null,
      watchlist: null,
      createdAt: new Date().toISOString(),
    };

    await kv.set(`user:${email.toLowerCase()}`, user);
    await kv.set(`verify:${verifyToken}`, { email: email.toLowerCase() }, { ex: VERIFY_TTL });

    // Create session immediately (allow usage before verification)
    const sessionToken = generateToken();
    const session = {
      userId: id,
      email: email.toLowerCase(),
      tier: 'free',
      expiresAt: Date.now() + SESSION_TTL * 1000,
    };
    await kv.set(`session:${sessionToken}`, session, { ex: SESSION_TTL });
    setSessionCookie(res, sessionToken);

    // Log verification link (email sending requires SMTP config)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://opticon-production.vercel.app';
    const verifyUrl = `${baseUrl}/api/auth?action=verify-email&token=${verifyToken}`;
    console.log(`[AUTH] Verify email for ${email}: ${verifyUrl}`);

    return res.status(201).json({
      ok: true,
      user: { id, email: email.toLowerCase(), verified: false, tier: 'free' },
      verifyUrl: process.env.NODE_ENV !== 'production' ? verifyUrl : undefined,
    });
  }

  // POST: login
  if (action === 'login') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await kv.get(`user:${email.toLowerCase()}`);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = generateToken();
    const session = {
      userId: user.id,
      email: user.email,
      tier: user.tier || 'free',
      expiresAt: Date.now() + SESSION_TTL * 1000,
    };
    await kv.set(`session:${sessionToken}`, session, { ex: SESSION_TTL });
    setSessionCookie(res, sessionToken);

    return res.status(200).json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        tier: user.tier || 'free',
        stripeCustomerId: user.stripeCustomerId || null,
      },
    });
  }

  // GET (handled via query): verify email
  if (action === 'verify-email') {
    const { token } = req.method === 'GET' ? req.query : (req.body || {});
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const verification = await kv.get(`verify:${token}`);
    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const user = await kv.get(`user:${verification.email}`);
    if (user) {
      user.verified = true;
      await kv.set(`user:${verification.email}`, user);
    }
    await kv.del(`verify:${token}`);

    // Redirect to app with success
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://opticon-production.vercel.app';
    res.writeHead(302, { Location: `${baseUrl}?verified=1` });
    return res.end();
  }

  // POST: logout
  if (action === 'logout') {
    const cookies = parseCookies(req);
    const token = cookies.opticon_session;
    if (token) {
      await kv.del(`session:${token}`);
    }
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
