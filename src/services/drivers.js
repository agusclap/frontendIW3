import { api } from "./api";

export const DriversService = {
  async list() {
    const { data } = await api.get("/choferes");
    return data;
  },
};
