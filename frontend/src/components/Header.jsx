// NOTE: no diacritics in comments
import { Utensils, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/api.js';

export default function Header() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <header className="header bg-page">
      <div className="container header-row">
        {/* Brand / logo — now clickable */}
        <button
          className="brand"
          onClick={() => navigate('/')}
          title="Go to home"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div className="brand-badge"><Utensils /></div>
          <span className="brand-name">FoodLog</span>
        </button>

        {/* Right side: profile or auth buttons */}
        {!user ? (
          <div className="profile" style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-sky"
              onClick={() => navigate('/auth/signin')}
              style={{ fontSize: '15px', padding: '10px 22px', fontWeight: 600 }}
            >
              Sign in
            </button>
            <button
              className="btn-cyan"
              onClick={() => navigate('/auth/signup')}
              style={{ fontSize: '15px', padding: '10px 22px', fontWeight: 600 }}
            >
              Sign up
            </button>
          </div>
        ) : (
          <button
            className="icon-btn profile"
            title="Account"
            onClick={() => navigate('/account')}
            aria-label="Profile"
          >
            <User />
          </button>
        )}
      </div>
    </header>
  );
}
