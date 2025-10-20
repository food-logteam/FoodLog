// NOTE: no diacritics in comments
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, register } from '../lib/api.js';

export default function AuthForm({ mode = 'signin' }) {
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function onChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validate() {
    if (isSignup && form.name.trim().length < 2) return 'Please enter your name.';
    if (!/\S+@\S+\.\S+/.test(form.email)) return 'Please enter a valid email.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    return '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) { setErr(v); return; }
    setErr('');
    setLoading(true);
    try {
      if (isSignup) await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      else await login({ email: form.email.trim(), password: form.password });
      navigate('/');
    } catch (error) {
      setErr(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <h2 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="auth-sub">
          {isSignup ? 'Already have an account? ' : "Do not have an account? "}
          <Link to={isSignup ? '/auth/signin' : '/auth/signup'} className="auth-link">
            {isSignup ? 'Sign in' : 'Create one'}
          </Link>
        </p>

        <form onSubmit={onSubmit} noValidate>
          {isSignup && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" value={form.name} onChange={onChange} placeholder="John Doe" />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={onChange} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={form.password} onChange={onChange} placeholder="Enter your password" />
          </div>

          {err && <div className="form-error">{err}</div>}

          <button className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? 'Please wait...' : (isSignup ? 'Sign up' : 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
