import { api } from "./api";

export async function login(username, password) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  // devuelve token como TEXT/PLAIN (baseURL ya incluye /api/v1)
  const { data: token } = await api.post("/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  localStorage.setItem("token", token);
  return token;
}

export function logout() {
  localStorage.removeItem("token");
}
