import { api } from "./api";

export const OrdersService = {
  list: async () => (await api.get("/orden")).data,
  /** Detalle por número de orden. El backend solo expone GET /orden/by-number/{numeroOrden} (no GET /orden/{id}). */
  getByNumeroOrden: async (numeroOrden) =>
    (await api.get(`/orden/by-number/${numeroOrden}`)).data,

   async create(order) {
    const { data } = await api.post("/orden/b2b", order);
    return data;
  },
  /**
   * Historial de datos de carga de la orden (cada envío POST /datos-carga).
   * Esperado: array de { fechaHora?, timestamp?, temperatura, masa?, densidad?, caudal? } ordenable por tiempo.
   * Si el backend no expone este endpoint (404), se ignora y el gráfico usa solo lo en vivo.
   */
  getHistorialCarga: async (numeroOrden) => {
    try {
      const res = await api.get(`/orden/by-number/${numeroOrden}/historial-carga`);
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      if (e?.response?.status === 404) return [];
      throw e;
    }
  },

    // Dentro de OrdersService
  async getConciliacion(numeroOrden) {
    const { data } = await api.get(`/orden/conciliacion`, {
      params: { numeroOrden }
    });
    return data;
  },
};
