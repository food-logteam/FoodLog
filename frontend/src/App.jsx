// NOTE: no diacritics in comments
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';

export default function App() {
  return (
    <Theme appearance="light" radius="large" scaling="100%">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth/signin" element={<SignIn />} />
          <Route path="/auth/signup" element={<SignUp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} newestOnTop closeOnClick pauseOnHover />
    </Theme>
  );
}
