import axios from "axios";

const api = axios.create({
  baseURL: "https://wavelength-production-6609.up.railway.app",
});

// Attach Supabase JWT when present in localStorage
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("sb-ehxeaqehzetzmfsbssmd-auth-token");
    if (raw) {
      const session = JSON.parse(raw);
      const token = session?.access_token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // no-op
  }
  return config;
});

export default api;
