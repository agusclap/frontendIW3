<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { Line } from "vue-chartjs";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import AppLayout from "../layouts/AppLayout.vue";
import { OrdersService } from "../services/orders";

import { AlarmsService } from "../services/alarms";
import { createTemperaturasSubscription } from "../services/websocket";
import {
  getClienteNombre,
  getEstadoOrden,
  getNumeroOrden,
  getPatente,
  getPreset,
  getMasa,
  getTemperatura,
  getDensidad,
  getCaudal,
  getTemperaturaUmbral,
  getProductoNombre,
  getChoferNombre,
  isAlarmaActivada,
} from "../utils/ordenContract";
import { statusMeta } from "../utils/orderStatus";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const route = useRoute();
const numeroOrden = route.params.id;

const loading = ref(true);
const error = ref("");
const order = ref(null);
const wsConnected = ref(false);

//  PASO 2 — Crear estado para alarmas
const alarms = ref([]);

const massKg = ref(0);
const presetKg = ref(0);
const temperature = ref(null);
const flowKgh = ref(0);
const density = ref(null);

const TEMP_HISTORY_MAX = 30;
const temperatureHistory = ref([]);
const temperatureLabels = ref([]);

const isCargaTerminada = computed(() => {
  const estado = (getEstadoOrden(order.value) ?? "").toString().toUpperCase().trim();
  return estado === "FINALIZADA" || estado === "CERRADA_PARA_CARGA";
});

let unsubscribeWs = null;
let pollTimer = null;

function applyOrderToState(data) {
  if (!data) return;
  order.value = data;
  presetKg.value = getPreset(data);
  massKg.value = getMasa(data);
  temperature.value = getTemperatura(data);
  flowKgh.value = getCaudal(data);
  density.value = getDensidad(data);
  if (temperature.value != null) {
    const terminada = isCargaTerminada.value;
    if (!terminada || temperatureHistory.value.length === 0) {
      appendTemperatureSample(new Date().toLocaleTimeString(), temperature.value);
    }
  }
}

function buildChartFromHistorial(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const withTime = items
    .map((item) => {
      const temp = item.temperatura ?? item.temp;
      if (temp == null || Number.isNaN(Number(temp))) return null;
      let ms = null;
      if (item.fechaHora) ms = new Date(item.fechaHora).getTime();
      else if (item.timestamp != null) ms = item.timestamp > 1e12 ? item.timestamp : item.timestamp * 1000;
      else if (item.fecha) ms = new Date(item.fecha).getTime();
      return { ms: ms ?? 0, temp: Number(temp) };
    })
    .filter(Boolean);
  if (withTime.length === 0) return null;
  withTime.sort((a, b) => a.ms - b.ms);
  return {
    labels: withTime.map((x) => (x.ms ? new Date(x.ms).toLocaleTimeString() : "")),
    values: withTime.map((x) => x.temp),
  };
}

//  PASO 3 — Función para cargar alarmas
const loadAlarms = async () => {
  try {
    const all = await AlarmsService.list();
    alarms.value = all
      .filter(a => a.orden?.numeroOrden == numeroOrden)
      .sort((a, b) => new Date(b.timeStamp) - new Date(a.timeStamp));
  } catch (e) {
    console.error("Error cargando alarmas", e);
  }
};

const load = async () => {
  error.value = "";
  try {
    const data = await OrdersService.getByNumeroOrden(numeroOrden);
    applyOrderToState(data);
    
    //  PASO 4 — Hacer que load() también cargue alarmas
    await loadAlarms();

    const terminada = isCargaTerminada.value;
    if (terminada) {
      const historial = await OrdersService.getHistorialCarga(numeroOrden);
      const chart = buildChartFromHistorial(historial);
      if (chart && chart.values.length > 0) {
        temperatureLabels.value = chart.labels;
        temperatureHistory.value = chart.values;
      }
    }
  } catch (e) {
    if (e?.response?.status === 403) {
      error.value = "Acceso denegado (403). Revisa los permisos en el backend.";
    } else {
      error.value = e?.message || "Error cargando la orden";
    }
  } finally {
    loading.value = false;
  }
};

function appendTemperatureSample(label, value) {
  const v = Number(value);
  if (Number.isNaN(v)) return;
  if (isCargaTerminada.value) {
    temperatureLabels.value = [...temperatureLabels.value, label];
    temperatureHistory.value = [...temperatureHistory.value, v];
  } else {
    temperatureLabels.value = [...temperatureLabels.value.slice(-(TEMP_HISTORY_MAX - 1)), label];
    temperatureHistory.value = [...temperatureHistory.value.slice(-(TEMP_HISTORY_MAX - 1)), v];
  }
}

onMounted(async () => {
  await load();
  pollTimer = setInterval(() => {
    if (order.value) load();
  }, 5000);

  const token = localStorage.getItem("token");
  unsubscribeWs = createTemperaturasSubscription({
    token: token || undefined,
    onTemperatura: (value) => {
      wsConnected.value = true;
      temperature.value = value;
      appendTemperatureSample(new Date().toLocaleTimeString(), value);
    },
  });
});

onUnmounted(() => {
  if (unsubscribeWs) unsubscribeWs();
  if (pollTimer) clearInterval(pollTimer);
});

const progress = computed(() => {
  if (!presetKg.value) return 0;
  return Math.min(100, Math.max(0, (massKg.value / presetKg.value) * 100));
});

//  PASO 5 — Computed para detectar alarma pendiente
const pendingAlarm = computed(() =>
  alarms.value.find(a => a.estado === "PENDIENTE_REVISION")
);

//  PASO 6 — Función aceptar alarma
const acceptAlarm = async () => {
  if (!pendingAlarm.value) return;
  try {
    await AlarmsService.accept(pendingAlarm.value.id);
    await load();
  } catch (e) {
    console.error("Error aceptando alarma", e);
  }
};

const etaSeconds = computed(() => {
  const target = Number(presetKg.value) || 0;
  const current = Number(massKg.value) || 0;
  const flow = Number(flowKgh.value) || 0;

  const remaining = target - current;

  // Si el caudal es 0, no hay cálculo posible
  if (flow <= 0) return null;

  // Si la masa ya alcanzó o superó el preset, el ETA es 0
  if (remaining <= 0) return 0;

  return (remaining / flow) * 3600;
});

const etaFormatted = computed(() => {
  const s = etaSeconds.value;
  
  // Si es null (caudal 0)
  if (s === null) return "—";
  
  // Si es 0 (carga completada o excedida)
  if (s <= 0) return "Completado";

  const totalSeconds = Math.floor(s);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
});

const etaCirclePercent = computed(() => {
  const s = etaSeconds.value;
  if (s == null || s <= 0) return 100;
  const maxEta = 3600;
  const p = Math.min(100, (1 - s / maxEta) * 100);
  return Math.max(0, p);
});

const chartData = computed(() => ({
  labels: temperatureLabels.value,
  datasets: [
    {
      label: "Temperatura (°C)",
      data: temperatureHistory.value,
      borderColor: "rgb(96, 165, 250)",
      backgroundColor: "rgba(96, 165, 250, 0.1)",
      fill: true,
      tension: 0.3,
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "rgba(255,255,255,0.7)" } },
    x: { grid: { color: "rgba(255,255,255,0.06)" }, ticks: { color: "rgba(255,255,255,0.6)", maxTicksLimit: 8 } },
  },
  plugins: { legend: { display: false } },
};

const fmt = (n, unit = "") =>
  n === null || n === undefined ? "—" : `${Number(n).toLocaleString()}${unit}`;
</script>

<template>
  <AppLayout>
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <div v-if="loading" class="flex items-center justify-center py-20 text-gray-400">
        Cargando orden...
      </div>
      
      <template v-else>
        <div v-if="error" class="mx-4 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {{ error }}
        </div>

        <div v-if="order" class="mx-4 space-y-6 py-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Orden</p>
              <h1 class="text-3xl font-bold tracking-tight text-white">#{{ getNumeroOrden(order) }}</h1>
              <div class="mt-2 flex flex-wrap items-center gap-3">
                <span class="rounded-lg border px-2 py-1 text-xs" :class="statusMeta(getEstadoOrden(order)).cls">
                  <span v-if="isAlarmaActivada(order)" class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  {{ statusMeta(getEstadoOrden(order)).label }}
                </span>
                <span class="text-sm text-gray-400">Camión: {{ getPatente(order) ?? "—" }}</span>
                <span v-if="wsConnected" class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  En vivo
                </span>
              </div>
            </div>
          </div>
          <div class="text-[10px] bg-black p-2 rounded border border-white/20 font-mono text-gray-400">
            DEBUG LOG:
            Preset: {{ presetKg }} ({{ typeof presetKg }}) |
            Masa: {{ massKg }} ({{ typeof massKg }}) |
            Caudal: {{ flowKgh }} ({{ typeof flowKgh }})
          </div>
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Progreso</p>
              <div class="relative mx-auto flex h-44 w-44 items-center justify-center">
                <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path class="text-white/10" stroke="currentColor" stroke-width="2.5" fill="none" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" />
                  <path class="text-blue-400 transition-all duration-500" stroke="currentColor" stroke-width="2.5" stroke-dasharray="100" :stroke-dashoffset="100 - progress" stroke-linecap="round" fill="none" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" />
                </svg>
                <div class="absolute flex flex-col items-center">
                  <span class="text-3xl font-bold text-white">{{ progress.toFixed(1) }}%</span>
                  <span class="text-xs text-gray-400">{{ fmt(massKg, " kg") }} / {{ fmt(presetKg, " kg") }}</span>
                </div>
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ETA</p>
              <div class="relative mx-auto flex h-44 w-44 items-center justify-center">
                <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path class="text-white/10" stroke="currentColor" stroke-width="2.5" fill="none" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" />
                  <path class="text-cyan-400 transition-all duration-500" stroke="currentColor" stroke-width="2.5" stroke-dasharray="100" :stroke-dashoffset="100 - etaCirclePercent" stroke-linecap="round" fill="none" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" />
                </svg>
                <div class="absolute flex flex-col items-center">
                  <span class="text-2xl font-bold text-white">{{ etaFormatted }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div class="h-64">
              <Line :data="chartData" :options="chartOptions" />
            </div>
          </div>

          <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div class="border-b border-white/10 px-5 py-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-gray-200">Alarmas de Temperatura</h2>
                  <p class="text-xs text-gray-500">Umbral: {{ getTemperaturaUmbral(order) }} °C</p>
                </div>
                <button
                  v-if="pendingAlarm"
                  @click="acceptAlarm"
                  class="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500 transition-colors"
                >
                  Aceptar alarma activa
                </button>
              </div>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-black/30 text-gray-400">
                  <tr>
                    <th class="px-5 py-3 text-left">Fecha / Hora</th>
                    <th class="px-5 py-3 text-left">Temperatura</th>
                    <th class="px-5 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="alarm in alarms"
                    :key="alarm.id"
                    class="border-t border-white/10"
                    :class="alarm.estado === 'PENDIENTE_REVISION' ? 'bg-red-500/10 text-red-200' : 'text-gray-300'"
                  >
                    <td class="px-5 py-3 font-mono text-xs">
                      {{ new Date(alarm.timeStamp).toLocaleString() }}
                    </td>
                    <td class="px-5 py-3 font-semibold">{{ alarm.temperatura }} °C</td>
                    <td class="px-5 py-3">
                      <span
                        :class="alarm.estado === 'PENDIENTE_REVISION' ? 'text-red-400 font-bold' : 'text-green-400'"
                      >
                        {{ alarm.estado }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="alarms.length === 0">
                    <td colspan="3" class="px-5 py-8 text-center text-gray-500">Sin alarmas registradas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>