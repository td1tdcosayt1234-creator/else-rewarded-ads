import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { JSX } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Wallet from './pages/Wallet';
import Referral from './pages/Referral';
import Support from './pages/Support';
import Admin from './pages/Admin';
import ConsoleLayout from './pages/console/ConsoleLayout';
import ConsoleOverview from './pages/console/Overview';
import ConsolePayments from './pages/console/Payments';
import Billing from './pages/console/Billing';
import ConsoleAuth from './pages/console/Authentication';
import ConsoleRates from './pages/console/Rates';
import ConsoleUsers from './pages/console/Users';
import ConsoleSettings from './pages/console/Settings';
import Products from './pages/console/Products';
import Notifications from './pages/console/Notifications';
import WebhooksPage from './pages/console/Webhooks';
import Developers from './pages/console/Developers';
import Transactions from './pages/console/Transactions';
import Reports from './pages/console/Reports';
import Customers from './pages/console/Customers';
import Merchants from './pages/console/Merchants';
import Checkout from './pages/console/Checkout';
import ApiDocs from './pages/console/ApiDocs';
import Pay from './pages/Pay';
import ConsoleSubscriptions from './pages/console/Subscriptions';
import Subscription from './pages/Subscription';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="gate"><div className="gbox">loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// First open: logged in -> /dashboard, logged out -> /login (no flash)
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="gate"><div className="gbox">loading...</div></div>;
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="referral" element={<Referral />} />
          <Route path="support" element={<Support />} />
        </Route>
        <Route path="/pay/:id" element={<RequireAuth><Pay /></RequireAuth>} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/console" element={<RequireAuth><ConsoleLayout /></RequireAuth>}>
          <Route index element={<ConsoleOverview />} />
          <Route path="products" element={<Products />} />
          <Route path="merchants" element={<Merchants />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="api-docs" element={<ApiDocs />} />
          <Route path="subscriptions" element={<ConsoleSubscriptions />} />
          <Route path="payments" element={<ConsolePayments />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="customers" element={<Customers />} />
          <Route path="billing" element={<Billing />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="developers" element={<Developers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="authentication" element={<ConsoleAuth />} />
          <Route path="rates" element={<ConsoleRates />} />
          <Route path="users" element={<ConsoleUsers />} />
          <Route path="settings" element={<ConsoleSettings />} />
        </Route>
        <Route path="*" element={<div className="sec"><div className="card">404 - <a href="/dashboard">dashboard</a></div></div>} />
      </Routes>
    </AuthProvider>
  );
}
