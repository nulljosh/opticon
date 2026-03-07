import { stripe } from '../../../lib/stripe.js';
import { getPlanByPriceId } from '../../../stripe.config.js';

// Important: configure express/next to pass raw body to this route
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'No signature' });

  let event;
  try {
    // req.body must be the raw Buffer — configure bodyParser accordingly
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  await handleStripeEvent(event);
  res.json({ received: true });
}

async function handleStripeEvent(event) {
  const obj = event.data.object;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const plan = getPlanByPriceId(obj.items.data[0]?.price.id);
      const userId = obj.metadata?.userId;
      const customerId = obj.customer;
      console.log(`[stripe] User ${userId} (cus: ${customerId}) → plan: ${plan}, status: ${obj.status}`);
      // TODO: update user's plan in your DB
      break;
    }
    case 'customer.subscription.deleted': {
      const userId = obj.metadata?.userId;
      console.log(`[stripe] User ${userId} subscription cancelled → free`);
      // TODO: downgrade in DB
      break;
    }
    case 'invoice.payment_failed': {
      console.warn(`[stripe] Payment failed for ${obj.customer}`);
      // TODO: notify user
      break;
    }
    default:
      console.log(`[stripe] Unhandled event: ${event.type}`);
  }
}
