import { useEffect, useState } from 'react';
import { api, User } from '../../lib/api';

export default function ConsoleUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const load = () => { api.adminUsers().then(setUsers).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const ban = async (id: string) => { await api.adminBan(id); load(); };
  const resetDev = async (id: string, name: string) => {
    if (!confirm('Unlink device for ' + name + '? They can log in from a new phone.')) return;
    await api.req('/api/console/users/' + id + '/reset-device', 'POST', {}, true);
    alert('Device unlinked');
  };
  return (
    <div className="card"><h3>Users</h3>
      {users.map(u => (
        <div className="listrow" key={u.id}>
          <span><b>{u.name}</b> {u.country} ${u.balance} ads:{u.totalAds} {u.banned && <b style={{ color: 'red' }}>BANNED</b>}<br /><small>{u.referralCode}</small></span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => resetDev(u.id, u.name)}>device</button>
            <button onClick={() => ban(u.id)}>ban</button>
          </span>
        </div>
      ))}
    </div>
  );
}
