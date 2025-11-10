// NOTE: no diacritics in comments
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../lib/api.js';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = getToken();
  if (!token) {
    return <Navigate to="/auth/signin" replace state={{ from: location.pathname }} />;
  }
  return children;
}
