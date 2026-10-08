import { useEffect, useState } from 'react';
import { api, Tx, Withdraw, Provider } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Wallet() {
  const { refresh } = useAuth();
  const [hist, setHist] = useState<Tx[]>([]);
  const [wds, setWds] = useState<Withdraw[]>([]);
  const [amt, setAmt] = useState(10);
  const [method, setMethod] = useState('Else Pay');
  const [acc, setAcc] = useState('');
  const [methods, setMethods] = useState<Provider[]>([]);

  const load = () => {
    api.wallet().then(w => setHist(w.history)).catch(() => {});
    api.myWithdraws().then(setWds).catch(() => {});
    api.paymentMethods().then(ms => { setMethods(ms); if (ms[0]) setMethod(ms[0].name); }).catch(() => {});
  };
  useEffect(load, []);

  const go = async () => {
    try {
      const r = await api.withdraw(amt, method, acc);
      alert('Request ' + r.status);
    } catch (e) { alert(e instanceof Error ? e.message : 'fail'); }
    load(); refresh();
  };

  return (
    <div className="sec">
      <div className="card"><h3>Wallet / Withdraw (min $10)</h3>
        Amount $<input type="number" value={amt} onChange={e => setAmt(Number(e.target.value))} step={0.001} />
        {methods.length > 0 ? (
          <>Method (Else Pay)<select value={method} onChange={e => setMethod(e.target.value)}>
            {methods.map(m => <option key={m.id} value={m.name}>{m.name} (fee {m.feePct}%)</option>)}
          </select></>
        ) : (
          <>Method (Else Pay)<input value={method} onChange={e => setMethod(e.target.value)} placeholder="Else Pay" /></>
        )}
        Account<input value={acc} onChange={e => setAcc(e.target.value)} placeholder="number / address" />
        <button className="btn" onClick={go}>Withdraw Request</button>
        <h4>Withdraws</h4>
        {wds.map(x => <div className="listrow" key={x.id}><span>${x.amount} {x.method}</span><b>{x.status}</b></div>)}
      </div>
      <div className="card"><h3>History</h3>
        {hist.map(h => <div className="listrow" key={h.id}><span>{h.reason}<br /><small>{h.at.slice(0, 10)}</small></span><b>{h.amount > 0 ? '+' : ''}{h.amount}</b></div>)}
      </div>
    </div>
  );
}
