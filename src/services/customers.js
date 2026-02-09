import { api } from "./api";

export const CustomersService = {
  async list() {
    const { data } = await api.get("/clientes");
    return data;
  },
};
