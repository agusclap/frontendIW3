/** Acepta estadoOrden (backend) o status */
export function statusMeta(status) {
  const s = (status ?? "").toString().toUpperCase().trim();

  const map = {
    PENDIENTE_PESAJE: { label: "Pendiente pesaje", cls: "bg-gray-500/10 text-gray-200 border-gray-500/30" },
    PENDIENTE_PESAJE_INICIAL: { label: "Pendiente pesaje inicial", cls: "bg-gray-500/10 text-gray-200 border-gray-500/30" },
    PESAJE_INICIAL: { label: "Pesaje inicial", cls: "bg-indigo-500/10 text-indigo-200 border-indigo-500/30" },
    CON_PESAJE_INICIAL: { label: "Con pesaje inicial", cls: "bg-indigo-500/10 text-indigo-200 border-indigo-500/30" },
    CARGANDO: { label: "Cargando", cls: "bg-blue-500/10 text-blue-200 border-blue-500/30" },
    CERRADA_PARA_CARGA: { label: "Cerrada para carga", cls: "bg-amber-500/10 text-amber-200 border-amber-500/30" },
    FINALIZADA: { label: "Finalizada", cls: "bg-green-500/10 text-green-200 border-green-500/30" },
    ALARMA_TEMPERATURA: { label: "Alarma temp", cls: "bg-red-500/10 text-red-200 border-red-500/30" },
  };

  return map[s] || { label: status ?? "—", cls: "bg-white/5 text-gray-200 border-white/10" };
}
