/**
 * Contrato de datos del backend IW3.
 * Orden: estadoOrden, numeroOrden, producto, camion, chofer, cliente, preset,
 * ultimaMasaAcumulada, ultimaDensidad, ultimaTemperatura, ultimaFlowRate, alarmaActivada, ...
 */

/** Estado de la orden (backend: estadoOrden) */
export function getEstadoOrden(order) {
  return order?.estadoOrden ?? order?.status ?? null;
}

/** Número de orden (backend: numeroOrden) */
export function getNumeroOrden(order) {
  return order?.numeroOrden ?? order?.number ?? order?.id;
}

/** Patente del camión (backend: camion.patente) */
export function getPatente(order) {
  return order?.camion?.patente ?? order?.truck?.plate ?? null;
}

/** Nombre del cliente (backend: cliente.nombreEmpresa) */
export function getClienteNombre(order) {
  return order?.cliente?.nombreEmpresa ?? order?.client?.name ?? order?.cliente?.name ?? null;
}

/** Preset en kg (backend: preset) */
export function getPreset(order) {
  const v = order?.preset ?? order?.presetKg ?? order?.monitor?.presetKg;
  return v != null ? Number(v) : 0;
}

/** Masa acumulada (backend: ultimaMasaAcumulada) */
export function getMasa(order) {
  const v = order?.ultimaMasaAcumulada ?? order?.massKg ?? order?.monitor?.massKg;
  return v != null ? Number(v) : 0;
}

/** Temperatura (backend: ultimaTemperatura) */
export function getTemperatura(order) {
  const v = order?.ultimaTemperatura ?? order?.temperature ?? order?.monitor?.temperature;
  return v != null ? Number(v) : null;
}

/** Densidad (backend: ultimaDensidad) */
export function getDensidad(order) {
  const v = order?.ultimaDensidad ?? order?.density ?? order?.monitor?.density;
  return v != null ? Number(v) : null;
}

/** Caudal / flow rate (backend: ultimaFlowRate) */
export function getCaudal(order) {
  const v = order?.ultimaFlowRate ?? order?.flowKgh ?? order?.monitor?.flowKgh;
  return v != null ? Number(v) : 0;
}

/** Umbral de temperatura del producto (backend: producto.temperatura_umbral) */
export function getTemperaturaUmbral(order) {
  const v = order?.producto?.temperatura_umbral ?? order?.product?.temperatura_umbral ?? order?.temperaturaUmbral;
  return v != null ? Number(v) : null;
}

/** Si la alarma está activada (backend: alarmaActivada) */
export function isAlarmaActivada(order) {
  return !!order?.alarmaActivada;
}

/** Nombre del producto (backend: producto.nombre) */
export function getProductoNombre(order) {
  return order?.producto?.nombre ?? order?.product?.nombre ?? null;
}

/** Chofer (backend: chofer) - nombre completo */
export function getChoferNombre(order) {
  const c = order?.chofer;
  if (!c) return null;
  const n = c.nombre ?? "";
  const a = c.apellido ?? "";
  return [n, a].filter(Boolean).join(" ") || null;
}
