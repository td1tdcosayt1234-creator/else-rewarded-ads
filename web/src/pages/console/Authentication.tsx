import { useEffect, useState } from 'react';
import { api, AuthSettings } from '../../lib/api';

export default function ConsoleAuth() {
  const [s, setS] = useState<AuthSettings | null>(null);
  const [key, setKey] = useState('');
  const [adminDev, setAdminDev] = useState('');
  const [newPass, setNewPass] = useState('');
  const [lastPass, setLastPass] = useState('');
  useEffect(() => {
    api.consoleAuthGet().then(setS).catch(() => {});
    api.consoleAdminAccount().then(a => setAdminDev(a.deviceId)).catch(() => {});
  }, []);
  const save = async () => { if (s) { await api.consoleAuthSave(s); alert('Saved'); } };
  const changeKey = async () => { await api.consoleChangeKey(key); alert('Admin key changed'); setKey(''); };
  const resetDev = async () => {
    const r = await api.consoleAdminReset();
    setAdminDev(r.deviceId);
    alert('New admin device ID: ' + r.deviceId);
  };
  const copyDev = async () => { await copyText(adminDev); };
  const copyText = async (t: string) => {
    try { await navigator.clipboard.writeText(t); alert('Copied'); }
    catch { prompt('copy:', t); }
  };
  const changePass = async () => {
    await api.consoleAdminPass(newPass);
    setNewPass('');
    alert('Admin password changed (hashed, never stored in plain text)');
  };
  const regenPass = async () => {
    const r = await api.consoleAdminPassReset();
    setLastPass(r.password);
    setNewPass('');
  };
  if (!s) return <div className="card">loading...</div>;
  return (
    <div className="card"><h3>Authentication</h3>
      {(Object.keys(s) as (keyof AuthSettings)[]).map(k => (
        <label key={k} style={{ display: 'block', marginTop: 8 }}>
          <input type="checkbox" checked={s[k]} onChange={e => setS({ ...s, [k]: e.target.checked })} /> {k}
        </label>
      ))}
      <button className="btn" onClick={save}>Save auth settings</button>
      <h4>Change admin key</h4>
      <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="new key min 6" />
      <button className="btn btn2" onClick={changeKey}>Change key</button>
      <h4>Admin app account (unlimited money)</h4>
      <div className="small">Log into the app with this device ID + password to get the unlimited admin account.</div>
      <div className="listrow"><span>ID<br /><small>{adminDev || '...'}</small></span><button onClick={copyDev}>Copy</button></div>
      <div style={{ display: 'flex', gap: 6 }}><button className="btn btn2" onClick={resetDev}>Reset device ID</button></div>
      New password<input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="min 6 chars" />
      <div style={{ display: 'flex', gap: 6 }}><button className="btn btn2" onClick={changePass}>Change password</button><button className="btn btn2" onClick={regenPass}>Generate random</button></div>
      {lastPass && <div className="listrow"><span><b>New password (shown once):</b><br /><small>{lastPass}</small></span><button onClick={() => copyText(lastPass)}>Copy</button></div>}
    </div>
  );
}
