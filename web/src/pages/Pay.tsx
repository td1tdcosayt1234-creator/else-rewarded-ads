import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Order {
  merchant: string; product: string; amount: number;
  currency: string; status: string; balance: number;
}

const steps = ['Order', 'Pay', 'Done'];

export default function Pay() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const [c, setC] = useState<Order | null>(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const j = await api.req<Order>('/api/pay/' + id);
      setC(j);
    } catch (e) { setErr(e instanceof Error ? e.message : 'fail'); }
  };
  useEffect(() => { load(); refresh(); }, []);

  const pay = async () => {
    setPaying(true);
    try {
      const r = await api.req<{ status: string; balance: number; returnUrl: string }>('/api/pay/' + id + '/confirm', 'POST');
      setDone(true);
      refresh(); load();
      setTimeout(() => { if (r.returnUrl) window.location.href = r.returnUrl; }, 2000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'fail'); }
    setPaying(false);
  };

  if (err) return <div className="sec"><div className="card" style={{ marginTop: 20 }}><h3>Else Pay Checkout</h3><div className="small">{err}</div><Link to="/dashboard">Back to app</Link></div></div>;
  if (!c) return <div className="sec"><div className="card" style={{ marginTop: 20 }}>Loading order...</div></div>;

  const paid = c.status === 'paid' || done;
  const bal = user?.balance ?? c.balance;
  const after = +(bal - c.amount).toFixed(4);
  const enough = bal >= c.amount && !paid;
  const pct = Math.min(100, Math.round((bal / c.amount) * 100));
  const stepIdx = paid ? 2 : 1;

  return (
    <div className="sec">
      {/* brand header */}
      <div className="card" style={{ marginTop: 16, background: 'linear-gradient(160deg,#7b5cff,#2f1bb3)', color: '#fff', overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="avatar" style={{ width: 52, height: 52, fontSize: 22 }}>{(c.merchant || '?')[0].toUpperCase()}</div>
          <div>
            <div className="small" style={{ color: '#e6deff' }}>Pay with Else Pay</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{c.merchant}</div>
          </div>
        </div>
        {/* steps */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, opacity: i <= stepIdx ? 1 : 0.45 }}>
              <div style={{ height: 6, borderRadius: 99, background: i <= stepIdx ? '#4ade80' : 'rgba(255,255,255,.3)', marginBottom: 4 }} />
              {i + 1}. {s}
            </div>
          ))}
        </div>
      </div>

      {/* order summary */}
      <div className="card"><h3>Order summary</h3>
        <div className="listrow"><span>{c.product}<br /><small>order {(id || '').slice(0, 20)}...</small></span><b>${c.amount.toFixed(3)} {c.currency}</b></div>
        <div className="listrow"><span>Fee</span><b>$0.000</b></div>
        <div className="listrow"><span><b>Total to pay</b></span><b style={{ fontSize: 18 }}>${c.amount.toFixed(3)}</b></div>
      </div>

      {/* balance */}
      <div className="card"><h3>Your money (earned $)</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>${bal.toFixed(3)}</div>
          <div className="small">{pct}% of order</div>
        </div>
        <div className="adbar"><div style={{ width: pct + '%' }} /></div>
        <div className="small" style={{ marginTop: 6 }}>
          {paid ? `Remaining: $${bal.toFixed(3)}` : enough ? `After payment you keep $${after.toFixed(3)}` : `Short by $${(c.amount - bal).toFixed(3)} - earn more below`}
        </div>
      </div>

      {paid ? (
        <div className="card pro-glow"><div className="success-wrap">
          <div className="success-ring"><svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-16" /></svg></div>
          <h3>PAID ${c.amount.toFixed(3)}!</h3>
          <div className="small">Charged from your balance - {c.merchant} has been notified. Redirecting to the shop...</div>
        </div></div>
      ) : enough ? (
        <>
          <button className="btn" onClick={pay} disabled={paying} style={{ fontSize: 17, padding: 15 }}>
            {paying ? 'Processing...' : `Pay $${c.amount.toFixed(3)} now`}
          </button>
          <div className="small" style={{ textAlign: 'center', marginTop: 8 }}>Secured by Else Pay - instant, no card needed</div>
        </>
      ) : (
        <div className="card"><h3>Insufficient balance</h3>
          <div className="small">You need ${c.amount.toFixed(3)} but have ${bal.toFixed(3)}. Watch ads to earn the rest, then come back - this order stays open.</div>
          <Link to="/dashboard" className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go earn $</Link>
        </div>
      )}
    </div>
  );
}
