import { PLAN_ORDER } from '../stripe.config.js';
import { usePlan } from '../hooks/usePlan.js';
import './PaywallGate.css';

/**
 * PaywallGate — wraps content, blocks it behind a required plan.
 *
 * Props:
 *   requiredPlan  'pro' | 'premium'  (default: 'pro')
 *   customerId    string  (Stripe customer ID)
 *   fallback      React node  (custom fallback — optional)
 *   children      content shown to authorized users
 *   blur          bool  — blur content instead of hiding (default: false)
 */
export default function PaywallGate({ requiredPlan = 'pro', customerId, fallback, children, blur = false }) {
  const { plan, loading } = usePlan(customerId);

  if (loading) return <div className="paywall-loading" />;

  const hasAccess = PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(requiredPlan);

  if (hasAccess) return <>{children}</>;

  if (blur) {
    return (
      <div className="paywall-blur-wrapper">
        <div className="paywall-blur-content" aria-hidden="true">{children}</div>
        <div className="paywall-blur-overlay">
          {fallback ?? <DefaultFallback requiredPlan={requiredPlan} />}
        </div>
      </div>
    );
  }

  return fallback ?? <DefaultFallback requiredPlan={requiredPlan} />;
}

function DefaultFallback({ requiredPlan }) {
  const label = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);
  return (
    <div className="paywall-default">
      <div className="paywall-icon">🔒</div>
      <h3 className="paywall-title">{label} feature</h3>
      <p className="paywall-desc">Upgrade to {label} to unlock this.</p>
      <a className="paywall-cta" href="/pricing">View plans →</a>
    </div>
  );
}
