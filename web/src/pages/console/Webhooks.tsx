import { useEffect, useState } from 'react';
import { api, Webhooks } from '../../lib/api';

export default function WebhooksPage() {
  const [w, setW] = useState<Webhooks | null>(null);
  const [events, setEvents] = useState<{ id: string; type: string; msg: string; at: string }[]>([]);
  useEffect(() => {
    api.consoleWebhooksGet().then(setW).catch(() => {});
    api.consoleEvents().then(setEvents).catch(() => {});
  }, []);
  const save = async () => { if (w) { await api.consoleWebhooksSave(w); alert('saved'); } };
  if (!w) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Webhooks</h3>
      AdMob SSV path<input value={w.admobSsvPath} onChange={e => setW({ ...w, admobSsvPath: e.target.value })} />
      Postback URL<input value={w.postbackUrl} onChange={e => setW({ ...w, postbackUrl: e.target.value })} placeholder="https://..." />
      <button className="btn" onClick={save}>Save webhooks</button>
      <h4>Event log</h4>
      {events.map(e => <div className="listrow" key={e.id}><span>[{e.type}] {e.msg}</span><small>{(e.at || '').slice(0, 16)}</small></div>)}
    </div>
  );
}
