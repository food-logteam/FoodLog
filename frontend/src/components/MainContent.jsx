// NOTE: no diacritics in comments
import { Plus, History, Calendar } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/api.js';

export default function MainContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  function go(to) {
    if (!user) {
      // send to signin and return after
      navigate('/auth/signin', { state: { from: to || location.pathname } });
      return;
    }
    navigate(to);
  }

  return (
    <main>
      <section className="container">
        {/* hero */}
        <div className="hero">
          <h1>
            Welcome to Your
            <span className="accent">Food Journey</span>
          </h1>
          <p>Track your meals, discover patterns, and build healthier eating habits with FoodLog.</p>
        </div>

        {/* actions */}
        <div className="actions" style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
          <button className="btn btn-primary wide" onClick={() => go('/add-today')}>
            <Plus width={18} height={18} />
            Add Meal
          </button>

          <div className="actions-inline">
            <button className="btn btn-history" onClick={() => go('/history')}>
              <History width={18} height={18} />
              History
            </button>
            <button className="btn btn-future" onClick={() => go('/future')}>
              <Calendar width={18} height={18} />
              Future
            </button>
          </div>
        </div>

        {/* features */}
        <section className="features">
          <article className="feature-card">
            <div className="feature-head">
              <div className="icon-badge icon-teal">
                <Plus width={18} height={18} />
              </div>
              <h3 className="feature-title">Track Meals</h3>
            </div>
            <p className="feature-text">Log your daily meals and snacks.</p>
          </article>

          <article className="feature-card">
            <div className="feature-head">
              <div className="icon-badge icon-sky">
                <History width={18} height={18} />
              </div>
              <h3 className="feature-title">View History</h3>
            </div>
            <p className="feature-text">Review your eating patterns.</p>
          </article>

          <article className="feature-card">
            <div className="feature-head">
              <div className="icon-badge icon-cyan">
                <Calendar width={18} height={18} />
              </div>
              <h3 className="feature-title">Plan Ahead</h3>
            </div>
            <p className="feature-text">Schedule future meals.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
