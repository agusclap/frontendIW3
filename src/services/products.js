import { api } from "./api";

export const ProductsService = {
  async list() {
    const { data } = await api.get("/products");
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

  async update(product) {
    await api.put("/products", product);
  },

  async remove(id) {
    await api.delete(`/products/${id}`);
  },
};
