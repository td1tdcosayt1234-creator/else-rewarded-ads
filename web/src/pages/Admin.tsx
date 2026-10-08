import { useEffect, useState } from 'react';
import { api, Withdraw, User, Ticket, Config } from '../lib/api';

export default function Admin() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [wds, setWds] = useState<Withdraw[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cfgText, setCfgText] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const s = await api.adminStats(); setStats(s as unknown as Record<string, number>);
      setWds(await api.adminWithdraws());
      setUsers(await api.adminUsers());
      setTickets(await api.adminTickets());
      const c = await api.config();
      setCfgText(JSON.stringify({ maintenance: c.maintenance, notice: c.notice, ads: c.ads, rewardByCountry: c.rewardByCountry, minWithdraw: c.minWithdraw }, null, 2));
    } catch (e) { setErr(e instanceof Error ? e.message : 'load fail - admin key?'); }
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, a: 'approve' | 'reject') => { await api.adminWithdrawAct(id, a); load(); };
  const ban = async (id: string) => { await api.adminBan(id); load(); };
  const reply = async (id: string) => { const r = prompt('reply:'); if (r === null) return; await api.adminReply(id, r); load(); };
  const save = async () => {
    try { await api.adminConfigSave(JSON.parse(cfgText) as Partial<Config>); alert('saved'); }
    catch (e) { alert(e instanceof Error ? e.message : 'fail'); }
  };

  return (
    <div className="sec">
      <div className="card"><h3>Else Admin</h3>
        Admin key<input type="password" defaultValue="else-admin-123" onChange={e => localStorage.setItem('else_admin_key', e.target.value)} />
        <button className="btn" onClick={load}>Load / Refresh</button>
        <div className="small">{err}</div>
        <div>{stats && Object.entries(stats).map(([k, v]) => <span className="chip" key={k}>{k} {v}</span>)}</div>
      </div>
      <div className="card"><h3>Withdraw queue</h3>
        {wds.map(x => <div className="listrow" key={x.id}><span>{(x.at || '').slice(0, 10)} <b>{x.name}</b> ${x.amount} {x.method}</span><span><b>{x.status}</b> {x.status === 'pending' && (<><button onClick={() => act(x.id, 'approve')}>Pay</button><button onClick={() => act(x.id, 'reject')}>X</button></>)}</span></div>)}
      </div>
      <div className="card"><h3>Users</h3>
        {users.map(u => <div className="listrow" key={u.id}><span><b>{u.name}</b> {u.country} ${u.balance} ads:{u.totalAds} {u.banned && <b style={{ color: 'red' }}>BANNED</b>}</span><button onClick={() => ban(u.id)}>ban</button></div>)}
      </div>
      <div className="card"><h3>Tickets</h3>
        {tickets.map(t => <div className="listrow" key={t.id}><span><b>{t.name}</b>: {t.msg} [{t.status}]</span><button onClick={() => reply(t.id)}>reply</button></div>)}
      </div>
      <div className="card"><h3>Config</h3><textarea rows={10} value={cfgText} onChange={e => setCfgText(e.target.value)} /><button className="btn" onClick={save}>Save</button></div>
    </div>
  );
}
