import axios from 'axios';
import { Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Submit the admin credentials and surface clearer errors when the API is unavailable.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/admin/login', { username, password });
      navigate('/admin/dashboard');
    } catch (requestError) {
      if (!requestError.response) {
        setError('Admin server is unavailable. Start the backend and try again.');
      } else {
        setError(requestError.response?.data?.error || 'Invalid credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex rounded-full bg-maastricht p-3">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-maastricht">Admin Login</h1>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-mist bg-pearl px-4 py-2 text-sm font-medium text-maastricht transition hover:border-silver-lake hover:text-police dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:text-slate-100"
          >
            Back home
          </button>
        </div>



        {error ? <p className="mb-4 text-center text-sm text-red-600">{error}</p> : null}


        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 p-3"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-gray-200 p-3"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-silver-lake py-3 font-semibold text-white transition hover:bg-wild-blue disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
