import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useEffect, useRef, useState } from 'react';
import { api, Config } from '../lib/api';

export default function Layout() {
  const { user, loading, logout, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [balPop, setBalPop] = useState(false);
  const prevBal = useRef<number | null>(null);

  useEffect(() => {
    refresh();
    api.config().then(setCfg).catch(() => {});
    api.banner().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bal = user?.balance ?? 0;
    if (prevBal.current !== null && prevBal.current !== bal) {
      setBalPop(true);
      const t = setTimeout(() => setBalPop(false), 450);
      prevBal.current = bal;
      return () => clearTimeout(t);
    }
    prevBal.current = bal;
  }, [user?.balance]);

  if (loading) return <div className="gate"><div className="gbox">loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="shell">
      <div className="top">
        <div className="top-row">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="avatar">{(user?.name || 'E')[0]}</div>
            <div>
              <div className="hello">Hello!</div>
              <div className="uname">{user?.name || 'Guest'}</div>
            </div>
          </div>
          <button className="bell" onClick={() => { logout(); nav('/login'); }}>Logout</button>
        </div>
        <div className="notice">{cfg ? `${cfg.notice.en} | min $${cfg.minWithdraw}` : '...'}</div>
      </div>

      <div className="balcard">
        <div>
          <div className="small">Total Balance {user?.sub ? 'PRO ' + user.sub.mult + 'x' : ''} {user?.isAdmin ? 'ADMIN' : ''}</div>
          <div className={'bal' + (balPop ? ' pop' : '')}>{user?.isAdmin ? '∞' : '$' + (user?.balance ?? 0).toFixed(3)}</div>
          <div style={{ marginTop: 6 }}>
            <span className="chip">Lv {user?.level ?? 1}</span>
            <span className="chip">{user?.totalAds ?? 0} ads</span>
            <span className="chip">streak {user?.streak ?? 0}</span>
            <span className="chip">tkt {user?.spinTickets ?? 0}</span>
          </div>
        </div>
        <div style={{ fontSize: 40 }} className="floaty">$</div>
      </div>

      <div key={loc.pathname} className="page">
      <Outlet />
      </div>

      <nav className="bottom">
        <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'on' : '')}>Home</NavLink>
        <NavLink to="/dashboard/wallet" className={({ isActive }) => (isActive ? 'on' : '')}>Wallet</NavLink>
        <NavLink to="/dashboard/subscription" className={({ isActive }) => (isActive ? 'on' : '')}>Pro</NavLink>
        <NavLink to="/dashboard/referral" className={({ isActive }) => (isActive ? 'on' : '')}>Referral</NavLink>
        <NavLink to="/dashboard/support" className={({ isActive }) => (isActive ? 'on' : '')}>More</NavLink>
      </nav>
    </div>
  );
}
