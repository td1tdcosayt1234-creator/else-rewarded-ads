import { useEffect, useState } from 'react';
import { api, Config, Ticket } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function Support() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [msg, setMsg] = useState('');
  const [list, setList] = useState<Ticket[]>([]);

  const load = () => api.myTickets().then(setList).catch(() => {});
  useEffect(() => { api.config().then(setCfg).catch(() => {}); load(); }, []);

  const send = async () => {
    try { await api.support(msg); setMsg(''); alert('Sent!'); } catch (e) { alert(e instanceof Error ? e.message : 'fail'); }
    load();
  };

  return (
    <div className="sec">
      <div className="card"><h3>Support</h3>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Describe your problem" />
        <button className="btn" onClick={send}>Send</button>
        {list.map(t => <div className="small" key={t.id}>Q:{t.msg}<br />A:{t.reply || '-'}<hr /></div>)}
      </div>
      <div className="card"><h3>Rates</h3>
        <div className="small">{cfg ? JSON.stringify(cfg.rewardByCountry) + ' | cooldown ' + cfg.ads.cooldownSec + 's daily ' + cfg.ads.dailyMax : '...'}</div>
      </div>
      <div className="card"><button className="btn btn2" onClick={() => { logout(); nav('/login'); }}>Logout</button></div>
    </div>
  );
}
