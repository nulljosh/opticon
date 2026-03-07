import { stripe } from '../../lib/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: 'Missing customerId' });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.APP_URL}/billing`,
  });

  res.json({ url: session.url });
}
