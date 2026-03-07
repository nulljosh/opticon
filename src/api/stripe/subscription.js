import { stripe } from '../../lib/stripe.js';
import { getPlanByPriceId } from '../../stripe.config.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { customerId } = req.query;

  if (!customerId) return res.json({ plan: 'free', subscription: null });

  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    const active = subs.data[0] ?? null;
    const plan = active ? getPlanByPriceId(active.items.data[0]?.price.id) : 'free';

    res.json({
      plan,
      status: active?.status ?? null,
      currentPeriodEnd: active?.current_period_end ?? null,
      cancelAtPeriodEnd: active?.cancel_at_period_end ?? false,
      subscription: active,
    });
  } catch (err) {
    console.error('Failed to fetch subscription:', err);
    res.json({ plan: 'free', subscription: null });
  }
}
