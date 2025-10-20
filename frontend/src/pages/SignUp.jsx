// NOTE: no diacritics in comments
import Header from '../components/Header.jsx';
import AuthForm from '../components/AuthForm.jsx';

export default function SignUp() {
  return (
    <div className="bg-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div className="auth-wrap">
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
