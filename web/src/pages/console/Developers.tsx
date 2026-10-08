import { useEffect, useState } from 'react';
import { api, DevCfg } from '../../lib/api';

export default function Developers() {
  const [d, setD] = useState<DevCfg | null>(null);
  const load = () => { api.consoleDevGet().then(setD).catch(() => {}); };
  useEffect(load, []);
  const regen = async (key: 'publicKey' | 'webhookSecret') => { await api.consoleDevRegen(key); load(); };
  if (!d) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Developers - API keys</h3>
      <div className="listrow"><span>Public key<br /><small>{d.publicKey}</small></span><button onClick={() => regen('publicKey')}>regen</button></div>
      <div className="listrow"><span>Webhook secret<br /><small>{d.webhookSecret || '(empty)'}</small></span><button onClick={() => regen('webhookSecret')}>regen</button></div>
      <div className="small">Admin key header: x-admin-key (change in authentication page)</div>
    </div>
  );
}
