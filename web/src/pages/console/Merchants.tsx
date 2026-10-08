import { useEffect, useState } from 'react';

interface Merchant { id: string; name: string; website: string; webhookUrl: string; publicKey: string; secretKey?: string; active: boolean; at?: string }

export default function Merchants() {
  const [list, setList] = useState<Merchant[]>([]);
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [hook, setHook] = useState('');
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const load = async () => {
    try {
      const r = await fetch('/api/console/merchants', { headers: { 'x-admin-key': localStorage.getItem('else_admin_key') || 'else-admin-123' } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load fail');
      setList(j); setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'load fail'); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    const r = await fetch('/api/console/merchants', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': localStorage.getItem('else_admin_key') || 'else-admin-123' }, body: JSON.stringify({ name, website: site, webhookUrl: hook }) });
    const m = await r.json();
    if (m.secretKey) { setSecret('SECRET (shown once - copy it): ' + m.secretKey + ' | PUBLIC: ' + m.publicKey); }
    setName(''); load();
  };
  const showSecret = async (id: string) => {
    const r = await fetch('/api/console/merchants/' + id + '/secret', { headers: { 'x-admin-key': localStorage.getItem('else_admin_key') || 'else-admin-123' } });
    const j = await r.json();
    alert('PUBLIC: ' + j.publicKey + '\nSECRET: ' + j.secretKey);
  };
  return (
    <div className="card"><h3>Merchants - API keys + products for other websites</h3>
      <div className="small">Other websites use Else Pay like this: 1) create a merchant 2) share the secret key + product_id 3) users pay with earned $</div>
      Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Shop name" />
      Website<input value={site} onChange={e => setSite(e.target.value)} placeholder="https://shop.com" />
      Webhook URL<input value={hook} onChange={e => setHook(e.target.value)} placeholder="https://shop.com/else-webhook" />
      <button className="btn" onClick={create}>Create merchant (get API keys)</button>
      {err && <div className="small" style={{ color: '#ff5c8a' }}>{err} - check the admin key above</div>}
      {secret && <div className="listrow"><span>{secret}</span></div>}
      {list.map(m => (
        <div className="listrow" key={m.id}>
          <span><b>{m.name}</b> {m.active ? 'ON' : 'OFF'}<br /><small>{m.website} | {m.publicKey}</small></span>
          <button onClick={() => showSecret(m.id)}>keys</button>
        </div>
      ))}
      <div className="small">API docs: <a href="/app/console/api-docs">/console/api-docs</a> | charges: <a href="/app/console/checkout">/console/checkout</a></div>
    </div>
  );
}
