// NOTE: no diacritics in comments
import { Plus, History, Calendar } from 'lucide-react';

export default function MainContent() {
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
  <button className="btn btn-primary wide" onClick={()=>console.log('add meal')}>
    <Plus width={18} height={18} />
    Add Meal
  </button>

  <div className="actions-inline">
    <button className="btn btn-history" onClick={()=>console.log('history')}>
      <History width={18} height={18} />
      History
    </button>
    <button className="btn btn-future" onClick={()=>console.log('future')}>
      <Calendar width={18} height={18} />
      Future
    </button>
  </div>
</div>


        {/* features */}
        <div className="features">
          <div className="feature">
            <div className="icon-circle icon-teal">
              <Plus width={20} height={20} />
            </div>
            <div className="title">Track Meals</div>
            <div className="text">Log your daily meals and snacks</div>
          </div>

          <div className="feature">
            <div className="icon-circle icon-sky">
              <History width={20} height={20} />
            </div>
            <div className="title">View History</div>
            <div className="text">Review your eating patterns</div>
          </div>

          <div className="feature">
            <div className="icon-circle icon-cyan">
              <Calendar width={20} height={20} />
            </div>
            <div className="title">Plan Ahead</div>
            <div className="text">Schedule future meals</div>
          </div>
        </div>
      </section>
    </main>
  );
}
