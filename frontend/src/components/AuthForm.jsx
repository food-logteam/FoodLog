// NOTE: no diacritics in comments
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { login, register } from '../lib/api.js';

export default function AuthForm({ mode = 'signin' }) {
  const isSignIn = mode === 'signin';
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [minKcal, setMinKcal] = useState('');
  const [maxKcal, setMaxKcal] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const targetAfterAuth = location.state?.from || '/account';

  function validate() {
    if (!email || !password) return 'Please fill email and password.';
    if (!isSignIn) {
      if (!name.trim()) return 'Please enter your name.';
      const min = Number(minKcal);
      const max = Number(maxKcal);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
        return 'Calories must be positive numbers.';
      }
      if (min >= max) return 'Min must be lower than max.';
    }
    return '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    const v = validate();
    if (v) { setErr(v); return; }

    setLoading(true);
    try {
      if (isSignIn) {
        await login({ email, password });
      } else {
        await register({
          name: name.trim(),
          email,
          password,
          min_kcal: Number(minKcal),
          max_kcal: Number(maxKcal),
        });
      }
      navigate(targetAfterAuth, { replace: true });
    } catch (e2) {
      setErr(e2.message || (isSignIn ? 'Login failed' : 'Register failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth" style={{ width: '100%', maxWidth: 480 }}>
      <div className="auth-card">
        <h2 className="auth-title" style={{ marginBottom: 12 }}>
          {isSignIn ? 'Sign in' : 'Create your account'}
        </h2>

        <form onSubmit={onSubmit}>
          {!isSignIn && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {!isSignIn && (
            <div className="field">
              <label>Calories (min — max)</label>
              <div className="kcal-row">
                <input
                  inputMode="numeric"
                  placeholder="min"
                  value={minKcal}
                  onChange={e => setMinKcal(e.target.value)}
                />
                <span className="kcal-sep">—</span>
                <input
                  inputMode="numeric"
                  placeholder="max"
                  value={maxKcal}
                  onChange={e => setMaxKcal(e.target.value)}
                />
              </div>
            </div>
          )}

          {err && <div className="form-error" style={{ marginTop: 4 }}>{err}</div>}

          <button className="btn btn-primary auth-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? (isSignIn ? 'Signing in…' : 'Creating…') : (isSignIn ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <div style={{ marginTop: 12, color: '#64748b', fontSize: 14 }}>
          {isSignIn ? (
            <>No account? <Link to="/auth/signup">Create one</Link></>
          ) : (
            <>Already have an account? <Link to="/auth/signin">Sign in</Link></>
          )}
        </div>
      </div>
    </div>
  );
}
