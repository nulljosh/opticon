import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // In a real app, get customer ID from session/JWT
    // For now, return null (free tier)
    const customerId = req.query.customerId;

    if (!customerId) {
      return res.status(200).json({
        status: null,
        tier: 'free',
      });
    }

    const subscription = await kv.get(`sub:${customerId}`);

    if (!subscription) {
      return res.status(200).json({
        status: null,
        tier: 'free',
      });
    }

    res.status(200).json({
      ...subscription,
      tier: subscription.status === 'active' ? 'pro' : 'free',
    });
  } catch (err) {
    console.error('[SUBSCRIPTION-STATUS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
