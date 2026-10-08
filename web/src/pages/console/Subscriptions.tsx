import { useEffect, useState } from 'react';
import { api, Plan, Sub } from '../../lib/api';

export default function ConsoleSubscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(5);
  const load = () => {
    api.consolePlans().then(setPlans).catch(() => {});
    api.consoleSubs().then(setSubs).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    await api.consolePlanCreate({ name, price, days: 30, mult: 1.5, dailyMax: 50 });
    setName(''); load();
  };
  const toggle = async (id: string) => { await api.consolePlanToggle(id); load(); };
  const act = async (id: string, a: 'approve' | 'reject') => {
    await api.consoleSubAct(id, a); load();
    alert(a === 'approve' ? 'Payment approved - subscription is AUTO ACTIVE, the user can use it now' : 'Rejected + refunded');
  };
  return (
    <div className="card"><h3>Subscriptions - instant activation</h3>
      <div className="small">Payments activate instantly. Legacy pending items below can still be approved/rejected.</div>
      Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Plan name" />
      Price $<input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
      <button className="btn" onClick={create}>Create plan</button>
      <h4>Plans</h4>
      {plans.map(p => <div className="listrow" key={p.id}><span><b>{p.name}</b> ${p.price} {p.mult}x<br /><small>{p.active ? 'ON' : 'OFF'}</small></span><button onClick={() => toggle(p.id)}>on/off</button></div>)}
      <h4>User subscriptions (approve activates legacy pending)</h4>
      {subs.map(s => (
        <div className="listrow" key={s.id}>
          <span><b>{s.name}</b> {s.planName} ${s.price}<br /><small>{s.method} | till {(s.expiresAt || '-').slice(0, 10)}</small></span>
          <span><b>{s.status}</b> {s.status === 'pending' && (<><button onClick={() => act(s.id, 'approve')}>Approve</button><button onClick={() => act(s.id, 'reject')}>X</button></>)}</span>
        </div>
      ))}
    </div>
  );
}
