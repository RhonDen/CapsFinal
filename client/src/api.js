import axios from 'axios';

// In production (Vercel), use the VITE_API_BASE_URL env var or the Render backend URL.
// In development, Vite proxy is used (localhost:5173 → localhost:5000).
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://capsfinal.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default api;
