import axios from "axios";

// En desarrollo usamos proxy de Vite (mismo origen) para evitar CORS
const apiBaseUrl = import.meta.env.DEV 
  ? "/api/v1" 
  : (import.meta.env.VITE_API_BASE_URL ?? "/api/v1");
  //: (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1");
export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Asegurar que TODAS las peticiones lleven el Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Opcional: ante 401 limpiar token y redirigir a login
api.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      const path = window.location.pathname || "";
      if (!path.startsWith("/login")) {
        window.location.href = "/login?redirect=" + encodeURIComponent(path);
      }
    }
    return Promise.reject(err);
  }
);
