import { useEffect, useState } from 'react';
import { api, Webhooks } from '../../lib/api';

export default function ConsoleSettings() {
  const [w, setW] = useState<Webhooks | null>(null);
  const [notice, setNotice] = useState('');
  const [maint, setMaint] = useState(false);
  useEffect(() => {
    api.consoleWebhooksGet().then(setW).catch(() => {});
    api.config().then(c => { setNotice(c.notice.en); setMaint(c.maintenance); }).catch(() => {});
  }, []);
  const saveW = async () => { if (w) { await api.consoleWebhooksSave(w); alert('webhooks saved'); } };
  const saveN = async () => {
    await api.adminConfigSave({ maintenance: maint, notice: { en: notice, bn: notice } });
    alert('saved');
  };
  if (!w) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Settings - webhooks + notice</h3>
      AdMob SSV path<input value={w.admobSsvPath} onChange={e => setW({ ...w, admobSsvPath: e.target.value })} />
      Postback URL<input value={w.postbackUrl} onChange={e => setW({ ...w, postbackUrl: e.target.value })} placeholder="https://..." />
      <button className="btn" onClick={saveW}>Save webhooks</button>
      <h4>Notice + maintenance</h4>
      Notice<input value={notice} onChange={e => setNotice(e.target.value)} />
      <label><input type="checkbox" checked={maint} onChange={e => setMaint(e.target.checked)} /> maintenance</label>
      <button className="btn btn2" onClick={saveN}>Save notice</button>
    </div>
  );
}
