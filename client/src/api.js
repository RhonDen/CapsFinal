import axios from 'axios';

// In production (Vercel), set VITE_API_BASE_URL to your Render backend URL (e.g. https://capsfinal.onrender.com).
// In development, BASE_URL is empty so the Vite proxy handles /api → localhost:5000.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default api;
