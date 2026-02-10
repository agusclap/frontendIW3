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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import AppLayout from "../layouts/AppLayout.vue";
import { OrdersService } from "../services/orders";

import { AlarmsService } from "../services/alarms";
import { createCargaSubscription } from "../services/websocket";
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
const downloadingConciliacion = ref(false);
const downloadError = ref("");

//  PASO 2 — Crear estado para alarmas
const alarms = ref([]);

const massKg = ref(0);
const presetKg = ref(0);
const temperature = ref(null);
const flowKgh = ref(0);
const density = ref(null);

const HISTORY_MAX = 30;
const temperatureHistory = ref([]);
const temperatureLabels = ref([]);
const densityHistory = ref([]);
const densityLabels = ref([]);
const flowHistory = ref([]);
const flowLabels = ref([]);

/** Historial completo de carga (del API) para órdenes finalizadas; usado para la tabla de detalles. */
const historialCarga = ref([]);

const isCargaTerminada = computed(() => {
  const estado = (getEstadoOrden(order.value) ?? "").toString().toUpperCase().trim();
  return estado === "FINALIZADA" || estado === "CERRADA_PARA_CARGA";
});
const isOrdenFinalizada = computed(() => {
  const estado = (getEstadoOrden(order.value) ?? "").toString().toUpperCase().trim();
  return estado === "FINALIZADA";
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
  const t = new Date().toLocaleTimeString();
  const terminada = isCargaTerminada.value;
  if (!terminada) {
    // Carga en curso: cada poll añade una fila con temp, densidad y caudal (mismo label) para que la tabla no crezca solo por temperatura.
    if (temperature.value != null) appendTemperatureSample(t, temperature.value);
    if (density.value != null) appendDensitySample(t, density.value);
    if (flowKgh.value != null) appendFlowSample(t, flowKgh.value);
  } else {
    // Orden finalizada: solo rellenar si los historiales están vacíos (el historial completo viene de getHistorialCarga).
    if (temperature.value != null && temperatureHistory.value.length === 0) appendTemperatureSample(t, temperature.value);
    if (density.value != null && densityHistory.value.length === 0) appendDensitySample(t, density.value);
    if (flowKgh.value != null && flowHistory.value.length === 0) appendFlowSample(t, flowKgh.value);
  }
}

/** Construye { labels, values } desde historial para un campo numérico (temperatura, densidad, caudal). */
function buildChartFromHistorial(items, fieldKey) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const key = fieldKey === "temperatura" ? "temperatura" : fieldKey === "densidad" ? "densidad" : "caudal";
  const withTime = items
    .map((item) => {
      const raw = item[key] ?? item[key === "temperatura" ? "temp" : key];
      if (raw == null || Number.isNaN(Number(raw))) return null;
      let ms = null;
      if (item.fechaHora) ms = new Date(item.fechaHora).getTime();
      else if (item.timestamp != null) ms = item.timestamp > 1e12 ? item.timestamp : item.timestamp * 1000;
      else if (item.fecha) ms = new Date(item.fecha).getTime();
      return { ms: ms ?? 0, value: Number(raw) };
    })
    .filter(Boolean);
  if (withTime.length === 0) return null;
  withTime.sort((a, b) => a.ms - b.ms);
  return {
    labels: withTime.map((x) => (x.ms ? new Date(x.ms).toLocaleTimeString() : "")),
    values: withTime.map((x) => x.value),
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
      historialCarga.value = Array.isArray(historial) ? historial : [];
      const chartTemp = buildChartFromHistorial(historial, "temperatura");
      if (chartTemp?.values?.length) {
        temperatureLabels.value = chartTemp.labels;
        temperatureHistory.value = chartTemp.values;
      }
      const chartDens = buildChartFromHistorial(historial, "densidad");
      if (chartDens?.values?.length) {
        densityLabels.value = chartDens.labels;
        densityHistory.value = chartDens.values;
      }
      const chartCaudal = buildChartFromHistorial(historial, "caudal");
      if (chartCaudal?.values?.length) {
        flowLabels.value = chartCaudal.labels;
        flowHistory.value = chartCaudal.values;
      }
    } else {
      historialCarga.value = [];
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

const fmtPdf = (n, unit = "", maxDecimals = 2) => {
  const v = Number(n);
  if (n === null || n === undefined || Number.isNaN(v)) return "—";
  const formatted = v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
  return `${formatted}${unit}`;
};

const downloadConciliacion = async () => {
  if (downloadingConciliacion.value) return;
  if (!isOrdenFinalizada.value) {
    downloadError.value = "La conciliacion se habilita cuando la orden está finalizada.";
    return;
  }
  downloadError.value = "";
  downloadingConciliacion.value = true;
  try {
    const num = getNumeroOrden(order.value) ?? numeroOrden;
    if (!num) throw new Error("Número de orden inválido.");
    const conciliacion = await OrdersService.getConciliacion(num);
    if (!conciliacion) throw new Error("No se recibió la conciliación.");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const headerHeight = 72;

    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, pageWidth, headerHeight, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Conciliacion de carga", marginX, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Orden #${num}`, marginX, 50);
    doc.setTextColor(31, 41, 55);

    let y = headerHeight + 12;

    const fechaPesaje = conciliacion.fechaPesajeFinal
      ? new Date(conciliacion.fechaPesajeFinal).toLocaleString()
      : "—";
    const fechaGenerado = new Date().toLocaleString();

    const infoRows = [
      ["Orden", String(num)],
      ["Cliente", getClienteNombre(order.value) ?? "—"],
      ["Producto", getProductoNombre(order.value) ?? "—"],
      ["Chofer", getChoferNombre(order.value) ?? "—"],
      ["Camión", getPatente(order.value) ?? "—"],
      ["Fecha pesaje final", fechaPesaje],
      ["Generado", fechaGenerado],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Datos de la orden", ""]],
      body: infoRows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
      theme: "striped",
      margin: { left: marginX, right: marginX },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { cellWidth: "auto" },
      },
    });

    const startY = (doc.lastAutoTable?.finalY ?? y) + 14;
    const dataRows = [
      ["Tara", fmtPdf(conciliacion.tara, " kg")],
      ["Peso final", fmtPdf(conciliacion.pesoFinal, " kg")],
      ["Producto cargado", fmtPdf(conciliacion.productoCargado, " kg")],
      ["Neto por balanza", fmtPdf(conciliacion.netoPorBalanza, " kg")],
      ["Diferencia", fmtPdf(conciliacion.diferencia, " kg")],
      ["Promedio temperatura", fmtPdf(conciliacion.promedioTemperatura, " °C", 1)],
      ["Promedio densidad", fmtPdf(conciliacion.promedioDensidad, "", 3)],
      ["Promedio caudal", fmtPdf(conciliacion.promedioCaudal, " kg/h")],
    ];

    autoTable(doc, {
      startY,
      head: [["Resumen de conciliacion", ""]],
      body: dataRows,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
      theme: "striped",
      margin: { left: marginX, right: marginX },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { cellWidth: "auto" },
      },
    });

    doc.save(`conciliacion-orden-${num}.pdf`);
  } catch (e) {
    console.error("Error descargando conciliación", e);
    downloadError.value = e?.message || "No se pudo descargar la conciliación.";
  } finally {
    downloadingConciliacion.value = false;
  }
};

function appendSample(labelsRef, valuesRef, label, value, maxPoints) {
  const v = Number(value);
  if (Number.isNaN(v)) return;
  if (isCargaTerminada.value) {
    labelsRef.value = [...labelsRef.value, label];
    valuesRef.value = [...valuesRef.value, v];
  } else {
    labelsRef.value = [...labelsRef.value.slice(-(maxPoints - 1)), label];
    valuesRef.value = [...valuesRef.value.slice(-(maxPoints - 1)), v];
  }
}
function appendTemperatureSample(label, value) {
  appendSample(temperatureLabels, temperatureHistory, label, value, HISTORY_MAX);
}
function appendDensitySample(label, value) {
  appendSample(densityLabels, densityHistory, label, value, HISTORY_MAX);
}
function appendFlowSample(label, value) {
  appendSample(flowLabels, flowHistory, label, value, HISTORY_MAX);
}

onMounted(async () => {
  await load();
  pollTimer = setInterval(() => {
    if (order.value) load();
  }, 5000);

  const token = localStorage.getItem("token");
  // Timestamp compartido por "batch": los 3 mensajes (temp, densidad, caudal) que llegan juntos
  // usan el mismo label para quedar en la misma fila de la tabla y alineados en los gráficos.
  const BATCH_MS = 2000;
  let batchLabel = "";
  let batchTime = 0;
  function getBatchLabel() {
    const now = Date.now();
    if (now - batchTime > BATCH_MS || !batchLabel) {
      batchLabel = new Date().toLocaleTimeString();
      batchTime = now;
    }
    return batchLabel;
  }
  const ingest = (loc, msg, data, hypothesisId) => {
    const payload = { location: loc, message: msg, data: data ?? {}, timestamp: Date.now(), hypothesisId };
    console.warn("[DEBUG-WS]", JSON.stringify(payload));
    fetch('http://127.0.0.1:7246/ingest/e8eacad5-e1b3-4f2d-a3a7-5d2583984d88', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  };
  unsubscribeWs = createCargaSubscription({
    token: token || undefined,
    onTemperatura: (value) => {
      wsConnected.value = true;
      temperature.value = value;
      appendTemperatureSample(getBatchLabel(), value);
    },
    onDensidad: (value) => {
      // #region agent log
      ingest("OrderDetailView.vue:onDensidad", "callback onDensidad ejecutado", { value, type: typeof value }, "H3");
      // #endregion
      wsConnected.value = true;
      density.value = value;
      appendDensitySample(getBatchLabel(), value);
      // #region agent log
      ingest("OrderDetailView.vue:onDensidad", "después de append", { densityHistoryLen: densityHistory.value.length, densityLabelsLen: densityLabels.value.length }, "H5");
      // #endregion
    },
    onCaudal: (value) => {
      // #region agent log
      ingest("OrderDetailView.vue:onCaudal", "callback onCaudal ejecutado", { value, type: typeof value }, "H3");
      // #endregion
      wsConnected.value = true;
      flowKgh.value = value;
      appendFlowSample(getBatchLabel(), value);
      // #region agent log
      ingest("OrderDetailView.vue:onCaudal", "después de append", { flowHistoryLen: flowHistory.value.length, flowLabelsLen: flowLabels.value.length }, "H5");
      // #endregion
    },
    onConnect: () => { wsConnected.value = true; },
    onDisconnect: () => { wsConnected.value = false; },
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

const chartDataTemperatura = computed(() => ({
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
const chartDataDensidad = computed(() => ({
  labels: densityLabels.value,
  datasets: [
    {
      label: "Densidad",
      data: densityHistory.value,
      borderColor: "rgb(168, 85, 247)",
      backgroundColor: "rgba(168, 85, 247, 0.1)",
      fill: true,
      tension: 0.3,
    },
  ],
}));
const chartDataCaudal = computed(() => ({
  labels: flowLabels.value,
  datasets: [
    {
      label: "Caudal (kg/h)",
      data: flowHistory.value,
      borderColor: "rgb(34, 197, 94)",
      backgroundColor: "rgba(34, 197, 94, 0.1)",
      fill: true,
      tension: 0.3,
    },
  ],
}));

/** Filas para la tabla de detalles: historial del API (orden finalizada) o datos en vivo (carga en curso). */
const detallesTableRows = computed(() => {
  if (isCargaTerminada.value && historialCarga.value.length > 0) {
    return [...historialCarga.value].sort((a, b) => {
      const ta = a.fechaHora ? new Date(a.fechaHora).getTime() : 0;
      const tb = b.fechaHora ? new Date(b.fechaHora).getTime() : 0;
      return ta - tb;
    });
  }
  const len = temperatureLabels.value.length;
  if (len === 0) return [];
  return Array.from({ length: len }, (_, i) => ({
    fechaHora: temperatureLabels.value[i],
    temperatura: temperatureHistory.value[i] ?? null,
    densidad: densityHistory.value[i] ?? null,
    caudal: flowHistory.value[i] ?? null,
    masa: i === len - 1 ? massKg.value : null,
  }));
});

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
            <div class="flex flex-col gap-2 md:items-end">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="downloadingConciliacion || !isOrdenFinalizada"
                @click="downloadConciliacion"
              >
                {{ downloadingConciliacion ? "Generando PDF..." : "Descargar conciliación" }}
              </button>
              <p v-if="downloadError" class="text-xs text-red-300">{{ downloadError }}</p>
              <p v-else-if="!isOrdenFinalizada" class="text-xs text-gray-400">
                Disponible cuando la orden esté finalizada.
              </p>
            </div>
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

          <div class="space-y-6">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-sm font-medium text-gray-300">
                {{ isCargaTerminada ? "Temperatura durante la carga" : "Temperatura en tiempo real" }}
              </p>
              <div class="h-64">
                <Line :data="chartDataTemperatura" :options="chartOptions" />
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-sm font-medium text-gray-300">
                {{ isCargaTerminada ? "Densidad durante la carga" : "Densidad en tiempo real" }}
              </p>
              <div class="h-64">
                <Line :data="chartDataDensidad" :options="chartOptions" />
              </div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p class="mb-4 text-sm font-medium text-gray-300">
                {{ isCargaTerminada ? "Caudal durante la carga" : "Caudal en tiempo real (kg/h)" }}
              </p>
              <div class="h-64">
                <Line :data="chartDataCaudal" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div class="border-b border-white/10 px-5 py-4">
              <h2 class="text-sm font-semibold text-gray-200">Detalles de carga</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ isCargaTerminada ? "Historial completo de la carga" : "Últimos datos en tiempo real" }}
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-black/30 text-gray-400">
                  <tr>
                    <th class="px-5 py-3 text-left font-medium">Fecha / Hora</th>
                    <th class="px-5 py-3 text-left font-medium">Temperatura (°C)</th>
                    <th class="px-5 py-3 text-left font-medium">Densidad</th>
                    <th class="px-5 py-3 text-left font-medium">Caudal (kg/h)</th>
                    <th class="px-5 py-3 text-left font-medium">Masa (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in detallesTableRows"
                    :key="idx"
                    class="border-t border-white/10 text-gray-300 hover:bg-white/5"
                  >
                    <td class="px-5 py-3 font-mono text-xs">
                      {{ row.fechaHora ? (row.fechaHora.includes('T') ? new Date(row.fechaHora).toLocaleString() : row.fechaHora) : "—" }}
                    </td>
                    <td class="px-5 py-3">{{ fmt(row.temperatura, " °C") }}</td>
                    <td class="px-5 py-3">{{ fmt(row.densidad) }}</td>
                    <td class="px-5 py-3">{{ fmt(row.caudal, " kg/h") }}</td>
                    <td class="px-5 py-3">{{ fmt(row.masa, " kg") }}</td>
                  </tr>
                  <tr v-if="detallesTableRows.length === 0">
                    <td colspan="5" class="px-5 py-8 text-center text-gray-500">
                      Aún no hay datos de carga. Los detalles aparecerán en tiempo real o al finalizar la orden.
                    </td>
                  </tr>
                </tbody>
              </table>
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
