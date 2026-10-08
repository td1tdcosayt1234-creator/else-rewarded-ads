import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, loading, login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (!loading && user) nav('/dashboard', { replace: true }); }, [user, loading, nav]);

  const go = async () => {
    setErr('Logging in...');
    try {
      await login(identifier.trim(), password);
      nav('/dashboard');
    } catch (e) { setErr(e instanceof Error ? e.message : 'failed'); }
  };

  return (
    <div className="gate"><div className="gbox">
      <div style={{ fontSize: 44 }}>$</div><h2>Else</h2>
      <div style={{ display: 'flex', gap: 6 }}><Link to="/login" className="btn" style={{ textAlign: 'center', textDecoration: 'none' }}>Login</Link><Link to="/signup" className="btn btn2" style={{ textAlign: 'center', textDecoration: 'none' }}>Signup</Link></div>
      <div className="small">Log in with your email or username</div>
      <div style={{ textAlign: 'left' }}>
        Email or username<input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@mail.com or username" autoComplete="username" />
        Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" onKeyDown={e => { if (e.key === 'Enter') go(); }} />
        <div className="small" style={{ color: '#ff5c8a', minHeight: 16 }}>{err}</div>
        <button className="btn" onClick={go}>Login</button>
        <div className="small" style={{ marginTop: 8 }}>New user? <Link to="/signup">Create an account</Link></div>
      </div>
    </div></div>
  );
}
