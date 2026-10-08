import { useEffect, useState } from 'react';
import { api, Tx } from '../../lib/api';

export default function Transactions() {
  const [list, setList] = useState<Tx[]>([]);
  useEffect(() => { api.consoleTxs().then(setList).catch(() => {}); }, []);
  return (
    <div className="card"><h3>Transactions</h3>
      {list.map(t => <div className="listrow" key={t.id}><span>{t.reason}<br /><small>{t.at.slice(0, 16)}</small></span><b>{t.amount}</b></div>)}
    </div>
  );
}
