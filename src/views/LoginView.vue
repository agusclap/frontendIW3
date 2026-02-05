<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "@/services/auth";

const router = useRouter();
const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const onSubmit = async () => {
  error.value = "";
  if (!username.value || !password.value) {
    error.value = "Usuario y contraseña son obligatorios";
    return;
  }
  loading.value = true;
  try {
    await login(username.value, password.value);
    router.push("/");
  } catch (err) {
    const msg = err.response?.data?.message ?? err.response?.data ?? err.message ?? "Error al iniciar sesión";
    error.value = typeof msg === "string" ? msg : JSON.stringify(msg);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black px-4">
    <div class="w-full max-w-md">
      <!-- Title -->
      <div class="mb-8 text-center">
        <h1 class="text-3xl font-bold text-white tracking-tight">
          Proyecto IW3
        </h1>
        <p class="text-gray-400 mt-2">
          Iniciá sesión para continuar
        </p>
      </div>

      <!-- Card -->
      <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
        <h2 class="text-xl font-semibold text-white mb-6">
          Iniciar sesión
        </h2>

        <form @submit.prevent="onSubmit" class="space-y-4">
          <p v-if="error" class="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            {{ error }}
          </p>
          <div>
            <label class="text-sm text-gray-300">Usuario</label>
            <input
              v-model="username"
              placeholder="admin"
              class="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>

          <div>
            <label class="text-sm text-gray-300">Contraseña</label>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              class="mt-2 w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-blue-500/60"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-lg shadow-blue-600/30
                   hover:bg-blue-500 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {{ loading ? "Entrando…" : "Entrar" }}
          </button>
        </form>

        <div class="mt-6 text-xs text-gray-400 flex justify-between">
          <span>© 2026 IW3</span>
          <span>Vue · Vite · Tailwind</span>
        </div>
      </div>
    </div>
  </div>
</template>
