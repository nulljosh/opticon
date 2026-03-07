import { useState } from 'react';
import { PLANS } from '../stripe.config.js';
import './PricingTable.css';

/**
 * PricingTable — full pricing cards with upgrade CTAs.
 *
 * Props:
 *   currentPlan  'free' | 'pro' | 'premium'
 *   userId       string
 *   userEmail    string
 *   customerId   string (Stripe cus_xxx — pass if you have it)
 *   onUpgrade    (plan, url) => void  — called with checkout URL (optional)
 */
export default function PricingTable({ currentPlan = 'free', userId, userEmail, customerId, onUpgrade }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  async function handleUpgrade(planKey) {
    const plan = PLANS[planKey];
    if (!plan.priceId) return;

    setLoading(planKey);
    setError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          userId,
          email: userEmail,
          existingCustomerId: customerId,
        }),
      });

      if (!res.ok) throw new Error('Checkout failed');
      const { url } = await res.json();

      if (onUpgrade) onUpgrade(planKey, url);
      else window.location.href = url;
    } catch (err) {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    if (!customerId) return;
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div className="pricing-table">
      {error && <p className="pricing-error">{error}</p>}
      {Object.entries(PLANS).map(([key, plan]) => {
        const isCurrent = currentPlan === key;
        const isUpgrade = ['free', 'pro', 'premium'].indexOf(key) > ['free', 'pro', 'premium'].indexOf(currentPlan);
        return (
          <div key={key} className={`pricing-card ${isCurrent ? 'pricing-card--current' : ''} ${key === 'pro' ? 'pricing-card--featured' : ''}`}>
            {key === 'pro' && <span className="pricing-badge">Most Popular</span>}
            <h3 className="pricing-name">{plan.name}</h3>
            <div className="pricing-price">
              {plan.price === 0 ? (
                <span className="pricing-amount">Free</span>
              ) : (
                <>
                  <span className="pricing-currency">$</span>
                  <span className="pricing-amount">{plan.price}</span>
                  <span className="pricing-period">/mo</span>
                </>
              )}
            </div>
            <ul className="pricing-features">
              {plan.features.map((f) => (
                <li key={f}>
                  <span className="pricing-check">✓</span> {f}
                </li>
              ))}
            </ul>
            <div className="pricing-action">
              {isCurrent ? (
                customerId ? (
                  <button className="pricing-btn pricing-btn--manage" onClick={handleManageBilling}>
                    Manage Billing
                  </button>
                ) : (
                  <button className="pricing-btn pricing-btn--current" disabled>
                    Current Plan
                  </button>
                )
              ) : isUpgrade && plan.priceId ? (
                <button
                  className="pricing-btn pricing-btn--upgrade"
                  onClick={() => handleUpgrade(key)}
                  disabled={loading === key}
                >
                  {loading === key ? 'Loading...' : `Upgrade to ${plan.name}`}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
