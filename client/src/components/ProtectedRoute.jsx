import axios from 'axios';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const [isAuth, setIsAuth] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const verifyAdmin = async () => {
      try {
        const response = await axios.get('/api/admin/check-auth');
        if (isMounted) {
          setIsAuth(Boolean(response?.data?.authenticated));
        }
      } catch (error) {
        // Surface server error messages (helps debug missing/blocked cookie issues)
        // eslint-disable-next-line no-console
        console.error('Admin auth check failed:', error?.response?.data || error?.message);
        if (isMounted) {
          setIsAuth(false);
        }
      }
    };

    verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuth === null) {
    return <div className="p-8 text-center text-police">Verifying admin session...</div>;
  }

  if (!isAuth) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
