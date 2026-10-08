import { useEffect, useState } from 'react';
import { api, BillingCfg } from '../../lib/api';

export default function Billing() {
  const [b, setB] = useState<BillingCfg | null>(null);
  const [minW, setMinW] = useState(10);
  const [currency, setCurrency] = useState('USD');
  const load = () => {
    api.consoleBilling().then(cfg => { setB(cfg); setCurrency(cfg.currency || 'USD'); }).catch(() => {});
    api.config().then(c => setMinW(c.minWithdraw)).catch(() => {});
  };
  useEffect(load, []);
  const save = async () => {
    await api.consoleBillingSave({ minWithdraw: minW, currency });
    alert('Saved - Else Pay only, no external providers');
    load();
  };
  if (!b) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Billing setup - Else Pay only</h3>
      <div className="listrow"><span><b>Mode</b><br /><small>else-pay (Paddle-style, Else payments only)</small></span><b>{b.mode}</b></div>
      Currency<input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" />
      Min withdraw $<input type="number" value={minW} onChange={e => setMinW(Number(e.target.value))} />
      <button className="btn" onClick={save}>Save billing</button>
      <div className="small" style={{ marginTop: 8 }}>External providers (Binance/bKash/Nagad/PayPal) removed. Users pay with earned $, payouts are approved by admin.</div>
    </div>
  );
}
