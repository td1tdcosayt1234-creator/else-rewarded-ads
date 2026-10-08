import { useEffect, useState } from 'react';
import { api, NotifCfg } from '../../lib/api';

export default function Notifications() {
  const [n, setN] = useState<NotifCfg | null>(null);
  useEffect(() => { api.consoleNotifGet().then(setN).catch(() => {}); }, []);
  const save = async () => { if (n) { await api.consoleNotifSave(n); alert('saved - app notice updated'); } };
  if (!n) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Notifications</h3>
      Push title<input value={n.pushTitle} onChange={e => setN({ ...n, pushTitle: e.target.value })} />
      Push body<input value={n.pushBody} onChange={e => setN({ ...n, pushBody: e.target.value })} />
      Email subject<input value={n.emailSubject} onChange={e => setN({ ...n, emailSubject: e.target.value })} />
      Email body<textarea value={n.emailBody} onChange={e => setN({ ...n, emailBody: e.target.value })} />
      App notice (shows in app header)<input value={n.notice || ''} onChange={e => setN({ ...n, notice: e.target.value })} placeholder="notice text" />
      <button className="btn" onClick={save}>Save notifications</button>
    </div>
  );
}
