import { useEffect, useState } from 'react';

interface Charge { id?: string; charge_id?: string; merchant?: string; product?: string; amount: number; status: string; account?: string; at?: string; name?: string }

export default function Checkout() {
  const [list, setList] = useState<Charge[]>([]);
  const load = async () => {
    const r = await fetch('/api/console/charges', { headers: { 'x-admin-key': localStorage.getItem('else_admin_key') || 'else-admin-123' } });
    setList(await r.json());
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="card"><h3>Checkout - incoming third-party payments</h3>
      <div className="small">Charges created by merchant sites appear here. Users pay with earned $ at /pay/:id.</div>
      {list.map(c => (
        <div className="listrow" key={c.id || c.charge_id}>
          <span><b>{c.merchant}</b> {c.product} ${c.amount}<br /><small>{c.id || c.charge_id} | {c.name || ''}</small></span>
          <b>{c.status}</b>
        </div>
      ))}
    </div>
  );
}
