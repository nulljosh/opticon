import { useState, useEffect } from 'react';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for customer ID (saved after checkout)
    // Also check auth user record for stripe_customer_id
    const customerId = localStorage.getItem('stripe_customer_id');

    if (!customerId) {
      setSubscription({ tier: 'free', status: null });
      setLoading(false);
      return;
    }

    fetch(`/api/stripe?action=status&customerId=${customerId}`)
      .then(r => r.json())
      .then(data => {
        setSubscription(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch subscription:', err);
        setSubscription({ tier: 'free', status: null });
        setLoading(false);
      });
  }, []);

  return {
    isPro: subscription?.tier === 'pro',
    isFree: subscription?.tier === 'free' || !subscription,
    subscription,
    loading,
  };
}
