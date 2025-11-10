// NOTE: no diacritics in comments
import Header from '../components/Header.jsx';
import AuthForm from '../components/AuthForm.jsx';

export default function SignIn() {
  return (
    <div className="bg-page auth-page">
      <Header />
      <main className="container">
        <div className="auth-wrap">
          <AuthForm mode="signin" />
        </div>
      </main>
    </div>
  );
}
