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
/** Parámetro de la ruta: en este front es el numeroOrden (enlace desde lista usa getNumeroOrden) */
const numeroOrden = route.params.id;

const loading = ref(true);
const error = ref("");
const order = ref(null);
const wsConnected = ref(false);

// Datos reactivos: inicializados desde API y temperatura también desde WebSocket
const massKg = ref(0);
const presetKg = ref(0);
const temperature = ref(null);
const flowKgh = ref(0);
const density = ref(null);

const TEMP_HISTORY_MAX = 30;
const temperatureHistory = ref([]);
const temperatureLabels = ref([]);
const temperatureAlarms = ref([]);

/** Orden finalizada o cerrada: el gráfico de temperatura se conserva como historial de la carga */
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
    const terminada = getEstadoOrden(data) != null && ["FINALIZADA", "CERRADA_PARA_CARGA"].includes((getEstadoOrden(data) ?? "").toString().toUpperCase().trim());
    if (!terminada || temperatureHistory.value.length === 0) {
      appendTemperatureSample(new Date().toLocaleTimeString(), temperature.value);
    }
  }
  // Si el backend marca alarma activada pero la tabla está vacía, añadir una fila para que coincida
  if (isAlarmaActivada(data) && temperature.value != null && temperatureAlarms.value.length === 0) {
    const umbral = getTemperaturaUmbral(data);
    temperatureAlarms.value = [
      {
        at: new Date().toISOString(),
        value: temperature.value,
        umbral: umbral != null ? umbral : 0,
      },
    ];
  }
}

/** Convierte historial de datos de carga del backend en labels y valores para el gráfico de temperatura */
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

const load = async () => {
  error.value = "";
  try {
    const data = await OrdersService.getByNumeroOrden(numeroOrden);
    applyOrderToState(data);
    const estado = (getEstadoOrden(data) ?? "").toString().toUpperCase().trim();
    const terminada = estado === "FINALIZADA" || estado === "CERRADA_PARA_CARGA";
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
      error.value =
        "Acceso denegado (403). El servidor no permite ver el detalle de esta orden. Revisa en el backend que GET /api/v1/orden/{id} esté permitido para tu rol.";
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
    // Carga terminada: conservar todo el historial (gráfico de cómo se fue cargando)
    temperatureLabels.value = [...temperatureLabels.value, label];
    temperatureHistory.value = [...temperatureHistory.value, v];
  } else {
    // Durante la carga: ventana móvil de los últimos puntos
    temperatureLabels.value = [...temperatureLabels.value.slice(-(TEMP_HISTORY_MAX - 1)), label];
    temperatureHistory.value = [...temperatureHistory.value.slice(-(TEMP_HISTORY_MAX - 1)), v];
  }
}

const umbralTemp = computed(() => getTemperaturaUmbral(order.value));

function checkTemperatureAlarm(value) {
  const umbral = umbralTemp.value;
  if (umbral == null || value == null) return;
  const v = Number(value);
  if (v > umbral) {
    temperatureAlarms.value = [
      { at: new Date().toISOString(), value: v, umbral },
      ...temperatureAlarms.value.slice(0, 49),
    ];
  }
}

onMounted(async () => {
  await load();
  // Polling para masa, caudal, densidad (solo si ya tenemos la orden)
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
      checkTemperatureAlarm(value);
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

const etaSeconds = computed(() => {
  const remaining = Math.max(0, presetKg.value - massKg.value);
  if (!flowKgh.value || remaining === 0) return null;
  return (remaining / flowKgh.value) * 3600;
});

const etaFormatted = computed(() => {
  const s = etaSeconds.value;
  if (s == null) return "—";
  const total = Math.floor(s);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}m ${ss}s`;
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
  animation: { duration: 300 },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: "rgba(255,255,255,0.06)" },
      ticks: { color: "rgba(255,255,255,0.7)" },
    },
    x: {
      grid: { color: "rgba(255,255,255,0.06)" },
      ticks: { color: "rgba(255,255,255,0.6)", maxTicksLimit: 8 },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(17,24,39,0.95)",
      titleColor: "#e5e7eb",
      bodyColor: "#9ca3af",
    },
  },
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
        <div
          v-if="error"
          class="mx-4 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200"
        >
          {{ error }}
        </div>

        <div v-if="order" class="mx-4 space-y-6 py-6">
          <!-- Header -->
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-medium uppercase tracking-wider text-gray-500">Orden</p>
              <h1 class="text-3xl font-bold tracking-tight text-white">
                #{{ getNumeroOrden(order) }}
              </h1>
              <div class="mt-2 flex flex-wrap items-center gap-3">
                <span
                  class="rounded-lg border px-2 py-1 text-xs"
                  :class="statusMeta(getEstadoOrden(order)).cls"
                >
                  <span
                    v-if="isAlarmaActivada(order)"
                    class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400"
                    title="Alarma activada"
                  />
                  {{ statusMeta(getEstadoOrden(order)).label }}
                </span>
                <span class="text-sm text-gray-400">Camión: {{ getPatente(order) ?? "—" }}</span>
                <span class="text-sm text-gray-400">Cliente: {{ getClienteNombre(order) ?? "—" }}</span>
                <span v-if="getProductoNombre(order)" class="text-sm text-gray-400">
                  Producto: {{ getProductoNombre(order) }}
                </span>
                <span v-if="getChoferNombre(order)" class="text-sm text-gray-400">
                  Chofer: {{ getChoferNombre(order) }}
                </span>
                <span
                  v-if="wsConnected"
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Temperatura en vivo
                </span>
              </div>
            </div>
          </div>

          <!-- Widgets circulares -->
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Progreso de Carga
              </p>
              <div class="relative mx-auto flex h-44 w-44 items-center justify-center">
                <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    class="text-white/10"
                    stroke="currentColor"
                    stroke-width="2.5"
                    fill="none"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                  <path
                    class="text-blue-400 transition-all duration-500"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-dasharray="100"
                    :stroke-dashoffset="100 - progress"
                    stroke-linecap="round"
                    fill="none"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                </svg>
                <div class="absolute flex flex-col items-center">
                  <span class="text-3xl font-bold text-white">{{ progress.toFixed(1) }}%</span>
                  <span class="text-xs text-gray-400"
                    >{{ fmt(massKg, " kg") }} / {{ fmt(presetKg, " kg") }}</span
                  >
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                ETA / Tiempo estimado
              </p>
              <div class="relative mx-auto flex h-44 w-44 items-center justify-center">
                <svg class="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    class="text-white/10"
                    stroke="currentColor"
                    stroke-width="2.5"
                    fill="none"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                  <path
                    class="text-cyan-400 transition-all duration-500"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-dasharray="100"
                    :stroke-dashoffset="100 - etaCirclePercent"
                    stroke-linecap="round"
                    fill="none"
                    d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31"
                  />
                </svg>
                <div class="absolute flex flex-col items-center">
                  <span class="text-2xl font-bold text-white">{{ etaFormatted }}</span>
                  <span class="text-xs text-gray-400">restante</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Gráfico Temperatura -->
          <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p class="mb-4 text-sm font-medium text-gray-300">
              {{ isCargaTerminada ? "Temperatura durante la carga" : "Temperatura en tiempo real" }}
            </p>
            <div class="h-64">
              <Line :data="chartData" :options="chartOptions" />
            </div>
          </div>

          <!-- Métricas -->
          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p class="text-xs text-gray-500">Masa acumulada</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ fmt(massKg, " kg") }}</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p class="text-xs text-gray-500">Caudal</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ fmt(flowKgh, " kg/h") }}</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p class="text-xs text-gray-500">Temperatura</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ fmt(temperature, " °C") }}</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p class="text-xs text-gray-500">Densidad</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ fmt(density) }}</p>
            </div>
          </div>

          <!-- Alarmas de Temperatura -->
          <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div class="border-b border-white/10 px-5 py-4">
              <h2 class="text-sm font-semibold text-gray-200">Alarmas de Temperatura</h2>
              <p class="text-xs text-gray-500">
                Umbral producto: {{ umbralTemp != null ? umbralTemp + " °C" : "—" }}
                <span v-if="isAlarmaActivada(order)" class="ml-2 text-red-300">(alarma activada)</span>
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-black/30 text-gray-400">
                  <tr>
                    <th class="px-5 py-3 text-left">Fecha / Hora</th>
                    <th class="px-5 py-3 text-left">Temperatura</th>
                    <th class="px-5 py-3 text-left">Umbral</th>
                    <th class="px-5 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(alarm, i) in temperatureAlarms"
                    :key="i"
                    class="border-t border-white/10 bg-red-500/10 text-red-200"
                  >
                    <td class="px-5 py-3 font-mono text-xs">
                      {{ new Date(alarm.at).toLocaleString() }}
                    </td>
                    <td class="px-5 py-3 font-semibold">{{ alarm.value }} °C</td>
                    <td class="px-5 py-3">{{ alarm.umbral }} °C</td>
                    <td class="px-5 py-3">
                      <span class="rounded bg-red-500/30 px-2 py-0.5 text-xs">Superado</span>
                    </td>
                  </tr>
                  <tr v-if="temperatureAlarms.length === 0">
                    <td colspan="4" class="px-5 py-8 text-center text-gray-500">
                      Sin alarmas registradas
                    </td>
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
