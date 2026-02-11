import { api } from "./api";

export const ProductsService = {
  async list(cacheBust = false) {
    const url = cacheBust ? `/products?_=${Date.now()}` : "/products";
    const { data } = await api.get(url);
    return data;
  },

  async get(id) {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },

  async create(product) {
    const { data } = await api.post("/products", product);
    return data;
  },

  /**
   * Actualiza un producto. Usa PUT /products/{id} (id en la URL).
   * Body: solo nombre, descripcion, temperatura_umbral (sin id).
   */
  async update(product) {
    const id = product?.id;
    const numId = id != null && id !== "" ? Number(id) : null;
    if (numId == null || Number.isNaN(numId) || numId <= 0) {
      throw new Error("ID de producto no válido para actualizar");
    }
    const body = {
      nombre: product?.nombre ?? "",
      descripcion: product?.descripcion ?? "",
      temperatura_umbral: product?.temperatura_umbral ?? null,
    };
    await api.put(`/products/${numId}`, body);
},

  async remove(id) {
    await api.delete(`/products/${id}`);
  },
};
