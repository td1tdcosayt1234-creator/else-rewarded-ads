import { NavLink, Outlet } from 'react-router-dom';

// Paddle-style console nav
const links = [
  ['/console', 'Overview'],
  ['/console/products', 'Products'],
  ['/console/merchants', 'Merchants'],
  ['/console/checkout', 'Checkout'],
  ['/console/api-docs', 'API docs'],
  ['/console/subscriptions', 'Subscriptions'],
  ['/console/payments', 'Payments'],
  ['/console/transactions', 'Transactions'],
  ['/console/customers', 'Customers'],
  ['/console/billing', 'Billing'],
  ['/console/notifications', 'Notifications'],
  ['/console/webhooks', 'Webhooks'],
  ['/console/developers', 'Developers'],
  ['/console/reports', 'Reports'],
  ['/console/authentication', 'Authentication'],
  ['/console/rates', 'Rates'],
  ['/console/settings', 'Settings'],
];

export default function ConsoleLayout() {
  const key = localStorage.getItem('else_admin_key') || 'else-admin-123';
  return (
    <div className="sec" style={{ maxWidth: 900, margin: 'auto' }}>
      <div className="card" style={{ background: 'linear-gradient(160deg,#7b5cff,#4a2bd8)', color: '#fff' }}>
        <h3 style={{ margin: 0 }}>Else Pay Console</h3>
        <div className="small" style={{ color: '#e6deff' }}>Paddle-style billing - only Else payment</div>
      </div>
      <div className="card"><h3>Admin key</h3>
        <input type="password" defaultValue={key} onChange={e => localStorage.setItem('else_admin_key', e.target.value)} />
        <div className="small">The console API runs with this key. <a href="/app/dashboard">Back to app</a></div>
      </div>
      <div className="card" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/console'}
            className={({ isActive }) => (isActive ? 'btn' : 'btn btn2')}
            style={{ width: 'auto', padding: '8px 14px', textDecoration: 'none' }}>{label}</NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
