// NOTE: no diacritics in comments
import { Utensils, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../lib/api.js';

export default function Header() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="container header-row">
        <div className="brand">
          <div className="brand-badge"><Utensils /></div>
          <span className="brand-name">FoodLog</span>
        </div>

        {!user ? (
          <div className="profile" style={{ display:'flex', gap: '8px' }}>
            <Link to="/auth/signin" className="icon-btn" title="Sign in">In</Link>
            <Link to="/auth/signup" className="icon-btn" title="Sign up">Up</Link>
          </div>
        ) : (
          <button
            className="icon-btn profile"
            title="Logout"
            onClick={() => { logout(); navigate(0); }}
          >
            <User />
          </button>
        )}
      </div>
    </header>
  );
}
