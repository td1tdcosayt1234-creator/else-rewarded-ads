import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function Reports() {
  const [r, setR] = useState<{ byCountry: Record<string, number>; byMethod: Record<string, number>; totals: { rewards: number; payouts: number } } | null>(null);
  useEffect(() => { api.consoleReports().then(setR).catch(() => {}); }, []);
  if (!r) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Reports</h3>
      <span className="chip">Rewards ${r.totals.rewards}</span><span className="chip">Payouts ${r.totals.payouts}</span>
      <h4>By country</h4>
      {Object.entries(r.byCountry).map(([k, v]) => <div className="listrow" key={k}><span>{k}</span><b>${v}</b></div>)}
      <h4>By method</h4>
      {Object.entries(r.byMethod).map(([k, v]) => <div className="listrow" key={k}><span>{k}</span><b>{v}</b></div>)}
    </div>
  );
}
