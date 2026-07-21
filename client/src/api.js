import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://capsfinal.onrender.com' : ''),
  withCredentials: true,
});

export default api;
