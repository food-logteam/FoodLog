// NOTE: no diacritics in comments
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { getMe, updateMe, getCurrentUser, logout } from '../lib/api.js';

export default function Account() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', min_kcal: '', max_kcal: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { navigate('/auth/signin'); return; }

    async function load() {
      try {
        const me = await getMe();
        setUser(me);
        setForm({
          name: me.name ?? '',
          min_kcal: me.min_kcal ?? '',
          max_kcal: me.max_kcal ?? '',
        });
      } catch (e) {
        setErr(e.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function onChange(e) {
    setSaved(false);
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function onSave(e) {
    e.preventDefault();
    setErr('');
    const min = Number(form.min_kcal), max = Number(form.max_kcal);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min >= max) {
      setErr('Please set a valid min < max (positive numbers).');
      return;
    }
    try {
      const updated = await updateMe({ name: form.name.trim(), min_kcal: min, max_kcal: max });
      setUser(updated);
      setSaved(true);
    } catch (e2) {
      setErr(e2.message || 'Failed to save');
    }
  }

  function handleLogout() {
    logout();
    navigate('/auth/signin');
  }

  return (
    <div className="bg-page account-page">
      <Header />

      <main className="account-wrap">
        <div className="account-card">
          <div className="account-header">
            <h2 className="auth-title">Your account</h2>
           
          </div>

          {loading ? (
            <p className="loading-text">Loading…</p>
          ) : (
            <>
              <div className="account-info">
                <div><strong>Email:</strong> {user?.email}</div>
              </div>

              <form onSubmit={onSave}>
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" value={form.name} onChange={onChange} />
                </div>

                <div className="field">
                  <label>Calories (min — max)</label>
                  <div className="kcal-row">
                    <input name="min_kcal" inputMode="numeric" value={form.min_kcal} onChange={onChange} placeholder="min" />
                    <span className="kcal-sep">—</span>
                    <input name="max_kcal" inputMode="numeric" value={form.max_kcal} onChange={onChange} placeholder="max" />
                  </div>
                </div>

                {err && <div className="form-error">{err}</div>}

                <button className="btn btn-primary auth-btn">Save</button>
                {saved && <div className="save-msg">Saved!</div>}

                <button type="button" className="logout-btn below" onClick={handleLogout}>
                  Log out
                </button>
              </form>

            </>
          )}
        </div>
      </main>
    </div>
  );
}
