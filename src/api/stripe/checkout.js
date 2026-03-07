import { stripe, getOrCreateCustomer } from '../../lib/stripe.js';
import { PLANS } from '../../stripe.config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { priceId, userId, email, existingCustomerId } = req.body;
  if (!priceId || !userId || !email) return res.status(400).json({ error: 'Missing required fields' });

  const validPriceIds = Object.values(PLANS).map((p) => p.priceId).filter(Boolean);
  if (!validPriceIds.includes(priceId)) return res.status(400).json({ error: 'Invalid price ID' });

  const customerId = await getOrCreateCustomer({ userId, email, existingCustomerId });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing?success=1`,
    cancel_url: `${process.env.APP_URL}/pricing?cancelled=1`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
  });

  // TODO: persist customerId to your DB here
  // await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });

  res.json({ url: session.url, customerId });
}
