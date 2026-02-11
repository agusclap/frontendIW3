<script setup>
import { ref, computed, onMounted } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { AlarmsService } from "../services/alarms";

const alarms = ref([]);
const loading = ref(false);
const error = ref("");
const q = ref("");

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    alarms.value = await AlarmsService.list();
  } catch (e) {
    error.value = e?.response?.data?.message || "Error cargando alarmas";
  } finally {
    loading.value = false;
  }
};

onMounted(load);

function alarmTimestamp(a) {
  return a.time_stamp ?? a.timeStamp ?? a.timestamp ?? null;
}
function alarmOrderId(a) {
  return a.id_order ?? a.idOrder ?? a.orden?.numeroOrden ?? a.orden?.id ?? "—";
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return alarms.value;
  return alarms.value.filter(
    (a) =>
      (a.descripcion ?? "").toLowerCase().includes(term) ||
      (a.estado ?? "").toLowerCase().includes(term) ||
      String(a.temperatura ?? "").includes(term) ||
      String(alarmOrderId(a)).toLowerCase().includes(term)
  );
});

function badgeClass(estado) {
  const e = (estado ?? "").toUpperCase();
  if (e.includes("PENDIENTE") || e.includes("REVISION")) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (e.includes("ACEPTAD") || e.includes("RESUELT")) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (e.includes("RECHAZAD") || e.includes("CANCEL")) return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-gray-500/20 text-gray-300 border-gray-500/40";
}
</script>

<template>
  <AppLayout>
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-white">Alarmas</h1>
          <p class="text-gray-400 mt-1">Historial de alarmas del sistema</p>
        </div>
        <div class="flex gap-3">
          <input
            v-model="q"
            placeholder="Buscar por descripción, estado, orden..."
            class="w-full md:w-80 rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
          <button
            @click="load"
            class="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold text-white transition"
          >
            🔄 Recargar
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200"
      >
        {{ error }}
      </div>

      <div class="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div v-if="loading" class="p-8 text-center text-gray-400">
          Cargando alarmas...
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-black/30 text-gray-400">
              <tr>
                <th class="px-5 py-4 text-left font-medium">ID</th>
                <th class="px-5 py-4 text-left font-medium">Descripción</th>
                <th class="px-5 py-4 text-left font-medium">Estado</th>
                <th class="px-5 py-4 text-left font-medium">Temperatura</th>
                <th class="px-5 py-4 text-left font-medium">Fecha / Hora</th>
                <th class="px-5 py-4 text-left font-medium">Orden</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in filtered"
                :key="a.id"
                class="border-t border-white/10 text-gray-300 hover:bg-white/5 transition"
              >
                <td class="px-5 py-3 font-mono text-xs text-gray-400">{{ a.id }}</td>
                <td class="px-5 py-3 max-w-xs truncate" :title="a.descripcion">
                  {{ a.descripcion || "—" }}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="inline-flex rounded-md border px-2 py-0.5 text-xs font-medium"
                    :class="badgeClass(a.estado)"
                  >
                    {{ a.estado || "—" }}
                  </span>
                </td>
                <td class="px-5 py-3 font-mono text-cyan-300">
                  {{ a.temperatura != null ? `${a.temperatura} °C` : "—" }}
                </td>
                <td class="px-5 py-3 font-mono text-xs text-gray-400">
                  {{ alarmTimestamp(a) ? new Date(alarmTimestamp(a)).toLocaleString() : "—" }}
                </td>
                <td class="px-5 py-3 font-mono text-xs">
                  {{ alarmOrderId(a) }}
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="6" class="px-5 py-12 text-center text-gray-500">
                  No hay alarmas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
