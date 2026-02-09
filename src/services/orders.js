import { api } from "./api";

export const OrdersService = {
  list: async () => (await api.get("/orden")).data,
  /** Detalle por ID (requiere endpoint GET /orden/{id} en el backend) */
  getById: async (id) => (await api.get(`/orden/${id}`)).data,
  /** Detalle por número de orden (usa GET /orden/by-number/{numeroOrden} que ya existe en el backend) */
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
};
