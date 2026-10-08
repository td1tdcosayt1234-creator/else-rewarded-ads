import { useEffect, useState } from 'react';
import { api, Product } from '../../lib/api';

export default function Products() {
  const [list, setList] = useState<Product[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0.001);
  const [lastId, setLastId] = useState('');
  const load = () => { api.consoleProducts().then(setList).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    const p = await api.consoleProductCreate({ name, price, type: 'reward', country: 'ALL' });
    setLastId(p.id);
    setName(''); load();
  };
  const toggle = async (id: string) => { await api.consoleProductToggle(id); load(); };
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); alert('copied: ' + t); }
    catch { prompt('copy:', t); }
  };
  return (
    <div className="card"><h3>Products - catalog</h3>
      {lastId && <div className="listrow"><span><b>New product_id:</b><br /><small>{lastId}</small></span><button onClick={() => copy(lastId)}>Copy</button></div>}
      Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Product name" />
      Price $<input type="number" step={0.0001} value={price} onChange={e => setPrice(Number(e.target.value))} />
      <button className="btn" onClick={create}>Create product (you will get a product_id)</button>
      {list.map(p => (
        <div className="listrow" key={p.id}>
          <span><b>{p.name}</b> {p.active ? 'ON' : 'OFF'}<br />
            <small>product_id: {(p as unknown as { merchantId?: string }).merchantId ? (p as unknown as { merchantId?: string }).merchantId + ' / ' : ''}{p.id}</small><br />
            <small>{p.type} | {p.country} | ${p.price}</small></span>
          <span><button onClick={() => copy(p.id)}>Copy ID</button><button onClick={() => toggle(p.id)}>on/off</button></span>
        </div>
      ))}
    </div>
  );
}
