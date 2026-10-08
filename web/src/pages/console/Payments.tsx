import { useEffect, useState } from 'react';
import { api, Withdraw } from '../../lib/api';

export default function ConsolePayments() {
  const [wds, setWds] = useState<Withdraw[]>([]);
  const load = () => { api.adminWithdraws().then(setWds).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const act = async (id: string, a: 'approve' | 'reject') => { await api.adminWithdrawAct(id, a); load(); };
  return (
    <div className="card"><h3>Payments / Payouts</h3>
      {wds.map(x => (
        <div className="listrow" key={x.id}>
          <span>{(x.at || '').slice(0, 10)} <b>{x.name}</b> ${x.amount} fee ${(x as unknown as { fee?: number }).fee ?? 0} net ${(x as unknown as { net?: number }).net ?? x.amount} {x.method}<br /><small>{x.account}</small></span>
          <span><b>{x.status}</b> {x.status === 'pending' && (<><button onClick={() => act(x.id, 'approve')}>Pay</button><button onClick={() => act(x.id, 'reject')}>X</button></>)}</span>
        </div>
      ))}
    </div>
  );
}
