import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID required' });
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.VERCEL_URL || 'https://bread-alpha.vercel.app'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.VERCEL_URL || 'https://bread-alpha.vercel.app'}/pricing`,
      allow_promotion_codes: true,
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[STRIPE-CHECKOUT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
