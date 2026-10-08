import { useEffect, useState } from 'react';
import { api, Task, Config } from '../lib/api';
import { useAuth } from '../lib/auth';

declare global { interface Window { AndroidRewarded?: { showRewarded: (sid: string) => void } } }

export default function Dashboard() {
  const { refresh } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [adstat, setAdstat] = useState('');
  const [adPct, setAdPct] = useState(0);
  const [toast, setToast] = useState('');
  const [cfg, setCfg] = useState<Config | null>(null);

  const showToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  const loadTasks = () => api.tasks().then(setTasks).catch(() => setTasks([]));

  useEffect(() => { loadTasks(); api.config().then(setCfg).catch(() => {}); }, []);

  const watchAd = async () => {
    try {
      const s = await api.adStart();
      setAdstat('Ad playing (5s)...');
      setAdPct(4);
      try { window.AndroidRewarded?.showRewarded(s.sessionId); } catch {}
      let n = 5;
      const iv = setInterval(async () => {
        n--;
        setAdstat(n + 's...');
        setAdPct((5 - n) * 20);
        if (n <= 0) {
          clearInterval(iv);
          try {
            const c = await api.adComplete(s.sessionId);
            setAdstat('+$' + c.reward + ' Bal $' + c.balance);
            setAdPct(100);
            showToast('+$' + c.reward + ' earned!');
          } catch (e) { setAdstat(e instanceof Error ? e.message : 'fail'); }
          refresh();
        }
      }, 1000);
    } catch (e) { setAdstat(e instanceof Error ? e.message : 'fail'); }
  };

  const checkin = async () => { try { const r = await api.checkin(); showToast('Streak ' + r.streak + ' +$' + r.bonus); } catch (e) { showToast(e instanceof Error ? e.message : 'fail'); } refresh(); };
  const spin = async () => { try { const r = await api.spin(); showToast('Spin +$' + r.reward); } catch (e) { showToast(e instanceof Error ? e.message : 'fail'); } refresh(); };
  const inter = async () => { await api.interstitial(); showToast('Interstitial logged'); };
  const claim = async (id: string) => { try { const r = await api.taskClaim(id); showToast('+$' + r.reward); } catch (e) { showToast(e instanceof Error ? e.message : 'fail'); } loadTasks(); refresh(); };

  return (
    <div>
      <div className="grid">
        <button className="tile t-purple" onClick={watchAd}><div className="ic">AD</div><b>Watch Ad</b><span>{cfg ? `1 ad = $${cfg.rewardByCountry.BD} (BD)` : 'Earn $ per ad'}</span></button>
        <button className="tile t-orange" onClick={spin}><div className="ic">SP</div><b>Spin</b><span>1 ticket = 1 spin</span></button>
        <button className="tile t-blue" onClick={checkin}><div className="ic">CK</div><b>Check-in</b><span>Daily bonus</span></button>
        <button className="tile t-pink" onClick={loadTasks}><div className="ic">TS</div><b>Tasks</b><span>Offerwall</span></button>
      </div>
      <div className="sec">
        <div className="adbox">Banner Ad (AdMob)</div>
        <div id="adstat">{adstat}</div>
        {adPct > 0 && <div className="adbar"><div style={{ width: adPct + '%' }} /></div>}
        {toast && <div className="toast">{toast}</div>}
        <button className="btn btn2" onClick={inter}>Interstitial Ad (owner income)</button>
        <div className="card"><h3>Tasks <button className="btn2 btn" style={{ width: 'auto', padding: '6px 12px' }} onClick={loadTasks}>View All</button></h3>
          {tasks.map(t => (
            <div className="listrow" key={t.id}>
              <span>{t.title_en}<br /><small>${t.reward} [{t.progress}]</small></span>
              {t.done ? 'OK' : <button className="btn" style={{ width: 'auto', padding: '6px 14px' }} onClick={() => claim(t.id)}>Claim</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
