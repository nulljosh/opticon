import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Card } from './ui';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function PricingPage({ dark, t, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO,
        }),
      });

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        maxWidth: 900,
        width: '100%',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 700,
            color: t.text,
            margin: 0,
          }}>Rise Pro</h1>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: t.textSecondary,
              fontSize: 24,
              cursor: 'pointer',
              padding: 8,
            }}
          >×</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {/* Free Tier */}
          <Card t={t} dark={dark} style={{ padding: 32 }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 24,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 8,
              }}>Free</h3>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: t.text,
                fontFamily: 'tabular-nums',
              }}>$0</div>
              <div style={{
                fontSize: 14,
                color: t.textSecondary,
              }}>Forever free</div>
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginBottom: 24,
            }}>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Prediction markets (Polymarket)</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Live stock data (US50)</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Monte Carlo simulations</li>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Trading simulator</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ Real-time cTrader signals</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ TradingView webhooks</li>
              <li style={{ marginBottom: 12, color: t.textTertiary }}>✗ Advanced analytics</li>
            </ul>

            <div style={{
              padding: 12,
              background: t.backgroundSecondary,
              borderRadius: 12,
              textAlign: 'center',
              color: t.textSecondary,
              fontSize: 14,
              fontWeight: 600,
            }}>
              Current Plan
            </div>
          </Card>

          {/* Pro Tier */}
          <Card t={t} dark={dark} style={{
            padding: 32,
            border: `2px solid ${t.blue}`,
            boxShadow: `0 0 40px ${t.blue}40`,
          }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 24,
                fontWeight: 600,
                color: t.text,
                margin: 0,
                marginBottom: 8,
              }}>Pro</h3>
              <div style={{
                fontSize: 48,
                fontWeight: 700,
                color: t.text,
                fontFamily: 'tabular-nums',
              }}>$49</div>
              <div style={{
                fontSize: 14,
                color: t.textSecondary,
              }}>per month</div>
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginBottom: 24,
            }}>
              <li style={{ marginBottom: 12, color: t.text }}>✓ Everything in Free</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Real-time cTrader integration</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ TradingView webhook access</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Priority API access</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Advanced Monte Carlo scenarios</li>
              <li style={{ marginBottom: 12, color: t.blue, fontWeight: 600 }}>+ Live trade execution</li>
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={loading}
              style={{
                width: '100%',
                padding: 16,
                background: t.blue,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? 'Loading...' : 'Upgrade to Pro'}
            </button>
          </Card>
        </div>

        <div style={{
          marginTop: 24,
          padding: 24,
          background: t.backgroundSecondary,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
        }}>
          <p style={{
            margin: 0,
            color: t.textSecondary,
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            Cancel anytime. No contracts. Secure payments powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
