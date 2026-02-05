import axios from "axios";

// En desarrollo usamos proxy de Vite (mismo origen) para evitar CORS
const apiBaseUrl = import.meta.env.DEV
  ? "/api/v1"
  : (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api/v1");

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
