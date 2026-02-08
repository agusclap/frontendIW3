<script setup>
import { computed, onMounted, ref } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { OrdersService } from "../services/orders";
import {
  getClienteNombre,
  getEstadoOrden,
  getMasa,
  getNumeroOrden,
  getPatente,
  getPreset,
  getTemperatura,
  getDensidad,
  getCaudal,
  isAlarmaActivada,
} from "../utils/ordenContract";
import { statusMeta } from "../utils/orderStatus";

const loading = ref(true);
const error = ref("");
const q = ref("");
const statusFilter = ref("ALL");
const orders = ref([]);

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    orders.value = await OrdersService.list();
  } catch (e) {
    error.value = e?.message || "Error cargando órdenes";
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const statuses = computed(() => {
  const set = new Set(
    (orders.value || [])
      .map((o) => (getEstadoOrden(o) ?? "").toString().toUpperCase().trim())
      .filter(Boolean)
  );
  return ["ALL", ...Array.from(set)];
});

const filtered = computed(() => {
  const qq = q.value.trim().toLowerCase();
  return (orders.value || []).filter((o) => {
    const estado = getEstadoOrden(o);
    const s = (estado ?? "").toString().toUpperCase().trim();
    const okStatus = statusFilter.value === "ALL" || s === statusFilter.value;
    const hay = `${o.id ?? ""} ${getNumeroOrden(o)} ${getPatente(o)} ${getClienteNombre(o)}`.toLowerCase();
    const okQ = !qq || hay.includes(qq);
    return okStatus && okQ;
  });
});

const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString());
</script>

<template>
  <AppLayout>
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <div class="mx-4 py-6">
        <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-white">Órdenes</h1>
            <p class="mt-1 text-sm text-gray-400">Monitoreo y estado de carga</p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              v-model="statusFilter"
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="ALL">Todos los estados</option>
              <option v-for="s in statuses.filter((x) => x !== 'ALL')" :key="s" :value="s">
                {{ statusMeta(s).label }}
              </option>
            </select>

            <input
              v-model="q"
              placeholder="Buscar (nº orden, patente, cliente...)"
              class="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 sm:w-72"
            />

            <button
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              @click="load"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div
          v-if="error"
          class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {{ error }}
        </div>

        <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div v-if="loading" class="p-8 text-center text-gray-400">Cargando órdenes...</div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-white/10 bg-black/30 text-gray-400">
                <tr>
                  <th class="px-5 py-4 text-left font-medium">Orden</th>
                  <th class="px-5 py-4 text-left font-medium">Estado</th>
                  <th class="px-5 py-4 text-left font-medium">Camión</th>
                  <th class="px-5 py-4 text-left font-medium">Preset</th>
                  <th class="px-5 py-4 text-left font-medium">Masa</th>
                  <th class="px-5 py-4 text-left font-medium">Temp</th>
                  <th class="px-5 py-4 text-left font-medium">Dens.</th>
                  <th class="px-5 py-4 text-left font-medium">Caudal</th>
                  <th class="px-5 py-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="o in filtered"
                  :key="o.id"
                  class="border-t border-white/10 transition hover:bg-white/5"
                >
                  <td class="px-5 py-4">
                    <div class="font-medium text-white">#{{ getNumeroOrden(o) }}</div>
                    <div class="text-xs text-gray-500">ID: {{ o.id }}</div>
                  </td>

                  <td class="px-5 py-4">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                      :class="statusMeta(getEstadoOrden(o)).cls"
                    >
                      <span
                        v-if="isAlarmaActivada(o)"
                        class="h-1.5 w-1.5 rounded-full bg-red-400"
                        title="Alarma activada"
                      />
                      {{ statusMeta(getEstadoOrden(o)).label }}
                    </span>
                  </td>

                  <td class="px-5 py-4 text-gray-300">{{ getPatente(o) ?? "—" }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ fmt(getPreset(o)) }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ fmt(getMasa(o)) }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ fmt(getTemperatura(o)) }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ fmt(getDensidad(o)) }}</td>
                  <td class="px-5 py-4 text-gray-300">{{ fmt(getCaudal(o)) }}</td>

                  <td class="px-5 py-4 text-right">
                    <router-link
                      :to="`/orders/${getNumeroOrden(o)}`"
                      class="font-medium text-blue-300 hover:text-blue-200"
                    >
                      Ver detalle
                    </router-link>
                  </td>
                </tr>

                <tr v-if="filtered.length === 0">
                  <td colspan="9" class="px-5 py-12 text-center text-gray-500">
                    No hay órdenes con esos filtros.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
