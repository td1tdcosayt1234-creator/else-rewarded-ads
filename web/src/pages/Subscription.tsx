import { useEffect, useState } from 'react';
import { api, Plan, Sub, Provider } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Subscription() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [my, setMy] = useState<{ active: Sub | null; history: Sub[] } | null>(null);
  const [methods, setMethods] = useState<Provider[]>([]);
  const [method, setMethod] = useState('Else Pay');
  const [acc, setAcc] = useState('');
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const load = () => {
    api.plans().then(setPlans).catch(() => {});
    api.mySub().then(setMy).catch(() => {});
    api.paymentMethods().then(ms => { setMethods(ms); if (ms[0]) setMethod(ms[0].name); }).catch(() => {});
  };
  useEffect(load, []);

  const buy = async (planId: string) => {
    try {
      const s = await api.subscribe(planId, method, acc);
      // instant approve: active right away (real)
      setCelebrate(s.planName);
      setTimeout(() => setCelebrate(null), 3000);
    } catch (e) { alert(e instanceof Error ? e.message : 'fail'); }
    load(); refresh();
  };

  return (
    <div className="sec">
      {celebrate && (
        <div className="card pro-glow"><div className="success-wrap">
          <div className="success-ring"><svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-16" /></svg></div>
          <h3>PRO ACTIVE!</h3>
          <div className="small">{celebrate} - payment approved instantly, enjoy Pro now</div>
        </div></div>
      )}
      <div className="card" style={{ background: user?.sub ? 'linear-gradient(160deg,#22c55e,#15803d)' : undefined, color: user?.sub ? '#fff' : undefined }}>
        <h3 style={{ margin: 0 }}>My Subscription {user?.sub ? 'ACTIVE' : '(free)'}</h3>
        {user?.sub
          ? <div>{user.sub.plan} - {user.sub.mult}x reward till {user.sub.expiresAt.slice(0, 10)}</div>
          : <div className="small">Go Pro for 1.5x-2x rewards + higher daily limits. Activates instantly after payment.</div>}
      </div>
      <div className="card"><h3>Plans (pay with wallet balance)</h3>
        Pay method<select value={method} onChange={e => setMethod(e.target.value)}>
          {methods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        Account<input value={acc} onChange={e => setAcc(e.target.value)} placeholder="payment account" />
        {plans.map(p => (
          <div className="listrow" key={p.id}>
            <span><b>{p.name}</b><br /><small>${p.price} | {p.days}d | {p.mult}x | {p.dailyMax}/day</small></span>
            <button className="btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => buy(p.id)}>Buy</button>
          </div>
        ))}
      </div>
      <div className="card"><h3>My history</h3>
        {my?.history.map(s => <div className="listrow" key={s.id}><span>{s.planName} ${s.price}<br /><small>{(s.at || '').slice(0, 10)} till {(s.expiresAt || '-').slice(0, 10)}</small></span><b>{s.status}</b></div>)}
      </div>
    </div>
  );
}
