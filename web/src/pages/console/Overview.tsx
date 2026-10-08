import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function ConsoleOverview() {
  const [d, setD] = useState<{ users: number; adViews: number; totalRewards: number; totalWithdraw: number; pendingW: number; openTickets: number; recentTx: { id: string; reason: string; amount: number }[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.consoleOverview().then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <div className="card">Set the admin key (top of console) - {err}</div>;
  if (!d) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Overview</h3>
      <span className="chip">Users {d.users}</span><span className="chip">Ads {d.adViews}</span>
      <span className="chip">Rewards ${d.totalRewards}</span><span className="chip">Paid ${d.totalWithdraw}</span>
      <span className="chip">Pending {d.pendingW}</span><span className="chip">Tickets {d.openTickets}</span>
      <h4>Recent transactions</h4>
      {d.recentTx.map(t => <div className="listrow" key={t.id}><span>{t.reason}</span><b>{t.amount}</b></div>)}
    </div>
  );
}
