import { useState, useRef } from 'react';
import { Card } from './ui';
import { createBroker } from '../utils/broker';

const BROKERS = [
  { id: 'ctrader',     label: 'cTrader',      enabled: true  },
  { id: 'tradingview', label: 'TradingView',   enabled: true  },
  { id: 'ibkr',        label: 'IBKR',          enabled: false },
];

const MAX_LOG = 10;

export default function BrokerPanel({ dark, t, font, isPro, onUpgrade, config, onConfigChange, signalLog, autoSend, onAutoSendChange }) {
  const [selectedBroker, setSelectedBroker] = useState(config.broker || 'ctrader');
  const [fields, setFields] = useState({
    clientId:      config.clientId      || '',
    clientSecret:  config.clientSecret  || '',
    refreshToken:  config.refreshToken  || '',
    accountId:     config.accountId     || '',
    webhookUrl:    config.webhookUrl    || '',
    accessToken:   config.accessToken   || '',
  });
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null); // { ok, text }

  const brokerRef = useRef(null);

  const save = (broker, updated) => {
    onConfigChange({ broker, ...updated });
  };

  const handleBrokerSwitch = (id) => {
    if (!BROKERS.find(b => b.id === id)?.enabled) return;
    setSelectedBroker(id);
    setConnected(false);
    setTestMsg(null);
    save(id, fields);
  };

  const handleField = (key, val) => {
    const next = { ...fields, [key]: val };
    setFields(next);
    save(selectedBroker, next);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const cfg = selectedBroker === 'ctrader'
        ? { clientId: fields.clientId, clientSecret: fields.clientSecret, refreshToken: fields.refreshToken, accountId: fields.accountId, accessToken: fields.accessToken }
        : selectedBroker === 'tradingview'
        ? { webhookUrl: fields.webhookUrl }
        : {};

      const adapter = createBroker(selectedBroker, cfg);
      await adapter.connect();
      brokerRef.current = adapter;
      setConnected(true);
      setTestMsg({ ok: true, text: `Connected to ${BROKERS.find(b => b.id === selectedBroker)?.label}` });
    } catch (err) {
      setConnected(false);
      setTestMsg({ ok: false, text: err.message.replace('[BROKER] ', '') });
    } finally {
      setTesting(false);
    }
  };

  const labelStyle = { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: t.textTertiary, textTransform: 'uppercase', marginBottom: 4 };
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${t.border}`, borderRadius: 8,
    color: t.text, fontSize: 12, padding: '6px 10px',
    fontFamily: font, outline: 'none',
  };

  return (
    <Card dark={dark} t={t} style={{ padding: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: t.textSecondary, flexGrow: 1 }}>BROKER INTEGRATION</div>
        {/* Status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? t.green : t.red,
            boxShadow: connected ? `0 0 4px ${t.green}` : `0 0 4px ${t.red}`,
          }} />
          <span style={{ fontSize: 10, color: connected ? t.green : t.red, fontWeight: 600 }}>
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
        {/* Pro badge */}
        {isPro
          ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: t.accent, background: `${t.accent}18`, border: `1px solid ${t.accent}40`, borderRadius: 10, padding: '2px 7px' }}>PRO</span>
          : <button onClick={onUpgrade} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: t.yellow, background: `${t.yellow}18`, border: `1px solid ${t.yellow}40`, borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: font }}>UPGRADE</button>
        }
      </div>

      {/* Pro gate */}
      {!isPro && (
        <div style={{ background: dark ? 'rgba(255,204,0,0.07)' : 'rgba(255,180,0,0.07)', border: `1px solid ${t.yellow}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
          Broker integration requires a Pro subscription. Signals are formatted but not forwarded.
        </div>
      )}

      {/* Broker selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {BROKERS.map(b => (
          <button
            key={b.id}
            onClick={() => handleBrokerSwitch(b.id)}
            disabled={!b.enabled}
            style={{
              padding: '5px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500, fontFamily: font, cursor: b.enabled ? 'pointer' : 'not-allowed',
              border: selectedBroker === b.id ? `1.5px solid ${t.accent}` : `1px solid ${t.border}`,
              background: selectedBroker === b.id ? `${t.accent}15` : 'transparent',
              color: !b.enabled ? t.textTertiary : selectedBroker === b.id ? t.accent : t.textSecondary,
              opacity: b.enabled ? 1 : 0.5,
            }}
          >
            {b.label}
            {!b.enabled && <span style={{ fontSize: 9, marginLeft: 4 }}>(soon)</span>}
          </button>
        ))}
      </div>

      {/* Fields: cTrader */}
      {selectedBroker === 'ctrader' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {[
            { key: 'clientId',     label: 'Client ID',      ph: 'cTrader app client ID'    },
            { key: 'clientSecret', label: 'Client Secret',  ph: 'cTrader app secret'       },
            { key: 'refreshToken', label: 'Refresh Token',  ph: 'OAuth2 refresh token'     },
            { key: 'accountId',    label: 'Account ID',     ph: 'Trading account ID'       },
            { key: 'accessToken',  label: 'Access Token',   ph: 'Cached token (optional)'  },
          ].map(f => (
            <div key={f.key}>
              <div style={labelStyle}>{f.label}</div>
              <input
                type={f.key.includes('Secret') || f.key.includes('Token') ? 'password' : 'text'}
                value={fields[f.key]}
                onChange={e => handleField(f.key, e.target.value)}
                placeholder={f.ph}
                style={inputStyle}
                disabled={!isPro}
              />
            </div>
          ))}
        </div>
      )}

      {/* Fields: TradingView */}
      {selectedBroker === 'tradingview' && (
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Webhook URL</div>
          <input
            type="url"
            value={fields.webhookUrl}
            onChange={e => handleField('webhookUrl', e.target.value)}
            placeholder="https://your-webhook.com/alert"
            style={inputStyle}
            disabled={!isPro}
          />
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 5, lineHeight: 1.5 }}>
            Rise will POST signal JSON to this URL when auto-send is on.
          </div>
        </div>
      )}

      {/* Test Connection + Auto-send */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
        <button
          onClick={handleTest}
          disabled={testing || !isPro}
          style={{
            padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 600, fontFamily: font,
            background: testing ? t.border : t.accent, color: testing ? t.textTertiary : '#fff',
            border: 'none', cursor: testing || !isPro ? 'not-allowed' : 'pointer',
            opacity: !isPro ? 0.5 : 1,
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>

        {/* Auto-send toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isPro ? 'pointer' : 'not-allowed', fontSize: 11, color: t.textSecondary, userSelect: 'none' }}>
          <div
            onClick={() => isPro && onAutoSendChange(!autoSend)}
            style={{
              width: 32, height: 18, borderRadius: 9, position: 'relative',
              background: autoSend && isPro ? t.green : t.border,
              transition: 'background 0.2s',
              cursor: isPro ? 'pointer' : 'not-allowed',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: autoSend && isPro ? 16 : 2,
              width: 14, height: 14, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
          Auto-send
        </label>
      </div>

      {/* Test result message */}
      {testMsg && (
        <div style={{ fontSize: 11, color: testMsg.ok ? t.green : t.red, marginBottom: 12, padding: '4px 0' }}>
          {testMsg.ok ? 'OK: ' : 'ERR: '}{testMsg.text}
        </div>
      )}

      {/* Signal log */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: t.textTertiary, textTransform: 'uppercase', marginBottom: 6 }}>Signal Log</div>
        {signalLog.length === 0
          ? <div style={{ fontSize: 11, color: t.textTertiary, fontStyle: 'italic' }}>No signals yet</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[...signalLog].reverse().slice(0, MAX_LOG).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, fontFamily: 'monospace', color: t.textSecondary }}>
                  <span style={{ color: s.action === 'buy' ? t.green : t.red, fontWeight: 700, textTransform: 'uppercase', minWidth: 30 }}>{s.action}</span>
                  <span style={{ color: t.text, fontWeight: 600, minWidth: 40 }}>{s.sym}</span>
                  <span style={{ color: t.textTertiary }}>${s.entry?.toFixed(2)}</span>
                  <span style={{ color: s.sent ? t.cyan : t.textTertiary, marginLeft: 'auto' }}>{s.sent ? 'sent' : 'local'}</span>
                  <span style={{ color: t.textTertiary }}>{new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </Card>
  );
}
