<script setup>
import { onMounted, ref, computed } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { UsersService } from "../services/users";

const users = ref([]);
const roles = ref([]);
const loading = ref(true);
const error = ref("");
const successMessage = ref("");
const searchQuery = ref("");

// Modal cambiar contraseña
const showPasswordModal = ref(false);
const passwordUser = ref(null);
const oldPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const passwordLoading = ref(false);
const passwordError = ref("");

// Asignar rol: usuario seleccionado y rol elegido
const showRoleModal = ref(false);
const roleUser = ref(null);
const selectedRoleName = ref("");
const roleLoading = ref(false);
const roleError = ref("");

const setMessage = (type, msg) => {
  if (type === "error") {
    error.value = msg;
    successMessage.value = "";
  } else {
    successMessage.value = msg;
    error.value = "";
  }
  setTimeout(() => {
    error.value = "";
    successMessage.value = "";
  }, 5000);
};

const loadUsers = async () => {
  loading.value = true;
  error.value = "";
  try {
    if (searchQuery.value.trim()) {
      const data = await UsersService.search(searchQuery.value.trim());
      users.value = Array.isArray(data) ? data : [data];
    } else {
      users.value = await UsersService.list();
    }
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || "Error cargando usuarios";
    setMessage("error", msg);
    users.value = [];
  } finally {
    loading.value = false;
  }
};

const loadRoles = async () => {
  try {
    roles.value = await UsersService.listRoles();
  } catch (e) {
    console.error("Error cargando roles", e);
    roles.value = [];
  }
};

onMounted(() => {
  loadUsers();
  loadRoles();
});

const enableUser = async (u) => {
  const id = u.username || u.email;
  try {
    await UsersService.enable(id);
    setMessage("success", `Usuario "${id}" activado.`);
    await loadUsers();
  } catch (e) {
    setMessage("error", e?.response?.data?.message || "Error al activar usuario.");
  }
};

const disableUser = async (u) => {
  const id = u.username || u.email;
  try {
    await UsersService.disable(id);
    setMessage("success", `Usuario "${id}" desactivado.`);
    await loadUsers();
  } catch (e) {
    setMessage("error", e?.response?.data?.message || "Error al desactivar usuario.");
  }
};

const openPasswordModal = (u) => {
  passwordUser.value = u;
  oldPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  passwordError.value = "";
  showPasswordModal.value = true;
};

const closePasswordModal = () => {
  showPasswordModal.value = false;
  passwordUser.value = null;
  passwordError.value = "";
};

const submitChangePassword = async () => {
  passwordError.value = "";
  if (!passwordUser.value) return;
  if (!newPassword.value || newPassword.value.length < 4) {
    passwordError.value = "La nueva contraseña debe tener al menos 4 caracteres.";
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = "La nueva contraseña y la confirmación no coinciden.";
    return;
  }
  const usernameoremail = passwordUser.value.username || passwordUser.value.email;
  passwordLoading.value = true;
  try {
    await UsersService.changePassword(usernameoremail, oldPassword.value, newPassword.value);
    setMessage("success", "Contraseña actualizada correctamente.");
    closePasswordModal();
  } catch (e) {
    passwordError.value = e?.response?.data?.message || "Error al cambiar la contraseña.";
  } finally {
    passwordLoading.value = false;
  }
};

const openRoleModal = (u) => {
  roleUser.value = u;
  selectedRoleName.value = "";
  roleError.value = "";
  showRoleModal.value = true;
};

const closeRoleModal = () => {
  showRoleModal.value = false;
  roleUser.value = null;
  roleError.value = "";
};

const rolesToAssign = computed(() => {
  if (!roleUser.value || !Array.isArray(roleUser.value.roles)) return roles.value;
  const currentNames = new Set(roleUser.value.roles.map((r) => r.name));
  return roles.value.filter((r) => !currentNames.has(r.name));
});

const assignRole = async () => {
  if (!roleUser.value || !selectedRoleName.value) return;
  roleLoading.value = true;
  roleError.value = "";
  const id = roleUser.value.username || roleUser.value.email;
  try {
    await UsersService.assignRole(id, selectedRoleName.value);
    setMessage("success", `Rol "${selectedRoleName.value}" asignado.`);
    await loadUsers();
    const idx = users.value.findIndex((x) => (x.username || x.email) === id);
    if (idx >= 0) roleUser.value = users.value[idx];
    selectedRoleName.value = "";
  } catch (e) {
    roleError.value = e?.response?.data?.message || "Error al asignar rol.";
  } finally {
    roleLoading.value = false;
  }
};

const removeRole = async (u, roleName) => {
  const id = u.username || u.email;
  try {
    await UsersService.removeRole(id, roleName);
    setMessage("success", `Rol "${roleName}" quitado.`);
    await loadUsers();
  } catch (e) {
    setMessage("error", e?.response?.data?.message || "Error al quitar rol.");
  }
};

const statusBadge = (value) =>
  value
    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
    : "border-red-500/40 bg-red-500/20 text-red-300";
</script>

<template>
  <AppLayout>
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <div class="mx-4 py-6">
        <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-white">
              Usuarios
            </h1>
            <p class="mt-1 text-sm text-gray-400">
              Gestión de usuarios, estados y roles
            </p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              v-model="searchQuery"
              placeholder="Buscar por username..."
              class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:w-72"
              @keyup.enter="loadUsers"
            />
            <button
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              @click="loadUsers"
            >
              Buscar
            </button>
            <button
              v-if="searchQuery.trim()"
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              @click="searchQuery = ''; loadUsers()"
            >
              Ver todos
            </button>
          </div>
        </div>

        <div
          v-if="error"
          class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {{ error }}
        </div>
        <div
          v-if="successMessage"
          class="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          {{ successMessage }}
        </div>

        <div
          class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
        >
          <div v-if="loading" class="p-8 text-center text-gray-400">
            Cargando usuarios...
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-white/10 bg-black/30 text-gray-400">
                <tr>
                  <th class="px-5 py-4 text-left font-medium">ID</th>
                  <th class="px-5 py-4 text-left font-medium">Username</th>
                  <th class="px-5 py-4 text-left font-medium">Email</th>
                  <th class="px-5 py-4 text-left font-medium">Activo</th>
                  <th class="px-5 py-4 text-left font-medium">Cuenta no expirada</th>
                  <th class="px-5 py-4 text-left font-medium">Cuenta no bloqueada</th>
                  <th class="px-5 py-4 text-left font-medium">Credenciales no expiradas</th>
                  <th class="px-5 py-4 text-left font-medium">Roles</th>
                  <th class="px-5 py-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="u in users"
                  :key="u.idUser"
                  class="border-t border-white/10 transition hover:bg-white/5"
                >
                  <td class="px-5 py-4 text-gray-300">{{ u.idUser }}</td>
                  <td class="px-5 py-4 font-medium text-white">{{ u.username ?? "—" }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ u.email ?? "—" }}</td>
                  <td class="px-5 py-4">
                    <span
                      class="inline-flex rounded-lg border px-2 py-1 text-xs"
                      :class="statusBadge(u.enabled)"
                    >
                      {{ u.enabled ? "Sí" : "No" }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class="inline-flex rounded-lg border px-2 py-1 text-xs"
                      :class="statusBadge(u.accountNonExpired)"
                    >
                      {{ u.accountNonExpired ? "Sí" : "No" }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class="inline-flex rounded-lg border px-2 py-1 text-xs"
                      :class="statusBadge(u.accountNonLocked)"
                    >
                      {{ u.accountNonLocked ? "Sí" : "No" }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <span
                      class="inline-flex rounded-lg border px-2 py-1 text-xs"
                      :class="statusBadge(u.credentialsNonExpired)"
                    >
                      {{ u.credentialsNonExpired ? "Sí" : "No" }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    <div class="flex flex-wrap gap-1">
                      <template v-for="r in (u.roles || [])" :key="r.id">
                        <span
                          class="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300"
                        >
                          {{ r.name }}
                          <button
                            type="button"
                            class="ml-0.5 rounded hover:bg-blue-500/30 p-0.5"
                            title="Quitar rol"
                            @click="removeRole(u, r.name)"
                          >
                            ×
                          </button>
                        </span>
                      </template>
                      <span v-if="!(u.roles && u.roles.length)" class="text-gray-500">—</span>
                    </div>
                  </td>
                  <td class="px-5 py-4 text-right">
                    <div class="flex flex-wrap justify-end gap-2">
                      <button
                        v-if="!u.enabled"
                        class="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/30"
                        @click="enableUser(u)"
                      >
                        Activar
                      </button>
                      <button
                        v-else
                        class="rounded-lg border border-amber-500/40 bg-amber-500/20 px-2 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30"
                        @click="disableUser(u)"
                      >
                        Desactivar
                      </button>
                      <button
                        class="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10"
                        @click="openRoleModal(u)"
                      >
                        Roles
                      </button>
                      <button
                        class="rounded-lg border border-blue-500/40 bg-blue-500/20 px-2 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/30"
                        @click="openPasswordModal(u)"
                      >
                        Cambiar contraseña
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="users.length === 0">
                  <td colspan="9" class="px-5 py-12 text-center text-gray-500">
                    No hay usuarios.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Cambiar contraseña -->
    <Teleport to="body">
      <div
        v-if="showPasswordModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="closePasswordModal"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-xl"
          @click.stop
        >
          <h3 class="text-lg font-semibold text-white">
            Cambiar contraseña
          </h3>
          <p v-if="passwordUser" class="mt-1 text-sm text-gray-400">
            Usuario: {{ passwordUser.username || passwordUser.email }}
          </p>
          <form class="mt-4 space-y-4" @submit.prevent="submitChangePassword">
            <div>
              <label class="block text-sm text-gray-400">Contraseña actual</label>
              <input
                v-model="oldPassword"
                type="password"
                autocomplete="current-password"
                class="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400">Nueva contraseña</label>
              <input
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                class="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-400">Confirmar nueva contraseña</label>
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                class="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <p v-if="passwordError" class="text-sm text-red-400">
              {{ passwordError }}
            </p>
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10"
                @click="closePasswordModal"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="passwordLoading"
                class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {{ passwordLoading ? "Guardando..." : "Guardar" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal Asignar rol -->
    <Teleport to="body">
      <div
        v-if="showRoleModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="closeRoleModal"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-xl"
          @click.stop
        >
          <h3 class="text-lg font-semibold text-white">
            Gestionar roles
          </h3>
          <p v-if="roleUser" class="mt-1 text-sm text-gray-400">
            Usuario: {{ roleUser.username || roleUser.email }}
          </p>
          <div class="mt-4 flex flex-wrap gap-1">
            <span
              v-for="r in (roleUser?.roles || [])"
              :key="r.id"
              class="inline-flex items-center rounded-lg border border-blue-500/40 bg-blue-500/20 px-2 py-1 text-xs text-blue-300"
            >
              {{ r.name }}
            </span>
          </div>
          <div class="mt-4">
            <label class="block text-sm text-gray-400">Asignar rol</label>
            <div class="mt-2 flex gap-2">
              <select
                v-model="selectedRoleName"
                class="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="" class="bg-gray-900 text-white">Seleccionar rol...</option>
                <option
                  v-for="r in rolesToAssign"
                  :key="r.id"
                  :value="r.name"
                  class="bg-gray-900 text-white" 
                >
                  {{ r.name }}
                </option>
              </select>
              <button
                type="button"
                :disabled="!selectedRoleName || roleLoading"
                class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                @click="assignRole"
              >
                {{ roleLoading ? "..." : "Asignar" }}
              </button>
            </div>
          </div>
          <p v-if="roleError" class="mt-2 text-sm text-red-400">
            {{ roleError }}
          </p>
          <div class="mt-4 flex justify-end">
            <button
              type="button"
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10"
              @click="closeRoleModal"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
