// NOTE: no diacritics in comments
import { Utensils, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="header">
      <div className="container header-row">
        <div className="brand">
          <div className="brand-badge">
            <Utensils />
          </div>
          <span className="brand-name">FoodLog</span>
        </div>

        <button className="icon-btn profile" aria-label="Profile" onClick={()=>console.log('profile')}>
          <User />
        </button>
      </div>
    </header>
  );
}
