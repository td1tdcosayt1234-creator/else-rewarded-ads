import { useEffect, useState } from 'react';
import { api, Config } from '../../lib/api';

export default function ConsoleRates() {
  const [c, setC] = useState<Config | null>(null);
  const [txt, setTxt] = useState('');
  useEffect(() => { api.config().then(cfg => { setC(cfg); setTxt(JSON.stringify(cfg.rewardByCountry, null, 2)); }).catch(() => {}); }, []);
  const save = async () => {
    try { await api.adminConfigSave({ rewardByCountry: JSON.parse(txt) }); alert('saved'); }
    catch (e) { alert(e instanceof Error ? e.message : 'fail'); }
  };
  if (!c) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Rates - per-country lowest</h3>
      <textarea rows={10} value={txt} onChange={e => setTxt(e.target.value)} />
      <button className="btn" onClick={save}>Save rates</button>
    </div>
  );
}
