// NOTE: no diacritics in comments
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import AddToday from './pages/AddToday.jsx';
import History from './pages/History.jsx';
import Future from './pages/Future.jsx';
import Account from './pages/Account.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import NotFound from './pages/NotFound.jsx';
import ProtectedRoute from './pages/ProtectedRoute.jsx';

export default function App() {
  return (
    <Router>
      <main className="bg-page" style={{ minHeight: '100vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/add-today" element={
            <ProtectedRoute><AddToday /></ProtectedRoute>
          } />

          <Route path="/history" element={
            <ProtectedRoute><History /></ProtectedRoute>
          } />

          <Route path="/future" element={
            <ProtectedRoute><Future /></ProtectedRoute>
          } />

          <Route path="/account" element={
            <ProtectedRoute><Account /></ProtectedRoute>
          } />

          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </Router>
  );
}
