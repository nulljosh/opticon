import Stripe from 'stripe';
import { kv } from '@vercel/kv';

let stripe;
function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

// Routes:
//   POST ?action=checkout  { priceId }    → create checkout session
//   POST ?action=portal    { customerId } → create billing portal session
//   GET  ?action=status&customerId=...    → subscription status

export default async function handler(req, res) {
  const { action, customerId } = req.query;
  const allowedPriceIds = new Set(
    [process.env.STRIPE_PRICE_ID_STARTER, process.env.STRIPE_PRICE_ID_PRO].filter(Boolean)
  );

  // GET: subscription status
  if (req.method === 'GET' && action === 'status') {
    try {
      if (!customerId) {
        return res.status(200).json({ status: null, tier: 'free' });
      }
      const subscription = await kv.get(`sub:${customerId}`);
      if (!subscription) {
        return res.status(200).json({ status: null, tier: 'free' });
      }
      return res.status(200).json({
        ...subscription,
        tier: subscription.status === 'active' ? 'pro' : 'free',
      });
    } catch (err) {
      console.error('[STRIPE/status] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST: checkout
  if (action === 'checkout') {
    try {
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: 'Price ID required' });
      if (allowedPriceIds.size > 0 && !allowedPriceIds.has(priceId)) {
        return res.status(400).json({ error: 'Invalid price ID' });
      }
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://opticon-production.vercel.app';
      const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: baseUrl,
        customer_creation: 'always',
        allow_promotion_codes: true,
      });
      return res.status(200).json({ sessionId: session.id, url: session.url });
    } catch (err) {
      console.error('[STRIPE/checkout] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: portal
  if (action === 'portal') {
    try {
      const { customerId: cid } = req.body;
      if (!cid) return res.status(400).json({ error: 'Customer ID required' });
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://opticon-production.vercel.app';
      const session = await getStripe().billingPortal.sessions.create({
        customer: cid,
        return_url: baseUrl,
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[STRIPE/portal] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
